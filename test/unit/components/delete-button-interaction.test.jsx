import React from 'react';
import {shallow} from 'enzyme';
import DeleteButton from '../../../src/components/delete-button/delete-button';

describe('asset delete button interactions', () => {
    const event = extra => ({stopPropagation: jest.fn(), preventDefault: jest.fn(), ...extra});

    test('contains touch and mouse presses so they cannot start dragging the role', () => {
        const remove = jest.fn();
        const button = shallow(<DeleteButton onClick={remove} />);
        ['mousedown', 'touchstart'].forEach(type => {
            const press = event();
            button.simulate(type, press);
            expect(press.stopPropagation).toHaveBeenCalledTimes(1);
            expect(press.preventDefault).not.toHaveBeenCalled();
        });
        expect(remove).not.toHaveBeenCalled();
        const click = event();
        button.simulate('click', click);
        expect(remove).toHaveBeenCalledTimes(1);
        expect(click.stopPropagation).toHaveBeenCalledTimes(1);
    });

    test.each(['Enter', ' '])('deletes once with %s without activating the parent tile', key => {
        const remove = jest.fn();
        const button = shallow(<DeleteButton onClick={remove} />);
        const press = event({key});
        button.simulate('keydown', press);
        expect(remove).toHaveBeenCalledTimes(1);
        expect(press.stopPropagation).toHaveBeenCalledTimes(1);
        expect(press.preventDefault).toHaveBeenCalledTimes(1);
        button.simulate('keydown', event({key, repeat: true}));
        expect(remove).toHaveBeenCalledTimes(1);
        button.simulate('keydown', event({key: 'Tab'}));
        expect(remove).toHaveBeenCalledTimes(1);
    });
});
