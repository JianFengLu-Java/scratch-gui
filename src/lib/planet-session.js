const REFRESH_ENDPOINT = '/backend-api/auth/user-session/refresh';
const EXPIRY_SKEW_MS = 30 * 1000;
const DEFAULT_SESSION_LIFETIME_MS = 60 * 1000;

let cachedSession = null;
let cachedSessionExpiresAt = 0;
let refreshPromise = null;

export const readPlanetEnvelope = async response => {
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || payload.code !== 'OK') {
        const fields = payload && payload.code === 'VALIDATION_ERROR' && payload.data && payload.data.fieldErrors;
        const messages = Array.isArray(fields) ? fields
            .filter(field => field && typeof field.message === 'string' && field.message.trim())
            .map(field => field.message) : [];
        const message = messages.length ? [...new Set(messages)].join('；') :
            payload && payload.message ? payload.message : `请求失败（${response.status}）`;
        const error = new Error(message);
        error.status = response.status;
        error.code = payload && payload.code;
        throw error;
    }
    return payload.data;
};

export const resolvePlanetAssetUrl = value => {
    if (!value || typeof value !== 'string') return '';
    if (value.startsWith('/api/v1/')) {
        return `/backend-api/${value.slice('/api/v1/'.length)}`;
    }
    return value;
};

const hasUsableSession = () => cachedSession && cachedSessionExpiresAt > Date.now() + EXPIRY_SKEW_MS;

const rememberSession = session => {
    const expiresInSeconds = Number(session && session.expiresIn);
    const lifetime = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ?
        expiresInSeconds * 1000 : DEFAULT_SESSION_LIFETIME_MS;
    cachedSession = session;
    cachedSessionExpiresAt = Date.now() + lifetime;
    return session;
};

export const refreshPlanetSession = () => {
    if (hasUsableSession()) return Promise.resolve(cachedSession);
    if (refreshPromise) return refreshPromise;

    const refresh = () => fetch(REFRESH_ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        headers: {Accept: 'application/json'}
    }).then(readPlanetEnvelope)
        .then(rememberSession);

    // Share the cookie rotation lock with the website and every editor tab.
    const locks = typeof navigator === 'undefined' ? null : navigator.locks;
    const request = locks ? locks.request('pp:user-session-refresh', refresh) : refresh();

    refreshPromise = request.then(session => {
        refreshPromise = null;
        return session;
    }, error => {
        refreshPromise = null;
        throw error;
    });
    return refreshPromise;
};

// API calls can outlive the cached access token while a large project uploads.
// Retry only the rejected API request; storage PUTs use separate presigned credentials.
export const fetchWithPlanetSession = async (session, url, options = {}) => {
    const sameOwner = candidate => {
        if (session.user && candidate.user && session.user.id !== candidate.user.id) {
            const error = new Error('登录账户已变化，请重新打开项目后保存');
            error.status = 409;
            throw error;
        }
        return candidate;
    };
    const send = candidate => fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
            ...options.headers,
            Authorization: `${candidate.tokenType || 'Bearer'} ${candidate.accessToken}`
        }
    });
    const active = sameOwner(cachedSession || session);
    const response = await send(active);
    if (response.status !== 401 || (options.signal && options.signal.aborted)) return response;
    // Do not discard a token another request refreshed while this 401 was in flight,
    // and do not clear the shared promise when several autosave calls fail together.
    if (cachedSession && cachedSession.accessToken === active.accessToken) {
        cachedSession = null;
        cachedSessionExpiresAt = 0;
    }
    return send(sameOwner(await refreshPlanetSession()));
};

export const clearPlanetSession = () => {
    cachedSession = null;
    cachedSessionExpiresAt = 0;
    refreshPromise = null;
};
