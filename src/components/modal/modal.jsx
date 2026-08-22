import classNames from 'classnames';
import {
    ArrowLeftIcon,
    CircleHelpIcon,
    XIcon
} from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';
import ReactModal from 'react-modal';
import {FormattedMessage} from 'react-intl';

import styles from './modal.css';

const ModalComponent = props => (
    <ReactModal
        isOpen
        className={classNames(styles.modalContent, props.className, {
            [styles.fullScreen]: props.fullScreen
        })}
        contentLabel={props.contentLabel}
        overlayClassName={classNames(styles.modalOverlay, props.overlayClassName)}
        shouldCloseOnOverlayClick={props.shouldCloseOnOverlayClick}
        onRequestClose={props.onRequestClose}
    >
        <div
            className={styles.dialog}
            dir={props.isRtl ? 'rtl' : 'ltr'}
        >
            <div className={classNames(styles.header, props.headerClassName)}>
                <div className={classNames(styles.headerItem, styles.headerItemHelp)}>
                    {props.onHelp ? (
                        <button
                            className={classNames(styles.headerAction, styles.helpButton)}
                            type="button"
                            onClick={props.onHelp}
                        >
                            <CircleHelpIcon data-icon="inline-start" />
                            <FormattedMessage
                                defaultMessage="Help"
                                description="Help button in modal"
                                id="gui.modal.help"
                            />
                        </button>
                    ) : null}
                </div>
                <h2
                    className={classNames(
                        styles.headerItem,
                        styles.headerItemTitle
                    )}
                >
                    {props.headerImage ? (
                        <img
                            alt=""
                            className={styles.headerImage}
                            src={props.headerImage}
                            draggable={false}
                        />
                    ) : null}
                    {props.contentLabel}
                </h2>
                <div
                    className={classNames(
                        styles.headerItem,
                        styles.headerItemClose
                    )}
                >
                    {props.fullScreen ? (
                        <button
                            className={classNames(styles.headerAction, styles.backButton)}
                            type="button"
                            onClick={props.onRequestClose}
                        >
                            <ArrowLeftIcon data-icon="inline-start" />
                            <FormattedMessage
                                defaultMessage="Back"
                                description="Back button in modal"
                                id="gui.modal.back"
                            />
                        </button>
                    ) : props.hideClose ? null : (
                        <button
                            aria-label="Close"
                            className={classNames(styles.headerAction, styles.closeButton)}
                            type="button"
                            onClick={props.onRequestClose}
                        >
                            <XIcon />
                        </button>
                    )}
                </div>
            </div>
            {props.children}
        </div>
    </ReactModal>
);

ModalComponent.propTypes = {
    children: PropTypes.node,
    className: PropTypes.string,
    contentLabel: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.object
    ]).isRequired,
    fullScreen: PropTypes.bool,
    headerClassName: PropTypes.string,
    headerImage: PropTypes.string,
    hideClose: PropTypes.bool,
    isRtl: PropTypes.bool,
    onHelp: PropTypes.func,
    overlayClassName: PropTypes.string,
    onRequestClose: PropTypes.func,
    shouldCloseOnOverlayClick: PropTypes.bool
};

ModalComponent.defaultProps = {
    hideClose: false,
    shouldCloseOnOverlayClick: true
};

export default ModalComponent;
