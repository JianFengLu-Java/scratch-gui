import {EventEmitter} from 'events';
import {TargetPane} from '../../../src/containers/target-pane';
import {StageSelector} from '../../../src/containers/stage-selector';
import {getBackdropLibrary, getSpriteLibrary} from '../../../src/lib/libraries/tw-async-libraries';
import {subscribeAssetLoadFeedback} from '../../../src/lib/asset-load-feedback';

jest.mock('../../../src/components/target-pane/target-pane', () => {
    const component = () => null;
    component.propTypes = {};
    return component;
});
jest.mock('../../../src/components/stage-selector/stage-selector', () => 'StageSelector');
jest.mock('../../../src/lib/file-uploader', () => ({}));
jest.mock('../../../src/lib/backpack-api', () => ({}));
jest.mock('../../../src/lib/libraries/tw-async-libraries', () => ({
    getSpriteLibrary: jest.fn(), getBackdropLibrary: jest.fn()
}));
jest.mock('../../../src/lib/drop-area-hoc', () => () => Component => Component);
jest.mock('../../../src/lib/throttled-property-hoc', () => () => Component => Component);
jest.mock('../../../src/lib/log', () => ({error: jest.fn()}));

describe.each(['sprite', 'backdrop'])('random %s loading', kind => {
    let vm;
    let events;
    let unsubscribe;
    let choose;
    let library;
    let add;
    let source;
    beforeEach(() => {
        vm = new EventEmitter();
        vm.runtime = {finishedAssetRequests: 4, totalAssetRequests: 4};
        vm.addSprite = jest.fn();
        vm.addBackdrop = jest.fn();
        events = [];
        unsubscribe = subscribeAssetLoadFeedback(event => events.push(event));
        const props = {vm, onActivateTab: jest.fn()};
        if (kind === 'sprite') {
            const pane = new TargetPane(props);
            choose = () => pane.handleSurpriseSpriteClick();
            library = getSpriteLibrary;
            add = vm.addSprite;
            source = {name: 'Test sprite', tags: [], x: 1000, y: 1000};
        } else {
            const pane = new StageSelector(props);
            choose = () => pane.handleSurpriseBackdrop({stopPropagation: jest.fn()});
            library = getBackdropLibrary;
            add = vm.addBackdrop;
            source = {name: 'Test backdrop', md5ext: 'test.svg'};
        }
        library.mockReset().mockResolvedValue([source]);
    });
    afterEach(() => unsubscribe());

    test('shows immediate feedback and progress, blocks repeated taps and removes its listener', async () => {
        let resolve;
        add.mockImplementation(() => new Promise(done => { resolve = done; }));
        const pending = choose();
        expect(choose()).toBe(pending);
        expect(events[0]).toMatchObject({type: 'start', assetType: kind});
        await Promise.resolve();
        await Promise.resolve();
        expect(add).toHaveBeenCalledTimes(1);
        vm.runtime.totalAssetRequests = 8;
        vm.runtime.finishedAssetRequests = 6;
        vm.emit('ASSET_PROGRESS', 6, 8);
        expect(events[events.length - 1]).toMatchObject({
            type: 'progress', name: source.name, finished: 2, total: 4
        });
        resolve();
        await pending;
        expect(events[events.length - 1]).toMatchObject({type: 'finish', name: source.name, status: 'success'});
        expect(vm.listenerCount('ASSET_PROGRESS')).toBe(0);
        if (kind === 'sprite') expect(source).toMatchObject({x: 1000, y: 1000});
    });

    test('reports a failure and permits a fresh retry', async () => {
        add.mockRejectedValueOnce(new Error('download failed')).mockResolvedValue(undefined);
        await choose();
        expect(events[events.length - 1]).toMatchObject({type: 'finish', status: 'error'});
        expect(vm.listenerCount('ASSET_PROGRESS')).toBe(0);
        await choose();
        expect(add).toHaveBeenCalledTimes(2);
        expect(events[events.length - 1]).toMatchObject({type: 'finish', status: 'success'});
    });

    test('handles an empty library without adding an invalid resource', async () => {
        library.mockResolvedValue([]);
        await choose();
        expect(add).not.toHaveBeenCalled();
        expect(events[events.length - 1]).toMatchObject({type: 'finish', status: 'error'});
        expect(vm.listenerCount('ASSET_PROGRESS')).toBe(0);
    });
});
