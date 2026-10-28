import PropTypes from 'prop-types';
import React from 'react';

import styles from './watermark.css';

const Watermark = props => (
    <img
        alt=""
        aria-hidden="true"
        className={styles.spriteImage}
        src={props.costumeURL}
        draggable={false}
    />
);

Watermark.propTypes = {
    costumeURL: PropTypes.string
};

export default Watermark;
