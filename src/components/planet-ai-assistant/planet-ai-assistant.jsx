/* eslint-disable react/jsx-no-literals, react/jsx-no-bind, react/jsx-handler-names, react/jsx-max-props-per-line */
import PropTypes from 'prop-types';
import React from 'react';
import VM from 'scratch-vm';

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

import styles from './planet-ai-assistant.css';

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
        this.open = this.open.bind(this);
        this.close = this.close.bind(this);
        this.toggle = this.toggle.bind(this);
        this.newConversation = this.newConversation.bind(this);
    }

    componentDidMount () {
        this.uninstallFloatingInterface = installAssistantFloatingInterface({
            open: this.open,
            close: this.close,
            toggle: this.toggle,
            newConversation: this.newConversation
        });
    }

    componentDidUpdate (previousProps, previousState) {
        if (this.state.messages !== previousState.messages ||
            this.state.toolStates !== previousState.toolStates) {
            this.scrollToLatest();
        }
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
            this.setToolState(toolCall.id, result.status.toLowerCase());
            this.setState(previous => ({messages: [...previous.messages, turn.message]}));
        } catch (error) {
            this.setToolState(toolCall.id, 'failed');
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
        const finished = status && status !== 'running';
        return (
            <section className={styles.toolCard} key={toolCall.id} aria-label="AI 积木修改计划">
                <div className={styles.toolEyebrow}>需要你的确认</div>
                <strong>{preview.title}</strong>
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
                {finished ? <div className={styles.toolStatus}>
                    {status === 'succeeded' ? '已添加，可使用编辑器撤销操作恢复。' :
                        status === 'cancelled' ? '已取消，没有修改编辑器。' : '应用失败，请重新规划。'}
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
                    <button type="button" onClick={this.newConversation}>＋ 新对话</button>
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
            <section
                aria-labelledby="planet-ai-assistant-title"
                className={this.state.historyOpen ? styles.panelWithHistory : styles.panel}
                role="dialog"
            >
                {this.renderHistory()}
                <div className={styles.chatColumn}>
                    <header className={styles.header}>
                        <div>
                            <div className={styles.titleRow}>
                                <span className={styles.spark}>✦</span>
                                <h2 id="planet-ai-assistant-title">AI 创作助手</h2>
                            </div>
                            <p>可以帮你规划并搭建基础积木</p>
                        </div>
                        <div className={styles.headerActions}>
                            <button
                                aria-label="查看历史记录"
                                className={this.state.historyOpen ? styles.iconButtonActive : styles.iconButton}
                                title="历史记录"
                                type="button"
                                onClick={() => this.setState(previous => ({historyOpen: !previous.historyOpen}))}
                            >
                                ◷
                            </button>
                            <button
                                aria-label="关闭 AI 助手"
                                className={styles.iconButton}
                                title="关闭"
                                type="button"
                                onClick={this.close}
                            >
                                ×
                            </button>
                        </div>
                    </header>
                    <div className={styles.memoryBar}>
                        <span /> 对话上下文和项目目标会保存在当前历史记录中
                    </div>
                    <div className={styles.messages} aria-live="polite">
                        {this.state.messages.length ? this.state.messages.map(
                            message => this.renderMessage(message)
                        ) : (
                            <div className={styles.emptyState}>
                                <span>✦</span>
                                <strong>从一个小目标开始</strong>
                                <p>例如：“给当前角色添加绿旗点击后移动并旋转的积木。”</p>
                            </div>
                        )}
                        {this.state.sending ? <div className={styles.thinking}>AI 正在整理积木计划…</div> : null}
                        <div ref={this.messagesEnd} />
                    </div>
                    {this.state.error ? <div className={styles.error} role="alert">{this.state.error}</div> : null}
                    <footer className={styles.composer}>
                        <textarea
                            aria-label="告诉 AI 你想制作什么"
                            disabled={this.state.sending}
                            maxLength={2000}
                            placeholder="描述你想让角色做什么…"
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
                            ↑
                        </button>
                    </footer>
                    <div className={styles.disclaimer}>AI 可能会出错，应用前请检查积木计划。</div>
                </div>
            </section>
        );
    }

    render () {
        return (
            <div className={styles.root}>
                {this.state.open ? this.renderPanel() : (
                    <button
                        aria-label="打开 AI 创作助手"
                        className={styles.launcher}
                        title="AI 创作助手"
                        type="button"
                        onClick={this.open}
                    >
                        <span>✦</span>
                        <span>AI</span>
                    </button>
                )}
            </div>
        );
    }
}

PlanetAiAssistant.propTypes = {
    vm: PropTypes.instanceOf(VM).isRequired
};

export default PlanetAiAssistant;
