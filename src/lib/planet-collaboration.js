import * as Y from 'yjs';

import {openPlanetWriteSession} from './planet-cloud-autosave';
import {refreshPlanetSession, resolvePlanetAssetUrl} from './planet-session';

const API_CONTEXT_PATH = '/api/v1';
const LOCAL_ORIGIN = 'planet-local-project';
const REMOTE_ORIGIN = 'planet-remote-project';
const MAX_UPDATE_BYTES = 8 * 1024 * 1024;
const HEARTBEAT_INTERVAL_MS = 25000;
const VOICE_ICE_REFRESH_MARGIN_MS = 5 * 60 * 1000;
const VOICE_ICE_REFRESH_MIN_DELAY_MS = 30 * 1000;
const SESSION_REPLACED_CLOSE_CODE = 4001;
const CHAT_HISTORY_LIMIT = 50;
let latestChatState = null;
let latestVoiceState = null;

const normalizeCollaborationPerson = person => ({
    ...person,
    avatarUrl: resolvePlanetAssetUrl(person && person.avatarUrl)
});

const normalizeChatMessage = message => normalizeCollaborationPerson(message);

const normalizeParticipants = participants => (Array.isArray(participants) ?
    participants.map(normalizeCollaborationPerson) : []);

export const PLANET_COLLABORATION_STATUS_EVENT = 'planet-collaboration-status';
export const PLANET_COLLABORATION_REMOTE_APPLIED_EVENT = 'planet-collaboration-remote-applied';
export const PLANET_COLLABORATION_CURSOR_EVENT = 'planet-collaboration-cursor';
export const PLANET_COLLABORATION_INVITATION_EVENT = 'planet-collaboration-invitation';
export const PLANET_COLLABORATION_CHAT_EVENT = 'planet-collaboration-chat';
export const PLANET_COLLABORATION_CHAT_SEND_EVENT = 'planet-collaboration-chat-send';
export const PLANET_COLLABORATION_VOICE_EVENT = 'planet-collaboration-voice';
export const PLANET_COLLABORATION_VOICE_SEND_EVENT = 'planet-collaboration-voice-send';
export const PLANET_COLLABORATION_PERMISSION_EVENT = 'planet-collaboration-permission';
export const PLANET_ROLE_LOCK_STATUS_EVENT = 'planet-role-lock-status';

export const collaborationEnabled = () => {
    const parameters = new URLSearchParams(location.search);
    return parameters.get('collaboration') !== 'off';
};

export const emitPlanetCollaborationStatus = detail => {
    window.dispatchEvent(new CustomEvent(PLANET_COLLABORATION_STATUS_EVENT, {detail}));
};

export const getPlanetCollaborationVoiceState = () => {
    if (!latestVoiceState) return null;
    return {
        ...latestVoiceState,
        participants: [...latestVoiceState.participants]
    };
};

export const getPlanetCollaborationChatState = () => {
    if (!latestChatState) return null;
    return {
        ...latestChatState,
        messages: [...latestChatState.messages]
    };
};

const currentChatState = projectId => (latestChatState &&
    latestChatState.projectId === String(projectId) ? latestChatState : {
        connected: false,
        messages: [],
        ownUserId: null,
        projectId: String(projectId)
    });

const resolveWebSocketUrl = (projectId, ticket) => {
    const origin = new URL(window.location.origin);
    if (
        ['localhost', '127.0.0.1', '::1'].includes(origin.hostname) &&
        ['3000', '5173', '5174'].includes(origin.port)
    ) {
        origin.port = '8080';
    }
    origin.protocol = origin.protocol === 'https:' ? 'wss:' : 'ws:';
    origin.pathname = `${API_CONTEXT_PATH}/ws/projects/${encodeURIComponent(projectId)}/collaboration`;
    origin.search = new URLSearchParams({ticket}).toString();
    return origin.toString();
};

const bytes = async value => {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (value && typeof value.arrayBuffer === 'function') {
        return new Uint8Array(await value.arrayBuffer());
    }
    return new Uint8Array(value);
};

