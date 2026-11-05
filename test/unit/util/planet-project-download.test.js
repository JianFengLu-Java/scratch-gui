import {downloadProject} from '../../../src/lib/planet-project-download';

const previousFetch = global.fetch;
const previousWindow = global.window;
const response = ({parts = [[1, 2, 3, 4]], headers = {}, status = 200, fail = false} = {}) => {
    let index = 0;
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: {get: key => headers[key] || null},
        body: {getReader: () => ({
            read: async () => {
                if (index < parts.length) return {value: new Uint8Array(parts[index++]), done: false};
                if (fail) throw new TypeError('Network interrupted');
                return {done: true};
            },
            cancel: async () => {}
        })}
    };
};

afterEach(() => {
    global.fetch = previousFetch;
    global.window = previousWindow;
    jest.useRealTimers();
});

test('reports streaming byte progress and produces an exact archive', async () => {
    global.fetch = jest.fn(async () => response({parts: [[1, 2], [3, 4]], headers: {'Content-Length': '4'}}));
    const progress = jest.fn();
    expect([...new Uint8Array(await downloadProject('https://example.com/work.sb3', {onProgress: progress}))])
        .toEqual([1, 2, 3, 4]);
    expect(progress).toHaveBeenCalledWith(2, 4, 1);
    expect(progress).toHaveBeenLastCalledWith(4, 4, 1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('resumes an interrupted transfer only at the validated byte offset', async () => {
    global.fetch = jest.fn()
        .mockResolvedValueOnce(response({parts: [[1, 2]], fail: true,
            headers: {'Content-Length': '4', 'Accept-Ranges': 'bytes', ETag: 'immutable'}}))
        .mockResolvedValueOnce(response({parts: [[3, 4]], status: 206,
            headers: {'Content-Range': 'bytes 2-3/4', ETag: 'immutable'}}));
    const buffer = await downloadProject('https://example.com/work.sb3');
    expect([...new Uint8Array(buffer)]).toEqual([1, 2, 3, 4]);
    expect(global.fetch.mock.calls[1][1].headers.Range).toBe('bytes=2-');
});

test('restarts cleanly when the server ignores a resume request', async () => {
    global.fetch = jest.fn()
        .mockResolvedValueOnce(response({parts: [[9, 9]], fail: true,
            headers: {'Content-Length': '4', 'Accept-Ranges': 'bytes'}}))
        .mockResolvedValueOnce(response({headers: {'Content-Length': '4'}}));
    expect([...new Uint8Array(await downloadProject('https://example.com/work.sb3'))]).toEqual([1, 2, 3, 4]);
});

test('discards a mismatched partial response and restarts without Range', async () => {
    global.fetch = jest.fn()
        .mockResolvedValueOnce(response({parts: [[9, 9]], fail: true,
            headers: {'Content-Length': '4', 'Accept-Ranges': 'bytes'}}))
        .mockResolvedValueOnce(response({parts: [[8, 8]], status: 206,
            headers: {'Content-Range': 'bytes 0-1/4'}}))
        .mockResolvedValueOnce(response({headers: {'Content-Length': '4'}}));
    expect([...new Uint8Array(await downloadProject('https://example.com/work.sb3'))]).toEqual([1, 2, 3, 4]);
    expect(global.fetch.mock.calls[2][1].headers).toEqual({});
});

test('fails incomplete bodies instead of passing a truncated archive to the VM', async () => {
    global.fetch = jest.fn(async () => response({headers: {'Content-Length': '8'}}));
    await expect(downloadProject('https://example.com/work.sb3')).rejects.toThrow('Project download failed');
    expect(global.fetch).toHaveBeenCalledTimes(3);
});

test('aborts stalled requests and stops after the bounded retries', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn((url, {signal}) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const result = expect(downloadProject('https://example.com/work.sb3', {idleTimeout: 10}))
        .rejects.toThrow('Project download failed');
    await jest.advanceTimersByTimeAsync(40);
    await result;
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(jest.getTimerCount()).toBe(0);
});

test('cancellation does not retry or leave timers running', async () => {
    jest.useFakeTimers();
    const controller = new AbortController();
    global.fetch = jest.fn((url, {signal}) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const result = expect(downloadProject('https://example.com/work.sb3', {signal: controller.signal}))
        .rejects.toMatchObject({name: 'AbortError'});
    controller.abort();
    await result;
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
});

test.each(['/backend-api/works/10/run-file', '/backend-api/works/10/versions/20/run-file'])(
    'falls back from CDN to the same authorized origin snapshot: %s', async path => {
        global.window = {location: {origin: 'http://localhost:3000', href: 'http://localhost:3000/create/embed.html'}};
        const url = `http://localhost:3000${path}?expires=1234&signature=signed`;
        global.fetch = jest.fn().mockRejectedValueOnce(new TypeError('CDN unavailable'))
            .mockResolvedValueOnce(response());
        await downloadProject(url);
        const fallback = new URL(global.fetch.mock.calls[1][0]);
        expect(fallback.pathname).toBe(path);
        expect(fallback.searchParams.get('expires')).toBe('1234');
        expect(fallback.searchParams.get('signature')).toBe('signed');
        expect(fallback.searchParams.get('origin')).toBe('true');
    }
);

test('does not retry a rejected authorization or alter unrelated project URLs', async () => {
    global.window = {location: {origin: 'http://localhost:3000', href: 'http://localhost:3000/'}};
    global.fetch = jest.fn(async () => response({status: 403}));
    await expect(downloadProject('https://other.example/backend-api/works/10/run-file')).rejects.toThrow();
    expect(global.fetch).toHaveBeenCalledTimes(1);
});
