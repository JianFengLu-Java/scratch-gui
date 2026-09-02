import {
    getPlanetCollaborationChatState,
    getPlanetCollaborationVoiceState,
    PlanetYjsCollaboration
} from '../../../src/lib/planet-collaboration';

describe('planet collaboration chat state', () => {
    let collaboration;

    beforeEach(() => {
        global.CustomEvent = class CustomEvent {
            constructor (type, options) {
                this.type = type;
                this.detail = options && options.detail;
            }
        };
        global.window = {
            addEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
            removeEventListener: jest.fn()
        };
        collaboration = new PlanetYjsCollaboration({
            onRemoteProject: jest.fn(),
            onStatus: jest.fn(),
            projectId: '8',
            serializeProject: jest.fn()
        });
    });

    afterEach(() => {
        collaboration.destroy();
        delete global.CustomEvent;
        delete global.window;
    });

    test('keeps session and authoritative history for chat panels mounted later', async () => {
        await collaboration.handleMessage({
            data: JSON.stringify({type: 'session-ready', sessionId: 'session-1', userId: '7'})
        });
        await collaboration.handleMessage({
            data: JSON.stringify({
                type: 'chat-history',
                messages: [{
                    avatarUrl: '/api/v1/files/88',
                    messageId: 'message-1',
                    content: '一起调试吧'
                }]
            })
        });
        collaboration.status({status: 'connected'});

        const snapshot = getPlanetCollaborationChatState();
        expect(snapshot).toEqual({
            connected: true,
            messages: [{
                avatarUrl: '/backend-api/files/88',
                messageId: 'message-1',
                content: '一起调试吧'
            }],
            ownUserId: '7',
            projectId: '8'
        });

        snapshot.messages.push({messageId: 'local-mutation'});
        expect(getPlanetCollaborationChatState().messages).toHaveLength(1);
    });

    test('deduplicates live messages and keeps only the latest fifty', async () => {
        const history = Array.from({length: 50}, (unused, index) => ({
            messageId: `message-${index}`,
            content: String(index)
        }));
        await collaboration.handleMessage({
            data: JSON.stringify({type: 'chat-history', messages: history})
        });
        await collaboration.handleMessage({
            data: JSON.stringify({
                type: 'chat-message',
                message: {messageId: 'message-50', content: '50'}
            })
        });
        await collaboration.handleMessage({
            data: JSON.stringify({
                type: 'chat-message',
                message: {messageId: 'message-50', content: '50'}
            })
        });

        const messages = getPlanetCollaborationChatState().messages;
        expect(messages).toHaveLength(50);
        expect(messages[0].messageId).toBe('message-1');
        expect(messages[49].messageId).toBe('message-50');
    });

    test('normalizes voice participant avatars before publishing room state', async () => {
        await collaboration.handleMessage({
            data: JSON.stringify({type: 'session-ready', sessionId: 'session-1', userId: '7'})
        });
        await collaboration.handleMessage({
            data: JSON.stringify({
                active: true,
                participants: [{
                    avatarUrl: '/api/v1/files/99',
                    nickname: '协作者',
                    sessionId: 'session-1'
                }],
                type: 'voice-room'
            })
        });

        expect(getPlanetCollaborationVoiceState().participants[0].avatarUrl)
            .toBe('/backend-api/files/99');
    });

    test('invalidates appearance without adding or mutating chat messages', async () => {
        await collaboration.handleMessage({data: JSON.stringify({type: 'chat-history', messages: []})});
        const before = getPlanetCollaborationChatState().messages;
        for (const type of ['BUBBLE_APPEARANCE_CHANGED', 'BUBBLE_CATALOG_CHANGED']) {
            const data = {userId: '7', appearanceRevision: 3};
            await collaboration.handleMessage({data: JSON.stringify({type, data})});
            expect(window.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
                type: 'programming-planet:bubble-appearance-changed', detail: data
            }));
        }
        expect(getPlanetCollaborationChatState().messages).toEqual(before);
        window.dispatchEvent.mockClear();
        await collaboration.handleMessage({
            data: JSON.stringify({type: 'session-ready', sessionId: 'reconnected', userId: '7'})
        });
        expect(window.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({
            type: 'programming-planet:bubble-appearance-changed'
        }));
    });
});