export class PlanetYjsCollaboration {
    constructor ({onRemoteProject, onStatus, projectId, serializeProject}) {
        this.onRemoteProject = onRemoteProject;
        this.onStatus = onStatus;
        this.projectId = String(projectId);
        this.serializeProject = serializeProject;
        this.handlePageHide = this.handlePageHide.bind(this);
        window.addEventListener('pagehide', this.handlePageHide);
        this.localRevision = 0;
        this.doc = new Y.Doc();
        this.project = this.doc.getMap('project');
        this.project.observe(event => {
            if (!event.keysChanged.has('snapshot') || event.transaction.origin === LOCAL_ORIGIN) return;
            const snapshot = this.project.get('snapshot');
            if (snapshot instanceof Uint8Array) {
                this.onRemoteProject({
                    revision: this.project.get('revision') || '',
                    snapshot,
                    targetId: this.project.get('targetId') || '',
                    targetName: this.project.get('targetName') || '',
                    updatedAt: this.project.get('updatedAt') || 0
                });
            }
        });
        this.doc.on('update', (update, origin) => {
            if (origin !== LOCAL_ORIGIN || !this.socket || this.socket.readyState !== WebSocket.OPEN) return;
            if (update.byteLength > MAX_UPDATE_BYTES) {
                this.status({status: 'error', message: '项目快照超过 8MB，暂时无法实时协作'});
                return;
            }
            this.socket.send(update);
        });
    }

    async connect () {
        this.status({status: 'connecting', participantCount: 1});
        const session = await refreshPlanetSession();
        const editorSession = await openPlanetWriteSession(session, this.projectId);
        if (this.destroyed) return;
        const socket = new WebSocket(resolveWebSocketUrl(this.projectId, editorSession.sessionToken));
        this.socket = socket;
        socket.binaryType = 'arraybuffer';
        socket.addEventListener('open', () => this.startHeartbeat(socket));
        socket.addEventListener('message', event => this.handleMessage(event));
        socket.addEventListener('close', event => {
            this.stopHeartbeat();
            if (this.destroyed || this.socket !== socket) return;
            if (this.replaced || event.code === SESSION_REPLACED_CLOSE_CODE) {
                this.replaced = true;
                this.status({status: 'replaced', message: '该账号已在另一个编辑器窗口接管协作会话'});
                this.clearTransientUi('session-replaced');
                return;
            }
            this.status({status: 'disconnected', participantCount: 1});
        });
        socket.addEventListener('error', () => {
            if (!this.destroyed && this.socket === socket) {
                this.status({status: 'error', message: '协作连接暂时不可用'});
            }
        });
    }

