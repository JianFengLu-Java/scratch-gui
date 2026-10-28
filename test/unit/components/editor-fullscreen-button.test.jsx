import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import EditorFullscreenButton from '../../../src/components/editor-dock/editor-fullscreen-button';

describe('whole-editor browser fullscreen', () => {
    let previous;
    let renderer;
    let listeners;
    let complete;
    beforeEach(() => {
        previous = global.document;
        listeners = new Map();
        global.document = {
            fullscreenEnabled: true,
            fullscreenElement: null,
            body: {requestFullscreen: jest.fn(() => Promise.resolve())},
            exitFullscreen: jest.fn(() => Promise.resolve()),
            addEventListener: (type, handler) => listeners.set(type, handler),
            removeEventListener: type => listeners.delete(type)
        };
        complete = jest.fn();
        act(() => { renderer = TestRenderer.create(<EditorFullscreenButton onComplete={complete} />); });
    });
    afterEach(() => {
        act(() => renderer.unmount());
        global.document = previous;
    });
    test('requests hidden browser navigation, tracks native exit and preserves the editor', async () => {
        await act(async () => { await renderer.root.findByType('button').props.onClick(); });
        expect(document.body.requestFullscreen).toHaveBeenCalledWith({navigationUI: 'hide'});
        expect(complete).toHaveBeenCalledTimes(1);
        document.fullscreenElement = document.body;
        act(() => listeners.get('fullscreenchange')());
        expect(renderer.root.findByType('button').props['aria-label']).toBe('退出全屏');
        await act(async () => { await renderer.root.findByType('button').props.onClick(); });
        expect(document.exitFullscreen).toHaveBeenCalledTimes(1);
        document.fullscreenElement = null;
        act(() => listeners.get('fullscreenchange')());
        expect(renderer.root.findByType('button').props['aria-label']).toBe('全屏编辑');
    });
    test('surfaces a denied or unavailable fullscreen request without an unhandled rejection', async () => {
        document.body.requestFullscreen.mockRejectedValue(new Error('denied'));
        await act(async () => { await renderer.root.findByType('button').props.onClick(); });
        expect(renderer.root.findByProps({role: 'status'}).children.join('')).toContain('未能进入全屏');
        expect(complete).not.toHaveBeenCalled();
        expect(renderer.root.findByType('button').props.disabled).toBe(false);
        document.fullscreenEnabled = false;
        await act(async () => { await renderer.root.findByType('button').props.onClick(); });
        expect(renderer.root.findByProps({role: 'status'}).children.join('')).toContain('不支持网页全屏');
        expect(document.body.requestFullscreen).toHaveBeenCalledTimes(1);
    });
});
