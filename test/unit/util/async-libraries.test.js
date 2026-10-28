import {getBackdropLibrary} from '../../../src/lib/libraries/tw-async-libraries';

jest.mock('../../../src/lib/libraries/backdrops.json', () => [{name: 'Bundled backdrop'}]);

describe('editor asset library requests', () => {
    let previousFetch;
    beforeEach(() => {
        previousFetch = global.fetch;
        global.fetch = jest.fn();
        jest.useFakeTimers();
    });
    afterEach(() => {
        global.fetch = previousFetch;
        jest.useRealTimers();
    });

    test('shares concurrent requests while reflecting later admin changes', async () => {
        fetch.mockResolvedValueOnce({ok: true, json: async () => ({code: 'OK', data: [{name: 'First'}]})});
        const first = getBackdropLibrary();
        expect(getBackdropLibrary()).toBe(first);
        expect(await first).toEqual([{name: 'First'}]);
        fetch.mockResolvedValueOnce({ok: true, json: async () => ({code: 'OK', data: [{name: 'Updated'}]})});
        expect(await getBackdropLibrary()).toEqual([{name: 'Updated'}]);
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(jest.getTimerCount()).toBe(0);
    });

    test('falls back to the bundled manifest after a slow server request and can retry', async () => {
        fetch.mockImplementationOnce((url, {signal}) => new Promise((resolve, reject) => {
            signal.addEventListener('abort', () => reject(new Error('aborted')));
        }));
        const pending = getBackdropLibrary();
        jest.advanceTimersByTime(5000);
        expect(await pending).toEqual([{name: 'Bundled backdrop'}]);
        fetch.mockResolvedValueOnce({ok: true, json: async () => ({code: 'OK', data: []})});
        expect(await getBackdropLibrary()).toEqual([]);
    });

    test('uses the bundled manifest for an invalid response without leaving a timer', async () => {
        fetch.mockResolvedValue({ok: true, json: async () => ({code: 'OK', data: null})});
        expect(await getBackdropLibrary()).toEqual([{name: 'Bundled backdrop'}]);
        expect(jest.getTimerCount()).toBe(0);
    });
});
