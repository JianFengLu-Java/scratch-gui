import {BadgeCheckIcon} from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';
import styles from './planet-user-verification.css';

const labels = {
    OFFICIAL: '官方账号', OPERATIONS: '运营认证', TEACHER: '老师认证', PERSONAL: '个人认证'
};

const PlanetUserVerification = ({verification}) => {
    const type = verification && verification.type;
    if (!Object.prototype.hasOwnProperty.call(labels, type)) return null;
    const label = verification.description ? `${labels[type]}：${verification.description}` : labels[type];
    return <span
        aria-label={label}
        className={styles.mark}
        data-verification={type}
        role="img"
        title={label}
    ><BadgeCheckIcon aria-hidden="true" /></span>;
};

PlanetUserVerification.propTypes = {
    verification: PropTypes.shape({type: PropTypes.string, description: PropTypes.string})
};

export default PlanetUserVerification;
