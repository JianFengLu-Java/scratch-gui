import lockMobileEditorViewport from '../../../src/lib/mobile-editor-viewport';

describe('mobile editor viewport ownership', () => {
    let previous;
    let media;
    let viewport;
    let root;
    let listeners;
    let dispose;
    const node = () => {
        const attributes = new Map();
        return {
            setAttribute: (key, value) => attributes.set(key, value),
            getAttribute: key => (attributes.has(key) ? attributes.get(key) : null),
            removeAttribute: key => attributes.delete(key),
            remove: jest.fn()
        };
    };
    beforeEach(() => {
        previous = {window: global.window, document: global.document};
        root = node();
        viewport = node();
        viewport.setAttribute('content', 'width=device-width, initial-scale=1');
        listeners = new Map();
        media = {matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn()};
        global.window = {matchMedia: () => media};
        global.document = {
            documentElement: root,
            querySelector: () => viewport,
            createElement: () => { viewport = node(); return viewport; },
            head: {appendChild: jest.fn()},
            addEventListener: (type, handler) => listeners.set(type, handler),
            removeEventListener: type => listeners.delete(type)
        };
    });
    afterEach(() => {
        if (dispose) dispose();
        dispose = null;
        Object.assign(global, previous);
    });
    test('locks mobile scale and restores the exact original viewport on desktop and unmount', () => {
        dispose = lockMobileEditorViewport();
        expect(viewport.getAttribute('content')).toContain('maximum-scale=1');
        expect(viewport.getAttribute('content')).toContain('interactive-widget=resizes-content');
        expect(root.getAttribute('data-mobile-editor-viewport')).toBe('locked');
        media.matches = false;
        media.addEventListener.mock.calls[0][1]();
        expect(viewport.getAttribute('content')).toBe('width=device-width, initial-scale=1');
        expect(root.getAttribute('data-mobile-editor-viewport')).toBeNull();
        media.matches = true;
        media.addEventListener.mock.calls[0][1]();
        dispose();
        expect(viewport.getAttribute('content')).toBe('width=device-width, initial-scale=1');
        expect(listeners.size).toBe(0);
    });
    test('prevents native pinch gestures while preserving normal scrolling and canvas propagation', () => {
        dispose = lockMobileEditorViewport();
        const single = {type: 'touchmove', touches: [{}], preventDefault: jest.fn()};
        const pinch = {type: 'touchmove', touches: [{}, {}], preventDefault: jest.fn()};
        const gesture = {type: 'gesturestart', preventDefault: jest.fn()};
        listeners.get('touchmove')(single);
        listeners.get('touchmove')(pinch);
        listeners.get('gesturestart')(gesture);
        expect(single.preventDefault).not.toHaveBeenCalled();
        expect(pinch.preventDefault).toHaveBeenCalled();
        expect(gesture.preventDefault).toHaveBeenCalled();
        media.matches = false;
        gesture.preventDefault.mockClear();
        listeners.get('gesturestart')(gesture);
        expect(gesture.preventDefault).not.toHaveBeenCalled();
    });
    test('removes a viewport it created and leaves initial desktop pages untouched', () => {
        viewport = null;
        media.matches = false;
        dispose = lockMobileEditorViewport();
        expect(viewport).toBeNull();
        media.matches = true;
        media.addEventListener.mock.calls[0][1]();
        const created = viewport;
        expect(created.getAttribute('name')).toBe('viewport');
        dispose();
        expect(created.remove).toHaveBeenCalledTimes(1);
    });
});
