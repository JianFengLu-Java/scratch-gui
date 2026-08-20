const REFRESH_ENDPOINT = '/backend-api/auth/user-session/refresh';
const EXPIRY_SKEW_MS = 30 * 1000;
const DEFAULT_SESSION_LIFETIME_MS = 60 * 1000;

let cachedSession = null;
let cachedSessionExpiresAt = 0;
let refreshPromise = null;

export const readPlanetEnvelope = async response => {
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || payload.code !== 'OK') {
        const error = new Error(payload && payload.message ? payload.message : `请求失败（${response.status}）`);
        error.status = response.status;
        error.code = payload && payload.code;
        throw error;
    }
    return payload.data;
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