    async handleMessage (event) {
        if (event.data instanceof ArrayBuffer) {
            Y.applyUpdate(this.doc, new Uint8Array(event.data), REMOTE_ORIGIN);
            return;
        }
        if (event.data instanceof Blob) {
            Y.applyUpdate(this.doc, new Uint8Array(await event.data.arrayBuffer()), REMOTE_ORIGIN);
            return;
        }
        let message;
        try {
            message = JSON.parse(event.data);
        } catch (error) {
            return;
        }
        if (message.type === 'session-ready') {
            this.sessionId = message.sessionId;
            const chatState = currentChatState(this.projectId);
            latestChatState = {
                ...chatState,
                ownUserId: String(message.userId || '')
            };
            latestVoiceState = {
                canCreateRoom: Boolean(message.voiceCanCreateRoom),
                enabled: Boolean(message.voiceEnabled),
                iceExpiresAt: message.voiceIceExpiresAt || null,
                iceServers: Array.isArray(message.voiceIceServers) ? message.voiceIceServers : [],
                participantLimit: 4,
                participants: [],
                roomActive: false,
                sessionId: message.sessionId
            };
            this.scheduleVoiceIceRefresh(message.voiceEnabled ? message.voiceIceExpiresAt : null);
            this.flushRoleLock();
            window.dispatchEvent(new CustomEvent(PLANET_ROLE_LOCK_STATUS_EVENT, {
                detail: {type: 'session-ready', sessionId: message.sessionId}
            }));
            window.dispatchEvent(new CustomEvent(PLANET_COLLABORATION_CHAT_EVENT, {
                detail: {
                    type: 'session-ready',
                    sessionId: message.sessionId,
                    userId: message.userId,
                    projectId: this.projectId,
                    voiceCanCreateRoom: message.voiceCanCreateRoom,
                    voiceEnabled: message.voiceEnabled,
                    voiceIceExpiresAt: message.voiceIceExpiresAt,
                    voiceIceServers: message.voiceIceServers
                }
            }));
            window.dispatchEvent(new CustomEvent(PLANET_COLLABORATION_VOICE_EVENT, {
                detail: {
                    type: 'session-ready',
                    sessionId: message.sessionId,
                    userId: message.userId,
                    projectId: this.projectId,
                    voiceCanCreateRoom: message.voiceCanCreateRoom,
                    voiceEnabled: message.voiceEnabled,
                    voiceIceExpiresAt: message.voiceIceExpiresAt,
                    voiceIceServers: message.voiceIceServers
                }
            }));
            window.dispatchEvent(new CustomEvent(PLANET_COLLABORATION_PERMISSION_EVENT, {
                detail: message
            }));
        } else if (message.type === 'session-replaced') {
            this.replaced = true;
            this.status({
                status: 'replaced',
                message: message.message || '该账号已在另一个编辑器窗口接管协作会话'
            });
            this.clearTransientUi('session-replaced');
        } else if (message.type === 'sync-request') {
            this.socket.send(Y.encodeStateAsUpdate(this.doc));
            this.socket.send(JSON.stringify({
                type: 'sync-response',
                targetSessionId: message.targetSessionId
            }));
        } else if (message.type === 'sync-ready') {
            if (!this.project.has('snapshot')) await this.publishCurrentProject();
            this.status({status: 'connected'});
        } else if (message.type === 'presence') {
            this.status({
                status: 'connected',
                participantCount: message.participantCount,
                participants: normalizeParticipants(message.participants)
            });
        } else if (message.type === 'role-locks' || message.type === 'role-lock-granted' ||
            message.type === 'role-lock-denied') {
            if (message.type === 'role-locks' && this.activeRole) {
                const current = message.locks.find(lock => lock.targetId === this.activeRole.targetId);
                this.roleLockGranted = Boolean(current && current.sessionId === this.sessionId);
            } else if (message.type === 'role-lock-granted' && message.lock && this.activeRole &&
                message.lock.targetId === this.activeRole.targetId) {
                this.roleLockGranted = message.lock.sessionId === this.sessionId;
            } else if (message.type === 'role-lock-denied' && message.lock && this.activeRole &&
                message.lock.targetId === this.activeRole.targetId) {
                this.roleLockGranted = false;
            } else if (message.type === 'role-lock-denied' && this.activeRole &&
                message.targetId === this.activeRole.targetId) {
                this.roleLockGranted = false;
            }
            window.dispatchEvent(new CustomEvent(PLANET_ROLE_LOCK_STATUS_EVENT, {
                detail: {...message, sessionId: this.sessionId}
            }));
            if (message.type === 'role-locks' && this.activeRole &&
                !message.locks.some(lock => lock.targetId === this.activeRole.targetId)) {
                this.flushRoleLock();
            }
        } else if (message.type === 'collaboration-permissions-updated') {
            this.roleLockGranted = false;
            window.dispatchEvent(new CustomEvent(PLANET_COLLABORATION_PERMISSION_EVENT, {
                detail: message
            }));
            this.flushRoleLock();
        } else if (message.type === 'cursor') {
            window.dispatchEvent(new CustomEvent(PLANET_COLLABORATION_CURSOR_EVENT, {
                detail: message
            }));
        } else if (message.type === 'project-invitation') {
            window.dispatchEvent(new CustomEvent(PLANET_COLLABORATION_INVITATION_EVENT, {
                detail: message
            }));
        } else if (message.type === 'chat-history') {
            const chatState = currentChatState(this.projectId);
            const messages = Array.isArray(message.messages) ?
                message.messages.slice(-CHAT_HISTORY_LIMIT).map(normalizeChatMessage) : [];
            latestChatState = {
                ...chatState,
                messages
            };
            window.dispatchEvent(new CustomEvent(PLANET_COLLABORATION_CHAT_EVENT, {
                detail: {...message, messages}
            }));
        } else if (message.type === 'chat-message' && message.message) {
            const chatState = currentChatState(this.projectId);
            const normalizedMessage = normalizeChatMessage(message.message);
            const duplicate = chatState.messages.some(existing =>
                existing.messageId === normalizedMessage.messageId);
            latestChatState = {
                ...chatState,
                messages: duplicate ? chatState.messages :
                    [...chatState.messages, normalizedMessage].slice(-CHAT_HISTORY_LIMIT)
            };
            window.dispatchEvent(new CustomEvent(PLANET_COLLABORATION_CHAT_EVENT, {
                detail: {...message, message: normalizedMessage}
            }));
        } else if (message.type === 'chat-error') {
            window.dispatchEvent(new CustomEvent(PLANET_COLLABORATION_CHAT_EVENT, {
                detail: message
            }));
        } else if (message.type === 'voice-room' || message.type === 'voice-signal' ||
            message.type === 'voice-error' || message.type === 'voice-room-closed' ||
            message.type === 'voice-ice-servers') {
            const voiceMessage = message.type === 'voice-room' ? {
                ...message,
                participants: normalizeParticipants(message.participants)
            } : message;
            if (message.type === 'voice-room' && latestVoiceState) {
                latestVoiceState = {
                    ...latestVoiceState,
                    hostUserId: message.hostUserId || null,
                    participantLimit: Number(message.participantLimit || 4),
                    participants: voiceMessage.participants,
                    roomActive: Boolean(message.active)
                };
            } else if (message.type === 'voice-ice-servers' && latestVoiceState) {
                latestVoiceState = {
                    ...latestVoiceState,
                    iceExpiresAt: message.voiceIceExpiresAt || null,
                    iceServers: Array.isArray(message.voiceIceServers) ?
                        message.voiceIceServers : []
                };
                this.scheduleVoiceIceRefresh(message.voiceIceExpiresAt);
            } else if (message.type === 'voice-room-closed' && latestVoiceState) {
                latestVoiceState = {...latestVoiceState, participants: [], roomActive: false};
            }
            window.dispatchEvent(new CustomEvent(PLANET_COLLABORATION_VOICE_EVENT, {
                detail: voiceMessage
            }));
        } else if (message.type === 'project-access-removed' &&
            String(message.projectId) === this.projectId) {
            this.status({status: 'error', message: '你已不再是这个项目的协作者'});
            this.destroy();
        } else if (message.type === 'error') {
            this.status({status: 'error', message: message.message});
        }
    }

