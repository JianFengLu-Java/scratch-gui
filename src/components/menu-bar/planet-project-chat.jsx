import {
    KeyboardIcon,
    MessageCircleIcon,
    MicIcon,
    RadioIcon,
    SendIcon
} from 'lucide-react';
// Webpack 4 resolves this package export through an explicit local alias.
// eslint-disable-next-line import/no-unresolved
import {MessageScroller} from '@shadcn/react/message-scroller';
import React from 'react';
import ReactDOM from 'react-dom';

import PlanetUserAvatar from '../editor-dock/planet-user-avatar.jsx';
import DockPanel from '../editor-dock/dock-panel.jsx';
import {
    PlanetProjectVoiceControls,
    PlanetProjectVoiceMessage
} from './planet-project-voice.jsx';
import {
    collaborationEnabled,
    getPlanetCollaborationChatState,
    PLANET_COLLABORATION_CHAT_EVENT,
    PLANET_COLLABORATION_CHAT_SEND_EVENT,
    PLANET_COLLABORATION_STATUS_EVENT
} from '../../lib/planet-collaboration';
import {isPlanetProjectRoute} from '../../lib/planet-project-loader';
import {
    PLANET_PROJECT_CHAT_READY_EVENT,
    PLANET_PROJECT_CHAT_STATE_EVENT
} from '../../lib/editor-dock-events';

import styles from './planet-project-chat.css';

const MAX_MESSAGE_LENGTH = 500;
const MESSAGE_GROUP_INTERVAL_MS = 5 * 60 * 1000;

const messageTimestamp = message => {
    const timestamp = new Date(message && message.sentAt).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
};

const startsNewMessageGroup = (message, previousMessage) => !previousMessage ||
    String(previousMessage.userId) !== String(message.userId) ||
    (messageTimestamp(message) > 0 && messageTimestamp(previousMessage) > 0 &&
        messageTimestamp(message) - messageTimestamp(previousMessage) >= MESSAGE_GROUP_INTERVAL_MS);

const endsMessageGroup = (message, nextMessage) => !nextMessage ||
    String(nextMessage.userId) !== String(message.userId) ||
    (messageTimestamp(nextMessage) > 0 && messageTimestamp(message) > 0 &&
        messageTimestamp(nextMessage) - messageTimestamp(message) >= MESSAGE_GROUP_INTERVAL_MS);

