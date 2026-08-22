import {gsap} from 'gsap';
import {Draggable} from 'gsap/Draggable';
import {useGSAP} from '@gsap/react';
import {GripVerticalIcon, SendIcon, XIcon} from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';

import {
    collaborationEnabled,
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

gsap.registerPlugin(useGSAP, Draggable);

const DraggableChatPanel = ({children, connected, onClose}) => {
    const panelRef = React.useRef(null);
    const dragHandleRef = React.useRef(null);

    useGSAP(() => {
        const matchMedia = gsap.matchMedia();
        const draggable = Draggable.create(panelRef.current, {
            bounds: document.documentElement,
            edgeResistance: 0.88,
            trigger: dragHandleRef.current,
            type: 'x,y'
        })[0];
        const keepInViewport = () => draggable.applyBounds(document.documentElement);

        matchMedia.add('(prefers-reduced-motion: no-preference)', () => {
            gsap.fromTo(panelRef.current, {
                autoAlpha: 0,
                scale: 0.98
            }, {
                autoAlpha: 1,
                duration: 0.2,
                ease: 'power2.out',
                scale: 1
            });
        });
        window.addEventListener('resize', keepInViewport);

        return () => {
            window.removeEventListener('resize', keepInViewport);
            draggable.kill();
            matchMedia.revert();
        };
    }, {scope: panelRef});

    return (
        <section
            aria-describedby="planet-project-chat-connection"
            aria-labelledby="planet-project-chat-title"
            className={styles.panel}
            data-project-chat-panel
            ref={panelRef}
            role="dialog"
        >
            <header className={styles.header}>
                <div
                    aria-label="拖动项目聊天窗口"
                    className={styles.dragHandle}
                    data-project-chat-drag-handle
                    ref={dragHandleRef}
                >
                    <GripVerticalIcon aria-hidden="true" />
                    <div className={styles.headerCopy}>
                        <h2
                            className={styles.title}
                            id="planet-project-chat-title"
                        >
                            {'项目聊天'}
                        </h2>
                        <span
                            className={styles.connection}
                            id="planet-project-chat-connection"
                        >
                            {connected ? '实时在线' : '正在连接'}
                        </span>
                    </div>
                </div>
                <button
                    aria-label="关闭项目聊天"
                    className={styles.closeButton}
                    onClick={onClose}
                    type="button"
                >
                    <XIcon aria-hidden="true" />
                </button>
            </header>
            {children}
        </section>
    );
};

DraggableChatPanel.propTypes = {
    children: PropTypes.node.isRequired,
    connected: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired
};

class PlanetProjectChat extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            connected: false,
            draft: '',
            error: '',
            messages: [],
            open: false,
            ownUserId: null,
            unread: 0
        };
        this.messageList = React.createRef();
        this.handleChatEvent = this.handleChatEvent.bind(this);
        this.handleDraftChange = this.handleDraftChange.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleStatus = this.handleStatus.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleOpen = this.handleOpen.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.handleToggleOpen = this.handleToggleOpen.bind(this);
        this.publishDockState = this.publishDockState.bind(this);
    }
    componentDidMount () {
        window.addEventListener(PLANET_COLLABORATION_CHAT_EVENT, this.handleChatEvent);
        window.addEventListener(PLANET_COLLABORATION_STATUS_EVENT, this.handleStatus);
        document.addEventListener('keydown', this.handleKeyDown);
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
        if (this.state.open && (previousState.messages.length !== this.state.messages.length ||
            previousState.open !== this.state.open)) {
            this.scrollToLatest();
        }
        if (previousState.connected !== this.state.connected ||
            previousState.open !== this.state.open ||
            previousState.unread !== this.state.unread) {
            this.publishDockState();
        }
    }
    componentWillUnmount () {
        window.removeEventListener(PLANET_COLLABORATION_CHAT_EVENT, this.handleChatEvent);
        window.removeEventListener(PLANET_COLLABORATION_STATUS_EVENT, this.handleStatus);
        document.removeEventListener('keydown', this.handleKeyDown);
        if (window.PlanetProjectChat === this.projectChatApi) delete window.PlanetProjectChat;
    }
    handleStatus (event) {
        const status = event.detail && event.detail.status;
        if (status === 'connected') this.setState({connected: true});
        if (status === 'connecting' || status === 'disconnected' || status === 'error') {
            this.setState({connected: false});
        }
    }
    handleChatEvent (event) {
        const detail = event.detail || {};
        if (detail.type === 'session-ready') {
            this.setState({ownUserId: String(detail.userId || '')});
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
            this.setState({connected: false, messages: [], ownUserId: null, unread: 0});
        }
    }
    handleDraftChange (event) {
        this.setState({draft: event.target.value, error: ''});
    }
    handleKeyDown (event) {
        if (event.key === 'Escape' && this.state.open) this.handleClose();
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
    scrollToLatest () {
        if (this.messageList.current) {
            this.messageList.current.scrollTop = this.messageList.current.scrollHeight;
        }
    }
    formatTime (value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    }
    renderPanel () {
        if (!this.state.open) return null;
        return ReactDOM.createPortal(
            <DraggableChatPanel
                connected={this.state.connected}
                onClose={this.handleClose}
            >
                <div
                    aria-live="polite"
                    className={styles.messages}
                    ref={this.messageList}
                >
                    {this.state.messages.length === 0 ? (
                        <div className={styles.empty}>{'还没有消息'}</div>
                    ) : this.state.messages.map(message => {
                        const own = String(message.userId) === this.state.ownUserId;
                        return (
                            <article
                                className={`${styles.message} ${own ? styles.ownMessage : ''}`}
                                key={message.messageId}
                            >
                                <div className={styles.messageMeta}>
                                    <span
                                        aria-hidden="true"
                                        className={styles.userDot}
                                        style={{backgroundColor: message.color || '#0ea5e9'}}
                                    />
                                    <strong>{own ? '我' : (message.nickname || '协作者')}</strong>
                                    <time>{this.formatTime(message.sentAt)}</time>
                                </div>
                                <p>{message.content}</p>
                            </article>
                        );
                    })}
                </div>
                <form
                    className={styles.composer}
                    onSubmit={this.handleSubmit}
                >
                    {this.state.error && <div className={styles.error}>{this.state.error}</div>}
                    <div className={styles.composerRow}>
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
                            className={styles.sendButton}
                            disabled={!this.state.connected || !this.state.draft.trim()}
                            type="submit"
                        >
                            <SendIcon aria-hidden="true" />
                            <span>{'发送'}</span>
                        </button>
                    </div>
                </form>
            </DraggableChatPanel>,
            document.body
        );
    }
    render () {
        if (!isPlanetProjectRoute() || !collaborationEnabled()) return null;
        return this.renderPanel();
    }
}

export default PlanetProjectChat;
