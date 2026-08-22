/* eslint-disable react/jsx-no-bind, react/jsx-handler-names, react/jsx-max-props-per-line */
import classNames from 'classnames';
import {gsap} from 'gsap';
import {useGSAP} from '@gsap/react';
import {
    BriefcaseIcon,
    CatIcon,
    DicesIcon,
    ImageIcon,
    MessageCircleIcon,
    PaintbrushIcon,
    PuzzleIcon,
    SearchIcon,
    SparklesIcon,
    UploadIcon
} from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';

import {
    PLANET_AI_ASSISTANT_STATE_EVENT,
    PLANET_BACKPACK_STATE_EVENT,
    PLANET_BACKPACK_TOGGLE_EVENT,
    PLANET_PROJECT_CHAT_READY_EVENT,
    PLANET_PROJECT_CHAT_STATE_EVENT,
    dispatchEditorResourceCommand
} from '../../lib/editor-dock-events';
import {collaborationEnabled} from '../../lib/planet-collaboration';
import {isPlanetProjectRoute} from '../../lib/planet-project-loader';

import styles from './editor-dock.css';

gsap.registerPlugin(useGSAP);

const resourceMenus = {
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

const EditorDock = ({
    hasBackpack,
    onOpenBackdropLibrary,
    onOpenExtensionLibrary,
    onOpenSpriteLibrary
}) => {
    const dockRef = React.useRef(null);
    const [openMenu, setOpenMenu] = React.useState(null);
    const [chatState, setChatState] = React.useState({connected: false, open: false, unread: 0});
    const [aiOpen, setAiOpen] = React.useState(false);
    const [backpackOpen, setBackpackOpen] = React.useState(false);
    const chatAvailable = isPlanetProjectRoute() && collaborationEnabled();
    const reducedMotion = typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const {contextSafe} = useGSAP(() => {
        const matchMedia = gsap.matchMedia();
        matchMedia.add('(prefers-reduced-motion: no-preference)', () => {
            gsap.fromTo('[data-dock-item]', {
                autoAlpha: 0,
                scale: 0.92,
                y: 12
            }, {
                autoAlpha: 1,
                clearProps: 'opacity,visibility',
                duration: 0.34,
                ease: 'power3.out',
                scale: 1,
                stagger: 0.045,
                y: 0
            });
        });
        return () => matchMedia.revert();
    }, {scope: dockRef});

    React.useEffect(() => {
        const handleChatState = event => setChatState(previous => ({
            ...previous,
            ...(event.detail || {})
        }));
        const handleAiState = event => setAiOpen(Boolean(event.detail && event.detail.open));
        const handleBackpackState = event => setBackpackOpen(Boolean(event.detail && event.detail.open));
        const handleOutsidePointer = event => {
            if (openMenu && dockRef.current && !dockRef.current.contains(event.target)) setOpenMenu(null);
        };
        const handleEscape = event => {
            if (event.key === 'Escape') setOpenMenu(null);
        };
        window.addEventListener(PLANET_PROJECT_CHAT_STATE_EVENT, handleChatState);
        window.addEventListener(PLANET_AI_ASSISTANT_STATE_EVENT, handleAiState);
        window.addEventListener(PLANET_BACKPACK_STATE_EVENT, handleBackpackState);
        document.addEventListener('pointerdown', handleOutsidePointer);
        document.addEventListener('keydown', handleEscape);
        return () => {
            window.removeEventListener(PLANET_PROJECT_CHAT_STATE_EVENT, handleChatState);
            window.removeEventListener(PLANET_AI_ASSISTANT_STATE_EVENT, handleAiState);
            window.removeEventListener(PLANET_BACKPACK_STATE_EVENT, handleBackpackState);
            document.removeEventListener('pointerdown', handleOutsidePointer);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [openMenu]);

    const animateIn = contextSafe(event => {
        if (reducedMotion || event.currentTarget.disabled) return;
        gsap.to(event.currentTarget, {
            duration: 0.18,
            ease: 'power2.out',
            overwrite: 'auto',
            scale: 1.06,
            y: -4
        });
    });
    const animateOut = contextSafe(event => {
        if (reducedMotion) return;
        gsap.to(event.currentTarget, {
            duration: 0.2,
            ease: 'power2.out',
            overwrite: 'auto',
            scale: 1,
            y: 0
        });
    });
    const animatePress = contextSafe(event => {
        if (reducedMotion || event.currentTarget.disabled) return;
        gsap.fromTo(event.currentTarget, {scale: 0.94}, {
            duration: 0.24,
            ease: 'back.out(2.4)',
            overwrite: 'auto',
            scale: 1.06
        });
    });

    const toggleChat = () => {
        if (!chatAvailable) return;
        if (window.PlanetProjectChat) {
            window.PlanetProjectChat.toggle();
            return;
        }
        window.addEventListener(PLANET_PROJECT_CHAT_READY_EVENT, event => {
            if (event.detail) event.detail.toggle();
        }, {once: true});
    };
    const toggleAi = () => {
        if (window.PlanetAiAssistant) {
            window.PlanetAiAssistant.toggle();
            return;
        }
        window.addEventListener('planet-ai-assistant-ready', event => {
            if (event.detail) event.detail.toggle();
        }, {once: true});
    };
    const toggleBackpack = () => {
        if (!hasBackpack) return;
        window.dispatchEvent(new CustomEvent(PLANET_BACKPACK_TOGGLE_EVENT));
    };
    const runResourceCommand = command => {
        setOpenMenu(null);
        if (command === 'sprite-library') onOpenSpriteLibrary();
        else if (command === 'backdrop-library') onOpenBackdropLibrary();
        else dispatchEditorResourceCommand(command);
    };

    const renderDockButton = ({
        active = false,
        badge = 0,
        disabled = false,
        expanded,
        icon: Icon,
        label,
        onClick
    }) => (
        <button
            aria-expanded={expanded}
            aria-label={badge ? `${label}，${badge} 条未读消息` : label}
            aria-pressed={active}
            className={classNames(styles.item, {[styles.active]: active})}
            data-dock-item
            disabled={disabled}
            key={label}
            type="button"
            onBlur={animateOut}
            onClick={event => {
                animatePress(event);
                onClick();
            }}
            onFocus={animateIn}
            onMouseEnter={animateIn}
            onMouseLeave={animateOut}
        >
            <Icon aria-hidden="true" />
            <span className={styles.tooltip} role="tooltip">{label}</span>
            {badge > 0 && <span className={styles.badge}>{badge}</span>}
        </button>
    );

    const renderResource = (kind, label, Icon) => (
        <div className={styles.resource} key={kind}>
            {renderDockButton({
                active: openMenu === kind,
                expanded: openMenu === kind,
                icon: Icon,
                label,
                onClick: () => setOpenMenu(previous => (previous === kind ? null : kind))
            })}
            {openMenu === kind && (
                <div aria-label={`${label}选项`} className={styles.resourceMenu} role="menu">
                    <div className={styles.resourceMenuLabel}>{`添加${label}`}</div>
                    {resourceMenus[kind].map(item => {
                        const ItemIcon = item.icon;
                        return (
                            <button
                                className={styles.resourceMenuItem}
                                key={item.command}
                                role="menuitem"
                                type="button"
                                onClick={() => runResourceCommand(item.command)}
                            >
                                <ItemIcon aria-hidden="true" />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );

    return (
        <nav aria-label="编辑器快捷工具" className={styles.root} ref={dockRef}>
            <div className={styles.surface}>
                {renderResource('sprite', '角色', CatIcon)}
                {renderResource('backdrop', '背景', ImageIcon)}
                <span aria-hidden="true" className={styles.separator} role="separator" />
                {renderDockButton({
                    active: chatState.open,
                    badge: chatState.unread,
                    disabled: !chatAvailable,
                    expanded: chatState.open,
                    icon: MessageCircleIcon,
                    label: chatAvailable ? '项目聊天' : '项目聊天（需协作模式）',
                    onClick: toggleChat
                })}
                {renderDockButton({
                    icon: PuzzleIcon,
                    label: '扩展',
                    onClick: onOpenExtensionLibrary
                })}
                {renderDockButton({
                    active: aiOpen,
                    expanded: aiOpen,
                    icon: SparklesIcon,
                    label: 'AI 助手',
                    onClick: toggleAi
                })}
                <span aria-hidden="true" className={styles.separator} role="separator" />
                {renderDockButton({
                    active: backpackOpen,
                    disabled: !hasBackpack,
                    expanded: backpackOpen,
                    icon: BriefcaseIcon,
                    label: hasBackpack ? '书包' : '书包暂不可用',
                    onClick: toggleBackpack
                })}
            </div>
        </nav>
    );
};

EditorDock.propTypes = {
    hasBackpack: PropTypes.bool,
    onOpenBackdropLibrary: PropTypes.func.isRequired,
    onOpenExtensionLibrary: PropTypes.func.isRequired,
    onOpenSpriteLibrary: PropTypes.func.isRequired
};

EditorDock.defaultProps = {
    hasBackpack: false
};

export default EditorDock;
