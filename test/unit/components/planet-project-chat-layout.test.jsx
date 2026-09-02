import fs from 'fs';
import path from 'path';
import React from 'react';
import {shallow} from 'enzyme';

import PlanetProjectChat from '../../../src/components/menu-bar/planet-project-chat';
import PlanetBubbleMessage from '../../../src/components/menu-bar/planet-bubble-message';

jest.mock('react-dom', () => ({
    ...jest.requireActual('react-dom'),
    createPortal: children => children
}));
jest.mock('@shadcn/react/message-scroller', () => ({
    MessageScroller: {
        Provider: 'ScrollerProvider', Root: 'ScrollerRoot', Viewport: 'ScrollerViewport',
        Content: 'ScrollerContent', Item: 'ScrollerItem'
    }
}), {virtual: true});
jest.mock('../../../src/lib/planet-collaboration', () => ({
    collaborationEnabled: () => true,
    getPlanetCollaborationChatState: () => ({messages: [], ownUserId: 'self'})
}));
jest.mock('../../../src/lib/planet-project-loader', () => ({isPlanetProjectRoute: () => true}));
jest.mock('../../../src/components/editor-dock/dock-panel', () => 'DockPanel');
jest.mock('../../../src/components/editor-dock/planet-user-avatar', () => 'PlanetUserAvatar');
jest.mock('../../../src/components/menu-bar/planet-rich-message-composer', () => 'Composer');
jest.mock('../../../src/components/menu-bar/planet-message-text', () => 'MessageText');
jest.mock('../../../src/components/menu-bar/planet-project-voice', () => ({
    PlanetProjectVoiceControls: 'VoiceControls', PlanetProjectVoiceMessage: 'VoiceMessage'
}));

describe('mobile IM message layout', () => {
    let wrapper;
    beforeEach(() => {
        global.document = {body: {}};
        global.window = {removeEventListener: jest.fn()};
        wrapper = shallow(<PlanetProjectChat />, {disableLifecycleMethods: true});
        wrapper.setState({open: true, connected: true, messages: [
            {messageId: '1', userId: 'friend', nickname: '星球创作者', content: '你好',
                sentAt: '2026-08-30T09:28:00+08:00'},
            {messageId: '2', userId: 'self', nickname: '自己', content: '收到',
                sentAt: '2026-08-30T09:29:00+08:00'}
        ]});
    });
    afterEach(() => {
        wrapper.unmount();
        delete global.document;
        delete global.window;
    });

    test('keeps incoming names but removes the redundant own-message heading', () => {
        const incoming = wrapper.find('[data-slot="message"]').at(0);
        const outgoing = wrapper.find('[data-slot="message"]').at(1);
        expect(incoming.prop('data-align')).toBe('start');
        expect(incoming.find('[data-slot="message-header"]').text()).toBe('星球创作者');
        expect(outgoing.prop('data-align')).toBe('end');
        expect(outgoing.find('[data-slot="message-header"]')).toHaveLength(0);
        expect(outgoing.prop('aria-label')).toBe('我的消息');
        expect(wrapper.find('PlanetUserAvatar')).toHaveLength(2);
    });

    test('lets decorated bubbles place their timestamp without a duplicate after the decoration gutter', () => {
        wrapper.find('[data-slot="message"]').forEach(row => {
            const content = row.find('[data-slot="message-content"]');
            const bubble = content.find(PlanetBubbleMessage);
            expect(bubble).toHaveLength(1);
            expect(bubble.prop('message').sentAt).toMatch(/^2026-08-30T09:2[89]:00\+08:00$/);
            expect(bubble.prop('timeLabel')).not.toBe('');
            expect(content.find('time')).toHaveLength(0);
            expect(content.children().last().type()).toBe(PlanetBubbleMessage);
        });
    });

    test('keeps voice messages in the same bubble and metadata structure', () => {
        wrapper.setState({messages: [{
            messageId: '3', userId: 'friend', nickname: '', messageType: 'VOICE',
            sentAt: '2026-08-30T09:30:00+08:00'
        }]});
        expect(wrapper.find('[data-slot="message-header"]').text()).toBe('协作者');
        expect(wrapper.find('[data-slot="bubble-content"]').find('VoiceMessage')).toHaveLength(1);
        expect(wrapper.find('[data-slot="message-time"]')).toHaveLength(1);
    });

    test('uses fixed 40px avatars without scaling them with multiline bubbles', () => {
        const css = fs.readFileSync(path.resolve(__dirname,
            '../../../src/components/menu-bar/planet-project-chat.css'), 'utf8');
        const avatarRule = css.match(/\.message-avatar\s*\{([^}]*)\}/)[1];
        const imageRule = css.match(/\.message-avatar > span\s*\{([^}]*)\}/)[1];
        const ownAvatarRule = css.match(/\.own-message \.message-avatar\s*\{([^}]*)\}/)[1];
        expect(css).toMatch(/\.message\s*\{[^}]*--message-avatar-size:\s*40px;/);
        expect(avatarRule).toContain('flex: 0 0 var(--message-avatar-size);');
        expect(imageRule).toContain('height: var(--message-avatar-size);');
        expect(imageRule).toContain('width: var(--message-avatar-size);');
        expect(avatarRule).toContain('margin-top: calc(var(--message-name-height) + var(--message-content-gap) + ' +
            'var(--message-bubble-top-inset, 0px));');
        expect(ownAvatarRule).toContain('margin-top: var(--message-bubble-top-inset, 0px);');
    });
});
