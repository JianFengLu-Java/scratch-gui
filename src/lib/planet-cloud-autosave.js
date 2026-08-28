import {readPlanetEnvelope, refreshPlanetSession} from './planet-session';

const API_ROOT = '/backend-api';
const cloudStates = new Map();

export const PLANET_AUTOSAVE_STATUS_EVENT = 'planet-autosave-status';
export const PLANET_AUTOSAVE_REQUEST_EVENT = 'planet-autosave-request';

const authorizedRequest = (session, path, options = {}) => fetch(`${API_ROOT}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
        Accept: 'application/json',
        Authorization: `${session.tokenType || 'Bearer'} ${session.accessToken}`,
        ...(options.body ? {'Content-Type': 'application/json'} : {}),
        ...options.headers
    }
}).then(readPlanetEnvelope);

const publicUploadUrl = value => (value.startsWith('/api/v1/') ?
    `${API_ROOT}/${value.slice('/api/v1/'.length)}` : value);

const externalUrl = value => /^https?:\/\//i.test(value);

const normalizeEtag = value => value && value.replace(/^W\//i, '').replace(/^"|"$/g, '');

const hex = buffer => Array.from(new Uint8Array(buffer))
    .map(value => value.toString(16).padStart(2, '0'))
    .join('');

export const sha256PlanetBlob = async blob => {
    if (!window.crypto || !window.crypto.subtle) {
        throw new Error('当前浏览器环境不支持安全文件校验，请使用 HTTPS 或本机地址打开编辑器。');
    }
    return hex(await window.crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
};

export const abortPlanetUpload = (session, objectId) => authorizedRequest(session,
    `/uploads/${encodeURIComponent(objectId)}`, {method: 'DELETE'});

export const uploadPlanetProjectFile = async (session, file, contentSha256) => {
    const presigned = await authorizedRequest(session, '/uploads/presign', {
        method: 'POST',
        body: JSON.stringify({
            purpose: 'PROJECT_FILE',
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            sha256: contentSha256
        })
    });
    const uploadUrl = publicUploadUrl(presigned.uploadUrl);
    try {
        const response = await fetch(uploadUrl, {
            method: 'PUT',
            body: file,
            headers: presigned.headers || {}
        });
        if (!response.ok) throw new Error(`项目文件上传失败（${response.status}）`);
        const etag = normalizeEtag(response.headers.get('ETag')) ||
            (externalUrl(uploadUrl) ? '' : contentSha256);
        if (!etag) throw new Error('OSS 未暴露 ETag，请在 Bucket CORS 的 Expose Headers 中加入 ETag。');
        await authorizedRequest(session, `/uploads/${presigned.objectId}/complete`, {
            method: 'POST',
            body: JSON.stringify({etag})
        });
        return presigned.objectId;
    } catch (error) {
        try {
            await abortPlanetUpload(session, presigned.objectId);
        } catch (cleanupError) {
            // The pending upload cleanup is best effort; the original error is more useful to the editor.
        }
        if (error instanceof TypeError && externalUrl(uploadUrl)) {
            throw new Error('无法连接 OSS，请检查 Bucket CORS 的来源、PUT、请求头和 ETag 暴露配置。');
        }
        throw error;
    }
};

export const rememberPlanetCloudState = (projectId, state) => {
    cloudStates.set(String(projectId), {
        baseVersionId: state.baseVersionId || null,
        contentSha256: state.contentSha256 || null,
        revision: Number(state.revision) || 0
    });
};

export const planetCloudState = projectId => cloudStates.get(String(projectId)) || {
    baseVersionId: null,
    contentSha256: null,
    revision: 0
};

export const fetchPlanetAutosave = (session, projectId) => authorizedRequest(session,
    `/projects/${encodeURIComponent(projectId)}/autosave`);

export const openPlanetWriteSession = (session, projectId) => authorizedRequest(session,
    `/projects/${encodeURIComponent(projectId)}/editor-session`, {
        method: 'POST',
        body: JSON.stringify({mode: 'WRITE'})
    });

export const savePlanetCloudAutosave = async ({
    contentSha256,
    editorSessionToken,
    file,
    projectId
}) => {
    const session = await refreshPlanetSession();
    const before = planetCloudState(projectId);
    const objectId = await uploadPlanetProjectFile(session, file, contentSha256);
    try {
        const saved = await authorizedRequest(session,
            `/projects/${encodeURIComponent(projectId)}/autosave`, {
                method: 'PUT',
                headers: {'X-Editor-Session-Token': editorSessionToken},
                body: JSON.stringify({
                    fileObjectId: objectId,
                    baseVersionId: before.baseVersionId,
                    contentSha256,
                    expectedRevision: before.revision
                })
            });
        rememberPlanetCloudState(projectId, saved);
        if (saved.replacedFileObjectId) {
            abortPlanetUpload(session, saved.replacedFileObjectId).catch(() => {});
        }
        return saved;
    } catch (error) {
        if (error.status === 409) {
            const remote = await fetchPlanetAutosave(session, projectId).catch(() => null);
            if (remote && remote.fileObjectId === String(objectId) &&
                remote.contentSha256 === contentSha256) {
                rememberPlanetCloudState(projectId, remote);
                return remote;
            }
            error.autosaveConflict = true;
        }
        await abortPlanetUpload(session, objectId).catch(() => {});
        throw error;
    }
};

export const emitPlanetAutosaveStatus = detail => {
    window.dispatchEvent(new CustomEvent(PLANET_AUTOSAVE_STATUS_EVENT, {detail}));
};
