// Keep a native vertical flyout in the upper pane. The main workspace starts
// below it, with its full width available for scripts and native drag coordinates.
import {getMobileSceneDefaultHeight} from './mobile-stage-layout';

const HEADER_HEIGHT = 32;
const SPLITTER_HEIGHT = 16;
const CATEGORY_WIDTH = 64;
const TOUCH_DRAG_HOLD_MS = 220;
const SPLIT_STORAGE_KEY = 'tw:mobile-palette-ratio';
const SCENE_SPLIT_STORAGE_KEY = 'tw:mobile-scene-ratio';

const configureMobileBlocksLayout = (workspace, expanded, onExpand, Blockly, getStageSize) => {
    const flyout = workspace.getFlyout();
    const flyoutWorkspace = flyout.getWorkspace();
    const toolbox = workspace.getToolbox();
    const host = workspace.getParentSvg().closest('[data-mobile-blocks]');
    const splitter = host && host.querySelector('[data-mobile-blocks-splitter]');
    flyout.svgGroup_.setAttribute('id', 'mobile-blocks-library');
    flyout.svgGroup_.setAttribute('role', 'tabpanel');
    flyout.svgGroup_.setAttribute('aria-labelledby', 'mobile-blocks-tab-blocks');
    const getMetrics = workspace.getMetrics;
    const getContentBounds = flyout.getContentBoundingBox_;
    const setVisible = flyout.setVisible;
    const hide = flyout.hide;
    const getClientRect = flyout.getClientRect;
    const setSelectedItem = toolbox.setSelectedItem;
    const selectCategoryById = toolbox.selectCategoryById;
    let width = 0;
    let paletteHeight = 0;
    let availableHeight = 0;
    let minimumHeight = 0;
    let maximumHeight = 0;
    let splitRatio = null;
    let sceneSplitRatio = null;
    let libraryVisible = true;
    let resizeFrame = null;
    let drag = null;
    let cachedBounds = null;
    let pendingScroll = null;
    let touchStart = 0;
    let touchGesture = false;
    let populating = false;
    let deferredContents = null;
    const hasLayout = () => !host || (host.clientWidth > 0 && host.clientHeight > 0);
    try {
        const savedRatio = Number(window.localStorage.getItem(SPLIT_STORAGE_KEY));
        if (savedRatio > 0 && savedRatio < 1) splitRatio = savedRatio;
        const savedSceneRatio = Number(window.localStorage.getItem(SCENE_SPLIT_STORAGE_KEY));
        if (savedSceneRatio > 0 && savedSceneRatio < 1) sceneSplitRatio = savedSceneRatio;
    } catch (e) { /* Storage may be unavailable in embedded editors. */ }

    const invalidateBounds = event => {
        if (!event || !event.isUiEvent) cachedBounds = null;
    };
    const measure = () => {
        const rect = workspace.getParentSvg().getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        width = rect.width;
        availableHeight = Math.max(0, rect.height - HEADER_HEIGHT - SPLITTER_HEIGHT);
        minimumHeight = Math.min(libraryVisible ? 96 : 180, availableHeight * 0.35);
        maximumHeight = Math.max(minimumHeight, availableHeight - Math.min(140, availableHeight * 0.45));
        const ratio = libraryVisible ? splitRatio : sceneSplitRatio;
        const defaultHeight = libraryVisible ? Math.min(224, availableHeight * 0.38) :
            getMobileSceneDefaultHeight(getStageSize ? getStageSize() : {width: 480, height: 360}, width);
        const requestedHeight = ratio === null ? defaultHeight : availableHeight * ratio;
        const nextHeight = expanded || populating ?
            Math.round(Math.max(minimumHeight, Math.min(maximumHeight, requestedHeight))) : 0;
        if (host && nextHeight !== paletteHeight) {
            host.style.setProperty('--tw-mobile-palette-height', `${nextHeight}px`);
        }
        paletteHeight = nextHeight;
        if (splitter && availableHeight > 0) {
            splitter.setAttribute('aria-valuemin', Math.round(minimumHeight / availableHeight * 100));
            splitter.setAttribute('aria-valuemax', Math.round(maximumHeight / availableHeight * 100));
            splitter.setAttribute('aria-valuenow', Math.round(nextHeight / availableHeight * 100));
            splitter.setAttribute('aria-valuetext',
                `上方 ${nextHeight} 像素，工作画布 ${Math.round(availableHeight - nextHeight)} 像素`);
        }
    };
    const revealSelectedCategory = () => {
        const selected = toolbox.getSelectedItem();
        if (!selected || !selected.item_ || !selected.item_.isConnected) return;
        const item = selected.item_.getBoundingClientRect();
        const menu = toolbox.HtmlDiv.getBoundingClientRect();
        if (item.top < menu.top) toolbox.HtmlDiv.scrollTop += item.top - menu.top;
        else if (item.bottom > menu.bottom) toolbox.HtmlDiv.scrollTop += item.bottom - menu.bottom;
    };

    // Retain VerticalFlyout's native category offsets and final-category padding.
    // Only cache the block bounds so scrolling does not walk every extension block.
    flyout.getContentBoundingBox_ = function () {
        if (!cachedBounds) cachedBounds = getContentBounds.call(this);
        return cachedBounds;
    };
    flyoutWorkspace.addChangeListener(invalidateBounds);

    toolbox.getWidth = () => 0;
    toolbox.getHeight = () => 0;
    toolbox.position = () => {
        measure();
        flyout.position();
    };
    workspace.getMetrics = function () {
        const metrics = getMetrics.call(this);
        if (!metrics) return metrics;
        const top = HEADER_HEIGHT + paletteHeight + (expanded ? SPLITTER_HEIGHT : 0);
        metrics.absoluteLeft = 0;
        metrics.absoluteTop = top;
        metrics.viewHeight = Math.max(1, metrics.viewHeight - top);
        metrics.toolboxWidth = 0;
        metrics.toolboxHeight = top;
        metrics.flyoutWidth = 0;
        metrics.flyoutHeight = paletteHeight;
        return metrics;
    };

    flyout.getWidth = () => Math.max(1, width - CATEGORY_WIDTH);
    flyout.position = function () {
        measure();
        if (deferredContents && hasLayout()) {
            const contents = deferredContents;
            deferredContents = null;
            this.show(contents);
            return;
        }
        if (!this.isVisible() || !this.containerVisible_ || !width) return;
        this.width_ = this.getWidth();
        this.height_ = paletteHeight;
        const x = workspace.RTL ? 0 : CATEGORY_WIDTH;
        this.setBackgroundPath_(this.width_, this.height_);
        this.svgGroup_.setAttribute('width', this.width_);
        this.svgGroup_.setAttribute('height', this.height_);
        Blockly.utils.setCssTransform(this.svgGroup_, `translate(${x}px,${HEADER_HEIGHT}px)`);
        this.scrollbar_.setOrigin(x, HEADER_HEIGHT);
        this.scrollbar_.resize();
        const metrics = this.getMetrics_();
        if (metrics) {
            this.clipRect_.setAttribute('height', `${Math.max(0, metrics.viewHeight)}px`);
            this.clipRect_.setAttribute('width', `${Math.max(0, metrics.viewWidth)}px`);
        }
        this.svgGroup_.style.opacity = 1;
        if (pendingScroll !== null) this.setScrollPos(pendingScroll);
    };
    flyout.setScrollPos = function (positionInBlocks) {
        this.scrollTarget = null;
        const value = Number.isFinite(positionInBlocks) ? Math.max(0, positionInBlocks) : 0;
        const metrics = hasLayout() && this.containerVisible_ && this.getMetrics_();
        if (!metrics || !Number.isFinite(metrics.contentHeight)) {
            pendingScroll = value;
            return;
        }
        pendingScroll = null;
        this.scrollbar_.resize(metrics);
        this.scrollbar_.set(Math.min(value * flyoutWorkspace.scale,
            Math.max(0, metrics.contentHeight - metrics.viewHeight)));
    };

    const expandPalette = () => {
        // Background toolbox refreshes must not replace the selected panel.
        if (expanded || !libraryVisible) return;
        expanded = true;
        flyout.setVisible(true);
        workspace.resize();
        onExpand();
    };
    flyout.scrollTo = function (positionInBlocks) {
        expandPalette();
        this.setScrollPos(positionInBlocks);
    };
    flyout.setVisible = function (visible) {
        return setVisible.call(this, visible && ((expanded && libraryVisible) || populating));
    };
    flyout.getClientRect = function () {
        return this.isVisible() && this.containerVisible_ ? getClientRect.call(this) : null;
    };
    flyout.hide = function () {
        this.scrollTarget = null;
        // Native hide() otherwise skips listener cleanup when already collapsed.
        this.isVisible_ = true;
        return hide.call(this);
    };
    flyout.show = function (contents) {
        // The mobile stage page keeps this workspace mounted but hidden.
        // SVG text/blocks must be measured after returning to the editor.
        if (!hasLayout()) {
            deferredContents = contents;
            invalidateBounds();
            return;
        }
        this.scrollTarget = null;
        pendingScroll = null;
        invalidateBounds();
        const gesture = workspace.currentGesture_;
        if (gesture && gesture.flyout_ === this) workspace.cancelCurrentGesture();
        populating = true;
        try {
            // Resolve the prototype at call time so late addon category
            // registrations still run before VARIABLE/LIST expansion.
            return Object.getPrototypeOf(this).show.call(this, contents);
        } finally {
            populating = false;
            this.setVisible(expanded);
            invalidateBounds();
            measure();
            flyoutWorkspace.setResizesEnabled(true);
            if (!expanded || !libraryVisible) workspace.resize();
        }
    };
    flyout.layout_ = function (contents, gaps) {
        invalidateBounds();
        try {
            return Object.getPrototypeOf(this).layout_.call(this, contents, gaps);
        } finally {
            invalidateBounds();
        }
    };
    toolbox.setSelectedItem = function (item, shouldScroll) {
        if (item && shouldScroll !== false) expandPalette();
        const result = setSelectedItem.call(this, item, shouldScroll);
        if (item) revealSelectedCategory();
        return result;
    };
    toolbox.selectCategoryById = function (id) {
        const selected = this.getSelectedItem();
        if (selected && selected.id_ === id) return;
        const result = selectCategoryById.call(this, id);
        revealSelectedCategory();
        return result;
    };

    // Quick vertical touches pan the library; holding before moving drags a
    // block into the lower canvas. Mouse users can drag immediately.
    const handleTouchStart = event => {
        if (event.touches.length !== 1) return;
        touchGesture = true;
        touchStart = Date.now();
        Promise.resolve().then(() => {
            if (typeof Blockly.longStop_ === 'function') Blockly.longStop_();
        });
    };
    const handleMouseDown = () => { touchGesture = false; };
    flyout.svgGroup_.addEventListener('touchstart', handleTouchStart, {capture: true, passive: true});
    flyout.svgGroup_.addEventListener('mousedown', handleMouseDown, true);
    flyout.isDragTowardWorkspace = () => !touchGesture || Date.now() - touchStart >= TOUCH_DRAG_HOLD_MS;

    // Native category selection listens to touchend. A category-menu swipe
    // should finish scrolling without selecting the item under the finger.
    let categoryTouch = null;
    let categoryScrolled = false;
    const handleCategoryStart = event => {
        categoryTouch = event.touches.length === 1 ? event.touches[0] : null;
        categoryScrolled = false;
    };
    const handleCategoryMove = event => {
        const touch = event.touches[0];
        if (categoryTouch && touch && Math.abs(touch.clientY - categoryTouch.clientY) > 8) {
            categoryScrolled = true;
        }
    };
    const handleCategoryEnd = event => {
        if (categoryScrolled) event.stopPropagation();
        categoryTouch = null;
    };
    const touchOptions = {capture: true, passive: true};
    toolbox.HtmlDiv.addEventListener('touchstart', handleCategoryStart, touchOptions);
    toolbox.HtmlDiv.addEventListener('touchmove', handleCategoryMove, touchOptions);
    toolbox.HtmlDiv.addEventListener('touchend', handleCategoryEnd, touchOptions);
    toolbox.HtmlDiv.addEventListener('touchcancel', handleCategoryEnd, touchOptions);

    const saveSplit = () => {
        const ratio = libraryVisible ? splitRatio : sceneSplitRatio;
        if (ratio === null) return;
        try {
            window.localStorage.setItem(libraryVisible ? SPLIT_STORAGE_KEY : SCENE_SPLIT_STORAGE_KEY, String(ratio));
        } catch (e) { /* Keep the current session's split even without storage. */ }
    };
    const flushResize = () => {
        if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
        resizeFrame = null;
        workspace.resize();
    };
    const resizePalette = height => {
        if (!availableHeight) return;
        const ratio = Math.max(minimumHeight, Math.min(maximumHeight, height)) / availableHeight;
        if (libraryVisible) splitRatio = ratio;
        else sceneSplitRatio = ratio;
        if (resizeFrame === null) resizeFrame = requestAnimationFrame(flushResize);
    };
    const handleSplitStart = event => {
        if (drag || !expanded || event.isPrimary === false || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        workspace.cancelCurrentGesture();
        Blockly.hideChaff();
        measure();
        drag = {pointerId: event.pointerId, y: event.clientY, height: paletteHeight};
        splitter.focus({preventScroll: true});
        splitter.setPointerCapture(event.pointerId);
        splitter.setAttribute('data-dragging', 'true');
    };
    const handleSplitMove = event => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        resizePalette(drag.height + event.clientY - drag.y);
    };
    const handleSplitEnd = event => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        const pointerId = drag.pointerId;
        drag = null;
        splitter.removeAttribute('data-dragging');
        if (splitter.hasPointerCapture(pointerId)) splitter.releasePointerCapture(pointerId);
        flushResize();
        saveSplit();
    };
    const handleSplitKey = event => {
        let height;
        if (event.key === 'ArrowUp') height = paletteHeight - (event.shiftKey ? 40 : 16);
        else if (event.key === 'ArrowDown') height = paletteHeight + (event.shiftKey ? 40 : 16);
        else if (event.key === 'Home') height = minimumHeight;
        else if (event.key === 'End') height = maximumHeight;
        else return;
        event.preventDefault();
        event.stopPropagation();
        resizePalette(height);
        flushResize();
        saveSplit();
    };
    if (splitter) {
        splitter.addEventListener('pointerdown', handleSplitStart);
        splitter.addEventListener('pointermove', handleSplitMove);
        splitter.addEventListener('pointerup', handleSplitEnd);
        splitter.addEventListener('pointercancel', handleSplitEnd);
        splitter.addEventListener('lostpointercapture', handleSplitEnd);
        splitter.addEventListener('keydown', handleSplitKey);
    }

    const setExpanded = visible => {
        expanded = visible;
        if (!visible) flyout.scrollTarget = null;
        measure();
        flyout.setVisible(visible);
        workspace.resize();
    };
    setExpanded.setPanel = panel => {
        libraryVisible = panel === 'blocks';
        flyout.scrollTarget = null;
        flyout.setVisible(expanded);
        workspace.resize();
    };
    setExpanded.dispose = () => {
        deferredContents = null;
        if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
        if (splitter) {
            const pointerId = drag && drag.pointerId;
            drag = null;
            if (pointerId !== null && splitter.hasPointerCapture(pointerId)) splitter.releasePointerCapture(pointerId);
            splitter.removeEventListener('pointerdown', handleSplitStart);
            splitter.removeEventListener('pointermove', handleSplitMove);
            splitter.removeEventListener('pointerup', handleSplitEnd);
            splitter.removeEventListener('pointercancel', handleSplitEnd);
            splitter.removeEventListener('lostpointercapture', handleSplitEnd);
            splitter.removeEventListener('keydown', handleSplitKey);
        }
        flyout.svgGroup_.removeEventListener('touchstart', handleTouchStart, true);
        flyout.svgGroup_.removeEventListener('mousedown', handleMouseDown, true);
        flyoutWorkspace.removeChangeListener(invalidateBounds);
        toolbox.HtmlDiv.removeEventListener('touchstart', handleCategoryStart, true);
        toolbox.HtmlDiv.removeEventListener('touchmove', handleCategoryMove, true);
        toolbox.HtmlDiv.removeEventListener('touchend', handleCategoryEnd, true);
        toolbox.HtmlDiv.removeEventListener('touchcancel', handleCategoryEnd, true);
    };
    measure();
    // Rebuild initial desktop geometry at the mobile width, including RTL blocks.
    toolbox.refreshSelection();
    return setExpanded;
};

export default configureMobileBlocksLayout;
