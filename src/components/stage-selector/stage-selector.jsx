import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import {defineMessages, intlShape, injectIntl, FormattedMessage} from 'react-intl';

import Box from '../box/box.jsx';
import styles from './stage-selector.css';
import {PLANET_EDITOR_RESOURCE_COMMAND_EVENT} from '../../lib/editor-dock-events';

const messages = defineMessages({
    addBackdropFromLibrary: {
        id: 'gui.spriteSelector.addBackdropFromLibrary',
        description: 'Button to add a stage in the target pane from library',
        defaultMessage: 'Choose a Backdrop'
    }
});

const StageSelector = props => {
    const {
        backdropCount,
        backdropName,
        containerRef,
        dragOver,
        fileInputRef,
        intl,
        readOnly,
        selected,
        standalone,
        raised,
        receivedBlocks,
        url,
        onBackdropFileUploadClick,
        onBackdropFileUpload,
        onClick,
        onMouseEnter,
        onMouseLeave,
        onNewBackdropClick,
        onSurpriseBackdropClick,
        onEmptyBackdropClick,
        ...componentProps
    } = props;
    React.useEffect(() => {
        const handleResourceCommand = event => {
            const command = event.detail && event.detail.command;
            // Backdrop handlers call stopPropagation before mutating the VM or opening the file input.
            if (command === 'backdrop-library') onNewBackdropClick(event);
            else if (command === 'backdrop-paint') onEmptyBackdropClick(event);
            else if (command === 'backdrop-surprise') onSurpriseBackdropClick(event);
            else if (command === 'backdrop-upload') onBackdropFileUploadClick(event);
        };
        if (!readOnly) window.addEventListener(PLANET_EDITOR_RESOURCE_COMMAND_EVENT, handleResourceCommand);
        return () => {
            if (!readOnly) window.removeEventListener(PLANET_EDITOR_RESOURCE_COMMAND_EVENT, handleResourceCommand);
        };
    }, [onBackdropFileUploadClick, onEmptyBackdropClick, onNewBackdropClick, onSurpriseBackdropClick, readOnly]);
    return (
        <Box
            aria-label={standalone ? `选择舞台，${backdropCount} 个背景` :
                intl.formatMessage(messages.addBackdropFromLibrary)}
            title={standalone ? backdropName : null}
            className={classNames(styles.stageSelector, {
                [styles.isSelected]: selected,
                [styles.standalone]: standalone,
                [styles.raised]: raised || dragOver,
                [styles.receivedBlocks]: receivedBlocks
            })}
            componentRef={containerRef}
            role={standalone ? 'button' : undefined}
            tabIndex={standalone ? 0 : undefined}
            aria-pressed={standalone ? selected : undefined}
            onClick={onClick}
            onKeyDown={standalone ? event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onClick(event);
                }
            } : undefined}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            {...componentProps}
        >
            <div className={styles.header}>
                <div className={styles.headerTitle}>
                    <FormattedMessage
                        defaultMessage="Stage"
                        description="Label for the stage in the stage selector"
                        id="gui.stageSelector.stage"
                    />
                </div>
            </div>
            {standalone ? <span className={styles.mobileCount}>{backdropCount}</span> : null}
            {url ? (
                <img
                    className={styles.costumeCanvas}
                    alt={backdropName || '舞台背景'}
                    src={url}
                    draggable={false}
                />
            ) : null}
            <div className={styles.label}>
                <FormattedMessage
                    defaultMessage="Backdrops"
                    description="Label for the backdrops in the stage selector"
                    id="gui.stageSelector.backdrops"
                />
            </div>
            <div className={styles.count}>{backdropCount}</div>
            {!readOnly && <input
                accept=".svg,.png,.bmp,.jpg,.jpeg,.jfif,.webp,.gif"
                className={styles.fileInput}
                multiple
                ref={fileInputRef}
                type="file"
                onChange={onBackdropFileUpload}
            />}
        </Box>
    );
};

StageSelector.propTypes = {
    backdropCount: PropTypes.number.isRequired,
    backdropName: PropTypes.string,
    containerRef: PropTypes.func,
    dragOver: PropTypes.bool,
    fileInputRef: PropTypes.func,
    intl: intlShape.isRequired,
    onBackdropFileUpload: PropTypes.func,
    onBackdropFileUploadClick: PropTypes.func,
    onClick: PropTypes.func,
    onEmptyBackdropClick: PropTypes.func,
    onMouseEnter: PropTypes.func,
    onMouseLeave: PropTypes.func,
    onNewBackdropClick: PropTypes.func,
    onSurpriseBackdropClick: PropTypes.func,
    readOnly: PropTypes.bool,
    raised: PropTypes.bool.isRequired,
    receivedBlocks: PropTypes.bool.isRequired,
    selected: PropTypes.bool.isRequired,
    standalone: PropTypes.bool,
    url: PropTypes.string
};

StageSelector.defaultProps = {
    readOnly: false
};

export default injectIntl(StageSelector);
