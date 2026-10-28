import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {shallow} from 'enzyme';

import EditorMoreMenu from '../../../src/components/editor-dock/editor-more-menu';
import EditorDock from '../../../src/components/editor-dock/editor-dock';

jest.mock('gsap', () => ({gsap: {registerPlugin: jest.fn()}}));
jest.mock('@gsap/react', () => ({useGSAP: () => ({contextSafe: fn => fn})}));
jest.mock('../../../src/lib/planet-project-loader', () => ({isPlanetProjectRoute: () => false}));
jest.mock('../../../src/lib/planet-collaboration', () => ({collaborationEnabled: () => false}));

describe('mobile More menu', () => {
    let renderer;
    let listeners;
    let panel;
    let trigger;
    let close;
    const inside = {};

    beforeEach(() => {
        listeners = new Map();
        panel = {focus: jest.fn(), contains: target => target === inside};
        trigger = {focus: jest.fn(), contains: target => target === trigger, isConnected: true};
        close = jest.fn();
        global.document = {
            addEventListener: (name, handler) => listeners.set(name, handler),
            removeEventListener: name => listeners.delete(name)
        };
        global.window = {matchMedia: () => ({matches: true})};
    });
    afterEach(() => {
        if (renderer) act(() => renderer.unmount());
        renderer = null;
        delete global.document;
        delete global.window;
    });

    test('keeps account controls mounted and hidden while closed', () => {
        const mounted = jest.fn();
        const removed = jest.fn();
        const Account = () => {
            React.useEffect(() => { mounted(); return removed; }, []);
            return <button>下载</button>;
        };
        const render = open => <EditorMoreMenu open={open} triggerRef={{current: trigger}} onClose={close}>
            <Account />
        </EditorMoreMenu>;
        act(() => { renderer = TestRenderer.create(render(false), {createNodeMock: () => panel}); });
        expect(renderer.root.findByType('section').props.hidden).toBe(true);
        act(() => renderer.update(render(true)));
        expect(renderer.root.findByType('section').props.hidden).toBe(false);
        expect(panel.focus).toHaveBeenCalled();
        act(() => renderer.update(render(false)));
        expect(mounted).toHaveBeenCalledTimes(1);
        expect(removed).not.toHaveBeenCalled();
        expect(listeners.size).toBe(0);
    });

    test('dismisses on Escape, close button or outside pointer with appropriate focus', () => {
        act(() => {
            renderer = TestRenderer.create(<EditorMoreMenu open triggerRef={{current: trigger}} onClose={close} />,
                {createNodeMock: () => panel});
        });
        const event = {key: 'Escape', target: inside, preventDefault: jest.fn(), stopPropagation: jest.fn()};
        listeners.get('keydown')(event);
        expect(event.preventDefault).toHaveBeenCalled();
        expect(trigger.focus).toHaveBeenCalled();
        listeners.get('pointerdown')({target: inside});
        listeners.get('pointerdown')({target: trigger});
        expect(close).toHaveBeenCalledTimes(1);
        listeners.get('pointerdown')({target: {}});
        expect(close).toHaveBeenCalledTimes(2);
        renderer.root.findByType('button').props.onClick();
        expect(close).toHaveBeenCalledTimes(3);
    });

    test('opens mobile tools through More and closes it before opening extensions', () => {
        const extension = jest.fn();
        const wrapper = shallow(<EditorDock mobileLayout onOpenExtensionLibrary={extension}
            onOpenSpriteLibrary={jest.fn()} onOpenBackdropLibrary={jest.fn()} />);
        wrapper.find('button[aria-label="更多"]').simulate('click', {currentTarget: {}});
        expect(wrapper.find(EditorMoreMenu).prop('open')).toBe(true);
        expect(wrapper.find('button[aria-label="项目聊天（需协作模式）"]').prop('disabled')).toBe(true);
        wrapper.find('button[aria-label="扩展"]').simulate('click', {currentTarget: {}});
        expect(extension).toHaveBeenCalledTimes(1);
        expect(wrapper.find(EditorMoreMenu).prop('open')).toBe(false);
        wrapper.unmount();
    });

    test('leaves desktop tools directly accessible', () => {
        const wrapper = shallow(<EditorDock onOpenExtensionLibrary={jest.fn()}
            onOpenSpriteLibrary={jest.fn()} onOpenBackdropLibrary={jest.fn()} />);
        expect(wrapper.find(EditorMoreMenu)).toHaveLength(0);
        expect(wrapper.find('button[aria-label="更多"]')).toHaveLength(0);
        expect(wrapper.find('button[aria-label="扩展"]')).toHaveLength(1);
        wrapper.unmount();
    });
});
