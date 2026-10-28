// Fixed panels use layout coordinates; VisualViewport accounts for the on-screen keyboard.
export const getMobilePanelBounds = ({
    height, viewportHeight = height, viewportTop = 0, dockTop = height, fullScreen = false
}) => {
    const visibleBottom = Math.min(height, viewportTop + viewportHeight);
    const keyboardInset = Math.max(0, height - visibleBottom);
    if (fullScreen) {
        return {bottom: keyboardInset, availableHeight: Math.max(0, visibleBottom - viewportTop)};
    }
    const dockInset = Math.max(0, height - dockTop);
    // When the keyboard is open, use the space above it rather than reserving the hidden dock.
    const bottom = keyboardInset > 80 ? keyboardInset + 8 : Math.max(8, dockInset + 8);
    const availableHeight = Math.max(0, height - bottom - viewportTop - 12);
    return {bottom, availableHeight};
};
