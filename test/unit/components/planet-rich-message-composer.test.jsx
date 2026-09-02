import React from 'react';
import {shallow} from 'enzyme';

import PlanetRichMessageComposer from '../../../src/components/menu-bar/planet-rich-message-composer';
import PlanetMessageText from '../../../src/components/menu-bar/planet-message-text';
import {loadPlanetMessageUi} from '../../../src/lib/planet-message-ui';

jest.mock('../../../src/lib/planet-message-ui', () => ({loadPlanetMessageUi: jest.fn()}));

const props = {
    disabled: false,
    label: '聊天消息',
    maxLength: 500,
    onChange: jest.fn(),
    onSubmit: jest.fn(),
    sendLabel: '发送消息',
    value: '草稿'
};

describe('shared editor message components', () => {
    beforeEach(() => jest.clearAllMocks());

    test('mounts the actual site composer, updates connection/draft, and releases its portal', async () => {
        const composer = {update: jest.fn(), unmount: jest.fn()};
        const runtime = {mountComposer: jest.fn(() => composer)};
        loadPlanetMessageUi.mockResolvedValue(runtime);
        const wrapper = shallow(<PlanetRichMessageComposer {...props} />);
        await Promise.resolve();
        expect(runtime.mountComposer).toHaveBeenCalledWith(null, expect.objectContaining(props));
        wrapper.setProps({value: '新草稿[微笑]', disabled: true});
        expect(composer.update).toHaveBeenLastCalledWith(expect.objectContaining({
            value: '新草稿[微笑]', disabled: true
        }));
        wrapper.unmount();
        expect(composer.unmount).toHaveBeenCalledTimes(1);
    });

    test('does not mount a stale composer after closing or switching to voice', async () => {
        let resolve;
        loadPlanetMessageUi.mockReturnValue(new Promise(done => { resolve = done; }));
        const wrapper = shallow(<PlanetRichMessageComposer {...props} />);
        wrapper.unmount();
        const mountComposer = jest.fn();
        resolve({mountComposer});
        await Promise.resolve();
        expect(mountComposer).not.toHaveBeenCalled();
    });

    test('offers retry when the shared bundle fails to load', async () => {
        loadPlanetMessageUi.mockRejectedValue(new Error('加载失败'));
        const wrapper = shallow(<PlanetRichMessageComposer {...props} />);
        await Promise.resolve();
        await Promise.resolve();
        expect(wrapper.find('[role="alert"]').text()).toContain('加载失败');
        loadPlanetMessageUi.mockResolvedValue({mountComposer: () => ({update: jest.fn(), unmount: jest.fn()})});
        wrapper.find('button').simulate('click');
        await Promise.resolve();
        expect(wrapper.find('[role="alert"]')).toHaveLength(0);
        wrapper.unmount();
    });

    test('renders EIF token images using the same parser and keeps ordinary text', async () => {
        loadPlanetMessageUi.mockResolvedValue({splitEifEmojiTokens: () => [
            {type: 'text', value: '你好'},
            {type: 'emoji', token: '[微笑]', emoji: {src: '/materials/eif-emojis/test.png', label: '微笑'}}
        ]});
        const wrapper = shallow(<PlanetMessageText content="你好[微笑]" />);
        await Promise.resolve();
        expect(wrapper.find('img').prop('src')).toBe('/materials/eif-emojis/test.png');
        expect(wrapper.find('img').prop('alt')).toBe('[微笑]');
        expect(wrapper.text()).toContain('你好');
        wrapper.unmount();
    });
});
