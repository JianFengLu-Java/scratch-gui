import {saveCurrentProjectDraft, workPayload} from '../../../src/lib/planet-work-publisher';

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
