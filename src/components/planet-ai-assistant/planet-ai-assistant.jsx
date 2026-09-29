/* eslint-disable react/jsx-no-literals, react/jsx-no-bind, react/jsx-handler-names, react/jsx-max-props-per-line */
import PropTypes from 'prop-types';
import React from 'react';
import {
    CheckCircle2Icon,
    CircleXIcon,
    Clock3Icon,
    HistoryIcon,
    LoaderCircleIcon,
    PlusIcon,
    SendIcon,
    SparklesIcon
} from 'lucide-react';
import VM from 'scratch-vm';

import DockPanel from '../editor-dock/dock-panel.jsx';
import {
    createAssistantConversation,
    listAssistantConversations,
    loadAssistantMessages,
    sendAssistantMessage,
    submitAssistantToolResults
} from '../../lib/planet-ai-assistant-api';
import {
    buildAssistantEditorContext,
    executeAssistantTool,
    installAssistantFloatingInterface,
    previewAssistantTool
} from '../../lib/planet-ai-tools';
import {PLANET_AI_ASSISTANT_STATE_EVENT} from '../../lib/editor-dock-events';

import styles from './planet-ai-assistant.css';

const STARTER_PROMPTS = [
    '让角色点击绿旗后移动并旋转',
    '检查当前脚本有没有逻辑问题',
    '帮我设计一个简单的得分机制'
];

const projectIdFromRoute = () => {
    const match = location.pathname.match(/^\/create\/(\d+)\/(?:editor|fullscreen)\/?$/);
    return match ? match[1] : null;
};

const localMessage = (role, content) => ({
    id: `local-${Date.now()}-${Math.random()}`,
    role,
    content,
    toolCalls: []
});

const toolStatesFromMessages = messages => messages.reduce((states, message) => {
    if (message.role !== 'TOOL' || !Array.isArray(message.toolResult)) return states;
    message.toolResult.forEach(result => {
        states[result.toolCallId] = String(result.status || 'FAILED').toLowerCase();
    });
    return states;
}, {});

class PlanetAiAssistant extends React.Component {
    constructor (props) {
        super(props);
        this.projectId = projectIdFromRoute();
        this.state = {
            open: false,
            historyOpen: false,
            loadingHistory: false,
            sending: false,
            conversations: [],
            conversationId: null,
            messages: [],
            input: '',
            error: null,
            toolStates: {}
        };
        this.messagesEnd = React.createRef();
        this.handleSend = this.handleSend.bind(this);
        this.handleInputKeyDown = this.handleInputKeyDown.bind(this);
        this.handleToggleHistory = this.handleToggleHistory.bind(this);
        this.open = this.open.bind(this);
        this.close = this.close.bind(this);
        this.toggle = this.toggle.bind(this);
        this.newConversation = this.newConversation.bind(this);
        this.publishDockState = this.publishDockState.bind(this);
    }

    componentDidMount () {
        this.uninstallFloatingInterface = installAssistantFloatingInterface({
            open: this.open,
            close: this.close,
            toggle: this.toggle,
            newConversation: this.newConversation
        });
        this.publishDockState();
    }

    componentDidUpdate (previousProps, previousState) {
        if (this.state.messages !== previousState.messages ||
            this.state.toolStates !== previousState.toolStates) {
            this.scrollToLatest();
        }
        if (this.state.open !== previousState.open) this.publishDockState();
    }

    componentWillUnmount () {
        if (this.uninstallFloatingInterface) this.uninstallFloatingInterface();
    }

    open () {
        this.setState({open: true});
        if (this.state.conversations.length === 0 && !this.state.loadingHistory) {
            this.loadHistory();
        }
    }

    close () {
        this.setState({open: false, historyOpen: false});
    }

    toggle () {
        if (this.state.open) this.close();
        else this.open();
    }

    publishDockState () {
        window.dispatchEvent(new CustomEvent(PLANET_AI_ASSISTANT_STATE_EVENT, {
            detail: {open: this.state.open}
        }));
    }

    handleToggleHistory () {
        this.setState(previous => ({
            historyOpen: !previous.historyOpen
        }));
    }

    async loadHistory () {
        this.setState({loadingHistory: true, error: null});
        try {
            const page = await listAssistantConversations(this.projectId);
            const conversations = page.items || [];
            const saved = localStorage.getItem(this.storageKey());
            const selected = conversations.find(item => item.id === saved) || conversations[0];
            this.setState({
                conversations,
                loadingHistory: false,
                conversationId: selected ? selected.id : null
            });
            if (selected) await this.selectConversation(selected.id);
        } catch (error) {
            this.setState({loadingHistory: false, error: error.message});
        }
    }

    async newConversation () {
        this.setState({sending: true, error: null, historyOpen: false});
        try {
            const conversation = await createAssistantConversation(this.projectId);
            this.rememberConversation(conversation.id);
            this.setState(previous => ({
                sending: false,
                conversationId: conversation.id,
                messages: [],
                conversations: [conversation, ...previous.conversations.filter(
                    item => item.id !== conversation.id
                )]
            }));
            return conversation;
        } catch (error) {
            this.setState({sending: false, error: error.message});
            throw error;
        }
    }

