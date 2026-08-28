import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import {defineMessages, injectIntl, intlShape} from 'react-intl';

import successIcon from '../../lib/assets/icon--success.svg';
import errorIcon from '../menu-bar/tw-error.svg';

import styles from './asset-loading-toast.css';

const messages = defineMessages({
    spriteLoading: {
        id: 'tw.spriteLoading.loading',
        defaultMessage: 'Loading sprite {name}…',
        description: 'Toast shown while a sprite is being added from the library'
    },
    spriteLoadingProgress: {
        id: 'tw.spriteLoading.loadingProgress',
        defaultMessage: 'Loading sprite {name}… ({finished}/{total})',
        description: 'Toast shown while sprite assets are being loaded'
    },
    spriteSuccess: {
        id: 'tw.spriteLoading.success',
        defaultMessage: 'Sprite {name} added',
        description: 'Toast shown after a sprite was added from the library'
    },
    spriteError: {
        id: 'tw.spriteLoading.error',
        defaultMessage: 'Could not add sprite {name}. Please try again.',
        description: 'Toast shown when a sprite could not be added from the library'
    },
    backdropLoading: {
        id: 'tw.backdropLoading.loading',
        defaultMessage: 'Loading backdrop {name}…',
        description: 'Toast shown while a backdrop is being added from the library'
    },
    backdropLoadingProgress: {
        id: 'tw.backdropLoading.loadingProgress',
        defaultMessage: 'Loading backdrop {name}… ({finished}/{total})',
        description: 'Toast shown while backdrop assets are being loaded'
    },
    backdropSuccess: {
        id: 'tw.backdropLoading.success',
        defaultMessage: 'Backdrop {name} added',
        description: 'Toast shown after a backdrop was added from the library'
    },
    backdropError: {
        id: 'tw.backdropLoading.error',
        defaultMessage: 'Could not add backdrop {name}. Please try again.',
        description: 'Toast shown when a backdrop could not be added from the library'
    },
    soundLoading: {
        id: 'tw.soundLoading.loading',
        defaultMessage: 'Loading sound {name}…',
        description: 'Toast shown while a sound is being added from the library'
    },
    soundLoadingProgress: {
        id: 'tw.soundLoading.loadingProgress',
        defaultMessage: 'Loading sound {name}… ({finished}/{total})',
        description: 'Toast shown while a sound is being downloaded and decoded'
    },
    soundSuccess: {
        id: 'tw.soundLoading.success',
        defaultMessage: 'Sound {name} added',
        description: 'Toast shown after a sound was added from the library'
    },
    soundError: {
        id: 'tw.soundLoading.error',
        defaultMessage: 'Could not add sound {name}. Please try again.',
        description: 'Toast shown when a sound could not be added from the library'
    }
});

const AssetLoadingToast = ({intl, notice}) => {
    if (!notice) return null;

    const isLoading = notice.status === 'loading';
    const hasProgress = isLoading && notice.total > 0;
    const progress = hasProgress ? Math.min(100, Math.round(notice.finished / notice.total * 100)) :
        notice.status === 'success' ? 100 : 0;
    const messagePrefix = notice.assetType === 'backdrop' ? 'backdrop' :
        notice.assetType === 'sound' ? 'sound' : 'sprite';
    const messageKey = notice.status === 'success' ? `${messagePrefix}Success` :
        notice.status === 'error' ? `${messagePrefix}Error` :
            hasProgress ? `${messagePrefix}LoadingProgress` : `${messagePrefix}Loading`;
    const message = intl.formatMessage(messages[messageKey], {
        name: notice.name,
        finished: notice.finished,
        total: notice.total
    });

    return (
        <div
            aria-atomic="true"
            aria-live={notice.status === 'error' ? 'assertive' : 'polite'}
            className={classNames(styles.toast, styles[notice.status])}
            role={notice.status === 'error' ? 'alert' : 'status'}
        >
            <div className={styles.content}>
                <span
                    className={classNames(styles.iconSlot, {
                        [styles.errorIcon]: notice.status === 'error'
                    })}
                >
                    {isLoading ? (
                        <span
                            aria-hidden="true"
                            className={styles.loadingIcon}
                        />
                    ) : (
                        <img
                            alt=""
                            src={notice.status === 'success' ? successIcon : errorIcon}
                        />
                    )}
                </span>
                <span className={styles.message}>{message}</span>
                {hasProgress && <span className={styles.percent}>{`${progress}%`}</span>}
            </div>
            {notice.status !== 'error' && (
                <div
                    aria-label={message}
                    aria-valuemax="100"
                    aria-valuemin="0"
                    aria-valuenow={hasProgress || notice.status === 'success' ? progress : null}
                    className={styles.progressTrack}
                    role="progressbar"
                >
                    <div
                        className={classNames(styles.progressValue, {
                            [styles.indeterminate]: isLoading && !hasProgress
                        })}
                        style={hasProgress || notice.status === 'success' ? {width: `${progress}%`} : null}
                    />
                </div>
            )}
        </div>
    );
};

AssetLoadingToast.propTypes = {
    intl: intlShape.isRequired,
    notice: PropTypes.shape({
        assetType: PropTypes.oneOf(['backdrop', 'sound', 'sprite']).isRequired,
        finished: PropTypes.number.isRequired,
        name: PropTypes.string.isRequired,
        status: PropTypes.oneOf(['loading', 'success', 'error']).isRequired,
        total: PropTypes.number.isRequired
    })
};

export default injectIntl(AssetLoadingToast);
