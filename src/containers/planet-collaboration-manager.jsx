import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import VM from 'scratch-vm';

import {
    collaborationEnabled,
    emitPlanetCollaborationStatus,
    PLANET_COLLABORATION_CHAT_SEND_EVENT,
    PLANET_COLLABORATION_REMOTE_APPLIED_EVENT,
    PlanetYjsCollaboration
} from '../lib/planet-collaboration';
import {isPlanetProjectRoute} from '../lib/planet-project-loader';
import {getIsShowingProject} from '../reducers/project-state';

const PUBLISH_DEBOUNCE_MS = 500;
const RECONNECT_MAX_MS = 10000;
const CURSOR_THROTTLE_MS = 50;
const REMOTE_SETTLE_MS = 2200;
const REMOTE_APPLY_MIN_INTERVAL_MS = 4000;
const LOCAL_IDLE_MS = 1200;
const REMOTE_EVENT_SUPPRESSION_MS = 300;
const INTERACTION_RECHECK_MS = 250;

class PlanetCollaborationManager extends React.Component {
    constructor (props) {
        super(props);
        this.applyingRemote = false;
        this.reconnectDelay = 1000;
        this.handleProjectChanged = this.handleProjectChanged.bind(this);
        this.handleChatSend = this.handleChatSend.bind(this);
        this.handleInteractionEnd = this.handleInteractionEnd.bind(this);
        this.handleInteractionStart = this.handleInteractionStart.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerLeave = this.handlePointerLeave.bind(this);
        this.handleRemoteProject = this.handleRemoteProject.bind(this);
        this.handleStatus = this.handleStatus.bind(this);
        this.applyPendingRemoteProject = this.applyPendingRemoteProject.bind(this);
    }
    componentDidMount () {
        this.mounted = true;
        this.props.vm.on('PROJECT_CHANGED', this.handleProjectChanged);
        window.addEventListener(PLANET_COLLABORATION_CHAT_SEND_EVENT, this.handleChatSend);
        document.addEventListener('pointerdown', this.handleInteractionStart, true);
        window.addEventListener('pointerup', this.handleInteractionEnd, true);
        window.addEventListener('pointercancel', this.handleInteractionEnd, true);
        document.addEventListener('keydown', this.handleKeyDown, true);
        document.addEventListener('pointermove', this.handlePointerMove, {passive: true});
        document.documentElement.addEventListener('mouseleave', this.handlePointerLeave);
        window.addEventListener('blur', this.handlePointerLeave);
        this.ensureConnection();
        this.syncRoleLock();
    }
    componentDidUpdate (prevProps) {
        if (String(prevProps.projectId) !== String(this.props.projectId)) this.disconnect();
        this.ensureConnection();
        if (!this.applyingRemote && prevProps.editingTargetKey !== this.props.editingTargetKey) {
            this.syncRoleLock();
        }
    }
    componentWillUnmount () {
        this.mounted = false;
        clearTimeout(this.publishTimer);
        clearTimeout(this.remoteApplyTimer);
        clearTimeout(this.reconnectTimer);
        this.props.vm.off('PROJECT_CHANGED', this.handleProjectChanged);
        window.removeEventListener(PLANET_COLLABORATION_CHAT_SEND_EVENT, this.handleChatSend);
        document.removeEventListener('pointerdown', this.handleInteractionStart, true);
        window.removeEventListener('pointerup', this.handleInteractionEnd, true);
        window.removeEventListener('pointercancel', this.handleInteractionEnd, true);
        document.removeEventListener('keydown', this.handleKeyDown, true);
        document.removeEventListener('pointermove', this.handlePointerMove);
        document.documentElement.removeEventListener('mouseleave', this.handlePointerLeave);
        window.removeEventListener('blur', this.handlePointerLeave);
        this.handlePointerLeave();
        this.disconnect();
    }
    active () {
        return collaborationEnabled() && isPlanetProjectRoute() && this.props.isShowingProject &&
            this.props.projectId && String(this.props.projectId) !== '0';
    }
    ensureConnection () {
        if (!this.active() || this.collaboration || this.connecting) return;
        this.connecting = true;
        const collaboration = new PlanetYjsCollaboration({
            projectId: this.props.projectId,
            serializeProject: () => this.props.vm.saveProjectSb3(),
            onRemoteProject: this.handleRemoteProject,
            onStatus: this.handleStatus
        });
        this.collaboration = collaboration;
        this.syncRoleLock();
        collaboration.connect().catch(error => {
            if (this.collaboration !== collaboration) return;
            emitPlanetCollaborationStatus({status: 'error', message: error.message});
            this.disconnect(false);
            this.scheduleReconnect();
        })
            .finally(() => {
                this.connecting = false;
            });
    }
    disconnect (resetStatus = true) {
        clearTimeout(this.publishTimer);
        clearTimeout(this.remoteApplyTimer);
        this.pendingRemoteProject = null;
        if (this.collaboration) this.collaboration.destroy();
        this.collaboration = null;
        if (resetStatus) emitPlanetCollaborationStatus({status: 'disconnected'});
    }
    scheduleReconnect () {
        if (!this.mounted || !this.active() || this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.ensureConnection();
        }, this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS);
    }
    handleStatus (detail) {
        if (detail.status === 'connected') this.reconnectDelay = 1000;
        emitPlanetCollaborationStatus(detail);
        if (detail.status === 'disconnected') {
            this.disconnect(false);
            this.scheduleReconnect();
        }
    }
    handleProjectChanged () {
        const now = Date.now();
        if (!this.active() || this.applyingRemote || now < (this.suppressLocalEventsUntil || 0) ||
            !this.collaboration) return;
        this.lastLocalChangeAt = now;
        this.localActivityUntil = now + LOCAL_IDLE_MS;
        if (this.pendingRemoteProject) this.scheduleRemoteProject();
        clearTimeout(this.publishTimer);
        this.publishTimer = setTimeout(() => {
            if (!this.collaboration) return;
            this.localPublishInFlight = true;
            Promise.resolve(this.collaboration.publishCurrentProject())
                .finally(() => {
                    this.localPublishInFlight = false;
                    if (this.pendingRemoteProject) this.scheduleRemoteProject();
                });
        }, PUBLISH_DEBOUNCE_MS);
    }
    handleChatSend (event) {
        if (this.collaboration && event.detail) {
            this.collaboration.sendChatMessage(event.detail.content);
        }
    }
    interactionSurfaceContains (target) {
        const surface = document.querySelector('[class*="gui_body-wrapper"]');
        return Boolean(surface && target && surface.contains(target));
    }
    handleInteractionStart (event) {
        if (!this.active() || !this.interactionSurfaceContains(event.target)) return;
        this.localPointerActive = true;
        this.localActivityUntil = Date.now() + LOCAL_IDLE_MS;
        if (this.pendingRemoteProject) this.scheduleRemoteProject();
    }
    handleInteractionEnd () {
        if (!this.localPointerActive) return;
        this.localPointerActive = false;
        this.localActivityUntil = Date.now() + LOCAL_IDLE_MS;
        if (this.pendingRemoteProject) this.scheduleRemoteProject();
    }
    handleKeyDown (event) {
        if (!this.active() || !this.interactionSurfaceContains(event.target)) return;
        this.localActivityUntil = Date.now() + LOCAL_IDLE_MS;
        if (this.pendingRemoteProject) this.scheduleRemoteProject();
    }
    syncRoleLock () {
        if (!this.collaboration || !this.props.editingTargetKey || !this.props.editingTargetName) return;
        this.collaboration.requestRoleLock(this.props.editingTargetKey, this.props.editingTargetName);
    }
    handlePointerMove (event) {
        if (!this.active() || !this.collaboration) return;
        const surface = document.querySelector('[class*="gui_body-wrapper"]');
        if (!surface || !surface.contains(event.target)) {
            this.handlePointerLeave();
            return;
        }
        const now = Date.now();
        if (now - (this.lastCursorAt || 0) < CURSOR_THROTTLE_MS) return;
        this.lastCursorAt = now;
        this.cursorVisible = true;
        this.collaboration.publishCursor(
            Math.max(0, Math.min(1, event.clientX / window.innerWidth)),
            Math.max(0, Math.min(1, event.clientY / window.innerHeight))
        );
    }
    handlePointerLeave () {
        if (!this.cursorVisible) return;
        this.cursorVisible = false;
        if (this.collaboration) this.collaboration.publishCursor(0, 0, false);
    }
    handleRemoteProject (remoteProject) {
        if (!this.active()) return;
        const payload = remoteProject instanceof Uint8Array ? {snapshot: remoteProject} : remoteProject;
        if (!payload || !(payload.snapshot instanceof Uint8Array)) return;
        if (payload.revision && (payload.revision === this.lastAppliedRevision ||
            (this.pendingRemoteProject && payload.revision === this.pendingRemoteProject.revision))) return;
        this.pendingRemoteProject = {...payload, receivedAt: Date.now()};
        this.scheduleRemoteProject();
    }
    scheduleRemoteProject () {
        clearTimeout(this.remoteApplyTimer);
        if (!this.pendingRemoteProject || !this.mounted) return;
        const now = Date.now();
        const settledAt = this.pendingRemoteProject.receivedAt + REMOTE_SETTLE_MS;
        const idleAt = this.localActivityUntil || 0;
        const nextAllowedAt = (this.lastRemoteAppliedAt || 0) + REMOTE_APPLY_MIN_INTERVAL_MS;
        const wait = Math.max(INTERACTION_RECHECK_MS, settledAt - now, idleAt - now, nextAllowedAt - now);
        this.remoteApplyTimer = setTimeout(this.applyPendingRemoteProject, wait);
    }
    async applyPendingRemoteProject () {
        this.remoteApplyTimer = null;
        if (!this.active() || !this.pendingRemoteProject) return;
        if (this.applyingRemote || this.localPointerActive || this.localPublishInFlight ||
            Date.now() < (this.localActivityUntil || 0)) {
            this.scheduleRemoteProject();
            return;
        }
        const remoteProject = this.pendingRemoteProject;
        this.pendingRemoteProject = null;
        if ((this.lastLocalChangeAt || 0) > remoteProject.receivedAt) return;
        this.applyingRemote = true;
        clearTimeout(this.publishTimer);
        emitPlanetCollaborationStatus({status: 'applying'});
        try {
            const snapshot = remoteProject.snapshot;
            const data = snapshot.buffer.slice(snapshot.byteOffset, snapshot.byteOffset + snapshot.byteLength);
            const editingTargetKey = this.props.editingTargetKey;
            this.suppressLocalEventsUntil = Date.now() + REMOTE_EVENT_SUPPRESSION_MS;
            await this.props.vm.loadProject(data);
            const target = this.props.vm.runtime.targets.find(item => (
                editingTargetKey === 'stage' ? item.isStage : `sprite:${item.getName()}` === editingTargetKey
            ));
            if (target) this.props.vm.setEditingTarget(target.id);
            this.lastAppliedRevision = remoteProject.revision;
            this.lastRemoteAppliedAt = Date.now();
            window.dispatchEvent(new CustomEvent(PLANET_COLLABORATION_REMOTE_APPLIED_EVENT));
            emitPlanetCollaborationStatus({status: 'connected'});
        } catch (error) {
            emitPlanetCollaborationStatus({status: 'error', message: '协作内容同步失败'});
        } finally {
            this.applyingRemote = false;
            this.suppressLocalEventsUntil = Date.now() + REMOTE_EVENT_SUPPRESSION_MS;
            if (this.pendingRemoteProject) this.scheduleRemoteProject();
        }
    }
    render () {
        return null;
    }
}

PlanetCollaborationManager.propTypes = {
    editingTargetKey: PropTypes.string,
    editingTargetName: PropTypes.string,
    isShowingProject: PropTypes.bool,
    projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    vm: PropTypes.instanceOf(VM).isRequired
};

const mapStateToProps = state => {
    const targets = state.scratchGui.targets;
    const editingTargetId = targets.editingTarget;
    const selected = targets.stage && targets.stage.id === editingTargetId ?
        targets.stage : targets.sprites[editingTargetId];
    const targetName = selected && (selected.name || (selected.isStage ? '舞台' : '角色'));
    return {
        editingTargetKey: selected ? (selected.isStage ? 'stage' : `sprite:${targetName}`) : null,
        editingTargetName: targetName,
        isShowingProject: getIsShowingProject(state.scratchGui.projectState.loadingState)
    };
};

export default connect(mapStateToProps)(PlanetCollaborationManager);
