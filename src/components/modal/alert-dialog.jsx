import {CircleAlertIcon} from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';
import ReactModal from 'react-modal';

import styles from './alert-dialog.css';

const AlertDialog = ({
    cancelLabel,
    confirmLabel,
    description,
    isOpen,
    onCancel,
    onConfirm,
    title
}) => (
    <ReactModal
        isOpen={isOpen}
        className={styles.content}
        contentLabel={title}
        overlayClassName={styles.overlay}
        shouldCloseOnOverlayClick={false}
        onRequestClose={onCancel}
    >
        <div className={styles.header}>
            <div className={styles.media}>
                <CircleAlertIcon />
            </div>
            <div className={styles.copy}>
                <h2 className={styles.title}>{title}</h2>
                <p className={styles.description}>{description}</p>
            </div>
        </div>
        <div className={styles.footer}>
            <button
                className={styles.cancelButton}
                type="button"
                onClick={onCancel}
            >
                {cancelLabel}
            </button>
            <button
                className={styles.confirmButton}
                type="button"
                onClick={onConfirm}
            >
                {confirmLabel}
            </button>
        </div>
    </ReactModal>
);

AlertDialog.propTypes = {
    cancelLabel: PropTypes.node.isRequired,
    confirmLabel: PropTypes.node.isRequired,
    description: PropTypes.node.isRequired,
    isOpen: PropTypes.bool.isRequired,
    onCancel: PropTypes.func.isRequired,
    onConfirm: PropTypes.func.isRequired,
    title: PropTypes.string.isRequired
};

export default AlertDialog;
