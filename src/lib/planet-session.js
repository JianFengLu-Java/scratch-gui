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

    const request = fetch(REFRESH_ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        headers: {Accept: 'application/json'}
    }).then(readPlanetEnvelope)
        .then(rememberSession);

    refreshPromise = request.then(session => {
        refreshPromise = null;
        return session;
    }, error => {
        refreshPromise = null;
        throw error;
    });
    return refreshPromise;
};

export const clearPlanetSession = () => {
    cachedSession = null;
    cachedSessionExpiresAt = 0;
    refreshPromise = null;
};
