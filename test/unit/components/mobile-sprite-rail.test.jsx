import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {shallowWithIntl} from '../../helpers/intl-helpers.jsx';
import SpriteList from '../../../src/components/sprite-selector/sprite-list.jsx';
import SpriteSelector from '../../../src/components/sprite-selector/sprite-selector.jsx';
import DragRecognizer from '../../../src/lib/drag-recognizer';

jest.mock('../../../src/lib/sortable-hoc.jsx', () => Component => Component);
jest.mock('../../../src/lib/throttled-property-hoc.jsx', () => () => Component => Component);
jest.mock('../../../src/components/asset-panel/sortable-asset.jsx', () => 'sortable-asset');
jest.mock('../../../src/containers/sprite-selector-item.jsx', () => 'sprite-item');
jest.mock('../../../src/containers/sprite-info.jsx', () => 'sprite-info');

describe('mobile scene sprite rail', () => {
    const originalWindow = global.window;
    let props;
    let list;
    let selectedRect;
    let view;

    beforeEach(() => {
        global.window = {
            matchMedia: jest.fn(() => ({matches: true})),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn()
        };
        props = {
            containerRef: jest.fn(),
            horizontalScroll: true,
            hoveredTarget: {},
            items: Array.from({length: 8}, (_, i) => ({id: `${i}`, name: `角色${i + 1}`, order: i})),
            selectedId: '7'
        };
        selectedRect = {left: 464, right: 512};
        list = {
            clientWidth: 306,
            scrollLeft: 0,
            getBoundingClientRect: () => ({left: 78, right: 384}),
            querySelector: () => ({getBoundingClientRect: () => selectedRect})
        };
    });

    afterEach(() => {
        if (view) act(() => view.unmount());
        view = null;
        global.window = originalWindow;
    });

    const render = () => {
        act(() => {
            view = renderer.create(<SpriteList {...props} />, {
                createNodeMock: node => (node.props.role === 'region' ? list : null)
            });
        });
    };

    test('the scene enables horizontal touch scrolling all the way to sprite tiles', () => {
        const selector = shallowWithIntl(<SpriteSelector
            mobileStandalone
            selectedId="7"
            sprites={Object.fromEntries(props.items.map(item => [item.id, item]))}
            stageSize="mobile"
        />).dive();
        expect(selector.find(SpriteList).prop('horizontalScroll')).toBe(true);
        render();
        expect(view.root.findAllByType('sprite-item').every(tile => tile.props.horizontalScroll)).toBe(true);
    });

    test('reveals a selected offscreen sprite by scrolling only the rail in either direction', () => {
        render();
        expect(list.scrollLeft).toBe(136);
        expect(props.containerRef).toHaveBeenCalledWith(list);
        selectedRect = {left: -50, right: -2};
        act(() => view.update(<SpriteList {...props} selectedId="0" />));
        expect(list.scrollLeft).toBe(0);
    });

    test('does not move the desktop list or a hidden scene', () => {
        window.matchMedia.mockReturnValue({matches: false});
        render();
        expect(list.scrollLeft).toBe(0);
        act(() => view.unmount());
        window.matchMedia.mockReturnValue({matches: true});
        list.clientWidth = 0;
        render();
        expect(list.scrollLeft).toBe(0);
    });

    test('sideways touch movement scrolls without preventing native input or dragging a sprite', () => {
        const onDrag = jest.fn();
        const recognizer = new DragRecognizer({onDrag, getTouchScrollAxis: () => 'horizontal'});
        recognizer.start({clientX: 100, clientY: 100});
        const move = {type: 'touchmove', clientX: 150, clientY: 106, preventDefault: jest.fn()};
        recognizer._handleMove(move);
        expect(onDrag).not.toHaveBeenCalled();
        expect(move.preventDefault).not.toHaveBeenCalled();
        recognizer._handleMove({...move, clientY: 160});
        expect(onDrag).not.toHaveBeenCalled();
        recognizer.reset();
    });

    test('vertical dragging is preserved for the horizontal rail', () => {
        const onDrag = jest.fn();
        const recognizer = new DragRecognizer({onDrag, getTouchScrollAxis: () => 'horizontal'});
        recognizer.start({clientX: 100, clientY: 100});
        const move = {type: 'touchmove', clientX: 106, clientY: 150, preventDefault: jest.fn()};
        recognizer._handleMove(move);
        expect(onDrag).toHaveBeenCalledTimes(1);
        expect(move.preventDefault).toHaveBeenCalledTimes(1);
        recognizer.reset();
    });
});
