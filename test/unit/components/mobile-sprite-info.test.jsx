import React from 'react';
import {shallowWithIntl} from '../../helpers/intl-helpers.jsx';
import SpriteInfo from '../../../src/components/sprite-info/sprite-info';

describe('compact mobile sprite inspector', () => {
    test('uses one visibility button beside the name and preserves both toggle directions', () => {
        const hide = jest.fn();
        const show = jest.fn();
        const change = jest.fn();
        const view = shallowWithIntl(<SpriteInfo
            stageSize="mobile" name="角色1" x={0} y={0} direction={90} size={100} visible
            onClickNotVisible={hide} onClickVisible={show}
            onChangeName={change} onChangeX={change} onChangeY={change} onChangeSize={change}
            onChangeDirection={change} onChangeRotationStyle={change}
        />).dive();
        expect(view.find('button[aria-pressed]')).toHaveLength(1);
        view.find('button[aria-pressed]').simulate('click');
        expect(hide).toHaveBeenCalledTimes(1);
        view.setProps({visible: false});
        view.find('button[aria-pressed]').simulate('click');
        expect(show).toHaveBeenCalledTimes(1);
        expect(view.find('button[aria-pressed]').prop('aria-pressed')).toBe(false);
        view.setProps({disabled: true});
        expect(view.find('button[aria-pressed]').prop('disabled')).toBe(true);
    });
});
