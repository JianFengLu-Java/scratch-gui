import {isPlanetProjectRoute, loadPlanetProject} from '../../../src/lib/planet-project-loader';
import {clearPlanetSession} from '../../../src/lib/planet-session';

const envelope = data => ({
    ok: true,
    status: 200,
    json: () => Promise.resolve({code: 'OK', data})
});

describe('planet project loader', () => {
    const originalFetch = global.fetch;
    const originalLocation = global.location;

    afterEach(() => {
        clearPlanetSession();
        global.fetch = originalFetch;
        global.location = originalLocation;
    });

    test('recognizes Programming Planet editor routes', () => {
        global.location = {pathname: '/create/81996335531687936/editor'};
        expect(isPlanetProjectRoute()).toBe(true);
        global.location = {pathname: '/create/editor'};
        expect(isPlanetProjectRoute()).toBe(false);
    });

    test('loads the newest cloud version with an authenticated file request', async () => {
        const session = {accessToken: 'token-1', expiresIn: 300, tokenType: 'Bearer'};
        const projectData = new Uint8Array([1, 2, 3]).buffer;
        global.fetch = jest.fn()
            .mockResolvedValueOnce(envelope(session))
            .mockResolvedValueOnce(envelope(null))
            .mockResolvedValueOnce(envelope({items: [{fileObjectId: '44'}]}))
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                arrayBuffer: () => Promise.resolve(projectData)
            });

        await expect(loadPlanetProject('81996335531687936')).resolves.toEqual({data: projectData});
        expect(global.fetch).toHaveBeenNthCalledWith(3,
            '/backend-api/projects/81996335531687936/versions?page=1&pageSize=1',
            expect.objectContaining({
                headers: expect.objectContaining({Authorization: 'Bearer token-1'})
            }));
        expect(global.fetch).toHaveBeenNthCalledWith(4, '/backend-api/files/44',
            expect.objectContaining({
                headers: {Authorization: 'Bearer token-1'}
            }));
    });

    test('returns null when the project has no cloud version yet', async () => {
        global.fetch = jest.fn()
            .mockResolvedValueOnce(envelope({accessToken: 'token-1', expiresIn: 300, tokenType: 'Bearer'}))
            .mockResolvedValueOnce(envelope(null))
            .mockResolvedValueOnce(envelope({items: []}));

        await expect(loadPlanetProject('10')).resolves.toBeNull();
        expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    test('falls back to the authenticated same-origin stream when OSS blocks CORS', async () => {
        const projectData = new Uint8Array([7, 8, 9]).buffer;
        global.fetch = jest.fn()
            .mockResolvedValueOnce(envelope({accessToken: 'token-1', expiresIn: 300, tokenType: 'Bearer'}))
            .mockResolvedValueOnce(envelope(null))
            .mockResolvedValueOnce(envelope({items: [{fileObjectId: '46'}]}))
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                arrayBuffer: () => Promise.resolve(projectData)
            });

        await expect(loadPlanetProject('12')).resolves.toEqual({data: projectData});
        expect(global.fetch).toHaveBeenNthCalledWith(4, '/backend-api/files/46',
            expect.objectContaining({headers: {Authorization: 'Bearer token-1'}}));
        expect(global.fetch).toHaveBeenNthCalledWith(5, '/backend-api/files/46/content',
            expect.objectContaining({headers: {Authorization: 'Bearer token-1'}}));
    });

    test('prefers a newer cloud autosave over an immutable version', async () => {
        const projectData = new Uint8Array([4, 5, 6]).buffer;
        global.fetch = jest.fn()
            .mockResolvedValueOnce(envelope({accessToken: 'token-1', expiresIn: 300, tokenType: 'Bearer'}))
            .mockResolvedValueOnce(envelope({
                baseVersionId: '20',
                contentSha256: 'a'.repeat(64),
                fileObjectId: '45',
                revision: 3
            }))
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                arrayBuffer: () => Promise.resolve(projectData)
            });

        await expect(loadPlanetProject('11')).resolves.toEqual({data: projectData});
        expect(global.fetch).toHaveBeenCalledTimes(3);
        expect(global.fetch).toHaveBeenNthCalledWith(3, '/backend-api/files/45',
            expect.objectContaining({headers: {Authorization: 'Bearer token-1'}}));
    });
});
