import {readFileSync} from 'fs';
import {runInNewContext} from 'vm';
import configureMobileBlocksLayout from '../../../src/lib/mobile-blocks-layout';

// Exercise the installed Scratch Blocks gesture routing, rather than a second
// implementation of the block-versus-background decision.
const gestureSource = readFileSync(require.resolve('scratch-blocks/core/gesture.js'), 'utf8');
class Coordinate {
    constructor (x, y) {
        this.x = x;
        this.y = y;
    }
    static difference (a, b) {
        return new Coordinate(a.x - b.x, a.y - b.y);
    }
    static magnitude (point) {
        return Math.hypot(point.x, point.y);
    }
}

describe('mobile blocks use the initial hit target', () => {
    let previousWindow;
    let Blockly;
    let flyout;
    let workspace;
    let controller;
    let originalDirectionCheck;
    let scrollers;

    beforeEach(() => {
        previousWindow = global.window;
        global.window = {localStorage: {getItem: () => null}};
        scrollers = [];
        Blockly = {
            FLYOUT_DRAG_RADIUS: 10,
            DRAG_RADIUS: 3,
            longStop_: jest.fn(),
            Events: {getGroup: () => true},
            FlyoutDragger: function () {
                this.startDrag = jest.fn();
                scrollers.push(this);
            }
        };
        runInNewContext(gestureSource, {
            Blockly,
            goog: {
                provide: () => {}, require: () => {},
                asserts: {assert: value => { if (!value) throw new Error('Invalid gesture transition'); }},
                math: {Coordinate}
            }
        });
        const flyoutWorkspace = {scale: 1, addChangeListener: jest.fn(), removeChangeListener: jest.fn()};
        originalDirectionCheck = jest.fn(() => false);
        flyout = {
            svgGroup_: {setAttribute: jest.fn()},
            getWorkspace: () => flyoutWorkspace,
            getContentBoundingBox_: jest.fn(),
            setVisible: jest.fn(), hide: jest.fn(), getClientRect: jest.fn(),
            isDragTowardWorkspace: originalDirectionCheck,
            isScrollable: () => true,
            createBlock: jest.fn(() => ({select: jest.fn()}))
        };
        const toolbox = {
            HtmlDiv: {addEventListener: jest.fn(), removeEventListener: jest.fn()},
            setSelectedItem: jest.fn(), selectCategoryById: jest.fn(), refreshSelection: jest.fn()
        };
        workspace = {
            getFlyout: () => flyout,
            getToolbox: () => toolbox,
            getParentSvg: () => ({
                closest: () => null,
                getBoundingClientRect: () => ({width: 390, height: 740})
            }),
            getMetrics: jest.fn(),
            updateScreenCalculationsIfScrolled: jest.fn()
        };
        flyout.targetWorkspace_ = workspace;
        controller = configureMobileBlocksLayout(workspace, true, jest.fn(), Blockly);
    });

    afterEach(() => {
        controller.dispose();
        global.window = previousWindow;
    });

    const begin = block => {
        const gesture = new Blockly.Gesture({}, workspace);
        gesture.flyout_ = flyout;
        gesture.targetBlock_ = block;
        gesture.startWorkspace_ = flyout.getWorkspace();
        gesture.mouseDownXY_ = {x: 100, y: 100};
        gesture.startDraggingBlock_ = jest.fn();
        return gesture;
    };

    test.each([[0, 30], [0, -30], [30, 0], [-30, 0]])(
        'touching a block drags immediately in direction %s, %s', (x, y) => {
            const block = {disabled: false};
            const gesture = begin(block);
            gesture.updateFromEvent_({type: 'touchmove', clientX: 100 + x, clientY: 100 + y});
            expect(flyout.createBlock).toHaveBeenCalledWith(block);
            expect(gesture.isDraggingBlock_).toBe(true);
            expect(gesture.startDraggingBlock_).toHaveBeenCalledTimes(1);
            expect(scrollers).toHaveLength(0);
        }
    );

    test('starting on blank space scrolls and stays a scroll while crossing blocks', () => {
        const gesture = begin(null);
        gesture.updateFromEvent_({type: 'touchmove', clientX: 100, clientY: 130});
        gesture.updateFromEvent_({type: 'touchmove', clientX: 160, clientY: 160});
        expect(gesture.isDraggingWorkspace_).toBe(true);
        expect(flyout.createBlock).not.toHaveBeenCalled();
        expect(scrollers).toHaveLength(1);
        expect(scrollers[0].startDrag).toHaveBeenCalledTimes(1);
    });

    test('small finger movement preserves input and dropdown taps', () => {
        const gesture = begin({disabled: false});
        gesture.startField_ = {isCurrentlyEditable: () => true};
        gesture.updateFromEvent_({type: 'touchmove', clientX: 103, clientY: 102});
        expect(gesture.isFieldClick_()).toBe(true);
        expect(gesture.isDragging()).toBe(false);
        expect(flyout.createBlock).not.toHaveBeenCalled();
    });

    test('disabled blocks remain unavailable and the desktop direction check is restored on disposal', () => {
        const gesture = begin({disabled: true});
        gesture.updateFromEvent_({type: 'touchmove', clientX: 100, clientY: 130});
        expect(flyout.createBlock).not.toHaveBeenCalled();
        controller.dispose();
        expect(flyout.isDragTowardWorkspace).toBe(originalDirectionCheck);
    });
});
