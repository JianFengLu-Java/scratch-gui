import React from 'react';
import {CloudIcon} from 'lucide-react';

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
        const label = labels[this.state.status] || labels.error;
        return (
            <button
                aria-busy={this.state.status === 'saving'}
                aria-label={this.state.message ? `${label}：${this.state.message}` : label}
                className={
                    `${styles.status} ${styles[this.state.status]}`
                }
                disabled={!interactive}
                title={this.state.message || labels[this.state.status]}
                type="button"
                onClick={this.handleClick}
            >
                <CloudIcon
                    aria-hidden="true"
                    className={styles.mobileIcon}
                />
                <span
                    aria-hidden="true"
                    className={styles.dot}
                />
                <span
                    aria-hidden="true"
                    className={styles.mobilePrefix}
                >{'保存'}</span>
                <span className={styles.desktopLabel}>{labels[this.state.status] || labels.error}</span>
                <span className={styles.mobileLabel}>{({
                    conflict: '云端更新',
                    error: '保存失败',
                    pending: '待保存',
                    saved: '已保存',
                    saving: '保存中'
                })[this.state.status] || '保存失败'}</span>
            </button>
        );
    }
}

export default PlanetAutosaveStatus;
