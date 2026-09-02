import PropTypes from 'prop-types';
import React from 'react';

import {loadPlanetMessageUi} from '../../lib/planet-message-ui';
import styles from './planet-project-chat.css';

class PlanetMessageText extends React.Component {
    constructor (props) {
        super(props);
        this.state = {runtime: null};
    }
    componentDidMount () {
        this.mounted = true;
        loadPlanetMessageUi().then(runtime => {
            if (this.mounted) this.setState({runtime});
        })
            .catch(() => {
                // Keep readable plain-text tokens if the optional UI bundle is offline.
            });
    }
    componentWillUnmount () {
        this.mounted = false;
    }
    render () {
        const {content} = this.props;
        const segments = this.state.runtime ? this.state.runtime.splitEifEmojiTokens(content) : [];
        return (
            <p>
                {segments.length ? segments.map((segment, index) => (segment.type === 'emoji' ? (
                    <img
                        alt={segment.token}
                        className={styles.inlineEmoji}
                        draggable={false}
                        key={`${index}:${segment.token}`}
                        loading="lazy"
                        src={segment.emoji.src}
                        title={segment.emoji.label}
                    />
                ) : segment.value)) : content}
            </p>
        );
    }
}

PlanetMessageText.propTypes = {
    content: PropTypes.string.isRequired
};

export default PlanetMessageText;
