import React from 'react';
import {shallow} from 'enzyme';

import ThrottledPropertyHOC from '../../../src/lib/throttled-property-hoc.jsx';

describe('ThrottledPropertyHOC', () => {
    let mounted;
    let now;
    const throttleTime = 500;
    beforeEach(() => {
        const Component = ({propToThrottle, doNotThrottle}) => (
            <input
                name={doNotThrottle}
                value={propToThrottle}
            />
        );
        const WrappedComponent = ThrottledPropertyHOC('propToThrottle', throttleTime)(Component);

        jest.useFakeTimers();
        now = 0;
        jest.spyOn(Date, 'now').mockImplementation(() => now);

        mounted = shallow(
            <WrappedComponent
                doNotThrottle="oldvalue"
                propToThrottle={0}
            />
        );
    });

    afterEach(() => {
        if (mounted && mounted.exists()) mounted.unmount();
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test('it passes the props on initial render ', () => {
        expect(mounted.dive().find('[value=0]').exists()).toEqual(true);
        expect(mounted.dive().find('[name="oldvalue"]').exists()).toEqual(true);
    });

    test('it does not rerender if throttled prop is updated too soon', () => {
        now = throttleTime / 2;
        mounted.setProps({propToThrottle: 1});
        mounted.update();
        expect(mounted.dive().find('[value=0]').exists()).toEqual(true);
    });

    test('it does rerender if throttled prop is updated after throttle timeout', () => {
        now = throttleTime * 2;
        mounted.setProps({propToThrottle: 1});
        mounted.update();
        expect(mounted.dive().find('[value=1]').exists()).toEqual(true);
    });

    test('it does rerender if a non-throttled prop is changed', () => {
        now = throttleTime / 2;
        mounted.setProps({doNotThrottle: 'newvalue', propToThrottle: 2});
        mounted.update();
        expect(mounted.dive().find('[name="newvalue"]').exists()).toEqual(true);
        expect(mounted.dive().find('[value=2]').exists()).toEqual(true);
    });

    test('renders the final update even when no subsequent props arrive', () => {
        now = 100;
        mounted.setProps({propToThrottle: 1});
        expect(mounted.dive().find('input').prop('value')).toBe(0);
        now = throttleTime;
        jest.advanceTimersByTime(400);
        mounted.update();
        expect(mounted.dive().find('input').prop('value')).toBe(1);
    });

    test('renders the latest asset when several updates arrive during the same interval', () => {
        now = 100;
        mounted.setProps({propToThrottle: 1});
        now = 200;
        mounted.setProps({propToThrottle: 2});
        now = throttleTime;
        jest.advanceTimersByTime(400);
        mounted.update();
        expect(mounted.dive().find('input').prop('value')).toBe(2);
    });

    test('cancels the pending render if the prop returns to the already rendered value', () => {
        now = 100;
        mounted.setProps({propToThrottle: 1});
        mounted.setProps({propToThrottle: 0});
        expect(jest.getTimerCount()).toBe(0);
        now = throttleTime;
        jest.advanceTimersByTime(throttleTime);
        mounted.update();
        expect(mounted.dive().find('input').prop('value')).toBe(0);
    });

    test('clears a pending update when the component unmounts', () => {
        now = 100;
        mounted.setProps({propToThrottle: 1});
        mounted.unmount();
        expect(jest.getTimerCount()).toBe(0);
        jest.runAllTimers();
    });
});
