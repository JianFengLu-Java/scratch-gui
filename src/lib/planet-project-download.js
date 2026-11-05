// The embedding page can attach after a small project has already loaded, so
// retain the latest state as well as emitting updates.
export const reportProjectLoad = (phase, loaded = 0, total = 0, attempt = 1) => {
    if (typeof document === 'undefined') return;
    const data = document.documentElement.dataset;
    data.twLoadPhase = phase;
    data.twLoadBytes = String(loaded);
    data.twLoadTotal = String(total);
    data.twLoadAttempt = String(attempt);
    window.dispatchEvent(new CustomEvent('turbowarp-project-load-state'));
};

/* Stream project archives with an idle deadline and bounded retries. Resume
 * only when the server advertises byte ranges and validates the returned offset.
 * A server ignoring Range is handled as a new, complete download.
 */
export const downloadProject = async (url, {
    signal,
    onProgress = () => {},
    idleTimeout = 20000,
    requestTimeout = 180000,
    maxAttempts = 3
} = {}) => {
    let originUrl = null;
    if (typeof window !== 'undefined') {
        const parsed = new URL(url, window.location.href);
        if (parsed.origin === window.location.origin &&
            /^\/(?:backend-api|api\/v1)\/works\/\d+(?:\/versions\/\d+)?\/run-file$/.test(parsed.pathname)) {
            parsed.searchParams.set('origin', 'true');
            originUrl = parsed.href;
        }
    }
    let chunks = [];
    let loaded = 0;
    let total = 0;
    let canResume = false;
    let etag = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (attempt === 2 && originUrl) {
            // CDN transport failures should not prevent access to a healthy OSS
            // source. This route still verifies the original work grant.
            url = originUrl;
            chunks = [];
            loaded = 0;
            total = 0;
            canResume = false;
        }
        const controller = new AbortController();
        const abort = () => controller.abort();
        if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
        if (signal) signal.addEventListener('abort', abort);
        let idleTimer;
        const resetIdleTimer = () => {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(abort, idleTimeout);
        };
        resetIdleTimer();
        const requestTimer = setTimeout(abort, requestTimeout);
        let reader;
        let retryable = true;
        try {
            const offset = canResume ? loaded : 0;
            if (!offset) {
                chunks = [];
                loaded = 0;
            }
            onProgress(loaded, total, attempt);
            const response = await fetch(url, {
                signal: controller.signal,
                headers: offset ? {Range: `bytes=${offset}-`} : {}
            });
            resetIdleTimer();
            if (!response.ok) {
                retryable = response.status === 408 || response.status === 429 || response.status >= 500;
                throw new Error(`Project request returned status ${response.status}`);
            }
            const length = Number(response.headers.get('Content-Length')) || 0;
            if (response.status === 206) {
                const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('Content-Range') || '');
                if (!offset || !range || Number(range[1]) !== offset || Number(range[3]) !== total ||
                    (etag && response.headers.get('ETag') !== etag)) {
                    // Do not concatenate an unverified partial response.
                    canResume = false;
                    throw new Error('Invalid project download range');
                }
            } else {
                chunks = [];
                loaded = 0;
                total = response.headers.get('Content-Encoding') ? 0 : length;
                canResume = total > 0 && response.headers.get('Accept-Ranges') === 'bytes';
                etag = response.headers.get('ETag');
            }
            reader = response.body && response.body.getReader();
            if (reader) {
                for (let part = await reader.read(); !part.done; part = await reader.read()) {
                    resetIdleTimer();
                    chunks.push(part.value);
                    loaded += part.value.byteLength;
                    onProgress(loaded, total, attempt);
                }
            } else {
                const buffer = new Uint8Array(await response.arrayBuffer());
                chunks.push(buffer);
                loaded += buffer.byteLength;
            }
            if (total && loaded !== total) throw new Error('Incomplete project download');
            const result = new Uint8Array(loaded);
            let cursor = 0;
            for (const chunk of chunks) {
                result.set(chunk, cursor);
                cursor += chunk.byteLength;
            }
            onProgress(loaded, loaded, attempt);
            return result.buffer;
        } catch (error) {
            if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
            if (!retryable || attempt === maxAttempts) throw new Error('Project download failed');
        } finally {
            controller.abort();
            if (reader) reader.cancel().catch(() => {});
            clearTimeout(idleTimer);
            clearTimeout(requestTimer);
            if (signal) signal.removeEventListener('abort', abort);
        }
    }
};
