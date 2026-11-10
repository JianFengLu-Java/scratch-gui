import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import WorkPublishModal from '../../../src/components/work-publish-modal/work-publish-modal';
import {loadWorkPublishOptions} from '../../../src/lib/planet-work-publisher';

jest.mock('../../../src/containers/modal.jsx', () => 'Modal');
jest.mock('../../../src/lib/planet-work-publisher', () => ({loadWorkPublishOptions: jest.fn()}));

const storage = new Map();
let renderer;
const props = {
    projectId: '100', projectTitle: '改编项目', onCancel: jest.fn(), onChangeProjectTitle: jest.fn(),
    onExport: jest.fn(), onGenerateCover: jest.fn(() => new Promise(() => {})),
    onSaveProjectTitle: jest.fn(), onSerializeProject: jest.fn()
};

beforeEach(() => {
    storage.clear();
    Object.defineProperty(global, 'localStorage', {configurable: true, value: {
        getItem: key => storage.get(key) || null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: key => storage.delete(key)
    }});
});
afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    renderer = null;
    delete global.localStorage;
});

test.each(['ORIGINAL', 'REPOST'])('a stale %s draft cannot relabel a first-publication remix project', async originType => {
    storage.set('pp:work-publish-draft:100', JSON.stringify({originType, categoryId: '', tagIds: [],
        summary: '', instructions: '', visibility: 'PUBLIC', remixPolicy: 'FORBIDDEN',
        versionType: 'RELEASE', changeLog: '', notifyFollowers: true}));
    loadWorkPublishOptions.mockResolvedValue({
        categories: [], tags: [], existingWork: null, publicationMode: 'FIRST', latestReleaseNo: 0,
        publicationOrigin: {projectId: '100', originType: 'REMIX', originWorkId: '90', locked: true},
        profile: null, session: {accessToken: 'test'}
    });
    await act(async () => { renderer = TestRenderer.create(<WorkPublishModal {...props} />); });
    const source = renderer.root.findAllByType('select').find(select => select.props.value === 'REMIX');
    expect(source.props.disabled).toBe(true);
    act(() => source.props.onChange({target: {value: 'ORIGINAL'}}));
    expect(renderer.getInstance().formValue()).toMatchObject({originType: 'REMIX', originWorkId: '90', repostSource: null});
    expect(JSON.parse(storage.get('pp:work-publish-draft:100')).originType).toBe('REMIX');
});

test('a new original project keeps its editable source selector', async () => {
    loadWorkPublishOptions.mockResolvedValue({
        categories: [], tags: [], existingWork: null, publicationMode: 'FIRST', latestReleaseNo: 0,
        publicationOrigin: {projectId: '100', originType: 'ORIGINAL', originWorkId: null, locked: false}
    });
    await act(async () => { renderer = TestRenderer.create(<WorkPublishModal {...props} />); });
    const source = renderer.root.findAllByType('select').find(select => select.props.value === 'ORIGINAL');
    expect(source.props.disabled).toBe(false);
    act(() => source.props.onChange({target: {value: 'REPOST'}}));
    expect(renderer.getInstance().state.originType).toBe('REPOST');
});
