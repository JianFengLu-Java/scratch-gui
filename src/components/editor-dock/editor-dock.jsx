/* eslint-disable react/jsx-no-bind, react/jsx-handler-names, react/jsx-max-props-per-line */
import classNames from 'classnames';
import {gsap} from 'gsap';
import {useGSAP} from '@gsap/react';
import {
    BriefcaseIcon,
    CatIcon,
    EllipsisIcon,
    ImageIcon,
    MessageCircleIcon,
    PuzzleIcon,
    ShieldCheckIcon,
    SparklesIcon,
    UserPlusIcon
} from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';

import {
    PLANET_EDITOR_ACCOUNT_SLOT_EVENT,
    PLANET_AI_ASSISTANT_STATE_EVENT,
    PLANET_BACKPACK_STATE_EVENT,
    PLANET_BACKPACK_TOGGLE_EVENT,
    PLANET_COLLABORATION_INVITE_READY_EVENT,
    PLANET_COLLABORATION_INVITE_STATE_EVENT,
    PLANET_COLLABORATION_PERMISSIONS_READY_EVENT,
    PLANET_COLLABORATION_PERMISSIONS_STATE_EVENT,
    PLANET_PROJECT_CHAT_READY_EVENT,
    PLANET_PROJECT_CHAT_STATE_EVENT,
    dispatchEditorResourceCommand
} from '../../lib/editor-dock-events';
import {collaborationEnabled} from '../../lib/planet-collaboration';
import {isPlanetProjectRoute} from '../../lib/planet-project-loader';
import EditorResourceMenu from './editor-resource-menu.jsx';
import EditorMoreMenu from './editor-more-menu.jsx';
import EditorFullscreenButton from './editor-fullscreen-button.jsx';

import styles from './editor-dock.css';

gsap.registerPlugin(useGSAP);

