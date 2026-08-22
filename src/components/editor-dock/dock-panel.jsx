import classNames from 'classnames';
import {gsap} from 'gsap';
import {Draggable} from 'gsap/Draggable';
import {useGSAP} from '@gsap/react';
import {GripVerticalIcon, XIcon} from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';

import {PLANET_DOCK_PANEL_OPEN_EVENT} from '../../lib/editor-dock-events';

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
    const onCloseRef = React.useRef(onClose);
    onCloseRef.current = onClose;

    React.useEffect(() => {
        const handlePanelOpen = event => {
            if (event.detail && event.detail.panelId !== panelId) onCloseRef.current();
        };
        const handleKeyDown = event => {
            if (event.key === 'Escape') onCloseRef.current();
        };
        window.addEventListener(PLANET_DOCK_PANEL_OPEN_EVENT, handlePanelOpen);
        document.addEventListener('keydown', handleKeyDown);
        window.dispatchEvent(new CustomEvent(PLANET_DOCK_PANEL_OPEN_EVENT, {
            detail: {panelId}
        }));
        return () => {
            window.removeEventListener(PLANET_DOCK_PANEL_OPEN_EVENT, handlePanelOpen);
            document.removeEventListener('keydown', handleKeyDown);
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
            edgeResistance: 0.88,
            onPress () {
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
    const descriptionId = `planet-dock-panel-${panelId}-description`;

    return (
        <section
            aria-describedby={descriptionId}
            aria-labelledby={titleId}
            aria-modal="false"
            className={classNames(styles.panel, className)}
            data-dock-panel={panelId}
            ref={panelRef}
            role="dialog"
        >
            {leading}
            <div className={styles.column}>
                <header className={styles.header}>
                    <div
                        aria-label={dragLabel}
                        className={styles.dragHandle}
                        ref={dragHandleRef}
                    >
                        <GripVerticalIcon
                            aria-hidden="true"
                            className={styles.grip}
                        />
                        {Icon ? (
                            <span className={styles.headerIcon}><Icon aria-hidden="true" /></span>
                        ) : null}
                        <div className={styles.headerCopy}>
                            <h2 id={titleId}>{title}</h2>
                            <p id={descriptionId}>{description}</p>
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
    description: PropTypes.string.isRequired,
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
    icon: null,
    leading: null
};

export default DockPanel;
