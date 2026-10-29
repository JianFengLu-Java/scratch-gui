import importBackpackItem from '../../../src/lib/backpack/import-item';
import {fetchCode, fetchSprite} from '../../../src/lib/backpack-api';

jest.mock('../../../src/lib/backpack-api', () => ({fetchCode: jest.fn(), fetchSprite: jest.fn()}));

describe('backpack import to an explicit sprite or stage', () => {
    let vm;
    beforeEach(() => {
        jest.clearAllMocks();
        vm = {
            addCostume: jest.fn().mockResolvedValue(),
            addSound: jest.fn().mockResolvedValue(),
            addSprite: jest.fn().mockResolvedValue(),
            shareBlocksToTarget: jest.fn().mockResolvedValue(),
            refreshWorkspace: jest.fn(),
            runtime: {getTargetById: jest.fn(id => id === 'sprite-1' || id === 'stage'), emitProjectChanged: jest.fn()}
        };
    });

    test.each(['sprite-1', 'stage'])('adds a costume to %s without relying on the current editor target', async targetId => {
        await importBackpackItem({item: {type: 'costume', body: 'image.svg', name: '造型'}, vm, targetId});
        expect(vm.addCostume).toHaveBeenCalledWith('image.svg', {name: '造型'}, targetId);
        expect(vm.refreshWorkspace).toHaveBeenCalled();
    });

    test('adds sound to the selected destination', async () => {
        await importBackpackItem({item: {type: 'sound', body: 'sound.wav', name: '声音'}, vm, targetId: 'sprite-1'});
        expect(vm.addSound).toHaveBeenCalledWith({md5: 'sound.wav', name: '声音'}, 'sprite-1');
    });

    test('imports scripts into the visible workspace and marks them for saving', async () => {
        const blocks = [{id: 'top', topLevel: true, x: 0, y: 0}];
        fetchCode.mockResolvedValue({blocks, extensionURLs: {custom: 'https://example.com/extension.js'}});
        await importBackpackItem({item: {type: 'script', bodyUrl: 'code.json'}, vm, targetId: 'sprite-1',
            workspaceMetrics: {scrollX: -100, scrollY: -50, scale: 1}});
        expect(vm.shareBlocksToTarget).toHaveBeenCalledWith({
            blocks: [{id: 'top', topLevel: true, x: 130, y: 80}],
            extensionURLs: {custom: 'https://example.com/extension.js'}
        }, 'sprite-1');
        expect(vm.runtime.emitProjectChanged).toHaveBeenCalledTimes(1);
    });

    test('loads sprite archives as new sprites even when the project has no selected sprite', async () => {
        const archive = new ArrayBuffer(8);
        fetchSprite.mockResolvedValue(archive);
        await importBackpackItem({item: {type: 'sprite', bodyUrl: 'sprite.zip'}, vm});
        expect(vm.addSprite).toHaveBeenCalledWith(archive);
    });

    test('rejects a deleted destination before fetching and after a pending script download', async () => {
        await expect(importBackpackItem({item: {type: 'sound'}, vm, targetId: 'deleted'}))
            .rejects.toThrow('已不存在');
        expect(vm.addSound).not.toHaveBeenCalled();
        fetchCode.mockImplementation(async () => {
            vm.runtime.getTargetById.mockReturnValue(null);
            return [];
        });
        await expect(importBackpackItem({item: {type: 'script', bodyUrl: 'code.json'}, vm, targetId: 'sprite-1'}))
            .rejects.toThrow('已不存在');
        expect(vm.shareBlocksToTarget).not.toHaveBeenCalled();
    });

    test('propagates download errors so the panel can keep the selected item and offer retry', async () => {
        fetchSprite.mockRejectedValue(new Error('网络中断'));
        await expect(importBackpackItem({item: {type: 'sprite'}, vm})).rejects.toThrow('网络中断');
        expect(vm.addSprite).not.toHaveBeenCalled();
    });
});
