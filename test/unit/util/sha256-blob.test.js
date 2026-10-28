import {createHash, webcrypto} from 'crypto';
import sha256Blob from '../../../src/lib/sha256-blob';

describe('project upload checksums on LAN HTTP', () => {
    const previousWindow = global.window;
    afterEach(() => { global.window = previousWindow; });

    test.each([
        Buffer.alloc(0),
        Buffer.from('abc'),
        Buffer.from('手机保存作品 🌍'),
        Buffer.from(Array.from({length: 257}, (unused, index) => index % 256))
    ])('matches the standard SHA-256 digest without SubtleCrypto: %p', async content => {
        global.window = {crypto: {}};
        expect(await sha256Blob(new Blob([content])))
            .toBe(createHash('sha256').update(content).digest('hex'));
    });

    test('uses native WebCrypto when it is available', async () => {
        const digest = jest.fn(webcrypto.subtle.digest.bind(webcrypto.subtle));
        global.window = {crypto: {subtle: {digest}}};
        const content = Buffer.from('native checksum');
        expect(await sha256Blob(new Blob([content])))
            .toBe(createHash('sha256').update(content).digest('hex'));
        expect(digest).toHaveBeenCalledWith('SHA-256', expect.any(Uint8Array));
    });

    test('allows UI callbacks while computing a large project checksum', async () => {
        global.window = {crypto: {}};
        const content = new Uint8Array(700000).fill(203);
        let uiUpdated = false;
        setTimeout(() => { uiUpdated = true; }, 0);
        const result = await sha256Blob({arrayBuffer: async () => content.buffer});
        expect(uiUpdated).toBe(true);
        expect(result).toBe(createHash('sha256').update(content).digest('hex'));
    });

    test('does not invent a checksum when reading the file fails', async () => {
        global.window = {crypto: {}};
        await expect(sha256Blob({arrayBuffer: async () => { throw new Error('read failed'); }}))
            .rejects.toThrow('read failed');
    });
});
