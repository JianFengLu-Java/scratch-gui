import PropTypes from 'prop-types';
import React from 'react';
import {loadPlanetMessageUi} from '../../lib/planet-message-ui';
import {
    clearPlanetSession, readPlanetEnvelope, refreshPlanetSession, resolvePlanetAssetUrl
} from '../../lib/planet-session';
import PlanetMessageText from './planet-message-text.jsx';
import styles from './planet-project-chat.css';

class PlanetBubbleMessage extends React.Component {
    constructor (props) {
        super(props);
        this.host = React.createRef();
        this.state = {ready: false};
        this.loadAppearances = this.loadAppearances.bind(this);
        this.handleBodyOffsetChange = this.handleBodyOffsetChange.bind(this);
    }
    componentDidMount () {
        this.mounted = true;
        loadPlanetMessageUi().then(runtime => {
            if (!this.mounted || !(runtime.messageUiVersion >= 4) ||
                typeof runtime.mountBubbleMessage !== 'function') return;
            this.appearance = runtime.mountBubbleMessage(this.host.current, this.runtimeProps());
            this.setState({ready: true});
        })
            .catch(() => { /* Keep selectable default text when the optional runtime is unavailable. */ });
    }
    componentDidUpdate (previous) {
        if (previous.message !== this.props.message || previous.own !== this.props.own ||
            previous.timeLabel !== this.props.timeLabel) {
            if (this.appearance) this.appearance.update(this.runtimeProps());
        }
    }
    componentWillUnmount () {
        this.mounted = false;
        this.handleBodyOffsetChange(0);
        if (this.appearance) this.appearance.unmount();
    }
    handleBodyOffsetChange (top) {
        const row = this.host.current && this.host.current.closest('[data-slot="message"]');
        if (!row) return;
        // Export only layout geometry across the React/Shadow DOM boundary.
        // The row owns the avatar/name; the shared renderer owns decoration sizing.
        if (top > 0) row.style.setProperty('--message-bubble-top-inset', `${top}px`);
        else row.style.removeProperty('--message-bubble-top-inset');
    }
    async loadAppearances (userIds, signal) {
        const params = new URLSearchParams({userIds: userIds.join(','), projectId: this.props.projectId});
        const request = async retry => {
            const session = await refreshPlanetSession();
            const response = await fetch(`/backend-api/bubble-appearances?${params}`, {
                signal, credentials: 'include', headers: {Authorization: `Bearer ${session.accessToken}`}
            });
            if (response.status === 401 && retry) {
                clearPlanetSession();
                return request(false);
            }
            return readPlanetEnvelope(response);
        };
        const appearances = await request(true);
        return appearances.map(appearance => ({
            ...appearance,
            template: appearance.template ? {...appearance.template,
                thumbnailUrl: appearance.template.thumbnailUrl ?
                    resolvePlanetAssetUrl(appearance.template.thumbnailUrl) : appearance.template.thumbnailUrl} : null,
            assets: appearance.assets.map(asset => ({...asset, previewUrl: resolvePlanetAssetUrl(asset.previewUrl)}))
        }));
    }
    runtimeProps () {
        return {
            projectId: this.props.projectId,
            viewerId: this.props.viewerId,
            userId: String(this.props.message.userId),
            message: this.props.message.content || '',
            side: this.props.own ? 'self' : 'other',
            timeLabel: this.props.timeLabel,
            sentAt: this.props.message.sentAt,
            onBodyOffsetChange: this.handleBodyOffsetChange,
            loadAppearances: this.loadAppearances};
    }
    render () {
        return (
            <div data-slot="bubble">
                <div
                    ref={this.host}
                    style={{display: 'flex'}}
                />
                {!this.state.ready && (
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                            alignItems: this.props.own ? 'flex-end' : 'flex-start'
                        }}
                    >
                        <div
                            className={`${styles.bubble} ${this.props.own ?
                                styles.bubbleDefault : styles.bubbleOutline}`}
                        >
                            <div className={styles.bubbleContent}>
                                <PlanetMessageText content={this.props.message.content} />
                            </div>
                        </div>
                        <time
                            className={styles.messageTime}
                            data-slot="message-time"
                            dateTime={this.props.message.sentAt}
                            title={new Date(this.props.message.sentAt).toLocaleString()}
                        >
                            {this.props.timeLabel}
                        </time>
                    </div>
                )}
            </div>
        );
    }
}

PlanetBubbleMessage.propTypes = {
    projectId: PropTypes.string.isRequired,
    viewerId: PropTypes.string.isRequired,
    own: PropTypes.bool.isRequired,
    timeLabel: PropTypes.string.isRequired,
    message: PropTypes.shape({
        userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        content: PropTypes.string,
        sentAt: PropTypes.string.isRequired
    }).isRequired
};

export default PlanetBubbleMessage;
