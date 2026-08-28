import PropTypes from 'prop-types';
import React from 'react';

import Modal from '../modal/modal.jsx';

import styles from './addon-settings-modal.css';

const getSettingsUrl = addonId => {
    const path = process.env.ROUTING_STYLE === 'wildcard' ? 'addons' : 'addons.html';
    return `${process.env.ROOT}${path}${addonId ? `#${addonId}` : ''}`;
};

const AddonSettingsModal = ({addonId, onClose}) => (
    <Modal
        className={styles.modal}
        contentLabel="插件设置"
        onRequestClose={onClose}
    >
        <iframe
            className={styles.frame}
            src={getSettingsUrl(addonId)}
            title="TurboWarp 插件设置"
        />
    </Modal>
);

AddonSettingsModal.propTypes = {
    addonId: PropTypes.string,
    onClose: PropTypes.func.isRequired
};

export default AddonSettingsModal;
