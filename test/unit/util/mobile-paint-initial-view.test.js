import paper from '@turbowarp/paper';
import {getAllRootItems} from 'scratch-paint/src/helper/selection';
import {initializeMobilePaintView, getPaintZoom} from '../../../src/lib/tw-scratch-paint';

jest.mock('@turbowarp/paper', () => ({
    view: null,
    Point: class {
        constructor (x, y) { this.x = x; this.y = y; }
    }
}));
jest.mock('scratch-paint/src/helper/selection', () => ({getAllRootItems: jest.fn()}));

describe('initial mobile paint view', () => {
    let previous;
    let previousWheel;
    let previousRaf;
    let previousCancelRaf;
    let canvas;
    let resize;
    let dispose;
    beforeEach(() => {
        jest.useFakeTimers();
        previous = global.window;
        previousWheel = global.WheelEvent;
        previousRaf = global.requestAnimationFrame;
        previousCancelRaf = global.cancelAnimationFrame;
        global.window = {innerWidth: 390, innerHeight: 844, matchMedia: () => ({matches: true}),
            addEventListener: (type, fn) => { resize = fn; }, removeEventListener: jest.fn()};
        global.WheelEvent = class {
            constructor (type, options) { Object.assign(this, {type}, options); }
        };
        global.requestAnimationFrame = fn => setTimeout(fn, 16);
        global.cancelAnimationFrame = clearTimeout;
        canvas = {clientWidth: 744, clientHeight: 131, dispatchEvent: jest.fn()};
        paper.view = {element: canvas, zoom: 0.5, center: {x: 752, y: 131}};
    });
    afterEach(() => {
        if (dispose) dispose();
        dispose = null;
        global.window = previous;
        global.WheelEvent = previousWheel;
        global.requestAnimationFrame = previousRaf;
        global.cancelAnimationFrame = previousCancelRaf;
        jest.useRealTimers();
    });

    test('centers a short canvas on the stage before importing artwork without changing its zoom', () => {
        dispose = initializeMobilePaintView(canvas, {width: 480, height: 360});
        expect(paper.view.center).toEqual({x: 480, y: 360});
        expect(getPaintZoom()).toBe(0.5);
    });
    test('uses custom stage dimensions and leaves unrelated or desktop canvases alone', () => {
        dispose = initializeMobilePaintView(canvas, {width: 360, height: 640});
        expect(paper.view.center).toEqual({x: 360, y: 640});
        dispose();
        initializeMobilePaintView({}, {width: 480, height: 360});
        expect(paper.view.center).toEqual({x: 360, y: 640});
        window.matchMedia = () => ({matches: false});
        initializeMobilePaintView(canvas, {width: 480, height: 360});
        expect(paper.view.center).toEqual({x: 360, y: 640});
    });
    test('fits artwork after rotation without changing the view on ordinary toolbar resize', () => {
        dispose = initializeMobilePaintView(canvas, {width: 480, height: 360});
        getAllRootItems.mockReturnValue([{bounds: {width: 192, height: 202, center: {x: 490, y: 380}}}]);
        resize();
        jest.runAllTimers();
        expect(canvas.dispatchEvent).not.toHaveBeenCalled();
        paper.view.zoom = 2;
        window.innerWidth = 844;
        window.innerHeight = 390;
        resize();
        jest.runAllTimers();
        expect(paper.view.center).toEqual({x: 490, y: 380});
        expect(paper.view.zoom).toBeCloseTo(131 / (202 * 1.3));
        expect(canvas.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({deltaY: 0, ctrlKey: true}));
        dispose();
        expect(window.removeEventListener).toHaveBeenCalledWith('resize', resize);
    });
});
