import attachMobilePaintPan from '../../../src/lib/mobile-paint-pan';

describe('mobile paint two-finger navigation', () => {
    let previous;
    let listeners;
    let media;
    let canvas;
    let controller;
    let frame;
    let zoom;
    let drawing;
    let wheels;
    const touch = (id, x, y = 20) => ({identifier: id, clientX: x, clientY: y, pageX: x, pageY: y});
    const send = (type, touches, changedTouches = touches, target = canvas) => {
        const input = {type, touches, targetTouches: touches, changedTouches, target,
            preventDefault: jest.fn(), stopImmediatePropagation: jest.fn()};
        listeners.get(type)(input);
        return input;
    };
    const nextFrame = () => {
        const callback = frame;
        frame = null;
        callback();
    };
    beforeEach(() => {
        jest.useFakeTimers();
        previous = {window: global.window, Event: global.Event, WheelEvent: global.WheelEvent,
            requestAnimationFrame: global.requestAnimationFrame, cancelAnimationFrame: global.cancelAnimationFrame};
        listeners = new Map();
        frame = null;
        zoom = 2;
        drawing = [];
        wheels = [];
        media = {matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn()};
        global.window = {matchMedia: () => media};
        global.Event = class {
            constructor (type, options) { Object.assign(this, {type}, options); }
        };
        global.WheelEvent = global.Event;
        global.requestAnimationFrame = jest.fn(callback => { frame = callback; return 1; });
        global.cancelAnimationFrame = jest.fn(() => { frame = null; });
        canvas = {
            ownerDocument: {
                addEventListener: (type, handler) => listeners.set(type, handler),
                removeEventListener: type => listeners.delete(type)
            },
            contains: element => element === canvas,
            setAttribute: jest.fn(), removeAttribute: jest.fn(),
            dispatchEvent: input => {
                if (input.type === 'wheel') {
                    wheels.push(input);
                    if (input.ctrlKey) zoom -= input.deltaY / 500;
                } else {
                    // Replayed touches traverse the capture listener again.
                    listeners.get(input.type)(input);
                    drawing.push(input);
                }
            }
        };
        controller = attachMobilePaintPan(canvas, () => zoom);
    });
    afterEach(() => {
        controller.dispose();
        jest.useRealTimers();
        Object.assign(global, previous);
    });

    test('recognizes staggered fingers without drawing the initial dot', () => {
        send('touchstart', [touch(1, 10)]);
        jest.advanceTimersByTime(40);
        send('touchstart', [touch(1, 10), touch(2, 110)]);
        send('touchmove', [touch(1, 30, 50), touch(2, 130, 50)]);
        send('touchmove', [touch(1, 60, 80), touch(2, 160, 80)]);
        expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
        nextFrame();
        expect(drawing).toEqual([]);
        expect(wheels).toEqual([expect.objectContaining({
            deltaX: -50, deltaY: -60, clientX: 110, clientY: 80, ctrlKey: false
        })]);
    });

    test('pinches proportionally around the old midpoint, then pans to the new midpoint', () => {
        send('touchstart', [touch(1, 10), touch(2, 110)]);
        send('touchmove', [touch(1, 0, 40), touch(2, 200, 40)]);
        nextFrame();
        expect(zoom).toBe(4);
        expect(wheels[0]).toMatchObject({ctrlKey: true, deltaY: -1000, clientX: 60, clientY: 20});
        expect(wheels[1]).toMatchObject({ctrlKey: false, deltaX: -40, deltaY: -20});
        send('touchmove', [touch(2, 150, 40), touch(1, 50, 40)]);
        nextFrame();
        expect(zoom).toBe(2);
    });

    test('preserves single-finger taps and complete drawing strokes', () => {
        send('touchstart', [touch(1, 10)]);
        send('touchend', [], [touch(1, 10)]);
        expect(drawing.map(input => input.type)).toEqual(['touchstart', 'touchend']);
        drawing = [];
        send('touchstart', [touch(2, 10)]);
        send('touchmove', [touch(2, 20)]);
        jest.advanceTimersByTime(70);
        send('touchmove', [touch(2, 30)]);
        send('touchend', [], [touch(2, 30)]);
        expect(drawing.map(input => input.type)).toEqual(['touchstart', 'touchmove', 'touchmove', 'touchend']);
        expect(drawing[1].touches[0].clientX).toBe(20);
        expect(wheels).toEqual([]);
    });

    test('panning preserves a high zoom previously selected with the zoom buttons', () => {
        zoom = 32;
        send('touchstart', [touch(1, 10), touch(2, 110)]);
        send('touchmove', [touch(1, 20), touch(2, 120)]);
        nextFrame();
        expect(zoom).toBe(32);
        expect(wheels).toHaveLength(1);
        expect(wheels[0].ctrlKey).toBe(false);
    });

    test('stationary first finger can wait for a second finger without starting a tool', () => {
        send('touchstart', [touch(1, 10)]);
        jest.advanceTimersByTime(500);
        send('touchstart', [touch(1, 10), touch(2, 110)]);
        expect(drawing).toEqual([]);
    });

    test('finishes an existing stroke before navigating and blocks the leftover finger', () => {
        send('touchstart', [touch(1, 10)]);
        send('touchmove', [touch(1, 20)]);
        jest.advanceTimersByTime(70);
        send('touchstart', [touch(1, 20), touch(2, 120)]);
        expect(drawing.map(input => input.type)).toEqual(['touchstart', 'touchmove', 'touchend']);
        send('touchmove', [touch(1, 40), touch(2, 140)]);
        send('touchend', [touch(1, 40)], [touch(2, 140)]);
        send('touchmove', [touch(1, 100)]);
        send('touchend', [], [touch(1, 100)]);
        expect(wheels).toHaveLength(1);
        expect(drawing).toHaveLength(3);
        send('touchstart', [touch(3, 10)]);
        send('touchend', [], [touch(3, 10)]);
        expect(drawing).toHaveLength(5);
    });

    test('rebases after a third finger and supports movement outside the canvas', () => {
        send('touchstart', [touch(1, 10), touch(2, 110)]);
        send('touchstart', [touch(1, 10), touch(2, 110), touch(3, 40)], [], {});
        send('touchmove', [touch(1, 50), touch(2, 150), touch(3, 80)], [], {});
        send('touchend', [touch(1, 50), touch(2, 150)], [touch(3, 80)], {});
        send('touchmove', [touch(1, 60), touch(2, 160)], [], {});
        nextFrame();
        expect(wheels).toHaveLength(1);
        expect(wheels[0].deltaX).toBe(-10);
        expect(drawing).toHaveLength(0);
    });

    test('clamps extreme pinches and cancels without late drawing or view updates', () => {
        send('touchstart', [touch(1, 10), touch(2, 110)]);
        send('touchmove', [touch(1, 60), touch(2, 60.01)]);
        nextFrame();
        expect(zoom).toBeCloseTo(1 / 3);
        send('touchmove', [touch(1, 10), touch(2, 110)]);
        send('touchcancel', []);
        expect(frame).toBeNull();
        expect(drawing).toHaveLength(0);
        send('touchstart', [touch(3, 10)]);
        send('touchcancel', []);
        jest.runOnlyPendingTimers();
        expect(drawing).toHaveLength(0);
    });

    test('leaves desktop, stylus and other areas alone and restores listeners on dispose', () => {
        media.matches = false;
        expect(send('touchstart', [touch(1, 10)]).preventDefault).not.toHaveBeenCalled();
        media.matches = true;
        expect(send('touchstart', [{...touch(1, 10), touchType: 'stylus'}]).preventDefault).not.toHaveBeenCalled();
        expect(send('touchstart', [touch(1, 10)], [], {}).preventDefault).not.toHaveBeenCalled();
        send('touchstart', [touch(1, 10)]);
        send('touchmove', [touch(1, 20)]);
        media.matches = false;
        media.addEventListener.mock.calls[0][1]();
        jest.runOnlyPendingTimers();
        expect(drawing).toHaveLength(0);
        controller.dispose();
        expect(listeners.size).toBe(0);
        expect(media.removeEventListener).toHaveBeenCalled();
    });
});
