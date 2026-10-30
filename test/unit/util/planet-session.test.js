import {
    clearPlanetSession,
    fetchWithPlanetSession,
    readPlanetEnvelope,
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
    const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks');

    afterEach(() => {
        clearPlanetSession();
        global.fetch = originalFetch;
        if (originalLocks) Object.defineProperty(navigator, 'locks', originalLocks);
        else delete navigator.locks;
    });

    test('shows actionable validation messages returned by the publishing API', async () => {
        await expect(readPlanetEnvelope({ok: false, status: 400, json: async () => ({
            code: 'VALIDATION_ERROR', message: '请求参数不合法', data: {fieldErrors: [
                {field: 'remixPolicy', message: '请选择改编授权策略'},
                {field: 'remixPolicy', message: '请选择改编授权策略'}
            ]}
        })})).rejects.toMatchObject({message: '请选择改编授权策略', status: 400, code: 'VALIDATION_ERROR'});
    });

    test('keeps the envelope message when field details are absent', async () => {
        await expect(readPlanetEnvelope({ok: false, status: 400, json: async () => ({
            code: 'VALIDATION_ERROR', message: '请求参数不合法', data: null
        })})).rejects.toThrow('请求参数不合法');
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

    test('waits for another tab to finish rotating the shared website cookie', async () => {
        let release;
        const otherTab = new Promise(resolve => { release = resolve; });
        const request = jest.fn((name, refresh) => otherTab.then(refresh));
        Object.defineProperty(navigator, 'locks', {configurable: true, value: {request}});
        const session = {accessToken: 'editor-token', expiresIn: 300};
        global.fetch = jest.fn().mockResolvedValue(envelope(session));

        const pending = refreshPlanetSession();
        expect(request).toHaveBeenCalledWith('pp:user-session-refresh', expect.any(Function));
        expect(global.fetch).not.toHaveBeenCalled();
        release();
        await expect(pending).resolves.toEqual(session);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('stops after one refresh when an API still returns 401', async () => {
        const session = {accessToken: 'old', expiresIn: 300, user: {id: '9'}};
        global.fetch = jest.fn(async url => (url.includes('/refresh') ?
            envelope({...session, accessToken: 'new'}) : {status: 401}));
        await expect(fetchWithPlanetSession(session, '/backend-api/projects/10/autosave'))
            .resolves.toEqual({status: 401});
        expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    test('does not retry a save under a different account returned by refresh', async () => {
        const session = {accessToken: 'old', user: {id: '9'}};
        global.fetch = jest.fn(async url => (url.includes('/refresh') ?
            envelope({accessToken: 'other', user: {id: '10'}}) : {status: 401}));
        await expect(fetchWithPlanetSession(session, '/backend-api/projects/10/autosave', {method: 'PUT'}))
            .rejects.toMatchObject({status: 409});
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test('coalesces renewal when simultaneous saves reject the same access token', async () => {
        const session = {accessToken: 'old', expiresIn: 300, user: {id: '9'}};
        let refreshes = 0;
        global.fetch = jest.fn(async (url, options = {}) => {
            if (url.includes('/refresh')) {
                refreshes++;
                return envelope({...session, accessToken: 'new'});
            }
            return {status: options.headers.Authorization === 'Bearer new' ? 200 : 401};
        });
        await expect(Promise.all([
            fetchWithPlanetSession(session, '/backend-api/projects/10/autosave'),
            fetchWithPlanetSession(session, '/backend-api/projects/11/autosave')
        ])).resolves.toEqual([{status: 200}, {status: 200}]);
        expect(refreshes).toBe(1);
    });
});
