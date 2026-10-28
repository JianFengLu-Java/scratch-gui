import attachMobilePaintPan from '../../../src/lib/mobile-paint-pan';

describe('mobile paint canvas panning', () => {
    let previous;
    let listeners;
    let media;
    let canvas;
    let attributes;
    let captured;
    let draw;
    let frame;
    const event = (type, x = 10, y = 20, id = 1) => ({
        type, clientX: x, clientY: y, pointerId: id, button: 0,
        preventDefault: jest.fn(), stopImmediatePropagation: jest.fn()
    });
    const send = (type, x, y, id) => {
        const input = event(type, x, y, id);
        listeners.get(type)(input);
        return input;
    };
    beforeEach(() => {
        previous = {window: global.window, WheelEvent: global.WheelEvent,
            requestAnimationFrame: global.requestAnimationFrame, cancelAnimationFrame: global.cancelAnimationFrame};
        listeners = new Map();
        attributes = new Map();
        captured = null;
        frame = null;
        media = {matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn()};
        global.window = {matchMedia: () => media};
        global.WheelEvent = class {
            constructor (type, options) { Object.assign(this, {type}, options); }
        };
        global.requestAnimationFrame = jest.fn(callback => { frame = callback; return 1; });
        global.cancelAnimationFrame = jest.fn();
        canvas = {
            addEventListener: (type, handler) => listeners.set(type, handler),
            removeEventListener: type => listeners.delete(type),
            setAttribute: (key, value) => attributes.set(key, value),
            removeAttribute: key => attributes.delete(key),
            setPointerCapture: id => { captured = id; },
            hasPointerCapture: id => id === captured,
            releasePointerCapture: () => { captured = null; },
            dispatchEvent: jest.fn()
        };
        draw = attachMobilePaintPan(canvas);
    });
    afterEach(() => {
        draw.dispose();
        Object.assign(global, previous);
    });

    test('leaves normal drawing gestures untouched until explicitly enabled', () => {
        expect(send('pointerdown').preventDefault).not.toHaveBeenCalled();
        expect(send('touchstart').preventDefault).not.toHaveBeenCalled();
        expect(canvas.dispatchEvent).not.toHaveBeenCalled();
    });

    test('coalesces finger movement into native view scrolling without a drawing gesture', () => {
        draw.setEnabled(true);
        expect(send('pointerdown', 10, 20).stopImmediatePropagation).toHaveBeenCalled();
        expect(send('touchstart').preventDefault).toHaveBeenCalled();
        send('pointermove', 30, 50);
        send('pointermove', 60, 80);
        expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
        frame();
        expect(canvas.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
            type: 'wheel', deltaX: -50, deltaY: -60, deltaMode: 0, clientX: 60, clientY: 80
        }));
        send('pointerup', 60, 80);
        expect(captured).toBeNull();
        draw.setEnabled(false);
        expect(send('mousedown').preventDefault).not.toHaveBeenCalled();
    });

    test('flushes the final movement and releases capture when the pointer is cancelled', () => {
        draw.setEnabled(true);
        send('pointerdown');
        send('pointermove', 20, 30);
        send('pointercancel', 20, 30);
        expect(canvas.dispatchEvent).toHaveBeenCalledTimes(1);
        expect(captured).toBeNull();
        expect(attributes.has('data-paint-pan-dragging')).toBe(false);
    });

    test('disables panning on desktop and cleans up an in-progress gesture', () => {
        draw.setEnabled(true);
        send('pointerdown');
        send('pointermove', 20, 30);
        media.matches = false;
        media.addEventListener.mock.calls[0][1]();
        expect(captured).toBeNull();
        expect(attributes.has('data-paint-pan-mode')).toBe(false);
        expect(send('pointerdown').preventDefault).not.toHaveBeenCalled();
        expect(canvas.dispatchEvent).not.toHaveBeenCalled();
        draw.dispose();
        expect(listeners.size).toBe(0);
        expect(media.removeEventListener).toHaveBeenCalled();
    });
});
