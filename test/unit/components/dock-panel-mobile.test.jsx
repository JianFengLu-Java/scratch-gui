import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';

import DockPanel from '../../../src/components/editor-dock/dock-panel';

jest.mock('gsap', () => ({gsap: {registerPlugin: jest.fn()}}));
jest.mock('gsap/Draggable', () => ({Draggable: {}}));
jest.mock('@gsap/react', () => ({useGSAP: jest.fn()}));

describe('mobile dock panel interactions', () => {
    let renderer;
    let panel;
    let trigger;
    let first;
    let last;
    let viewport;
    let listeners;
    let viewportListeners;
    let close;

    const focusable = () => {
        const element = {
            isConnected: true,
            matches: () => true,
            getClientRects: () => [{}],
            closest: () => null,
            focus: jest.fn(() => { document.activeElement = element; })
        };
        return element;
    };

    beforeEach(() => {
        listeners = new Set();
        viewportListeners = new Map();
        trigger = focusable();
        first = focusable();
        last = focusable();
        const attributes = new Map();
        const styles = new Map();
        panel = {
            ...focusable(),
            getAttribute: key => attributes.get(key),
            setAttribute: (key, value) => attributes.set(key, value),
            contains: element => element === first || element === last,
            querySelectorAll: () => [first, last],
            style: {
                getPropertyValue: key => styles.get(key),
                setProperty: (key, value) => styles.set(key, value),
                removeProperty: key => styles.delete(key)
            }
        };
        panel.focus = jest.fn(() => { document.activeElement = panel; });
        viewport = {
            height: 844,
            offsetTop: 0,
            addEventListener: (type, fn) => viewportListeners.set(type, fn),
            removeEventListener: type => viewportListeners.delete(type)
        };
        global.window = {
            innerHeight: 844,
            visualViewport: viewport,
            matchMedia: () => ({matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn()}),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn()
        };
        global.document = {
            activeElement: trigger,
            body: {style: {overflow: 'auto'}},
            addEventListener: (type, fn) => { if (type === 'keydown') listeners.add(fn); },
            removeEventListener: (type, fn) => listeners.delete(fn),
            querySelector: () => ({getBoundingClientRect: () => ({top: 724})}),
            querySelectorAll: () => [panel]
        };
        close = jest.fn();
        act(() => {
            renderer = TestRenderer.create(
                <DockPanel panelId="chat" title="项目聊天" dragLabel="移动聊天" onClose={close}>
                    <button>发送</button>
                </DockPanel>,
                {createNodeMock: element => element.type === 'section' ? panel : {}}
            );
        });
    });

    afterEach(() => {
        if (renderer) act(() => renderer.unmount());
        renderer = null;
        delete global.window;
        delete global.document;
    });

    const keydown = (key, shiftKey = false) => {
        const event = {key, shiftKey, preventDefault: jest.fn(), target: document.activeElement};
        for (const listener of [...listeners]) listener(event);
        return event;
    };

    test('opens as a modal without focusing an input and restores focus and scrolling on close', () => {
        expect(renderer.root.findByType('section').props['aria-modal']).toBe('true');
        expect(document.activeElement).toBe(panel);
        expect(document.body.style.overflow).toBe('hidden');
        act(() => renderer.unmount());
        renderer = null;
        expect(document.body.style.overflow).toBe('auto');
        expect(document.activeElement).toBe(trigger);
        expect(viewportListeners.size).toBe(0);
        expect(listeners.size).toBe(0);
    });

    test('wraps keyboard focus within the active sheet', () => {
        document.activeElement = last;
        expect(keydown('Tab').preventDefault).toHaveBeenCalled();
        expect(document.activeElement).toBe(first);
        expect(keydown('Tab', true).preventDefault).toHaveBeenCalled();
        expect(document.activeElement).toBe(last);
    });

    test('leaves nested modal keyboard interactions alone', () => {
        document.activeElement = {closest: () => ({hasAttribute: () => false})};
        expect(keydown('Tab').preventDefault).not.toHaveBeenCalled();
        expect(keydown('Escape').preventDefault).not.toHaveBeenCalled();
        expect(close).not.toHaveBeenCalled();
    });

    test('includes the isolated chat composer in the focus cycle', () => {
        const composerInput = focusable();
        const host = {
            matches: () => false,
            shadowRoot: {querySelectorAll: () => [composerInput], activeElement: composerInput}
        };
        panel.querySelectorAll = () => [first, last, host];
        document.activeElement = last;
        expect(keydown('Tab').preventDefault).not.toHaveBeenCalled();
        document.activeElement = host;
        expect(keydown('Tab').preventDefault).toHaveBeenCalled();
        expect(document.activeElement).toBe(first);
    });

    test('updates bounds when the keyboard appears and supports backdrop and Escape dismissal', () => {
        expect(panel.style.getPropertyValue('--dock-panel-mobile-bottom')).toBe('128px');
        viewport.height = 450;
        viewportListeners.get('resize')();
        expect(panel.style.getPropertyValue('--dock-panel-mobile-bottom')).toBe('402px');
        expect(panel.style.getPropertyValue('--dock-panel-mobile-height')).toBe('430px');
        renderer.root.findAllByProps({'aria-hidden': 'true'})
            .find(element => element.type === 'div').props.onClick();
        expect(close).toHaveBeenCalledTimes(1);
        keydown('Escape');
        expect(close).toHaveBeenCalledTimes(2);
    });
});
