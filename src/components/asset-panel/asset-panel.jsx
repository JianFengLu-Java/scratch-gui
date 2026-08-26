import React from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';

import Box from '../box/box.jsx';
import Selector from './selector.jsx';
import styles from './asset-panel.css';

const AssetPanel = props => (
    <Box className={classNames(styles.wrapper, {[styles.readOnly]: props.readOnly})}>
        <Selector
            className={styles.selector}
            {...props}
        />
        <Box className={styles.detailArea}>
            {props.children}
        </Box>
    </Box>
);

AssetPanel.propTypes = {
    ...Selector.propTypes,
    readOnly: PropTypes.bool
};

export default AssetPanel;