class PlanetProjectChat extends React.Component {
    constructor (props) {
        super(props);
        const initialChatState = getPlanetCollaborationChatState();
        this.state = {
            composerMode: 'text',
            connected: Boolean(initialChatState && initialChatState.connected),
            draft: '',
            error: '',
            messages: initialChatState ? initialChatState.messages : [],
            open: false,
            ownUserId: initialChatState ? initialChatState.ownUserId : null,
            projectId: initialChatState ? initialChatState.projectId : null,
            unread: 0,
            view: 'chat'
        };
        this.handleChatEvent = this.handleChatEvent.bind(this);
        this.handleDraftChange = this.handleDraftChange.bind(this);
        this.handleStatus = this.handleStatus.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleToggleComposer = this.handleToggleComposer.bind(this);
        this.handleViewChat = this.handleViewChat.bind(this);
        this.handleViewVoice = this.handleViewVoice.bind(this);
        this.handleOpen = this.handleOpen.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.handleToggleOpen = this.handleToggleOpen.bind(this);
        this.publishDockState = this.publishDockState.bind(this);
    }
    componentDidMount () {
        window.addEventListener(PLANET_COLLABORATION_CHAT_EVENT, this.handleChatEvent);
        window.addEventListener(PLANET_COLLABORATION_STATUS_EVENT, this.handleStatus);
        this.projectChatApi = Object.freeze({
            close: this.handleClose,
            open: this.handleOpen,
            toggle: this.handleToggleOpen
        });
        window.PlanetProjectChat = this.projectChatApi;
        window.dispatchEvent(new CustomEvent(PLANET_PROJECT_CHAT_READY_EVENT, {
            detail: this.projectChatApi
        }));
        this.publishDockState();
    }
    componentDidUpdate (previousProps, previousState) {
        if (previousState.connected !== this.state.connected ||
            previousState.open !== this.state.open ||
            previousState.unread !== this.state.unread) {
            this.publishDockState();
        }
    }
    componentWillUnmount () {
        window.removeEventListener(PLANET_COLLABORATION_CHAT_EVENT, this.handleChatEvent);
        window.removeEventListener(PLANET_COLLABORATION_STATUS_EVENT, this.handleStatus);
        if (window.PlanetProjectChat === this.projectChatApi) delete window.PlanetProjectChat;
    }
    handleStatus (event) {
        const status = event.detail && event.detail.status;
        if (status === 'connected') this.setState({connected: true});
        if (status === 'connecting' || status === 'disconnected' || status === 'replaced' ||
            status === 'error') {
            this.setState({connected: false});
        }
    }
    handleChatEvent (event) {
        const detail = event.detail || {};
        if (detail.type === 'session-ready') {
            this.setState({
                ownUserId: String(detail.userId || ''),
                projectId: detail.projectId || null
            });
        } else if (detail.type === 'chat-history') {
            this.setState({messages: Array.isArray(detail.messages) ? detail.messages : []});
        } else if (detail.type === 'chat-message' && detail.message) {
            this.setState(previous => {
                if (previous.messages.some(message => message.messageId === detail.message.messageId)) return null;
                return {
                    error: '',
                    messages: [...previous.messages, detail.message].slice(-50),
                    unread: previous.open ? 0 : Math.min(99, previous.unread + 1)
                };
            });
        } else if (detail.type === 'chat-error') {
            this.setState({error: detail.message || '消息发送失败'});
        } else if (detail.type === 'collaboration-destroyed') {
            this.setState({
                connected: false,
                messages: [],
                ownUserId: null,
                projectId: null,
                unread: 0
            });
        }
    }
    handleDraftChange (event) {
        this.setState({draft: event.target.value, error: ''});
    }
    handleSubmit (event) {
        event.preventDefault();
        const content = this.state.draft.trim();
        if (!content || !this.state.connected) return;
        window.dispatchEvent(new CustomEvent(PLANET_COLLABORATION_CHAT_SEND_EVENT, {
            detail: {content}
        }));
        this.setState({draft: '', error: ''});
    }
    handleToggleComposer () {
        this.setState(previous => ({
            composerMode: previous.composerMode === 'voice' ? 'text' : 'voice'
        }));
    }
    handleViewChat () {
        this.setState({view: 'chat'});
    }
    handleViewVoice () {
        this.setState({view: 'voice'});
    }
    handleToggleOpen () {
        this.setState(previous => ({open: !previous.open, unread: 0}));
    }
    handleOpen () {
        this.setState({open: true, unread: 0});
    }
    handleClose () {
        this.setState({open: false});
    }
    publishDockState () {
        window.dispatchEvent(new CustomEvent(PLANET_PROJECT_CHAT_STATE_EVENT, {
            detail: {
                connected: this.state.connected,
                open: this.state.open,
                unread: this.state.unread
            }
        }));
    }
    formatTime (value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    }
    renderPanel () {
        if (!this.state.open) return null;
        const voiceComposer = this.state.composerMode === 'voice';
        return ReactDOM.createPortal(
            <DockPanel
                className={styles.panel}
                description={this.state.connected ? '实时消息' : '正在连接'}
                dragLabel="拖动项目聊天窗口"
                icon={MessageCircleIcon}
                onClose={this.handleClose}
                panelId="chat"
                title="项目聊天"
            >
                <div
                    aria-label="聊天类型"
                    className={styles.roomTabs}
                    role="tablist"
                >
                    <button
                        aria-selected={this.state.view === 'chat'}
                        className={this.state.view === 'chat' ? styles.roomTabActive : ''}
                        role="tab"
                        type="button"
                        onClick={this.handleViewChat}
                    >
                        <MessageCircleIcon aria-hidden="true" />
                        <span>{'聊天'}</span>
                    </button>
                    <button
                        aria-selected={this.state.view === 'voice'}
                        className={this.state.view === 'voice' ? styles.roomTabActive : ''}
                        role="tab"
                        type="button"
                        onClick={this.handleViewVoice}
                    >
                        <RadioIcon aria-hidden="true" />
                        <span>{'语音房'}</span>
                    </button>
                </div>
                {this.state.view === 'voice' ? (
                    <div className={styles.voicePanelBody}>
                        <PlanetProjectVoiceControls
                            connected={this.state.connected}
                            recorder={false}
                        />
                    </div>
                ) : (
                    <React.Fragment>
                        <MessageScroller.Provider
                            autoScroll
                            defaultScrollPosition="end"
                        >
                            <MessageScroller.Root className={styles.messageScroller}>
                                <MessageScroller.Viewport
                                    aria-label="项目聊天记录"
                                    className={styles.messages}
                                    preserveScrollOnPrepend
                                >
                                    <MessageScroller.Content
                                        aria-live="polite"
                                        className={styles.messageScrollerContent}
                                    >
                                        {this.state.messages.length === 0 ? (
                                            <div className={styles.empty}>{'还没有消息'}</div>
                                        ) : this.state.messages.map((message, index) => {
                                            const own = String(message.userId) === this.state.ownUserId;
                                            const previousMessage = this.state.messages[index - 1];
                                            const nextMessage = this.state.messages[index + 1];
                                            const startsGroup = startsNewMessageGroup(message, previousMessage);
                                            const showAvatar = endsMessageGroup(message, nextMessage);
                                            const showTime = index === 0 || (messageTimestamp(message) > 0 &&
                                                messageTimestamp(previousMessage) > 0 &&
                                                messageTimestamp(message) - messageTimestamp(previousMessage) >=
                                                    MESSAGE_GROUP_INTERVAL_MS);
                                            const nickname = message.nickname || '协作者';
                                            return (
                                                <MessageScroller.Item
                                                    className={styles.messageItem}
                                                    key={message.messageId}
                                                    messageId={String(message.messageId)}
                                                >
                                                    {showTime && (
                                                        <time className={styles.messageTime}>
                                                            {this.formatTime(message.sentAt)}
                                                        </time>
                                                    )}
                                                    <article
                                                        aria-label={`${own ? '我' : nickname}的消息`}
                                                        className={`${styles.message} ${own ? styles.ownMessage : ''}`}
                                                        data-align={own ? 'end' : 'start'}
                                                        data-slot="message"
                                                    >
                                                        <div
                                                            className={styles.messageAvatar}
                                                            data-slot="message-avatar"
                                                        >
                                                            {showAvatar ? (
                                                                <PlanetUserAvatar
                                                                    member={{
                                                                        avatarUrl: message.avatarUrl,
                                                                        nickname
                                                                    }}
                                                                />
                                                            ) : null}
                                                        </div>
                                                        <div
                                                            className={styles.messageContent}
                                                            data-slot="message-content"
                                                        >
                                                            {startsGroup ? (
                                                                <div
                                                                    className={styles.messageHeader}
                                                                    data-slot="message-header"
                                                                >
                                                                    {own ? '我' : nickname}
                                                                </div>
                                                            ) : null}
                                                            <div
                                                                className={`${styles.bubble} ${own ?
                                                                    styles.bubbleDefault : styles.bubbleOutline}`}
                                                                data-slot="bubble"
                                                                data-variant={own ? 'default' : 'outline'}
                                                            >
                                                                <div
                                                                    className={styles.bubbleContent}
                                                                    data-slot="bubble-content"
                                                                >
                                                                    {message.messageType === 'VOICE' ? (
                                                                        <PlanetProjectVoiceMessage
                                                                            message={message}
                                                                            projectId={this.state.projectId}
                                                                        />
                                                                    ) : <p>{message.content}</p>}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </article>
                                                </MessageScroller.Item>
                                            );
                                        })}
                                    </MessageScroller.Content>
                                </MessageScroller.Viewport>
                            </MessageScroller.Root>
                        </MessageScroller.Provider>
                        <form
                            className={styles.composer}
                            onSubmit={this.handleSubmit}
                        >
                            {this.state.error && <div className={styles.error}>{this.state.error}</div>}
                            <div className={styles.composerRow}>
                                <button
                                    aria-label={voiceComposer ? '切换到文字输入' : '切换到按住说话'}
                                    className={styles.modeButton}
                                    type="button"
                                    onClick={this.handleToggleComposer}
                                >
                                    {voiceComposer ?
                                        <KeyboardIcon aria-hidden="true" /> : <MicIcon aria-hidden="true" />}
                                </button>
                                {voiceComposer ? (
                                    <PlanetProjectVoiceControls
                                        connected={this.state.connected}
                                        room={false}
                                    />
                                ) : (
                                    <React.Fragment>
                                        <input
                                            aria-label="聊天消息"
                                            autoComplete="off"
                                            className={styles.input}
                                            disabled={!this.state.connected}
                                            maxLength={MAX_MESSAGE_LENGTH}
                                            onChange={this.handleDraftChange}
                                            placeholder={this.state.connected ? '输入消息…' : '等待协作连接…'}
                                            value={this.state.draft}
                                        />
                                        <button
                                            aria-label="发送消息"
                                            className={styles.sendButton}
                                            disabled={!this.state.connected || !this.state.draft.trim()}
                                            type="submit"
                                        >
                                            <SendIcon aria-hidden="true" />
                                        </button>
                                    </React.Fragment>
                                )}
                            </div>
                        </form>
                    </React.Fragment>
                )}
            </DockPanel>,
            document.body
        );
    }
    render () {
        if (!isPlanetProjectRoute() || !collaborationEnabled()) return null;
        return this.renderPanel();
    }
}

export default PlanetProjectChat;
