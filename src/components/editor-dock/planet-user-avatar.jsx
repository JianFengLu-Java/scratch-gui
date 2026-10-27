import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

import {resolvePlanetAssetUrl} from '../../lib/planet-session';

import styles from './planet-user-avatar.css';

const initials = value => (String(value || '用户')
    .trim()
    .slice(0, 1) || '用').toUpperCase();

const PlanetUserAvatar = ({className, member, style}) => {
    const [failedUrl, setFailedUrl] = React.useState('');
    const avatarUrl = resolvePlanetAssetUrl(member.avatarUrl);
    const frame = member.avatarFrame;
    const frameUrl = frame && /^\/(?:api\/v1|backend-api)\/files\/[1-9]\d*$/.test(frame.imageUrl || '') ?
        resolvePlanetAssetUrl(frame.imageUrl) : '';
    const [failedFrameUrl, setFailedFrameUrl] = React.useState('');
    const bounded = (value, fallback, min, max) => Number.isFinite(Number(value)) ?
        Math.max(min, Math.min(max, Number(value))) : fallback;
    const handleImageError = React.useCallback(() => setFailedUrl(avatarUrl), [avatarUrl]);
    return (
        <span
            aria-hidden="true"
            className={classNames(styles.avatar, className)}
            style={style}
        >
            <span className={styles.image}>
                {initials(member.nickname)}
                {avatarUrl && failedUrl !== avatarUrl ? (
                    <img alt="" src={avatarUrl} onError={handleImageError} />
                ) : null}
            </span>
            {frameUrl && failedFrameUrl !== frameUrl && <img
                alt=""
                className={styles.frame}
                src={frameUrl}
                style={{
                    width: `${bounded(frame.scalePercent, 120, 50, 300)}%`,
                    height: `${bounded(frame.scalePercent, 120, 50, 300)}%`,
                    left: `${50 + bounded(frame.offsetXPercent, 0, -100, 100)}%`,
                    top: `${50 + bounded(frame.offsetYPercent, 0, -100, 100)}%`
                }}
                onError={() => setFailedFrameUrl(frameUrl)}
            />}
        </span>
    );
};

PlanetUserAvatar.propTypes = {
    className: PropTypes.string,
    member: PropTypes.shape({
        avatarUrl: PropTypes.string,
        avatarFrame: PropTypes.shape({
            imageUrl: PropTypes.string,
            scalePercent: PropTypes.number,
            offsetXPercent: PropTypes.number,
            offsetYPercent: PropTypes.number
        }),
        nickname: PropTypes.string
    }).isRequired,
    style: PropTypes.object
};

PlanetUserAvatar.defaultProps = {
    className: null,
    style: null
};

export default PlanetUserAvatar;
