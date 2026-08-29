import {capturePlanetStageCover} from '../../../src/lib/planet-stage-cover';

describe('planet stage cover', () => {
    beforeAll(() => {
        global.window = {atob};
    });

    afterAll(() => {
        delete global.window;
    });

    test('captures the current stage as a named PNG file', async () => {
        let snapshotCallback;
        const vm = {
            postIOData: jest.fn(),
            renderer: {
                requestSnapshot: jest.fn(callback => {
                    snapshotCallback = callback;
                }),
                draw: jest.fn(() => snapshotCallback('data:image/png;base64,aGVsbG8='))
            }
        };

        const file = await capturePlanetStageCover(vm, '猫咪/太空');

        expect(file.name).toBe('猫咪_太空-舞台.png');
        expect(file.type).toBe('image/png');
        expect(file.size).toBe(5);
        expect(vm.renderer.requestSnapshot).toHaveBeenCalledTimes(1);
        expect(vm.renderer.draw).toHaveBeenCalledTimes(1);
        expect(vm.postIOData).toHaveBeenNthCalledWith(1, 'video', {forceTransparentPreview: true});
        expect(vm.postIOData).toHaveBeenLastCalledWith('video', {forceTransparentPreview: false});
    });

    test('rejects when the stage renderer is unavailable', async () => {
        await expect(capturePlanetStageCover({}, '作品')).rejects.toThrow('暂时无法读取舞台');
    });

    test('compresses an autosave cover to a bounded WebP file', async () => {
        const originalImage = global.Image;
        const originalDocument = global.document;
        const drawImage = jest.fn();
        global.Image = class MockImage {
            constructor () {
                this.naturalWidth = 1280;
                this.naturalHeight = 720;
            }
            set src (value) { // eslint-disable-line no-unused-vars
                this.onload();
            }
        };
        global.document = {createElement: jest.fn(() => ({
            getContext: () => ({drawImage}),
            toBlob: callback => callback(new Blob(['webp'], {type: 'image/webp'}))
        }))};
        const vm = {
            postIOData: jest.fn(),
            renderer: {
                requestSnapshot: jest.fn(callback => callback('data:image/png;base64,aGVsbG8=')),
                draw: jest.fn()
            }
        };

        try {
            const file = await capturePlanetStageCover(vm, '自动保存', {compress: true});

            expect(file.name).toBe('自动保存-舞台.webp');
            expect(file.type).toBe('image/webp');
            expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 640, 360);
        } finally {
            global.Image = originalImage;
            if (originalDocument) global.document = originalDocument;
            else delete global.document;
        }
    });
});
