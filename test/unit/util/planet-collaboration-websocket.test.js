import {resolvePlanetCollaborationWebSocketUrl} from '../../../src/lib/planet-collaboration';

describe('project collaboration WebSocket addresses', () => {
    let previousWindow;

    beforeEach(() => {
        previousWindow = global.window;
    });

    afterEach(() => {
        global.window = previousWindow;
    });

    test.each([
        ['http://localhost:3000', 'ws://localhost:8080'],
        ['http://127.0.0.1:3000', 'ws://127.0.0.1:8080'],
        ['http://192.168.31.244:3000', 'ws://192.168.31.244:8080'],
        ['http://10.0.0.12:5173', 'ws://10.0.0.12:8080'],
        ['http://172.16.0.12:5174', 'ws://172.16.0.12:8080'],
        ['http://dev-machine.local:3000', 'ws://dev-machine.local:8080'],
        ['http://[::1]:3000', 'ws://[::1]:8080'],
        ['https://test.letcu.com', 'wss://test.letcu.com'],
        ['https://test.letcu.com:8443', 'wss://test.letcu.com:8443']
    ])('connects from %s to the matching API host', (origin, socketOrigin) => {
        global.window = {location: {origin}};
        const url = new URL(resolvePlanetCollaborationWebSocketUrl('42', 'ticket&value'));
        expect(url.origin).toBe(socketOrigin);
        expect(url.pathname).toBe('/api/v1/ws/projects/42/collaboration');
        expect(url.searchParams.get('ticket')).toBe('ticket&value');
    });
});
