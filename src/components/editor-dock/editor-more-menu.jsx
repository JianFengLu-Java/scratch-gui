import {XIcon} from 'lucide-react';
import PropTypes from 'prop-types';
import React from 'react';

import styles from './editor-dock.css';

// Keep the portal slot mounted while closed, so download and collaboration state survive dismissal.
const EditorMoreMenu = ({children, open, onClose, triggerRef}) => {
    const panelRef = React.useRef(null);
    React.useLayoutEffect(() => {
        if (!open) return () => {};
        const panel = panelRef.current;
        const trigger = triggerRef.current;
        panel.focus({preventScroll: true});
        const handlePointer = event => {
            if (!panel.contains(event.target) && !(trigger && trigger.contains(event.target))) onClose();
        };
        const handleKey = event => {
            if (event.key === 'Escape' && panel.contains(event.target)) {
                event.preventDefault();
                event.stopPropagation();
                onClose();
                if (trigger && trigger.isConnected) trigger.focus({preventScroll: true});
            }
        };
        const handleFocus = event => {
            if (!panel.contains(event.target) && event.target !== trigger) onClose();
        };
        document.addEventListener('pointerdown', handlePointer);
        document.addEventListener('keydown', handleKey);
        document.addEventListener('focusin', handleFocus);
        return () => {
            document.removeEventListener('pointerdown', handlePointer);
            document.removeEventListener('keydown', handleKey);
            document.removeEventListener('focusin', handleFocus);
        };
    }, [open, onClose, triggerRef]);

    const handleClose = React.useCallback(() => {
        onClose();
        if (triggerRef.current) triggerRef.current.focus({preventScroll: true});
    }, [onClose, triggerRef]);

    return (
        <section
            aria-label="更多功能"
            className={styles.moreMenu}
            hidden={!open}
            id="editor-more-menu"
            ref={panelRef}
            role="dialog"
            tabIndex={-1}
        >
            <header className={styles.moreHeader}>
                <h2>{'更多功能'}</h2>
                <button
                    aria-label="关闭更多功能"
                    type="button"
                    onClick={handleClose}
                >
                    <XIcon aria-hidden="true" />
                </button>
            </header>
            <div className={styles.moreTools}>{children}</div>
            <div
                className={styles.moreAccount}
                data-editor-secondary-account-slot
            />
        </section>
    );
};

EditorMoreMenu.propTypes = {
    children: PropTypes.node,
    onClose: PropTypes.func.isRequired,
    open: PropTypes.bool,
    triggerRef: PropTypes.shape({current: PropTypes.any}).isRequired
};

export default EditorMoreMenu;
