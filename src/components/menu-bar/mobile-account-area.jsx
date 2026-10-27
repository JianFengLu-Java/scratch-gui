import React from 'react';
import PropTypes from 'prop-types';
import {createPortal} from 'react-dom';
import {PLANET_EDITOR_ACCOUNT_SLOT_EVENT} from '../../lib/editor-dock-events';

// The same account controls and autosave managers have one mounted home at a time.
const MobileAccountArea = ({children}) => {
    const [destination, setDestination] = React.useState({ready: false, target: null});
    React.useLayoutEffect(() => {
        const update = () => {
            const target = window.matchMedia('(max-width: 1023px)').matches ?
                document.querySelector('[data-editor-account-slot]') : null;
            setDestination(previous => (previous.ready && previous.target === target ?
                previous : {ready: true, target}));
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener(PLANET_EDITOR_ACCOUNT_SLOT_EVENT, update);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener(PLANET_EDITOR_ACCOUNT_SLOT_EVENT, update);
        };
    }, []);
    if (!destination.ready) return null;
    return destination.target ? createPortal(children, destination.target) : children;
};

MobileAccountArea.propTypes = {children: PropTypes.node};

export default MobileAccountArea;
