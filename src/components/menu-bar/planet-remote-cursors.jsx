import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';

import {
    collaborationEnabled,
    PLANET_COLLABORATION_CURSOR_EVENT
} from '../../lib/planet-collaboration';
import {getSelectedTarget} from '../../lib/planet-collaboration-targets';
import {isPlanetProjectRoute} from '../../lib/planet-project-loader';
import {COSTUMES_TAB_INDEX} from '../../reducers/editor-tab';

import styles from './planet-remote-cursors.css';

const CURSOR_EXPIRY_MS = 5000;

class PlanetRemoteCursors extends React.Component {
    constructor (props) {
        super(props);
        this.state = {cursors: {}};
        this.handleCursor = this.handleCursor.bind(this);
    }
    componentDidMount () {
        window.addEventListener(PLANET_COLLABORATION_CURSOR_EVENT, this.handleCursor);
        this.expiryTimer = setInterval(() => this.expireCursors(), 1000);
    }
    componentWillUnmount () {
        window.removeEventListener(PLANET_COLLABORATION_CURSOR_EVENT, this.handleCursor);
        clearInterval(this.expiryTimer);
    }
    handleCursor (event) {
        const cursor = event.detail;
        if (!cursor || !cursor.sessionId) return;
        this.setState(previous => {
            const cursors = {...previous.cursors};
            if (cursor.visible === false) {
                delete cursors[cursor.sessionId];
            } else {
                cursors[cursor.sessionId] = {...cursor, updatedAt: Date.now()};
            }
            return {cursors};
        });
    }
    expireCursors () {
        const cutoff = Date.now() - CURSOR_EXPIRY_MS;
        this.setState(previous => {
            const entries = Object.entries(previous.cursors)
                .filter(([, cursor]) => cursor.updatedAt >= cutoff);
            if (entries.length === Object.keys(previous.cursors).length) return null;
            return {cursors: Object.fromEntries(entries)};
        });
    }
    render () {
        if (!isPlanetProjectRoute() || !collaborationEnabled()) return null;
        const visibleCursors = Object.values(this.state.cursors)
            .filter(cursor => cursor.targetId === this.props.editingTargetKey);
        return ReactDOM.createPortal(
            <div
                aria-hidden="true"
                className={styles.layer}
            >
                {visibleCursors.map(cursor => (
                    <div
                        className={styles.cursor}
                        key={cursor.sessionId}
                        style={{
                            color: cursor.color || '#0ea5e9',
                            left: `${cursor.x * 100}%`,
                            top: `${cursor.y * 100}%`
                        }}
                    >
                        <svg
                            className={styles.pointer}
                            viewBox="0 0 22 28"
                        >
                            <path
                                d="M2 2l17 12-8 1 4 8-4 2-4-8-5 6z"
                                fill="currentColor"
                                stroke="white"
                                strokeLinejoin="round"
                                strokeWidth="1.5"
                            />
                        </svg>
                        <span
                            className={styles.label}
                            style={{backgroundColor: cursor.color || '#0ea5e9'}}
                        >
                            {cursor.nickname || '协作者'}
                        </span>
                    </div>
                ))}
            </div>,
            document.body
        );
    }
}

PlanetRemoteCursors.propTypes = {
    editingTargetKey: PropTypes.string
};

const mapStateToProps = state => {
    const targets = state.scratchGui.targets;
    const selected = getSelectedTarget(
        targets,
        state.scratchGui.editorTab.activeTabIndex === COSTUMES_TAB_INDEX
    );
    return {
        editingTargetKey: selected && selected.targetId
    };
};

export default connect(mapStateToProps)(PlanetRemoteCursors);
