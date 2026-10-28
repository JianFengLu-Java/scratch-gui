import {TargetPane} from '../../../src/containers/target-pane';
import {StageSelector} from '../../../src/containers/stage-selector';
import {COSTUMES_TAB_INDEX} from '../../../src/reducers/editor-tab';
import {subscribeAssetLoadFeedback} from '../../../src/lib/asset-load-feedback';

jest.mock('../../../src/components/target-pane/target-pane', () => {
    const component = () => null;
    component.propTypes = {};
    return component;
});
jest.mock('../../../src/components/stage-selector/stage-selector', () => 'StageSelector');
jest.mock('../../../src/lib/file-uploader', () => ({}));
jest.mock('../../../src/lib/backpack-api', () => ({}));
jest.mock('../../../src/lib/libraries/tw-async-libraries', () => ({}));
jest.mock('../../../src/lib/drop-area-hoc', () => () => Component => Component);
jest.mock('../../../src/lib/throttled-property-hoc', () => () => Component => Component);
jest.mock('../../../src/lib/log', () => ({error: jest.fn()}));

describe.each(['sprite', 'backdrop'])('painting a new %s', kind => {
    let events;
    let unsubscribe;
    let vm;
    let activate;
    let paint;

    beforeEach(() => {
        events = [];
        unsubscribe = subscribeAssetLoadFeedback(event => events.push(event));
        vm = {addSprite: jest.fn(), addBackdrop: jest.fn(), setEditingTarget: jest.fn()};
        activate = jest.fn();
        const props = {
            id: 'stage-id',
            intl: {formatMessage: message => message.defaultMessage.replace('{index}', '1')},
            onActivateTab: activate,
            vm
        };
        if (kind === 'sprite') {
            const pane = new TargetPane(props);
            paint = () => pane.handlePaintSpriteClick();
        } else {
            const stage = new StageSelector(props);
            paint = () => stage.handleEmptyBackdrop({stopPropagation: jest.fn()});
        }
    });

    afterEach(() => unsubscribe());

    test('immediately reports progress, ignores repeated taps and opens the paint editor on success', async () => {
        let finish;
        const add = kind === 'sprite' ? vm.addSprite : vm.addBackdrop;
        add.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
        const pending = paint();
        expect(events).toEqual([expect.objectContaining({assetType: kind, type: 'start'})]);
        expect(paint()).toBe(pending);
        await Promise.resolve();
        expect(add).toHaveBeenCalledTimes(1);
        expect(activate).not.toHaveBeenCalled();
        finish();
        await pending;
        expect(activate).toHaveBeenCalledWith(COSTUMES_TAB_INDEX);
        expect(events[events.length - 1]).toMatchObject({type: 'finish', status: 'success'});
        if (kind === 'backdrop') expect(vm.setEditingTarget).toHaveBeenCalledWith('stage-id');
    });

    test('shows an error without opening the paint editor and allows a retry', async () => {
        const add = kind === 'sprite' ? vm.addSprite : vm.addBackdrop;
        add.mockRejectedValueOnce(new Error('renderer failed')).mockResolvedValue(undefined);
        await paint();
        expect(events[events.length - 1]).toMatchObject({type: 'finish', status: 'error'});
        expect(activate).not.toHaveBeenCalled();
        await paint();
        expect(add).toHaveBeenCalledTimes(2);
        expect(activate).toHaveBeenCalledWith(COSTUMES_TAB_INDEX);
        expect(events[events.length - 1]).toMatchObject({type: 'finish', status: 'success'});
    });
});
