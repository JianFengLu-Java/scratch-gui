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
    const handleImageError = React.useCallback(() => setFailedUrl(avatarUrl), [avatarUrl]);
    return (
        <span
            aria-hidden="true"
            className={classNames(styles.avatar, className)}
            style={style}
        >
            {initials(member.nickname)}
            {avatarUrl && failedUrl !== avatarUrl ? (
                <img
                    alt=""
                    src={avatarUrl}
                    onError={handleImageError}
                />
            ) : null}
        </span>
    );
};

PlanetUserAvatar.propTypes = {
    className: PropTypes.string,
    member: PropTypes.shape({
        avatarUrl: PropTypes.string,
        nickname: PropTypes.string
    }).isRequired,
    style: PropTypes.object
};

PlanetUserAvatar.defaultProps = {
    className: null,
    style: null
};

export default PlanetUserAvatar;