    async selectConversation (conversationId) {
        this.setState({conversationId, messages: [], loadingHistory: true, error: null});
        this.rememberConversation(conversationId);
        try {
            const messages = await loadAssistantMessages(conversationId);
            this.setState({
                messages,
                toolStates: toolStatesFromMessages(messages),
                loadingHistory: false,
                historyOpen: false
            });
        } catch (error) {
            this.setState({loadingHistory: false, error: error.message});
        }
    }

    async ensureConversation () {
        if (this.state.conversationId) return this.state.conversationId;
        const conversation = await this.newConversation();
        return conversation.id;
    }

    async handleSend () {
        const content = this.state.input.trim();
        if (!content || this.state.sending) return;
        this.setState(previous => ({
            input: '',
            sending: true,
            error: null,
            messages: [...previous.messages, localMessage('USER', content)]
        }));
        try {
            const conversationId = await this.ensureConversation();
            const turn = await sendAssistantMessage(
                conversationId,
                content,
                buildAssistantEditorContext(this.props.vm)
            );
            this.setState(previous => ({
                sending: false,
                messages: [...previous.messages.filter(message => !message.id.startsWith('local-')),
                    localMessage('USER', content), turn.message]
            }));
            this.refreshConversationList();
        } catch (error) {
            this.setState({sending: false, error: error.message, input: content});
        }
    }

