import classNames from 'classnames';
import {gsap} from 'gsap';
import {Draggable} from 'gsap/Draggable';
import {useGSAP} from '@gsap/react';
import {ArrowLeftIcon, XIcon} from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';

import {registerDockPanel} from '../../lib/dock-panel-manager';
import {getMobilePanelBounds} from '../../lib/dock-panel-viewport';

import styles from './dock-panel.css';

const VIEWPORT_INSET = 8;
const TOP_INSET = 56;
const DOCK_GAP = 10;
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), ' +
    'select:not([disabled]), [tabindex="0"], [contenteditable="true"]';
let mobilePanelCount = 0;
let previousBodyOverflow = '';

gsap.registerPlugin(useGSAP, Draggable);

// Chat inputs live in an isolated Shadow DOM runtime. Include them in the tab order.
const getFocusables = root => [...root.querySelectorAll('*')].reduce((elements, element) => {
    if (element.matches(FOCUSABLE) && element.getClientRects().length > 0 && !element.closest('[hidden], [inert]')) {
        elements.push(element);
    }
    if (element.shadowRoot) elements.push(...getFocusables(element.shadowRoot));
    return elements;
}, []);

const DockPanel = ({
    actions,
    appearance,
    children,
    className,
    description,
    dragLabel,
    icon: Icon,
    leading,
    mobileFullScreen,
    onClose,
    panelId,
    title
}) => {
    const panelRef = React.useRef(null);
    const dragHandleRef = React.useRef(null);
    const registrationRef = React.useRef(null);
    const onCloseRef = React.useRef(onClose);
    const [mobileLayout, setMobileLayout] = React.useState(() =>
        window.matchMedia('(max-width: 1023px)').matches
    );
    onCloseRef.current = onClose;
    const activatePanel = React.useCallback(() => {
        if (registrationRef.current) registrationRef.current.activate();
    }, []);
    const closePanel = React.useCallback(() => onCloseRef.current(), []);

    React.useEffect(() => {
        const media = window.matchMedia('(max-width: 1023px)');
        const update = () => setMobileLayout(media.matches);
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);

    React.useLayoutEffect(() => {
        const registration = registerDockPanel(
            panelId,
            panelRef.current,
            () => onCloseRef.current()
        );
        registrationRef.current = registration;
        return () => {
            registration.unregister();
            if (registrationRef.current === registration) registrationRef.current = null;
        };
    }, [panelId]);

    React.useLayoutEffect(() => {
        if (mobileLayout && registrationRef.current) registrationRef.current.closeOthers();
    }, [mobileLayout, panelId]);

    React.useLayoutEffect(() => {
        if (!mobileLayout) return () => {};
        const panel = panelRef.current;
        const trigger = document.activeElement;
        const viewport = window.visualViewport;
        const updateBounds = () => {
            const dock = document.querySelector('[data-editor-dock]');
            const bounds = getMobilePanelBounds({
                height: window.innerHeight,
                viewportHeight: viewport ? viewport.height : window.innerHeight,
                viewportTop: viewport ? viewport.offsetTop : 0,
                dockTop: dock ? dock.getBoundingClientRect().top : window.innerHeight,
                fullScreen: mobileFullScreen
            });
            panel.style.setProperty('--dock-panel-mobile-bottom', `${bounds.bottom}px`);
            panel.style.setProperty('--dock-panel-mobile-height', `${bounds.availableHeight}px`);
        };
        const containFocus = event => {
            if (event.defaultPrevented || event.key !== 'Tab' ||
                panel.getAttribute('data-dock-panel-active') !== 'true') return;
            let active = document.activeElement;
            while (active && active.shadowRoot && active.shadowRoot.activeElement) {
                active = active.shadowRoot.activeElement;
            }
            const modal = active && active.closest('[role="dialog"]');
            if (modal && modal !== panel) return;
            const focusable = getFocusables(panel);
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            // Shadow DOM descendants are not reported by Element.contains().
            const inside = panel.contains(active) || focusable.includes(active);
            if (!first) {
                event.preventDefault();
                panel.focus({preventScroll: true});
            } else if (event.shiftKey && (active === first || active === panel || !inside)) {
                event.preventDefault();
                last.focus({preventScroll: true});
            } else if (!event.shiftKey && (active === last || !inside)) {
                event.preventDefault();
                first.focus({preventScroll: true});
            }
        };
        if (mobilePanelCount++ === 0) {
            previousBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        }
        updateBounds();
        if (panel.getAttribute('data-dock-panel-active') === 'true') panel.focus({preventScroll: true});
        window.addEventListener('resize', updateBounds);
        document.addEventListener('keydown', containFocus);
        if (viewport) {
            viewport.addEventListener('resize', updateBounds);
            viewport.addEventListener('scroll', updateBounds);
        }
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateBounds);
        const dock = document.querySelector('[data-editor-dock]');
        if (observer && dock) observer.observe(dock);
        return () => {
            window.removeEventListener('resize', updateBounds);
            document.removeEventListener('keydown', containFocus);
            if (viewport) {
                viewport.removeEventListener('resize', updateBounds);
                viewport.removeEventListener('scroll', updateBounds);
            }
            if (observer) observer.disconnect();
            panel.style.removeProperty('--dock-panel-mobile-bottom');
            panel.style.removeProperty('--dock-panel-mobile-height');
            if (--mobilePanelCount === 0) document.body.style.overflow = previousBodyOverflow;
            // Switching sheets must leave focus on the newly opened sheet.
            const otherSheet = [...document.querySelectorAll('[data-dock-panel][aria-modal="true"]')]
                .some(element => element !== panel);
            if (trigger && trigger.isConnected && !otherSheet) {
                trigger.focus({preventScroll: true});
            }
        };
    }, [mobileLayout, mobileFullScreen]);

    useGSAP(() => {
        if (mobileLayout) return;
        const calculateBounds = (currentX = 0, currentY = 0) => {
            const panel = panelRef.current;
            const rect = panel.getBoundingClientRect();
            const dock = document.querySelector('[data-editor-dock]');
            const dockTop = dock ? dock.getBoundingClientRect().top : window.innerHeight - 64;
            return {
                maxX: currentX + window.innerWidth - VIEWPORT_INSET - rect.right,
                maxY: currentY + dockTop - DOCK_GAP - rect.bottom,
                minX: currentX + VIEWPORT_INSET - rect.left,
                minY: currentY + TOP_INSET - rect.top
            };
        };

        const draggable = Draggable.create(panelRef.current, {
            bounds: calculateBounds(),
            dragClickables: false,
            edgeResistance: 0.88,
            onPress () {
                activatePanel();
                this.applyBounds(calculateBounds(this.x, this.y));
                panelRef.current.classList.add(styles.dragging);
            },
            onRelease () {
                panelRef.current.classList.remove(styles.dragging);
            },
            trigger: dragHandleRef.current,
            type: 'x,y'
        })[0];
        const keepAboveDock = () => draggable.applyBounds(calculateBounds(draggable.x, draggable.y));
        const matchMedia = gsap.matchMedia();
        matchMedia.add('(prefers-reduced-motion: no-preference)', () => {
            gsap.fromTo(panelRef.current, {
                autoAlpha: 0,
                scale: 0.985
            }, {
                autoAlpha: 1,
                duration: 0.2,
                ease: 'power2.out',
                scale: 1
            });
        });
        window.addEventListener('resize', keepAboveDock);
        return () => {
            window.removeEventListener('resize', keepAboveDock);
            draggable.kill();
            matchMedia.revert();
        };
    }, {scope: panelRef, dependencies: [mobileLayout], revertOnUpdate: true});

    const titleId = `planet-dock-panel-${panelId}-title`;
    const descriptionId = description ? `planet-dock-panel-${panelId}-description` : null;
    const fullScreen = mobileLayout && mobileFullScreen;
    const closeButton = (
        <button
            aria-label={fullScreen ? '返回编辑器' : `关闭${title}`}
            className={styles.iconButton}
            title={fullScreen ? '返回编辑器' : '关闭'}
            type="button"
            onClick={onClose}
        >
            {fullScreen ? <ArrowLeftIcon aria-hidden="true" /> : <XIcon aria-hidden="true" />}
        </button>
    );

    return (
        <React.Fragment>
            {mobileLayout && (
                <div
                    aria-hidden="true"
                    className={styles.backdrop}
                    onClick={closePanel}
                />
            )}
            <section
                aria-describedby={descriptionId}
                aria-labelledby={titleId}
                aria-modal={mobileLayout ? 'true' : 'false'}
                className={classNames(styles.panel, {
                    [styles.conversation]: appearance === 'conversation',
                    [styles.mobileSheet]: mobileLayout,
                    [styles.mobileFullScreen]: fullScreen
                }, className)}
                data-dock-panel={panelId}
                ref={panelRef}
                role="dialog"
                tabIndex={-1}
                onFocusCapture={activatePanel}
                onMouseDownCapture={activatePanel}
                onTouchStartCapture={activatePanel}
            >
                {leading}
                <div className={styles.column}>
                    <header className={styles.header}>
                        {fullScreen ? closeButton : null}
                        <div
                            aria-label={mobileLayout ? null : dragLabel}
                            className={styles.dragHandle}
                            ref={dragHandleRef}
                        >
                            {Icon && !fullScreen ? (
                                <span className={styles.headerIcon}><Icon aria-hidden="true" /></span>
                            ) : null}
                            <div className={styles.headerCopy}>
                                <h2 id={titleId}>{title}</h2>
                                {description ? <p id={descriptionId}>{description}</p> : null}
                            </div>
                        </div>
                        <div className={styles.headerActions}>
                            {actions}
                            {fullScreen ? null : closeButton}
                        </div>
                    </header>
                    {children}
                </div>
            </section>
        </React.Fragment>
    );
};

DockPanel.propTypes = {
    actions: PropTypes.node,
    appearance: PropTypes.oneOf(['default', 'conversation']),
    children: PropTypes.node.isRequired,
    className: PropTypes.string,
    description: PropTypes.string,
    dragLabel: PropTypes.string.isRequired,
    icon: PropTypes.elementType,
    leading: PropTypes.node,
    mobileFullScreen: PropTypes.bool,
    onClose: PropTypes.func.isRequired,
    panelId: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired
};

DockPanel.defaultProps = {
    actions: null,
    appearance: 'default',
    className: null,
    description: null,
    icon: null,
    leading: null,
    mobileFullScreen: false
};

export default DockPanel;
