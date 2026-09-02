import React from 'react';
import {shallow} from 'enzyme';
import PlanetBubbleMessage from '../../../src/components/menu-bar/planet-bubble-message';
import {loadPlanetMessageUi} from '../../../src/lib/planet-message-ui';
import {readPlanetEnvelope, refreshPlanetSession} from '../../../src/lib/planet-session';

jest.mock('../../../src/lib/planet-message-ui', () => ({loadPlanetMessageUi: jest.fn()}));
jest.mock('../../../src/components/menu-bar/planet-message-text', () => 'MessageText');
jest.mock('../../../src/lib/planet-session', () => ({
    clearPlanetSession: jest.fn(),
    readPlanetEnvelope: jest.fn(),
    refreshPlanetSession: jest.fn(),
    resolvePlanetAssetUrl: url => url.replace('/api/v1/', '/backend-api/')
}));

const props = {projectId: '8', viewerId: '9', own: false, timeLabel: '11:02',
    message: {userId: '7', content: '你好', sentAt: '2026-08-30T11:02:00+08:00'}};

describe('shared BubbleRenderer editor bridge', () => {
    beforeEach(() => jest.clearAllMocks());

    test('mounts shared renderer, updates text/side, and unregisters on unmount', async () => {
        const handle = {update: jest.fn(), unmount: jest.fn()};
        const runtime = {messageUiVersion: 4, mountBubbleMessage: jest.fn(() => handle)};
        loadPlanetMessageUi.mockResolvedValue(runtime);
        const wrapper = shallow(<PlanetBubbleMessage {...props} />);
        await Promise.resolve();
        expect(runtime.mountBubbleMessage).toHaveBeenCalledWith(null, expect.objectContaining({
            projectId: '8', userId: '7', message: '你好', side: 'other',
            timeLabel: '11:02', sentAt: props.message.sentAt
        }));
        expect(wrapper.find('MessageText')).toHaveLength(0);
        expect(wrapper.find('[data-slot="message-time"]')).toHaveLength(0);
        wrapper.setProps({own: true, message: {...props.message, content: '新消息😀'}});
        expect(handle.update).toHaveBeenCalledWith(expect.objectContaining({message: '新消息😀', side: 'self'}));
        wrapper.setProps({timeLabel: '11:03'});
        expect(handle.update).toHaveBeenLastCalledWith(expect.objectContaining({timeLabel: '11:03'}));
        wrapper.unmount();
        expect(handle.unmount).toHaveBeenCalledTimes(1);
    });

    test('does not mount a portal after the message has disappeared', async () => {
        let finish;
        loadPlanetMessageUi.mockReturnValue(new Promise(resolve => { finish = resolve; }));
        const wrapper = shallow(<PlanetBubbleMessage {...props} />);
        wrapper.unmount();
        const runtime = {messageUiVersion: 4, mountBubbleMessage: jest.fn()};
        finish(runtime);
        await Promise.resolve();
        expect(runtime.mountBubbleMessage).not.toHaveBeenCalled();
    });

    test('retains selectable fallback when runtime fails or is an older cached build', async () => {
        for (const failed of [true, false]) {
            if (failed) loadPlanetMessageUi.mockRejectedValue(new Error('offline'));
            else loadPlanetMessageUi.mockResolvedValue({messageUiVersion: 3, mountBubbleMessage: jest.fn()});
            const wrapper = shallow(<PlanetBubbleMessage {...props} />);
            await Promise.resolve();
            await Promise.resolve();
            expect(wrapper.find('MessageText').prop('content')).toBe('你好');
            const timestamp = wrapper.find('[data-slot="message-time"]');
            expect(timestamp).toHaveLength(1);
            expect(timestamp.prop('dateTime')).toBe(props.message.sentAt);
            expect(timestamp.prop('title')).not.toBe('');
            expect(timestamp.text()).toBe('11:02');
            expect(timestamp.parent().prop('style').gap).toBe('0.25rem');
            wrapper.unmount();
        }
    });

    test('uses project membership context and normalizes only application asset URLs', async () => {
        loadPlanetMessageUi.mockResolvedValue({});
        refreshPlanetSession.mockResolvedValue({accessToken: 'test-only-token'});
        readPlanetEnvelope.mockResolvedValue([{userId: '7', template: null,
            assets: [{id: '930101', previewUrl: '/api/v1/bubble-assets/930101/content?v=0'}]}]);
        const previousFetch = global.fetch;
        global.fetch = jest.fn().mockResolvedValue({status: 200});
        const wrapper = shallow(<PlanetBubbleMessage {...props} />);
        try {
            const values = await wrapper.instance().loadAppearances(['7'], undefined);
            expect(global.fetch.mock.calls[0][0]).toBe('/backend-api/bubble-appearances?userIds=7&projectId=8');
            expect(values[0].assets[0].previewUrl).toBe('/backend-api/bubble-assets/930101/content?v=0');
        } finally {
            wrapper.unmount();
            global.fetch = previousFetch;
        }
    });

    test('aligns the row avatar/name to the measured body and clears stale offsets', () => {
        loadPlanetMessageUi.mockResolvedValue({});
        const wrapper = shallow(<PlanetBubbleMessage {...props} />);
        const row = {style: {setProperty: jest.fn(), removeProperty: jest.fn()}};
        wrapper.instance().host.current = {closest: jest.fn(() => row)};
        const reportOffset = wrapper.instance().runtimeProps().onBodyOffsetChange;
        reportOffset(24);
        expect(row.style.setProperty).toHaveBeenCalledWith('--message-bubble-top-inset', '24px');
        reportOffset(8);
        expect(row.style.setProperty).toHaveBeenLastCalledWith('--message-bubble-top-inset', '8px');
        reportOffset(0);
        expect(row.style.removeProperty).toHaveBeenCalledWith('--message-bubble-top-inset');
        wrapper.unmount();
        expect(row.style.removeProperty).toHaveBeenCalledTimes(2);
    });
});
