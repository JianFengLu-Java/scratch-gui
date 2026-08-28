import {readPlanetEnvelope, refreshPlanetSession} from './planet-session';
import {
    fetchPlanetAutosave,
    rememberPlanetCloudState
} from './planet-cloud-autosave';

const API_ROOT = '/backend-api';

const request = (session, path, options = {}) => fetch(`${API_ROOT}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
        Accept: 'application/json',
        Authorization: `${session.tokenType || 'Bearer'} ${session.accessToken}`,
        ...(options.body ? {'Content-Type': 'application/json'} : {}),
        ...options.headers
    }
}).then(readPlanetEnvelope);

const download = async (session, objectId) => {
    const requestOptions = {
        credentials: 'include',
        headers: {Authorization: `${session.tokenType || 'Bearer'} ${session.accessToken}`}
    };
    const directUrl = `${API_ROOT}/files/${encodeURIComponent(objectId)}`;
    let response;
    try {
        response = await fetch(directUrl, requestOptions);
    } catch (error) {
        if (!(error instanceof TypeError)) throw error;
        try {
            response = await fetch(`${directUrl}/content`, requestOptions);
        } catch (fallbackError) {
            if (fallbackError instanceof TypeError) {
                throw new Error('云端项目文件读取失败：直连和同源回退均不可用，请稍后重试。');
            }
            throw fallbackError;
        }
    }
    if (!response.ok) {
        throw new Error(`云端项目文件读取失败（${response.status}）`);
    }
    return response.arrayBuffer();
};

export const isPlanetProjectRoute = () => /^\/create\/\d+\/(editor|fullscreen)\/?$/.test(location.pathname);

export const loadPlanetProjectMetadata = async projectId => {
    const session = await refreshPlanetSession();
    return request(session, `/projects/${encodeURIComponent(projectId)}`);
};

export const savePlanetProjectName = async (projectId, name) => {
    if (!projectId || !/^\d+$/.test(String(projectId)) || String(projectId) === '0') return;
    const normalizedName = String(name || '').trim();
    if (!normalizedName) return;
    const session = await refreshPlanetSession();
    return request(session, `/projects/${encodeURIComponent(projectId)}`, {
        method: 'PATCH',
        body: JSON.stringify({name: normalizedName})
    });
};

export const loadPlanetProject = async projectId => {
    const session = await refreshPlanetSession();
    const autosave = await fetchPlanetAutosave(session, projectId);
    if (autosave && autosave.fileObjectId) {
        rememberPlanetCloudState(projectId, autosave);
        return {data: await download(session, autosave.fileObjectId)};
    }
    const versions = await request(session,
        `/projects/${encodeURIComponent(projectId)}/versions?page=1&pageSize=1`);
    const latest = versions.items && versions.items[0];
    rememberPlanetCloudState(projectId, {
        baseVersionId: latest ? latest.id : null,
        contentSha256: null,
        revision: 0
    });
    if (!latest || !latest.fileObjectId) return null;
    return {data: await download(session, latest.fileObjectId)};
};
