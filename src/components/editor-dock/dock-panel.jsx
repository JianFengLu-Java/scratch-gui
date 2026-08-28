import classNames from 'classnames';
import {gsap} from 'gsap';
import {Draggable} from 'gsap/Draggable';
import {useGSAP} from '@gsap/react';
import {XIcon} from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';

import {registerDockPanel} from '../../lib/dock-panel-manager';

import styles from './dock-panel.css';

const VIEWPORT_INSET = 8;
const TOP_INSET = 56;
const DOCK_GAP = 10;

gsap.registerPlugin(useGSAP, Draggable);

const DockPanel = ({
    actions,
    children,
    className,
    description,
    dragLabel,
    icon: Icon,
    leading,
    onClose,
    panelId,
    title
}) => {
    const panelRef = React.useRef(null);
    const dragHandleRef = React.useRef(null);
    const registrationRef = React.useRef(null);
    const onCloseRef = React.useRef(onClose);
    onCloseRef.current = onClose;
    const activatePanel = React.useCallback(() => {
        if (registrationRef.current) registrationRef.current.activate();
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

    useGSAP(() => {
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
    }, {scope: panelRef});

    const titleId = `planet-dock-panel-${panelId}-title`;
    const descriptionId = description ? `planet-dock-panel-${panelId}-description` : null;

    return (
        <section
            aria-describedby={descriptionId}
            aria-labelledby={titleId}
            aria-modal="false"
            className={classNames(styles.panel, className)}
            data-dock-panel={panelId}
            ref={panelRef}
            role="dialog"
            onFocusCapture={activatePanel}
            onMouseDownCapture={activatePanel}
            onTouchStartCapture={activatePanel}
        >
            {leading}
            <div className={styles.column}>
                <header className={styles.header}>
                    <div
                        aria-label={dragLabel}
                        className={styles.dragHandle}
                        ref={dragHandleRef}
                    >
                        {Icon ? (
                            <span className={styles.headerIcon}><Icon aria-hidden="true" /></span>
                        ) : null}
                        <div className={styles.headerCopy}>
                            <h2 id={titleId}>{title}</h2>
                            {description ? <p id={descriptionId}>{description}</p> : null}
                        </div>
                    </div>
                    <div className={styles.headerActions}>
                        {actions}
                        <button
                            aria-label={`关闭${title}`}
                            className={styles.iconButton}
                            title="关闭"
                            type="button"
                            onClick={onClose}
                        >
                            <XIcon aria-hidden="true" />
                        </button>
                    </div>
                </header>
                {children}
            </div>
        </section>
    );
};

DockPanel.propTypes = {
    actions: PropTypes.node,
    children: PropTypes.node.isRequired,
    className: PropTypes.string,
    description: PropTypes.string,
    dragLabel: PropTypes.string.isRequired,
    icon: PropTypes.elementType,
    leading: PropTypes.node,
    onClose: PropTypes.func.isRequired,
    panelId: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired
};

DockPanel.defaultProps = {
    actions: null,
    className: null,
    description: null,
    icon: null,
    leading: null
};

export default DockPanel;
