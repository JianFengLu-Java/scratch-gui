const sha = 'a'.repeat(64);
const catalog = () => ({code: 'OK', data: {
    snapshot: 'b'.repeat(64), extensions: [{slug: 'author/test', id: 'test'}],
    resources: {'author/test.js': sha, 'images/test.svg': 'c'.repeat(64)}
}});
let originalWindow;
let originalFetch;
let mirror;

beforeEach(() => {
    jest.resetModules();
    originalWindow = global.window;
    originalFetch = global.fetch;
    global.window = {location: {href: 'https://planet.example/create/editor.html'}};
    global.fetch = jest.fn().mockResolvedValue({ok: true, json: async () => catalog()});
    mirror = require('../../../src/lib/planet-extension-mirror');
});

afterEach(() => {
    global.window = originalWindow;
    global.fetch = originalFetch;
    jest.useRealTimers();
});

test('gallery and project imports share one backend request while canonical project URL stays portable', async () => {
    const official = 'https://extensions.turbowarp.org/author/test.js';
    const [library, rewritten] = await Promise.all([
        mirror.fetchExtensionLibrary(), mirror.rewriteExtensionURL(official)
    ]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toBe('/backend-api/editor-assets/extensions/library');
    expect(rewritten).toBe(`https://planet.example/backend-api/editor-assets/extensions/files/${sha}`);
    expect(mirror.mirroredResourceURL(library, 'images/test.svg')).toContain('c'.repeat(64));
    expect(official).toBe('https://extensions.turbowarp.org/author/test.js');
});

test('trust includes only this origin and exact digest route, including desktop custom origins', () => {
    const path = `/backend-api/editor-assets/extensions/files/${sha}`;
    expect(mirror.isMirroredExtensionURL(`https://planet.example${path}`)).toBe(true);
    for (const url of [`https://evil.example${path}`, `https://planet.example/uploads/${sha}`,
        `https://planet.example${path}?redirect=evil`, `https://planet.example${path}/evil`]) {
        expect(mirror.isMirroredExtensionURL(url)).toBe(false);
    }
    global.window.location.href = 'tw-editor://localhost/create/editor.html';
    expect(mirror.isMirroredExtensionURL(`tw-editor://localhost${path}`)).toBe(true);
    expect(mirror.isMirroredExtensionURL(`evil://localhost${path}`)).toBe(false);
});

test('custom extension hosts remain untouched; unmirrored official files fail explicitly', async () => {
    const custom = 'https://custom.example/my-extension.js';
    expect(await mirror.rewriteExtensionURL(custom)).toBe(custom);
    expect(global.fetch).not.toHaveBeenCalled();
    await expect(mirror.rewriteExtensionURL('https://extensions.turbowarp.org/missing.js'))
        .rejects.toThrow('not mirrored');
});

test('a failed catalog request can retry without a page reload', async () => {
    global.fetch.mockResolvedValueOnce({ok: false, status: 503});
    await expect(mirror.fetchExtensionLibrary()).rejects.toThrow('503');
    expect((await mirror.fetchExtensionLibrary()).extensions).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('catalog loads have a finite timeout and release the failed request for retry', async () => {
    jest.useFakeTimers();
    global.fetch.mockImplementationOnce((url, {signal}) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const pending = expect(mirror.fetchExtensionLibrary()).rejects.toThrow('aborted');
    jest.advanceTimersByTime(15000);
    await pending;
    expect((await mirror.fetchExtensionLibrary()).extensions).toHaveLength(1);
});
