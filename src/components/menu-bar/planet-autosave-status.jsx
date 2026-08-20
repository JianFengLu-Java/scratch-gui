import React from 'react';

import {
    PLANET_AUTOSAVE_REQUEST_EVENT,
    PLANET_AUTOSAVE_STATUS_EVENT
} from '../../lib/planet-cloud-autosave';
import {isPlanetProjectRoute} from '../../lib/planet-project-loader';

import styles from './planet-autosave-status.css';

const labels = {
    conflict: '云端有更新，点击重新加载',
    error: '云端保存失败，点击重试',
    pending: '等待保存',
    saved: '已保存到云端',
    saving: '正在保存…'
};

class PlanetAutosaveStatus extends React.Component {
    constructor (props) {
        super(props);
        this.state = {status: 'saved'};
        this.handleClick = this.handleClick.bind(this);
        this.handleStatus = this.handleStatus.bind(this);
    }
    componentDidMount () {
        window.addEventListener(PLANET_AUTOSAVE_STATUS_EVENT, this.handleStatus);
    }
    componentWillUnmount () {
        window.removeEventListener(PLANET_AUTOSAVE_STATUS_EVENT, this.handleStatus);
    }
    handleStatus (event) {
        this.setState(event.detail || {status: 'error'});
    }
    handleClick () {
        if (this.state.status === 'conflict') {
            window.location.reload();
        } else if (this.state.status === 'error' || this.state.status === 'pending') {
            window.dispatchEvent(new CustomEvent(PLANET_AUTOSAVE_REQUEST_EVENT));
        }
    }
    render () {
        if (!isPlanetProjectRoute()) return null;
        const interactive = ['conflict', 'error', 'pending'].includes(this.state.status);
        return (
            <button
                className={
                    `${styles.status} ${styles[this.state.status]}`
                }
                disabled={!interactive}
                title={this.state.message || labels[this.state.status]}
                type="button"
                onClick={this.handleClick}
            >
                <span
                    aria-hidden="true"
                    className={styles.dot}
                />
                {labels[this.state.status] || labels.error}
            </button>
        );
    }
}

export default PlanetAutosaveStatus;
