import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';

import {
    collaborationEnabled,
    PLANET_ROLE_LOCK_STATUS_EVENT
} from '../lib/planet-collaboration';
import {isPlanetProjectRoute} from '../lib/planet-project-loader';

import styles from './planet-role-lock-overlay.css';

const BLOCK_EDITOR_SELECTOR = [
    '.blocklySvg',
    '.blocklyToolboxDiv',
    '.blocklyWidgetDiv',
    '[class*="blocks_blocks"]'
].join(',');

class PlanetRoleLockOverlay extends React.Component {
    constructor (props) {
        super(props);
        this.state = {
            deniedTargetId: null,
            denialMessage: '',
            inactive: false,
            locks: [],
            pendingTargetId: null,
            sessionId: null
        };
        this.handleLockStatus = this.handleLockStatus.bind(this);
        this.guardBlockEditorEvent = this.guardBlockEditorEvent.bind(this);
    }
    componentDidMount () {
        window.addEventListener(PLANET_ROLE_LOCK_STATUS_EVENT, this.handleLockStatus);
        document.addEventListener('pointerdown', this.guardBlockEditorEvent, true);
        document.addEventListener('dragstart', this.guardBlockEditorEvent, true);
        document.addEventListener('drop', this.guardBlockEditorEvent, true);
        document.addEventListener('keydown', this.guardBlockEditorEvent, true);
        this.syncBodyClass();
    }
    componentDidUpdate () {
        this.syncBodyClass();
    }
    componentWillUnmount () {
        window.removeEventListener(PLANET_ROLE_LOCK_STATUS_EVENT, this.handleLockStatus);
        document.removeEventListener('pointerdown', this.guardBlockEditorEvent, true);
        document.removeEventListener('dragstart', this.guardBlockEditorEvent, true);
        document.removeEventListener('drop', this.guardBlockEditorEvent, true);
        document.removeEventListener('keydown', this.guardBlockEditorEvent, true);
        document.body.classList.remove('planet-role-locked');
    }
    handleLockStatus (event) {
        const detail = event.detail || {};
        if (detail.type === 'session-ready') {
            this.setState({inactive: false, sessionId: detail.sessionId});
        } else if (detail.type === 'collaboration-destroyed') {
            this.setState({
                deniedTargetId: null,
                denialMessage: '',
                inactive: detail.reason === 'session-replaced',
                locks: [],
                pendingTargetId: null,
                sessionId: null
            });
        } else if (detail.type === 'role-locks') {
            this.setState(previous => ({
                locks: Array.isArray(detail.locks) ? detail.locks : [],
                pendingTargetId: previous.pendingTargetId && (detail.locks || []).some(lock =>
                    lock.targetId === previous.pendingTargetId && lock.sessionId === previous.sessionId) ?
                    null : previous.pendingTargetId
            }));
        } else if (detail.type === 'role-lock-pending') {
            this.setState({deniedTargetId: null, denialMessage: '', pendingTargetId: detail.targetId});
        } else if (detail.type === 'role-lock-granted') {
            this.setState(previous => ({
                deniedTargetId: null,
                denialMessage: '',
                locks: this.upsertLock(previous.locks, detail.lock),
                pendingTargetId: null
            }));
        } else if (detail.type === 'role-lock-denied') {
            this.setState(previous => ({
                deniedTargetId: detail.reason === 'NOT_ASSIGNED' ? detail.targetId : null,
                denialMessage: detail.reason === 'NOT_ASSIGNED' ? detail.message : '',
                locks: this.upsertLock(previous.locks, detail.lock),
                pendingTargetId: detail.lock ? detail.lock.targetId : detail.targetId || previous.pendingTargetId
            }));
        }
    }
    guardBlockEditorEvent (event) {
        if (!this.isBlocked()) return;
        const target = event.target && event.target.closest ? event.target.closest(BLOCK_EDITOR_SELECTOR) : null;
        const keyboardInsideBlocks = event.type === 'keydown' && document.activeElement &&
            document.activeElement.closest && document.activeElement.closest(BLOCK_EDITOR_SELECTOR);
        if (!target && !keyboardInsideBlocks) return;
        event.preventDefault();
        event.stopPropagation();
    }
    upsertLock (locks, lock) {
        if (!lock) return locks;
        return [...locks.filter(item => item.targetId !== lock.targetId), lock];
    }
    currentLock () {
        return this.state.locks.find(lock => lock.targetId === this.props.editingTargetKey);
    }
    isBlocked () {
        if (!isPlanetProjectRoute() || !collaborationEnabled() || !this.props.editingTargetKey) return false;
        if (this.state.inactive) return true;
        const current = this.currentLock();
        return Boolean(
            (current && current.sessionId !== this.state.sessionId) ||
            (this.state.pendingTargetId === this.props.editingTargetKey && !current) ||
            this.state.deniedTargetId === this.props.editingTargetKey
        );
    }
    syncBodyClass () {
        document.body.classList.toggle('planet-role-locked', this.isBlocked());
    }
    render () {
        if (!isPlanetProjectRoute() || !collaborationEnabled() || !this.isBlocked()) return null;
        const current = this.currentLock();
        const denied = this.state.deniedTargetId === this.props.editingTargetKey;
        const message = this.state.inactive ? '协作会话已在其他窗口接管' : denied ?
            (this.state.denialMessage || `你没有 ${this.props.editingTargetName} 的编辑权限`) : current ?
                `${current.nickname || '一位协作者'} 正在编辑 ${this.props.editingTargetName}` :
                `正在获取 ${this.props.editingTargetName} 编辑权`;
        const hint = this.state.inactive ? '此窗口已停止协作编辑' : denied ?
            '可切换到房主已分配的角色' : '可先切换到其他角色';
        return ReactDOM.createPortal(
            <div
                aria-live="polite"
                className={styles.notice}
                role="status"
            >
                <span
                    aria-hidden="true"
                    className={styles.dot}
                    style={current ? {backgroundColor: current.color} : null}
                />
                <span>{message}</span>
                <span className={styles.hint}>{hint}</span>
            </div>,
            document.body
        );
    }
}

PlanetRoleLockOverlay.propTypes = {
    editingTargetKey: PropTypes.string,
    editingTargetName: PropTypes.string
};

const mapStateToProps = state => {
    const targets = state.scratchGui.targets;
    const editingTargetId = targets.editingTarget;
    const selected = targets.stage && targets.stage.id === editingTargetId ?
        targets.stage : targets.sprites[editingTargetId];
    const targetName = selected && (selected.name || (selected.isStage ? '舞台' : '角色'));
    return {
        editingTargetKey: selected ? (selected.isStage ? 'stage' : `sprite:${targetName}`) : null,
        editingTargetName: targetName
    };
};

export default connect(mapStateToProps)(PlanetRoleLockOverlay);
