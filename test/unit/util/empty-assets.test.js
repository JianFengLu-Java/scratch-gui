import {createHash} from 'crypto';
import fs from 'fs';
import path from 'path';

import storage from '../../../src/lib/storage';
import {emptyCostume, emptyCostumeAsset, emptySprite} from '../../../src/lib/empty-assets';

// A custom default project need not contain the editor's blank drawing asset.
jest.mock('../../../src/lib/default-project', () => () => []);

describe('local blank drawing assets', () => {
    let network;
    beforeEach(() => {
        network = jest.spyOn(storage.webHelper, 'load').mockRejectedValue(new Error('offline'));
    });
    afterEach(() => network.mockRestore());

    test('keeps the bundled blank SVG and its content hash consistent', () => {
        const data = Buffer.from(emptyCostumeAsset.data);
        const original = fs.readFileSync(path.resolve(__dirname,
            '../../../src/lib/default-project/cd21514d0531fdffb22204e0ec5ed84a.svg'));
        expect(data.equals(original)).toBe(true);
        expect(createHash('md5').update(data).digest('hex')).toBe(emptyCostumeAsset.id);
    });

    test.each([
        ['sprite', () => emptySprite('角色1', '', '造型1').costumes[0].baseLayerMD5],
        ['costume', () => emptyCostume('造型1').md5],
        ['backdrop', () => emptyCostume('背景1').md5]
    ])('painting a %s resolves its blank image without a network request', async (kind, getMd5) => {
        const [id, format] = getMd5().split('.');
        const asset = await storage.load(storage.AssetType.ImageVector, id, format);
        expect(asset.assetId).toBe(emptyCostumeAsset.id);
        expect(Buffer.from(asset.data).equals(Buffer.from(emptyCostumeAsset.data))).toBe(true);
        expect(network).not.toHaveBeenCalled();
    });

    test('changing the default project language retains the blank drawing asset', async () => {
        storage.setTranslatorFunction(() => '');
        const asset = await storage.load(storage.AssetType.ImageVector, emptyCostumeAsset.id, 'svg');
        expect(asset.assetId).toBe(emptyCostumeAsset.id);
        expect(network).not.toHaveBeenCalled();
    });

    test('provides an absolute same-origin URL for the blob worker downloader', () => {
        const previousWindow = global.window;
        const previousHost = storage.assetHost;
        global.window = {location: {href: 'https://editor.example/create/42/editor'}};
        try {
            storage.setAssetHost('/backend-api/editor-assets');
            expect(storage.getAssetGetConfig({assetId: 'abc', dataFormat: 'svg'}))
                .toBe('https://editor.example/backend-api/editor-assets/internalapi/asset/abc.svg/get');
            storage.setAssetHost('https://assets.example');
            expect(storage.getAssetGetConfig({assetId: 'abc', dataFormat: 'wav'}))
                .toBe('https://assets.example/internalapi/asset/abc.wav/get');
        } finally {
            global.window = previousWindow;
            storage.setAssetHost(previousHost);
        }
    });
});