    requestRoleLock (targetId, targetName) {
        if (!targetId || !targetName) return;
        if (this.activeRole && this.activeRole.targetId === targetId &&
            this.activeRole.targetName === targetName) return;
        if (this.activeRole && this.activeRole.targetId !== targetId) {
            this.publishCursor(0, 0, false);
            this.sendJson({type: 'role-unlock', targetId: this.activeRole.targetId});
            this.roleLockGranted = false;
        }
        this.activeRole = {targetId, targetName};
        window.dispatchEvent(new CustomEvent(PLANET_ROLE_LOCK_STATUS_EVENT, {
            detail: {type: 'role-lock-pending', targetId, targetName, sessionId: this.sessionId}
        }));
        this.flushRoleLock();
    }

    flushRoleLock () {
        if (!this.activeRole) return;
        this.sendJson({type: 'role-lock', ...this.activeRole});
    }

    publishCursor (x, y, visible = true) {
        if (!this.activeRole || (visible && !this.roleLockGranted)) return;
        this.sendJson({type: 'cursor', targetId: this.activeRole.targetId, x, y, visible});
    }

    sendChatMessage (content) {
        const value = typeof content === 'string' ? content.trim() : '';
        if (!value || value.length > 500) return;
        this.sendJson({type: 'chat-message', content: value});
    }

