import React from 'react';
import PropTypes from 'prop-types';

import {
    collaborationEnabled,
    PLANET_COLLABORATION_INVITATION_EVENT,
    PLANET_COLLABORATION_STATUS_EVENT
} from '../../lib/planet-collaboration';
import {PLANET_COLLABORATION_INVITE_READY_EVENT} from '../../lib/editor-dock-events';
import {isPlanetProjectRoute} from '../../lib/planet-project-loader';

import styles from './planet-collaboration-status.css';

class PlanetCollaborationStatus extends React.Component {
    constructor (props) {
        super(props);
        this.state = {invitation: null, status: 'connecting', participantCount: 1};
        this.handleClick = this.handleClick.bind(this);
        this.handleInvitation = this.handleInvitation.bind(this);
        this.handleStatus = this.handleStatus.bind(this);
    }
    componentDidMount () {
        window.addEventListener(PLANET_COLLABORATION_STATUS_EVENT, this.handleStatus);
        window.addEventListener(PLANET_COLLABORATION_INVITATION_EVENT, this.handleInvitation);
    }
    componentWillUnmount () {
        window.removeEventListener(PLANET_COLLABORATION_STATUS_EVENT, this.handleStatus);
        window.removeEventListener(PLANET_COLLABORATION_INVITATION_EVENT, this.handleInvitation);
    }
    handleStatus (event) {
        this.setState(previous => ({...previous, ...(event.detail || {status: 'error'})}));
    }
    handleInvitation (event) {
        this.setState({invitation: event.detail || null});
    }
    handleClick () {
        if (this.state.invitation && this.state.invitation.editorPath) {
            window.location.assign(this.state.invitation.editorPath);
            return;
        }
        if (!this.props.projectId) return;
        if (window.PlanetCollaborationInvite) {
            window.PlanetCollaborationInvite.open();
            return;
        }
        window.addEventListener(PLANET_COLLABORATION_INVITE_READY_EVENT, event => {
            if (event.detail) event.detail.open();
        }, {once: true});
    }
    label () {
        if (this.state.invitation) return '收到协作邀请';
        if (this.state.status === 'connected' && this.state.participantCount > 1) {
            return `${this.state.participantCount} 人在线`;
        }
        return {
            applying: '正在同步协作',
            connected: '协作已连接',
            connecting: '正在连接协作',
            disconnected: '协作已断开',
            replaced: '协作已在其他窗口接管',
            error: '协作不可用'
        }[this.state.status] || '协作不可用';
    }
    render () {
        if (!isPlanetProjectRoute() || !collaborationEnabled()) return null;
        return (
            <button
                className={`${styles.status} ${styles[this.state.status]}`}
                onClick={this.handleClick}
                title={this.state.message || this.label()}
                type="button"
            >
                <span
                    aria-hidden="true"
                    className={styles.dot}
                />
                {this.label()}
            </button>
        );
    }
}

PlanetCollaborationStatus.propTypes = {
    projectId: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
};

export default PlanetCollaborationStatus;
