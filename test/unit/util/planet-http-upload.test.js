import {createHash} from 'crypto';
import {publishCurrentProject} from '../../../src/lib/planet-work-publisher';
import {savePlanetCloudAutosave, sha256PlanetBlob} from '../../../src/lib/planet-cloud-autosave';
import {clearPlanetSession} from '../../../src/lib/planet-session';

const ok = data => ({ok: true, status: 200, json: async () => ({code: 'OK', data})});

describe('save and publish uploads on a LAN HTTP origin', () => {
    const previous = {window: global.window, fetch: global.fetch, localStorage: global.localStorage};
    let uploads;
    let failUpload;
    const form = {
        name: '手机作品', categoryId: '1001', tagIds: [], summary: '测试作品', instructions: '',
        sourceAccess: 'NO_REMIX', remixPolicy: 'FORBIDDEN', visibility: 'PUBLIC', versionType: 'RELEASE',
        stageWidth: 480, stageHeight: 360, notifyFollowers: false, copyrightAccepted: true
    };

    beforeEach(() => {
        clearPlanetSession();
        uploads = new Map();
        failUpload = false;
        global.window = {crypto: {}, location: {pathname: '/create/10/editor'}};
        const keys = new Map();
        global.localStorage = {getItem: key => keys.get(key), setItem: (key, value) => keys.set(key, value),
            removeItem: key => keys.delete(key)};
        global.fetch = jest.fn(async (url, options = {}) => {
            if (url === '/backend-api/auth/user-session/refresh') {
                return ok({accessToken: 'test-token', tokenType: 'Bearer', expiresIn: 300});
            }
            if (url.startsWith('/backend-api/works/mine?')) return ok({items: []});
            if (url === '/backend-api/uploads/presign') {
                const payload = JSON.parse(options.body);
                const id = String(uploads.size + 1);
                uploads.set(id, payload);
                return ok({objectId: id, uploadUrl: `/api/v1/test-upload/${id}`, headers: {}});
            }
            if (url.startsWith('/backend-api/test-upload/')) {
                const id = url.split('/').pop();
                if (failUpload) return {ok: false, status: 503};
                const content = await options.body.arrayBuffer();
                expect(createHash('sha256').update(new Uint8Array(content)).digest('hex'))
                    .toBe(uploads.get(id).sha256);
                return {ok: true, headers: {get: () => `"${uploads.get(id).sha256}"`}};
            }
            if (/\/uploads\/\d+\/complete$/.test(url)) return ok({objectId: url.split('/')[3]});
            if (/\/uploads\/\d+$/.test(url) && options.method === 'DELETE') return ok(null);
            if (url === '/backend-api/projects/10/editor-session') return ok({sessionToken: 'write-session'});
            if (url === '/backend-api/projects/10/versions') return ok({id: '20'});
            if (url === '/backend-api/projects/10/autosave') return ok({revision: 1});
            if (url === '/backend-api/projects/10') return ok({id: '10'});
            if (url === '/backend-api/works') return ok({id: '30'});
            if (url === '/backend-api/works/30/submit') return ok({id: '30', status: 'PENDING'});
            throw new Error(`Unexpected upload request: ${url}`);
        });
    });

    afterEach(() => {
        clearPlanetSession();
        Object.assign(global, previous);
    });

    test('uploads both files and submits a work with verified checksums and ETags', async () => {
        const result = await publishCurrentProject({
            projectId: '10', form, coverFile: new File(['cover'], 'cover.png', {type: 'image/png'}),
            serializeProject: async () => new Blob(['project']), onProgress: jest.fn(),
            session: {accessToken: 'test-token', tokenType: 'Bearer'}
        });
        expect(result.work.id).toBe('30');
        expect([...uploads.values()].map(upload => upload.purpose)).toEqual(['PROJECT_FILE', 'WORK_COVER']);
        expect(global.fetch).toHaveBeenCalledWith('/backend-api/works/30/submit',
            expect.objectContaining({headers: expect.objectContaining({'Idempotency-Key': expect.any(String)})}));
    });

    test('autosaves the project and stage cover with the same integrity checks on HTTP', async () => {
        const file = new File(['project'], 'project.sb3', {type: 'application/zip'});
        await expect(savePlanetCloudAutosave({projectId: '10', file,
            contentSha256: await sha256PlanetBlob(file), editorSessionToken: 'write-session',
            stageCoverFile: new File(['cover'], 'cover.png', {type: 'image/png'})}))
            .resolves.toMatchObject({revision: 1});
        expect([...uploads.values()].map(upload => upload.purpose)).toEqual(['PROJECT_FILE', 'WORK_COVER']);
        expect(global.fetch).toHaveBeenCalledWith('/backend-api/projects/10/autosave',
            expect.objectContaining({headers: expect.objectContaining({'X-Editor-Session-Token': 'write-session'})}));
    });

    test('cleans up a failed upload and never submits incomplete files', async () => {
        failUpload = true;
        await expect(publishCurrentProject({projectId: '10', form,
            coverFile: new File(['cover'], 'cover.png'), serializeProject: async () => new Blob(['project']),
            onProgress: jest.fn(), session: {accessToken: 'test-token'}})).rejects.toThrow('503');
        expect(global.fetch).toHaveBeenCalledWith('/backend-api/uploads/1', expect.objectContaining({method: 'DELETE'}));
        expect(global.fetch.mock.calls.some(([url]) => url.endsWith('/submit'))).toBe(false);
    });
});
