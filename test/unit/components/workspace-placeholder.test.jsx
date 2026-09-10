import React from 'react';
import {shallow} from 'enzyme';
import WorkspacePlaceholder from '../../../src/components/menu-bar/workspace-placeholder.jsx';

describe('course floating window', () => {
    beforeEach(() => {
        global.window = {innerWidth: 1024, innerHeight: 768, addEventListener: jest.fn(),
            removeEventListener: jest.fn()};
    });
    afterEach(() => { delete global.window; });
    test('mounts the embedded player only while open', () => {
        const wrapper = shallow(<WorkspacePlaceholder />);
        expect(wrapper.find('iframe').exists()).toBe(false);
        wrapper.find('button').simulate('click');
        expect(wrapper.find('iframe').prop('src')).toBe('/editor-courses');
        wrapper.instance().trigger.current = {focus: jest.fn()};
        wrapper.find('[aria-label="关闭课程窗口并停止播放"]').simulate('click');
        expect(wrapper.find('iframe').exists()).toBe(false);
        expect(wrapper.instance().trigger.current.focus).toHaveBeenCalled();
        wrapper.unmount();
    });
    test('keeps keyboard movement within the viewport', () => {
        const wrapper = shallow(<WorkspacePlaceholder />);
        wrapper.find('button').simulate('click');
        wrapper.instance().clamp(-100, -100);
        expect(wrapper.state('x')).toBe(8);
        expect(wrapper.state('y')).toBe(52);
        const preventDefault = jest.fn();
        wrapper.find('[aria-label="移动课程窗口，使用方向键调整位置"]')
            .simulate('keydown', {key: 'ArrowRight', preventDefault});
        expect(wrapper.state('x')).toBe(28);
        expect(preventDefault).toHaveBeenCalled();
        wrapper.unmount();
    });
});
