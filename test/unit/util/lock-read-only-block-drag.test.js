import lockReadOnlyBlockDrag from '../../../src/lib/lock-read-only-block-drag';

describe('lockReadOnlyBlockDrag', () => {
    const runtime = () => {
        const original = jest.fn(() => true);
        function Gesture () {}
        Gesture.prototype.updateIsDraggingFromFlyout_ = original;
        return {Gesture, original};
    };

    test('blocks flyout drag into a read-only target workspace', () => {
        const {Gesture, original} = runtime();
        lockReadOnlyBlockDrag({Gesture});
        const gesture = new Gesture();
        gesture.flyout_ = {targetWorkspace_: {options: {readOnly: true}}};

        expect(gesture.updateIsDraggingFromFlyout_()).toBe(false);
        expect(original).not.toHaveBeenCalled();
    });

    test('preserves normal editor flyout dragging and installs only once', () => {
        const {Gesture, original} = runtime();
        const ScratchBlocks = {Gesture};
        lockReadOnlyBlockDrag(ScratchBlocks);
        lockReadOnlyBlockDrag(ScratchBlocks);
        const gesture = new Gesture();
        gesture.flyout_ = {targetWorkspace_: {options: {readOnly: false}}};

        expect(gesture.updateIsDraggingFromFlyout_('event')).toBe(true);
        expect(original).toHaveBeenCalledTimes(1);
        expect(original).toHaveBeenCalledWith('event');
    });
});
