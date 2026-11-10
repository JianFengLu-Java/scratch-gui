import {receivePreviewProject} from '../../../src/lib/planet-preview-transfer';

const previousWindow = global.window;
const channel = '13cf7545-6566-42ac-9d20-460612a572a6';
const parentOrigin = 'https://admin.example';
let listeners;
let parent;

beforeEach(() => {
    jest.useFakeTimers();
    listeners = new Set();
    parent = {postMessage: jest.fn()};
    global.window = {parent,
        addEventListener: (type, listener) => listeners.add(listener),
        removeEventListener: (type, listener) => listeners.delete(listener)};
});
afterEach(() => {
    global.window = previousWindow;
    jest.useRealTimers();
});
const emit = event => [...listeners].forEach(listener => listener(event));

test('accepts one archive only from the exact parent, origin and random channel', async () => {
    const pending = receivePreviewProject({channel, parentOrigin});
    const buffer = new ArrayBuffer(4);
    const data = {type: 'planet-preview-project', channel, buffer};
    expect(parent.postMessage).toHaveBeenCalledWith({type: 'planet-preview-ready', channel}, parentOrigin);
    emit({source: parent, origin: 'https://wrong.example', data});
    emit({source: {}, origin: parentOrigin, data});
    emit({source: parent, origin: parentOrigin, data: {...data, channel: 'wrong'}});
    emit({source: parent, origin: parentOrigin, data: {...data, buffer: 'not-bytes'}});
    expect(listeners.size).toBe(1);
    emit({source: parent, origin: parentOrigin, data});
    await expect(pending).resolves.toBe(buffer);
    expect(listeners.size).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
});

test('repeats readiness until a late parent listener attaches and bounds that wait', async () => {
    const pending = expect(receivePreviewProject({channel, parentOrigin, timeout: 1200}))
        .rejects.toThrow('Preview transfer timed out');
    await jest.advanceTimersByTimeAsync(1200);
    await pending;
    expect(parent.postMessage).toHaveBeenCalledTimes(3);
    expect(listeners.size).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
});

test('cancellation removes the transfer listener and all handshake timers', async () => {
    const controller = new AbortController();
    const pending = expect(receivePreviewProject({channel, parentOrigin, signal: controller.signal}))
        .rejects.toMatchObject({name: 'AbortError'});
    controller.abort();
    await pending;
    expect(listeners.size).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
});

test.each(['*', 'https://admin.example/path', 'javascript:alert(1)'])(
    'rejects a non-origin target instead of using a wildcard: %s', async origin => {
        await expect(receivePreviewProject({channel, parentOrigin: origin})).rejects.toThrow();
        expect(parent.postMessage).not.toHaveBeenCalled();
    }
);