    handleInputKeyDown (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.handleSend();
        }
    }

    async handleTool (message, toolCall, accepted) {
        if (this.state.toolStates[toolCall.id] === 'running') return;
        this.setToolState(toolCall.id, 'running');
        let result;
        try {
            if (accepted) {
                result = executeAssistantTool(this.props.vm, toolCall);
            } else {
                result = {status: 'CANCELLED'};
            }
        } catch (error) {
            result = {status: 'FAILED', error: error.message};
        }
        this.setToolState(toolCall.id, result.status.toLowerCase());
        try {
            const turn = await submitAssistantToolResults(
                this.state.conversationId,
                message.id,
                [{
                    toolCallId: toolCall.id,
                    name: toolCall.name,
                    status: result.status,
                    result: result.status === 'SUCCEEDED' ? result : null,
                    error: result.error || null
                }],
                buildAssistantEditorContext(this.props.vm)
            );
            this.setState(previous => ({messages: [...previous.messages, turn.message]}));
        } catch (error) {
            this.setState({error: error.message});
        }
    }

    setToolState (toolCallId, value) {
        this.setState(previous => ({
            toolStates: {...previous.toolStates, [toolCallId]: value}
        }));
    }

    async refreshConversationList () {
        try {
            const page = await listAssistantConversations(this.projectId);
            this.setState({conversations: page.items || []});
        } catch (error) {
            // History refresh is best effort; the active turn has already been persisted.
        }
    }

    rememberConversation (id) {
        localStorage.setItem(this.storageKey(), id);
    }

    storageKey () {
        return `planet-ai-conversation:${this.projectId || 'local'}`;
    }

    scrollToLatest () {
        if (this.messagesEnd.current) {
            this.messagesEnd.current.scrollIntoView({block: 'nearest'});
        }
    }

    renderToolCall (message, toolCall) {
        let preview;
        let valid = true;
        try {
            preview = previewAssistantTool(this.props.vm, toolCall);
        } catch (error) {
            valid = false;
            preview = {title: '脚本计划需要重新生成', description: error.message};
        }
        const status = this.state.toolStates[toolCall.id];
        const StatusIcon = status === 'succeeded' ? CheckCircle2Icon :
            status === 'running' ? LoaderCircleIcon : CircleXIcon;
        return (
            <section className={styles.toolCard} key={toolCall.id} aria-label="AI 积木修改计划">
                <div className={styles.toolHeader}>
                    <span className={styles.toolGlyph}><SparklesIcon aria-hidden="true" /></span>
                    <div>
                        <div className={styles.toolEyebrow}>需要你的确认</div>
                        <strong>{preview.title}</strong>
                    </div>
                </div>
                <p>{preview.description}</p>
                <div className={styles.toolActions}>
                    <button
                        className={styles.secondaryButton}
                        disabled={Boolean(status)}
                        type="button"
                        onClick={() => this.handleTool(message, toolCall, false)}
                    >
                        暂不应用
                    </button>
                    <button
                        className={styles.primaryButton}
                        disabled={Boolean(status) || !valid}
                        type="button"
                        onClick={() => this.handleTool(message, toolCall, true)}
                    >
                        {status === 'running' ? '正在应用…' : '应用到编辑器'}
                    </button>
                </div>
                {status ? <div className={styles.toolStatus} data-status={status}>
                    <StatusIcon aria-hidden="true" />
                    <span>{status === 'running' ? '正在应用积木修改…' :
                        status === 'succeeded' ? '已添加，可使用编辑器撤销操作恢复。' :
                            status === 'cancelled' ? '已取消，没有修改编辑器。' : '应用失败，请重新规划。'}</span>
                </div> : null}
            </section>
        );
    }

    renderMessage (message) {
        if (message.role === 'TOOL') return null;
        const assistant = message.role === 'ASSISTANT';
        return (
            <article
                className={assistant ? styles.assistantMessage : styles.userMessage}
                key={message.id}
            >
                <div className={styles.messageLabel}>{assistant ? 'AI 助手' : '你'}</div>
                <div className={styles.messageBody}>{message.content}</div>
                {(message.toolCalls || []).map(toolCall => this.renderToolCall(message, toolCall))}
            </article>
        );
    }

    renderHistory () {
        if (!this.state.historyOpen) return null;
        return (
            <aside className={styles.history} aria-label="历史对话">
                <div className={styles.historyHeader}>
                    <strong>历史记录</strong>
                    <button type="button" onClick={this.newConversation}>
                        <PlusIcon aria-hidden="true" />
                        新对话
                    </button>
                </div>
                <div className={styles.historyList}>
                    {this.state.conversations.length ? this.state.conversations.map(item => (
                        <button
                            className={item.id === this.state.conversationId ? styles.historyActive : ''}
                            key={item.id}
                            type="button"
                            onClick={() => this.selectConversation(item.id)}
                        >
                            <span>{item.title}</span>
                            <small>{item.lastMessageAt ? new Date(item.lastMessageAt).toLocaleString() : '刚刚创建'}</small>
                        </button>
                    )) : <div className={styles.emptyHistory}>还没有历史对话</div>}
                </div>
            </aside>
        );
    }

    renderPanel () {
        return (
            <DockPanel
                actions={(
                    <button
                        aria-label="查看历史记录"
                        className={this.state.historyOpen ? styles.iconButtonActive : styles.iconButton}
                        title="历史记录"
                        type="button"
                        onClick={this.handleToggleHistory}
                    >
                        <HistoryIcon aria-hidden="true" />
                    </button>
                )}
                appearance="conversation"
                className={this.state.historyOpen ? styles.panelWithHistory : styles.panel}
                description="规划并搭建基础积木"
                dragLabel="拖动 AI 创作助手窗口"
                icon={SparklesIcon}
                leading={this.renderHistory()}
                onClose={this.close}
                panelId="ai"
                title="AI 创作助手"
            >
                <div className={styles.memoryBar}>
                    <span /> 每次发送都会读取最新工作台；项目目标会保存在当前历史记录中
                </div>
                <div className={styles.messages} aria-live="polite">
                    {this.state.messages.length ? this.state.messages.map(
                        message => this.renderMessage(message)
                    ) : (
                        <div className={styles.emptyState}>
                            <span className={styles.emptyIcon}><SparklesIcon aria-hidden="true" /></span>
                            <strong>从一个小目标开始</strong>
                            <p>我会读取当前角色与积木，再给出可确认的修改计划。</p>
                            <div className={styles.starterPrompts} aria-label="示例问题">
                                {STARTER_PROMPTS.map(prompt => (
                                    <button
                                        key={prompt}
                                        type="button"
                                        onClick={() => this.setState({input: prompt})}
                                    >
                                        <span>{prompt}</span>
                                        <span aria-hidden="true">↗</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {this.state.sending ? <div className={styles.thinking} role="status">
                        <span className={styles.pixelLoader} aria-hidden="true">
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(index => <i key={index} />)}
                        </span>
                        <span className={styles.thinkingCopy}>
                            <strong>正在构思</strong>
                            <small>读取工作台 · 整理积木计划</small>
                        </span>
                    </div> : null}
                    <div ref={this.messagesEnd} />
                </div>
                {this.state.error ? <div className={styles.error} role="alert">{this.state.error}</div> : null}
                <footer className={styles.composer}>
                    <div className={styles.composerMeta}>
                        <span><SparklesIcon aria-hidden="true" /> 当前工作台</span>
                        <span><Clock3Icon aria-hidden="true" /> 实时上下文</span>
                    </div>
                    <div className={styles.composerRow}>
                        <textarea
                            aria-label="告诉 AI 你想制作什么"
                            disabled={this.state.sending}
                            maxLength={2000}
                            placeholder="描述目标，或输入 @ 引用当前角色…"
                            rows={2}
                            value={this.state.input}
                            onChange={event => this.setState({input: event.target.value})}
                            onKeyDown={this.handleInputKeyDown}
                        />
                        <button
                            aria-label="发送消息"
                            className={styles.sendButton}
                            disabled={this.state.sending || !this.state.input.trim()}
                            type="button"
                            onClick={this.handleSend}
                        >
                            <SendIcon aria-hidden="true" />
                        </button>
                    </div>
                </footer>
                <div className={styles.disclaimer}>AI 可能会出错，应用前请检查积木计划。</div>
            </DockPanel>
        );
    }

    render () {
        if (!this.state.open) return null;
        return (
            <div className={styles.root}>
                {this.renderPanel()}
            </div>
        );
    }
}

PlanetAiAssistant.propTypes = {
    vm: PropTypes.instanceOf(VM).isRequired
};

export default PlanetAiAssistant;
