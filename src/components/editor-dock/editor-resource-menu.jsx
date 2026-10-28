/* eslint-disable react/jsx-no-bind */
import {DicesIcon, PaintbrushIcon, SearchIcon, UploadIcon} from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';

import Modal from '../modal/modal.jsx';
import styles from './editor-dock.css';

const menus = {
    sprite: [
        {command: 'sprite-library', icon: SearchIcon, label: '从素材库选择'},
        {command: 'sprite-paint', icon: PaintbrushIcon, label: '绘制角色'},
        {command: 'sprite-surprise', icon: DicesIcon, label: '随机角色'},
        {command: 'sprite-upload', icon: UploadIcon, label: '上传角色'}
    ],
    backdrop: [
        {command: 'backdrop-library', icon: SearchIcon, label: '从素材库选择'},
        {command: 'backdrop-paint', icon: PaintbrushIcon, label: '绘制背景'},
        {command: 'backdrop-surprise', icon: DicesIcon, label: '随机背景'},
        {command: 'backdrop-upload', icon: UploadIcon, label: '上传背景'}
    ]
};

const EditorResourceMenu = ({isRtl, kind, mobileLayout, onClose, onSelect}) => {
    const title = kind === 'sprite' ? '添加角色' : '添加背景';
    const actions = menus[kind].map(item => {
        const Icon = item.icon;
        return (
            <button
                className={styles.resourceMenuItem}
                key={item.command}
                role={mobileLayout ? null : 'menuitem'}
                type="button"
                onClick={() => onSelect(item.command)}
            >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
            </button>
        );
    });

    if (mobileLayout) {
        return (
            <Modal
                className={styles.resourceDialog}
                contentLabel={title}
                isRtl={isRtl}
                overlayClassName={styles.resourceDialogOverlay}
                onRequestClose={onClose}
            >
                <div className={styles.resourceDialogActions}>{actions}</div>
                <div className={styles.resourceDialogFooter}>
                    <button
                        className={styles.resourceCancel}
                        type="button"
                        onClick={onClose}
                    >
                        {'取消'}
                    </button>
                </div>
            </Modal>
        );
    }

    return (
        <div
            aria-label={title}
            className={styles.resourceMenu}
            role="menu"
        >
            <div className={styles.resourceMenuLabel}>{title}</div>
            {actions}
        </div>
    );
};

EditorResourceMenu.propTypes = {
    isRtl: PropTypes.bool,
    kind: PropTypes.oneOf(['sprite', 'backdrop']).isRequired,
    mobileLayout: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
    onSelect: PropTypes.func.isRequired
};

export default EditorResourceMenu;
