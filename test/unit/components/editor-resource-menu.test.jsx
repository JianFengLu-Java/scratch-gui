import React from 'react';
import {shallow} from 'enzyme';

import EditorResourceMenu from '../../../src/components/editor-dock/editor-resource-menu';
import Modal from '../../../src/components/modal/modal';

describe('editor add-resource menu', () => {
    test.each([['sprite', '添加角色', '绘制角色'], ['backdrop', '添加背景', '绘制背景']])(
        'opens the mobile %s options in a labelled modal', (kind, title, paint) => {
            const onSelect = jest.fn();
            const onClose = jest.fn();
            const wrapper = shallow(<EditorResourceMenu
                mobileLayout
                kind={kind}
                onClose={onClose}
                onSelect={onSelect}
            />);
            expect(wrapper.find(Modal).prop('contentLabel')).toBe(title);
            const actions = wrapper.find('button');
            expect(actions.map(button => button.text())).toEqual([
                '从素材库选择', paint, kind === 'sprite' ? '随机角色' : '随机背景',
                kind === 'sprite' ? '上传角色' : '上传背景', '取消'
            ]);
            actions.slice(0, 4).forEach(button => {
                expect(button.prop('role')).toBeFalsy();
                button.simulate('click');
            });
            expect(onSelect.mock.calls.map(([command]) => command)).toEqual([
                `${kind}-library`, `${kind}-paint`, `${kind}-surprise`, `${kind}-upload`
            ]);
            actions.last().simulate('click');
            wrapper.find(Modal).prop('onRequestClose')();
            expect(onClose).toHaveBeenCalledTimes(2);
            wrapper.unmount();
        }
    );

    test('keeps the desktop options as a popover menu', () => {
        const wrapper = shallow(<EditorResourceMenu kind="sprite" onClose={() => {}} onSelect={() => {}} />);
        expect(wrapper.find(Modal)).toHaveLength(0);
        expect(wrapper.find('[role="menu"]')).toHaveLength(1);
        expect(wrapper.find('button[role="menuitem"]')).toHaveLength(4);
        wrapper.unmount();
    });
});