    sendVoiceCommand (message) {
        if (!message || typeof message.type !== 'string') return;
        this.sendJson(message);
    }

    sendVoiceMessage (frame) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        if (!(frame instanceof ArrayBuffer) && !(frame instanceof Uint8Array)) return;
        this.socket.send(frame);
    }

    sendJson (message) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        this.socket.send(JSON.stringify(message));
    }

    startHeartbeat (socket) {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            if (!this.destroyed && this.socket === socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({type: 'ping'}));
            }
        }, HEARTBEAT_INTERVAL_MS);
    }

    stopHeartbeat () {
        clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
    }

    scheduleVoiceIceRefresh (expiresAt) {
        clearTimeout(this.voiceIceRefreshTimer);
        this.voiceIceRefreshTimer = null;
        const expires = Date.parse(expiresAt || '');
        if (!Number.isFinite(expires)) return;
        const delay = Math.max(VOICE_ICE_REFRESH_MIN_DELAY_MS,
            expires - Date.now() - VOICE_ICE_REFRESH_MARGIN_MS);
        this.voiceIceRefreshTimer = setTimeout(() => {
            this.voiceIceRefreshTimer = null;
            this.sendJson({type: 'voice-ice-refresh'});
        }, delay);
    }

    handlePageHide () {
        this.destroy();
    }

    clearTransientUi (reason = 'closed') {
        clearTimeout(this.voiceIceRefreshTimer);
        this.voiceIceRefreshTimer = null;
        latestChatState = null;
        latestVoiceState = null;
        window.dispatchEvent(new CustomEvent(PLANET_ROLE_LOCK_STATUS_EVENT, {
            detail: {type: 'collaboration-destroyed', reason}
        }));
        window.dispatchEvent(new CustomEvent(PLANET_COLLABORATION_CHAT_EVENT, {
            detail: {type: 'collaboration-destroyed'}
        }));
        window.dispatchEvent(new CustomEvent(PLANET_COLLABORATION_VOICE_EVENT, {
            detail: {type: 'collaboration-destroyed', reason}
        }));
    }

    async publishCurrentProject () {
        if (this.publishing || this.destroyed) {
            this.publishQueued = true;
            return;
        }
        this.publishing = true;
        try {
            const snapshot = await bytes(await this.serializeProject());
            if (snapshot.byteLength > MAX_UPDATE_BYTES - 1024) {
                this.status({status: 'error', message: '项目快照超过 8MB，暂时无法实时协作'});
                return;
            }
            this.doc.transact(() => {
                this.project.set('snapshot', snapshot);
                this.project.set('updatedAt', Date.now());
                this.project.set('revision', `${this.doc.clientID}:${++this.localRevision}`);
                this.project.set('targetId', this.activeRole ? this.activeRole.targetId : '');
                this.project.set('targetName', this.activeRole ? this.activeRole.targetName : '');
            }, LOCAL_ORIGIN);
        } finally {
            this.publishing = false;
            if (this.publishQueued) {
                this.publishQueued = false;
                this.publishCurrentProject();
            }
        }
    }

    status (next) {
        if (next.status === 'connected' || next.status === 'connecting' ||
            next.status === 'disconnected' || next.status === 'replaced' ||
            next.status === 'error') {
            latestChatState = {
                ...currentChatState(this.projectId),
                connected: next.status === 'connected'
            };
        }
        this.onStatus(next);
    }

    destroy () {
        if (this.destroyed) return;
        window.removeEventListener('pagehide', this.handlePageHide);
        this.stopHeartbeat();
        this.destroyed = true;
        if (this.activeRole) {
            this.publishCursor(0, 0, false);
            this.sendJson({type: 'role-unlock', targetId: this.activeRole.targetId});
        }
        this.sendJson({type: 'leave'});
        if (this.socket) this.socket.close(1000, 'editor-closed');
        this.doc.destroy();
        this.clearTransientUi('closed');
    }
}
