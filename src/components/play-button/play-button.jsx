import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

import {defineMessages, injectIntl, intlShape} from 'react-intl';

import styles from './play-button.css';

import playIcon from './icon--play.svg';
import stopIcon from './icon--stop.svg';

const messages = defineMessages({
    loading: {
        id: 'tw.soundPreview.loading',
        description: 'Title of the button while a sound preview is loading',
        defaultMessage: 'Loading preview'
    },
    play: {
        id: 'gui.playButton.play',
        description: 'Title of the button to start playing the sound',
        defaultMessage: 'Play'
    },
    stop: {
        id: 'gui.playButton.stop',
        description: 'Title of the button to stop the sound',
        defaultMessage: 'Stop'
    }
});

const PlayButtonComponent = ({
    className,
    intl,
    isLoading,
    isPlaying,
    onClick,
    onMouseDown,
    onMouseEnter,
    onMouseLeave,
    setButtonRef,
    ...props
}) => {
    const label = isLoading ? intl.formatMessage(messages.loading) : isPlaying ?
        intl.formatMessage(messages.stop) :
        intl.formatMessage(messages.play);

    return (
        <div
            aria-busy={isLoading}
            aria-label={label}
            className={classNames(styles.playButton, className, {
                [styles.playing]: isPlaying,
                [styles.loading]: isLoading
            })}
            onClick={onClick}
            onMouseDown={onMouseDown}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            ref={setButtonRef}
            {...props}
        >
            {isLoading ? (
                <span
                    aria-hidden="true"
                    className={styles.loadingIcon}
                />
            ) : (
                <img
                    className={styles.playIcon}
                    draggable={false}
                    src={isPlaying ? stopIcon : playIcon}
                />
            )}
        </div>
    );
};

PlayButtonComponent.propTypes = {
    className: PropTypes.string,
    intl: intlShape,
    isLoading: PropTypes.bool,
    isPlaying: PropTypes.bool.isRequired,
    onClick: PropTypes.func.isRequired,
    onMouseDown: PropTypes.func.isRequired,
    onMouseEnter: PropTypes.func.isRequired,
    onMouseLeave: PropTypes.func.isRequired,
    setButtonRef: PropTypes.func.isRequired
};

export default injectIntl(PlayButtonComponent);
