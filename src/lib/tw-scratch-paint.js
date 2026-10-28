import React from 'react';

let realScratchPaint;
const getRealScratchPaint = () => {
    if (!realScratchPaint) {
        realScratchPaint = require('scratch-paint');
    }
    return realScratchPaint;
};

const PaintEditor = props => React.createElement(getRealScratchPaint().default, props);

// Load Paper with the paint editor, rather than adding it to editor startup.
const getPaper = () => {
    const module = require('@turbowarp/paper');
    return module.default || module;
};
const getPaintZoom = () => {
    const paper = getPaper();
    return paper.view ? paper.view.zoom : null;
};

const initializeMobilePaintView = (canvas, stageSize) => {
    if (!window.matchMedia('(max-width: 1023px)').matches) return;
    const paper = getPaper();
    if (!paper.view || paper.view.element !== canvas) return;
    // Seed the view before the asynchronous image import. Paint's zoom-to-fit
    // only recenters when it can zoom in, leaving short landscape views empty.
    // An imported saved view matrix still takes precedence over this default.
    paper.view.center = new paper.Point(stageSize.width, stageSize.height);
    const view = paper.view;
    let landscape = window.innerWidth > window.innerHeight;
    let frame = null;
    let timer = null;
    const fitAfterRotation = () => {
        if (paper.view !== view) return;
        const {getAllRootItems} = require('scratch-paint/src/helper/selection');
        const bounds = getAllRootItems().reduce((combined, item) =>
            (combined ? combined.unite(item.bounds) : item.bounds), null);
        if (!bounds || !bounds.width || !bounds.height) return;
        view.center = bounds.center;
        view.zoom = Math.max(1 / 3, Math.min(view.zoom,
            canvas.clientWidth / (bounds.width * 1.3), canvas.clientHeight / (bounds.height * 1.3)));
        canvas.dispatchEvent(new WheelEvent('wheel', {
            bubbles: true, cancelable: true, deltaMode: 0, deltaX: 0, deltaY: 0, ctrlKey: true
        }));
    };
    const resize = () => {
        const nextLandscape = window.innerWidth > window.innerHeight;
        if (landscape === nextLandscape) return;
        landscape = nextLandscape;
        cancelAnimationFrame(frame);
        clearTimeout(timer);
        // Wait for the responsive layout and Paper's deferred size calibration.
        frame = requestAnimationFrame(() => {
            timer = setTimeout(fitAfterRotation, 0);
        });
    };
    window.addEventListener('resize', resize);
    return () => {
        cancelAnimationFrame(frame);
        clearTimeout(timer);
        window.removeEventListener('resize', resize);
    };
};

let hasSetupReducer = false;
const ScratchPaintReducer = (state, action) => {
    if (!hasSetupReducer && action.type === 'scratch-gui/navigation/ACTIVATE_TAB' && action.activeTabIndex === 1) {
        hasSetupReducer = true;
    }
    if (hasSetupReducer) {
        return getRealScratchPaint().ScratchPaintReducer(state, action);
    }
    return {};
};

export {
    PaintEditor as default,
    getPaintZoom,
    initializeMobilePaintView,
    ScratchPaintReducer
};