const EditorDock = ({
    hasBackpack,
    isRtl,
    mobileLayout,
    readOnly,
    onOpenBackdropLibrary,
    onOpenExtensionLibrary,
    onOpenSpriteLibrary
}) => {
    const dockRef = React.useRef(null);
    const moreButtonRef = React.useRef(null);
    const [openMenu, setOpenMenu] = React.useState(null);
    const [chatState, setChatState] = React.useState({connected: false, open: false, unread: 0});
    const [aiOpen, setAiOpen] = React.useState(false);
    const [backpackOpen, setBackpackOpen] = React.useState(false);
    const [inviteOpen, setInviteOpen] = React.useState(false);
    const [permissionsOpen, setPermissionsOpen] = React.useState(false);
    const chatAvailable = isPlanetProjectRoute() && collaborationEnabled();
    const reducedMotion = typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    React.useLayoutEffect(() => {
        window.dispatchEvent(new CustomEvent(PLANET_EDITOR_ACCOUNT_SLOT_EVENT));
        return () => window.dispatchEvent(new CustomEvent(PLANET_EDITOR_ACCOUNT_SLOT_EVENT));
    }, []);

    React.useEffect(() => {
        const dock = dockRef.current;
        const container = dock.parentElement;

        let animationFrame = null;
        let resizeObserver = null;
        const observedElements = new Set();
        const getVisibleRect = selector => {
            const element = document.querySelector(selector);
            if (!element) return null;
            const computedStyle = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            if (
                computedStyle.display === 'none' ||
                computedStyle.visibility === 'hidden' ||
                rect.width <= 0 ||
                rect.height <= 0
            ) return null;
            return {element, rect};
        };
        const observeElement = element => {
            if (!resizeObserver || !element || observedElements.has(element)) return;
            observedElements.add(element);
            resizeObserver.observe(element);
        };
        const updatePosition = () => {
            animationFrame = null;
            const containerRect = container.getBoundingClientRect();
            const workspace = getVisibleRect('.blocklySvg');

            if (!workspace) {
                dock.style.removeProperty('--editor-dock-center-x');
                dock.style.removeProperty('--editor-dock-max-width');
                return;
            }

            const toolbox = getVisibleRect('.blocklyToolboxDiv');
            const flyout = getVisibleRect('.blocklyFlyoutBackground') || getVisibleRect('.blocklyFlyout');
            observeElement(workspace.element);
            observeElement(toolbox && toolbox.element);
            observeElement(flyout && flyout.element);

            let workspaceLeft = Math.max(containerRect.left, workspace.rect.left);
            let workspaceRight = Math.min(containerRect.right, workspace.rect.right);
            const containerIsRtl = window.getComputedStyle(container).direction === 'rtl';

            if (containerIsRtl) {
                if (toolbox) workspaceRight = Math.min(workspaceRight, toolbox.rect.left);
                if (flyout) workspaceRight = Math.min(workspaceRight, flyout.rect.left);
            } else {
                if (toolbox) workspaceLeft = Math.max(workspaceLeft, toolbox.rect.right);
                if (flyout) workspaceLeft = Math.max(workspaceLeft, flyout.rect.right);
            }

            const workspaceWidth = workspaceRight - workspaceLeft;
            if (workspaceWidth <= 0) {
                dock.style.removeProperty('--editor-dock-center-x');
                dock.style.removeProperty('--editor-dock-max-width');
                return;
            }

            const center = workspaceLeft + (workspaceWidth / 2) - containerRect.left;
            dock.style.setProperty('--editor-dock-center-x', `${center}px`);
            dock.style.setProperty('--editor-dock-max-width', `${Math.max(workspaceWidth - 16, 0)}px`);
        };
        const schedulePositionUpdate = () => {
            if (animationFrame !== null) cancelAnimationFrame(animationFrame);
            animationFrame = requestAnimationFrame(updatePosition);
        };
        const mutationContainsWorkspace = mutation => [...mutation.addedNodes, ...mutation.removedNodes]
            .some(node => node.nodeType === Node.ELEMENT_NODE && (
                node.matches('.blocklySvg') || node.querySelector('.blocklySvg')
            ));
        const mutationObserver = new MutationObserver(mutations => {
            if (mutations.some(mutationContainsWorkspace)) schedulePositionUpdate();
        });

        resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedulePositionUpdate);
        observeElement(container);
        mutationObserver.observe(container, {childList: true, subtree: true});
        schedulePositionUpdate();
        window.addEventListener('resize', schedulePositionUpdate);

        return () => {
            if (animationFrame !== null) cancelAnimationFrame(animationFrame);
            if (resizeObserver) resizeObserver.disconnect();
            mutationObserver.disconnect();
            window.removeEventListener('resize', schedulePositionUpdate);
        };
    }, []);

    const {contextSafe} = useGSAP(() => {
        const matchMedia = gsap.matchMedia();
        matchMedia.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
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
        const handleInviteState = event => setInviteOpen(Boolean(event.detail && event.detail.open));
        const handlePermissionsState = event => setPermissionsOpen(Boolean(event.detail && event.detail.open));
        const handleOutsidePointer = event => {
            if (!mobileLayout && openMenu && dockRef.current && !dockRef.current.contains(event.target)) {
                setOpenMenu(null);
            }
        };
        const handleEscape = event => {
            if (!mobileLayout && event.key === 'Escape' && openMenu) {
                event.preventDefault();
                setOpenMenu(null);
            }
        };
        window.addEventListener(PLANET_PROJECT_CHAT_STATE_EVENT, handleChatState);
        window.addEventListener(PLANET_AI_ASSISTANT_STATE_EVENT, handleAiState);
        window.addEventListener(PLANET_BACKPACK_STATE_EVENT, handleBackpackState);
        window.addEventListener(PLANET_COLLABORATION_INVITE_STATE_EVENT, handleInviteState);
        window.addEventListener(PLANET_COLLABORATION_PERMISSIONS_STATE_EVENT, handlePermissionsState);
        document.addEventListener('pointerdown', handleOutsidePointer);
        document.addEventListener('keydown', handleEscape, true);
        return () => {
            window.removeEventListener(PLANET_PROJECT_CHAT_STATE_EVENT, handleChatState);
            window.removeEventListener(PLANET_AI_ASSISTANT_STATE_EVENT, handleAiState);
            window.removeEventListener(PLANET_BACKPACK_STATE_EVENT, handleBackpackState);
            window.removeEventListener(PLANET_COLLABORATION_INVITE_STATE_EVENT, handleInviteState);
            window.removeEventListener(PLANET_COLLABORATION_PERMISSIONS_STATE_EVENT, handlePermissionsState);
            document.removeEventListener('pointerdown', handleOutsidePointer);
            document.removeEventListener('keydown', handleEscape, true);
        };
    }, [openMenu, mobileLayout]);

    const animateIn = contextSafe(event => {
        if (reducedMotion || event.currentTarget.disabled || window.matchMedia('(max-width: 1023px)').matches) return;
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
        if (reducedMotion || event.currentTarget.disabled || window.matchMedia('(max-width: 1023px)').matches) return;
        gsap.fromTo(event.currentTarget, {scale: 0.94}, {
            duration: 0.24,
            ease: 'back.out(2.4)',
            overwrite: 'auto',
            scale: 1.06
        });
    });

    const toggleChat = () => {
        if (!chatAvailable) return;
        setOpenMenu(null);
        if (window.PlanetProjectChat) {
            window.PlanetProjectChat.toggle();
            return;
        }
        window.addEventListener(PLANET_PROJECT_CHAT_READY_EVENT, event => {
            if (event.detail) event.detail.toggle();
        }, {once: true});
    };
    const toggleAi = () => {
        setOpenMenu(null);
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
        setOpenMenu(null);
        window.dispatchEvent(new CustomEvent(PLANET_BACKPACK_TOGGLE_EVENT));
    };
    const togglePermissions = () => {
        if (!chatAvailable) return;
        setOpenMenu(null);
        if (window.PlanetCollaborationPermissions) {
            window.PlanetCollaborationPermissions.toggle();
            return;
        }
        window.addEventListener(PLANET_COLLABORATION_PERMISSIONS_READY_EVENT, event => {
            if (event.detail) event.detail.toggle();
        }, {once: true});
    };
    const toggleInvite = () => {
        if (!chatAvailable) return;
        setOpenMenu(null);
        if (window.PlanetCollaborationInvite) {
            window.PlanetCollaborationInvite.toggle();
            return;
        }
        window.addEventListener(PLANET_COLLABORATION_INVITE_READY_EVENT, event => {
            if (event.detail) event.detail.toggle();
        }, {once: true});
    };
    const runResourceCommand = command => {
        setOpenMenu(null);
        if (command === 'sprite-library') onOpenSpriteLibrary();
        else if (command === 'backdrop-library') onOpenBackdropLibrary();
        else dispatchEditorResourceCommand(command);
    };
    const toggleResourceMenu = kind => {
        setOpenMenu(previous => (previous === kind ? null : kind));
    };
    const openExtensionLibrary = () => {
        setOpenMenu(null);
        onOpenExtensionLibrary();
    };

    const renderDockButton = ({
        active = false,
        buttonRef,
        controls,
        badge = 0,
        disabled = false,
        expanded,
        icon: Icon,
        label,
        mobileLabel = label,
        popup,
        onClick
    }) => (
        <button
            aria-controls={controls}
            aria-expanded={expanded}
            aria-haspopup={popup}
            aria-label={badge ? `${label}，${badge} 条未读消息` : label}
            aria-pressed={active}
            className={classNames(styles.item, {[styles.active]: active})}
            data-dock-item
            disabled={disabled}
            key={label}
            ref={buttonRef}
            title={label}
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
            <span aria-hidden="true" className={styles.mobileLabel}>{mobileLabel}</span>
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
                popup: mobileLayout ? 'dialog' : 'menu',
                onClick: () => toggleResourceMenu(kind)
            })}
            {openMenu === kind && (
                <EditorResourceMenu
                    isRtl={isRtl}
                    kind={kind}
                    mobileLayout={mobileLayout}
                    onClose={() => setOpenMenu(null)}
                    onSelect={runResourceCommand}
                />
            )}
        </div>
    );

    const closeMenu = React.useCallback(() => setOpenMenu(null), []);
    const renderSecondaryTools = () => (
        <React.Fragment>
            {mobileLayout && <EditorFullscreenButton
                className={styles.item}
                labelClassName={styles.mobileLabel}
                onComplete={closeMenu}
            />}
            <span aria-hidden="true" className={styles.separator} role="separator" />
            {renderDockButton({
                active: inviteOpen,
                disabled: !chatAvailable,
                expanded: inviteOpen,
                icon: UserPlusIcon,
                label: chatAvailable ? '邀请协作' : '邀请协作（需协作模式）',
                mobileLabel: '邀请',
                onClick: toggleInvite
            })}
            {renderDockButton({
                active: chatState.open,
                badge: chatState.unread,
                disabled: !chatAvailable,
                expanded: chatState.open,
                icon: MessageCircleIcon,
                label: chatAvailable ? '项目聊天' : '项目聊天（需协作模式）',
                mobileLabel: '聊天',
                onClick: toggleChat
            })}
            {renderDockButton({
                active: permissionsOpen,
                disabled: !chatAvailable,
                expanded: permissionsOpen,
                icon: ShieldCheckIcon,
                label: chatAvailable ? '角色权限' : '角色权限（需协作模式）',
                mobileLabel: '权限',
                onClick: togglePermissions
            })}
            {renderDockButton({
                icon: PuzzleIcon,
                label: '扩展',
                onClick: openExtensionLibrary
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
                mobileLabel: '书包',
                onClick: toggleBackpack
            })}
        </React.Fragment>
    );

    return (
        <nav aria-label="编辑器快捷工具" className={styles.root} data-editor-dock ref={dockRef}>
            <div className={styles.surface}>
                {!readOnly && <div className={styles.tools}>
                    {renderResource('sprite', '角色', CatIcon)}
                    {renderResource('backdrop', '背景', ImageIcon)}
                    {mobileLayout ? renderDockButton({
                        active: openMenu === 'more',
                        badge: chatState.unread,
                        buttonRef: moreButtonRef,
                        controls: 'editor-more-menu',
                        expanded: openMenu === 'more',
                        icon: EllipsisIcon,
                        label: '更多',
                        popup: 'dialog',
                        onClick: () => toggleResourceMenu('more')
                    }) : <React.Fragment>
                        {renderSecondaryTools()}
                    </React.Fragment>}
                </div>}
                <div className={styles.accountRow} data-editor-account-slot />
                {mobileLayout && !readOnly && <EditorMoreMenu
                    open={openMenu === 'more'}
                    triggerRef={moreButtonRef}
                    onClose={closeMenu}
                >
                    {renderSecondaryTools()}
                </EditorMoreMenu>}
            </div>
        </nav>
    );
};

EditorDock.propTypes = {
    hasBackpack: PropTypes.bool,
    isRtl: PropTypes.bool,
    mobileLayout: PropTypes.bool,
    readOnly: PropTypes.bool,
    onOpenBackdropLibrary: PropTypes.func.isRequired,
    onOpenExtensionLibrary: PropTypes.func.isRequired,
    onOpenSpriteLibrary: PropTypes.func.isRequired
};

EditorDock.defaultProps = {
    hasBackpack: false,
    mobileLayout: false,
    readOnly: false
};

export default EditorDock;
