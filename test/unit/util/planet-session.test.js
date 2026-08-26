import {
    clearPlanetSession,
    refreshPlanetSession,
    resolvePlanetAssetUrl
} from '../../../src/lib/planet-session';

const envelope = data => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve({code: 'OK', data})
});

describe('planet session', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        clearPlanetSession();
        global.fetch = originalFetch;
    });

    test('routes backend avatar paths through the same-origin API proxy', () => {
        expect(resolvePlanetAssetUrl('/api/v1/files/88')).toBe('/backend-api/files/88');
        expect(resolvePlanetAssetUrl('/backend-api/files/88')).toBe('/backend-api/files/88');
        expect(resolvePlanetAssetUrl('https://cdn.example/avatar.webp'))
            .toBe('https://cdn.example/avatar.webp');
        expect(resolvePlanetAssetUrl(null)).toBe('');
    });

    test('shares one rotating refresh request between concurrent consumers', async () => {
        const session = {accessToken: 'token-1', expiresIn: 300, tokenType: 'Bearer'};
        global.fetch = jest.fn().mockResolvedValue(envelope(session));

        await expect(Promise.all([
            refreshPlanetSession(),
            refreshPlanetSession(),
            refreshPlanetSession()
        ])).resolves.toEqual([session, session, session]);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('reuses a valid access session for sequential consumers', async () => {
        const session = {accessToken: 'token-1', expiresIn: 300, tokenType: 'Bearer'};
        global.fetch = jest.fn().mockResolvedValue(envelope(session));

        await refreshPlanetSession();
        await refreshPlanetSession();

        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('allows a retry after a refresh failure', async () => {
        global.fetch = jest.fn()
            .mockRejectedValueOnce(new Error('network error'))
            .mockResolvedValueOnce(envelope({accessToken: 'token-2', expiresIn: 300}));

        await expect(refreshPlanetSession()).rejects.toThrow('network error');
        await expect(refreshPlanetSession()).resolves.toEqual(expect.objectContaining({accessToken: 'token-2'}));
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });
});
