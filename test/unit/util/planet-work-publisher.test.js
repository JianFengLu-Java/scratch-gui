import {loadWorkPublishOptions, saveCurrentProjectDraft, workPayload} from '../../../src/lib/planet-work-publisher';
import {refreshPlanetSession} from '../../../src/lib/planet-session';

jest.mock('../../../src/lib/planet-session', () => ({
    refreshPlanetSession: jest.fn(),
    readPlanetEnvelope: response => response.json().then(envelope => envelope.data)
}));

describe('planet work publishing contract', () => {
    const form = {
        name: ' Scratch 猫咪 ', categoryId: '1001', tagIds: [],
        summary: '猫咪猫咪猫咪猫咪猫咪猫咪', instructions: '', sourceAccess: 'NO_REMIX',
        remixPolicy: 'FORBIDDEN', visibility: 'PUBLIC', versionType: 'RELEASE',
        stageWidth: 480, stageHeight: 360, notifyFollowers: true, copyrightAccepted: true
    };

    test('serializes the selected policy and false confirmation instead of omitting the field', () => {
        const payload = JSON.parse(JSON.stringify(workPayload('100',
            {versionId: '200', coverObjectId: '300'}, form, null)));
        expect(payload).toMatchObject({projectId: '100', versionId: '200', title: 'Scratch 猫咪',
            remixPolicy: 'FORBIDDEN', remixAuthorizationConfirmed: false, revision: null});
    });

    test.each(['OPEN', 'APPLICATION_REQUIRED'])('preserves explicit confirmation for %s', remixPolicy => {
        expect(workPayload('100', {versionId: '200', coverObjectId: '300'},
            {...form, remixPolicy, remixAuthorizationConfirmed: true}, 2))
            .toMatchObject({remixPolicy, remixAuthorizationConfirmed: true, revision: 2});
    });

    test('an archived original work reference always publishes as remix', () => {
        expect(workPayload('100', {versionId: '200', coverObjectId: '300'},
            {...form, originType: 'ORIGINAL', originWorkId: '90'}, null))
            .toMatchObject({originType: 'REMIX', originWorkId: '90', repostSource: null});
    });

    test('loads the project remix origin before the first work is created', async () => {
        const previousFetch = global.fetch;
        refreshPlanetSession.mockResolvedValue({accessToken: 'test', tokenType: 'Bearer'});
        global.fetch = jest.fn(async url => ({json: async () => ({data:
            url.includes('/publication-origin?') ? {projectId: '100', originType: 'REMIX', originWorkId: '90', locked: true} :
                url.includes('/works/mine?') ? {items: []} : []})}));
        try {
            const options = await loadWorkPublishOptions('100');
            expect(options.existingWork).toBe(null);
            expect(options.publicationOrigin).toEqual({projectId: '100', originType: 'REMIX', originWorkId: '90', locked: true});
            expect(options.publicationMode).toBe('FIRST');
        } finally {
            global.fetch = previousFetch;
        }
    });

    test.each([undefined, 'UNKNOWN', 'OPEN', 'APPLICATION_REQUIRED'])(
        'rejects missing or unconfirmed authorization before serializing or uploading: %s', async remixPolicy => {
            const serializeProject = jest.fn();
            const onProgress = jest.fn();
            await expect(saveCurrentProjectDraft({form: {...form, remixPolicy}, serializeProject, onProgress}))
                .rejects.toThrow(/改编/);
            expect(serializeProject).not.toHaveBeenCalled();
            expect(onProgress).not.toHaveBeenCalled();
        });
});

describe('repost publication', () => {
    const repostSource = {originalAuthor: '作者', sourcePlatform: 'Scratch',
        sourceUrl: 'https://scratch.mit.edu/projects/123/', repostStatement: '经许可转载，用于学习'};
    const form = {name: '转载作品', summary: '这是转载作品的完整简介', instructions: '',
        originType: 'REPOST', repostSource, remixPolicy: 'FORBIDDEN', sourceAccess: 'NO_REMIX'};
    test('keeps external attribution in the draft payload', () => {
        expect(workPayload('1', {versionId: '2', coverObjectId: '3'}, form, null))
            .toMatchObject({originType: 'REPOST', repostSource, originWorkId: null});
    });
    test.each([null, {...repostSource, sourceUrl: 'javascript:alert(1)'}, {...repostSource, originalAuthor: ''}])(
        'rejects invalid attribution before uploading', async source => {
            const serializeProject = jest.fn();
            await expect(saveCurrentProjectDraft({form: {...form, repostSource: source}, serializeProject,
                onProgress: jest.fn()})).rejects.toThrow();
            expect(serializeProject).not.toHaveBeenCalled();
        });
});
