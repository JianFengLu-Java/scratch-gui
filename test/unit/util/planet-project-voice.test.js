import {
    createPlanetVoiceMessageFrame,
    PlanetProjectVoiceRoom,
    selectPlanetVoiceMimeType
} from '../../../src/lib/planet-project-voice';

describe('project voice protocol', () => {
    test('encodes a bounded voice message using the trusted binary header', () => {
        const frame = createPlanetVoiceMessageFrame(
            'audio/webm;codecs=opus', 1250, new Uint8Array([11, 12, 13]));

        expect(String.fromCharCode(...frame.slice(0, 8))).toBe('PLANETV1');
        expect(frame[8]).toBe(1);
        expect(new DataView(frame.buffer).getUint32(9)).toBe(1250);
        expect(Array.from(frame.slice(13))).toEqual([11, 12, 13]);
    });

    test('chooses the first browser-supported recording format', () => {
        const MediaRecorderClass = {
            isTypeSupported: type => type === 'audio/ogg;codecs=opus'
        };

        expect(selectPlanetVoiceMimeType(MediaRecorderClass)).toBe('audio/ogg;codecs=opus');
    });

    test('rejects oversized voice payloads before websocket transmission', () => {
        expect(() => createPlanetVoiceMessageFrame(
            'audio/webm;codecs=opus', 1000, new Uint8Array((256 * 1024) + 1)
        )).toThrow('语音消息过大');
    });

    test('applies rotated TURN credentials and restarts existing peer ICE', () => {
        const room = new PlanetProjectVoiceRoom({onState: jest.fn(), send: jest.fn()});
        const peer = {setConfiguration: jest.fn()};
        const state = {candidates: [], peer};
        room.joined = true;
        room.iceServers = [{urls: ['turn:old.example.com']}];
        room.sessionId = 'a-session';
        room.peers.set('b-session', state);
        room.offer = jest.fn();
        const next = [{
            urls: ['turn:new.example.com'],
            username: 'expires:7',
            credential: 'temporary'
        }];

        room.configure({iceServers: next, sessionId: room.sessionId});

        expect(peer.setConfiguration).toHaveBeenCalledWith({iceServers: next});
        expect(room.offer).toHaveBeenCalledWith('b-session', state, true);
    });
});
