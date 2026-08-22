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

class PlanetRoleLockOverlay extends React.Component {
    constructor (props) {
        super(props);
        this.state = {locks: [], pendingTargetId: null, sessionId: null};
        this.handleLockStatus = this.handleLockStatus.bind(this);
    }
    componentDidMount () {
        window.addEventListener(PLANET_ROLE_LOCK_STATUS_EVENT, this.handleLockStatus);
        this.syncBodyClass();
    }
    componentDidUpdate () {
        this.syncBodyClass();
    }
    componentWillUnmount () {
        window.removeEventListener(PLANET_ROLE_LOCK_STATUS_EVENT, this.handleLockStatus);
        document.body.classList.remove('planet-role-locked');
    }
    handleLockStatus (event) {
        const detail = event.detail || {};
        if (detail.type === 'session-ready') {
            this.setState({sessionId: detail.sessionId});
        } else if (detail.type === 'collaboration-destroyed') {
            this.setState({locks: [], pendingTargetId: null, sessionId: null});
        } else if (detail.type === 'role-locks') {
            this.setState(previous => ({
                locks: Array.isArray(detail.locks) ? detail.locks : [],
                pendingTargetId: previous.pendingTargetId && (detail.locks || []).some(lock =>
                    lock.targetId === previous.pendingTargetId && lock.sessionId === previous.sessionId) ?
                    null : previous.pendingTargetId
            }));
        } else if (detail.type === 'role-lock-pending') {
            this.setState({pendingTargetId: detail.targetId});
        } else if (detail.type === 'role-lock-granted') {
            this.setState(previous => ({
                locks: this.upsertLock(previous.locks, detail.lock),
                pendingTargetId: null
            }));
        } else if (detail.type === 'role-lock-denied') {
            this.setState(previous => ({
                locks: this.upsertLock(previous.locks, detail.lock),
                pendingTargetId: detail.lock ? detail.lock.targetId : previous.pendingTargetId
            }));
        }
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
        const current = this.currentLock();
        return Boolean(
            (current && current.sessionId !== this.state.sessionId) ||
            (this.state.pendingTargetId === this.props.editingTargetKey && !current)
        );
    }
    syncBodyClass () {
        document.body.classList.toggle('planet-role-locked', this.isBlocked());
    }
    render () {
        if (!isPlanetProjectRoute() || !collaborationEnabled() || !this.isBlocked()) return null;
        const current = this.currentLock();
        return ReactDOM.createPortal(
            <div
                aria-live="polite"
                className={styles.notice}
                role="status"
            >
                <span
                    aria-hidden="true"
                    className={styles.dot}
                    style={{backgroundColor: current ? current.color : '#f59e0b'}}
                />
                <span>
                    {current ? `${current.nickname || '一位协作者'} 正在编辑 ${this.props.editingTargetName}` :
                        `正在获取 ${this.props.editingTargetName} 编辑权`}
                </span>
                <span className={styles.hint}>{'可先切换到其他角色'}</span>
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
