// An administrator's browser downloads the protected file itself. Only the
// immutable archive crosses origins; administrator credentials stay in its tab.
export const receivePreviewProject = ({channel, parentOrigin, signal, timeout = 30000}) => {
    let validOrigin = false;
    try {
        validOrigin = /^https?:\/\//.test(parentOrigin || '') && new URL(parentOrigin).origin === parentOrigin;
    } catch (_error) { /* Reject malformed origins without leaving a pending handshake. */ }
    if (!/^[a-f0-9-]{36}$/.test(channel || '') || !validOrigin || window.parent === window) {
        return Promise.reject(new Error('Invalid preview transfer'));
    }
    return new Promise((resolve, reject) => {
        let timer = null;
        let readyTimer = null;
        const listeners = [];
        const cleanup = () => {
            clearTimeout(timer);
            clearInterval(readyTimer);
            listeners.forEach(remove => remove());
        };
        const abort = () => {
            cleanup();
            reject(new DOMException('Aborted', 'AbortError'));
        };
        const receive = event => {
            if (event.source !== window.parent || event.origin !== parentOrigin || !event.data ||
                event.data.type !== 'planet-preview-project' || event.data.channel !== channel ||
                !(event.data.buffer instanceof ArrayBuffer)) return;
            cleanup();
            resolve(event.data.buffer);
        };
        if (signal && signal.aborted) return abort();
        window.addEventListener('message', receive);
        listeners.push(() => window.removeEventListener('message', receive));
        if (signal) {
            signal.addEventListener('abort', abort, {once: true});
            listeners.push(() => signal.removeEventListener('abort', abort));
        }
        timer = setTimeout(() => {
            cleanup();
            reject(new Error('Preview transfer timed out'));
        }, timeout);
        const ready = () => window.parent.postMessage({type: 'planet-preview-ready', channel}, parentOrigin);
        // A cached iframe may initialize before React attaches the parent listener.
        readyTimer = setInterval(ready, 500);
        ready();
    });
};
