const guardMarker = '__letCodingReadOnlyFlyoutGuard__';

/**
 * Scratch Blocks checks readOnly for blocks already on the workspace, but its
 * flyout gesture creates a new block without consulting the target workspace.
 * Install one runtime guard so a read-only target can never receive that block.
 *
 * @param {object} ScratchBlocks Scratch Blocks runtime namespace
 */
const lockReadOnlyBlockDrag = ScratchBlocks => {
    const gesture = ScratchBlocks && ScratchBlocks.Gesture && ScratchBlocks.Gesture.prototype;
    if (!gesture || gesture[guardMarker]) return;

    const updateIsDraggingFromFlyout = gesture.updateIsDraggingFromFlyout_;
    if (typeof updateIsDraggingFromFlyout !== 'function') return;

    gesture.updateIsDraggingFromFlyout_ = function (...args) {
        const targetWorkspace = this.flyout_ && this.flyout_.targetWorkspace_;
        if (targetWorkspace && targetWorkspace.options && targetWorkspace.options.readOnly) {
            return false;
        }
        return updateIsDraggingFromFlyout.apply(this, args);
    };
    gesture[guardMarker] = true;
};

export default lockReadOnlyBlockDrag;
