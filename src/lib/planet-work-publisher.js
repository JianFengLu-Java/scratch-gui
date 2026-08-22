import {readPlanetEnvelope, refreshPlanetSession} from './planet-session';

const API_ROOT = '/backend-api';

const authorizedRequest = (session, path, options = {}) => fetch(`${API_ROOT}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
        Accept: 'application/json',
        Authorization: `${session.tokenType || 'Bearer'} ${session.accessToken}`,
        ...(options.body && !(options.body instanceof Blob) ? {'Content-Type': 'application/json'} : {}),
        ...options.headers
    }
}).then(readPlanetEnvelope);

const publicRequest = path => fetch(`${API_ROOT}${path}`, {
    credentials: 'include',
    headers: {Accept: 'application/json'}
}).then(readPlanetEnvelope);

const hex = buffer => Array.from(new Uint8Array(buffer))
    .map(value => value.toString(16).padStart(2, '0'))
    .join('');

const sha256 = async blob => {
    if (!window.crypto || !window.crypto.subtle) {
        throw new Error('当前浏览器环境不支持安全文件校验，请使用 HTTPS 或本机地址打开编辑器。');
    }
    return hex(await window.crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
};

const normalizeUploadUrl = value => {
    if (value.startsWith('/api/v1/')) return `${API_ROOT}/${value.slice('/api/v1/'.length)}`;
    return value;
};

const isExternalUploadUrl = value => /^https?:\/\//i.test(value);

const normalizeEtag = value => value && value
    .replace(/^W\//i, '')
    .replace(/^"|"$/g, '');

const abortUpload = (session, objectId) => authorizedRequest(session, `/uploads/${objectId}`, {
    method: 'DELETE'
});

const uploadFile = async (session, file, purpose) => {
    const digest = await sha256(file);
    const presigned = await authorizedRequest(session, '/uploads/presign', {
        method: 'POST',
        body: JSON.stringify({
            purpose,
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            sha256: digest
        })
    });
    try {
        const uploadUrl = normalizeUploadUrl(presigned.uploadUrl);
        const response = await fetch(uploadUrl, {
            method: 'PUT',
            body: file,
            headers: presigned.headers || {}
        });
        if (!response.ok) throw new Error(`文件上传失败（${response.status}），请检查网络后重试。`);
        const etag = normalizeEtag(response.headers.get('ETag')) ||
            (isExternalUploadUrl(uploadUrl) ? '' : digest);
        if (!etag) {
            throw new Error('OSS 未向浏览器暴露 ETag，请在 Bucket CORS 的 Expose Headers 中加入 ETag。');
        }
        return await authorizedRequest(session, `/uploads/${presigned.objectId}/complete`, {
            method: 'POST',
            body: JSON.stringify({etag})
        });
    } catch (error) {
        let publishError = error;
        if (error instanceof TypeError && isExternalUploadUrl(presigned.uploadUrl)) {
            publishError = new Error(
                '无法连接 OSS：请在 Bucket CORS 中允许当前编辑器来源、PUT 和 x-oss-* 请求头。'
            );
        }
        try {
            await abortUpload(session, presigned.objectId);
        } catch (cleanupError) {
            publishError.message += ' 临时上传记录自动清理失败，请联系管理员处理。';
        }
        throw publishError;
    }
};

const currentProjectId = candidate => {
    if (candidate && /^\d+$/.test(String(candidate)) && String(candidate) !== '0') return String(candidate);
    const match = window.location.pathname.match(/^\/create\/(\d+)\/editor/);
    return match ? match[1] : null;
};

const createOrUpdateProject = async (session, candidate, name) => {
    const existingId = currentProjectId(candidate);
    if (existingId) {
        await authorizedRequest(session, `/projects/${existingId}`, {
            method: 'PATCH',
            body: JSON.stringify({name})
        });
        return existingId;
    }
    const project = await authorizedRequest(session, '/projects', {
        method: 'POST',
        body: JSON.stringify({name, editorType: 'TURBOWARP'})
    });
    window.history.replaceState(null, '', `/create/${project.id}/editor`);
    return project.id;
};

const findProjectWork = async (session, projectId) => {
    const page = await authorizedRequest(session,
        `/works/mine?projectId=${encodeURIComponent(projectId)}&page=1&pageSize=1`);
    if (!page.items || page.items.length === 0) return null;
    return authorizedRequest(session, `/works/${page.items[0].id}`);
};

const uploadVersionFiles = async (session, projectFile, coverFile, onProgress) => {
    onProgress('正在生成发布版本', 30);
    const projectUpload = await uploadFile(session, projectFile, 'PROJECT_FILE');
    try {
        onProgress('正在保存作品封面', 48);
        const coverUpload = await uploadFile(session, coverFile, 'WORK_COVER');
        return {coverUpload, projectUpload};
    } catch (error) {
        try {
            await abortUpload(session, projectUpload.objectId);
        } catch (cleanupError) {
            error.message += ' 已上传的项目文件自动清理失败，请联系管理员处理。';
        }
        throw error;
    }
};

const saveVersion = async (session, projectId, uploads, form, onProgress) => {
    onProgress('正在创建不可变版本', 64);
    const editorSession = await authorizedRequest(session, `/projects/${projectId}/editor-session`, {
        method: 'POST',
        body: JSON.stringify({mode: 'WRITE'})
    });
    const version = await authorizedRequest(session, `/projects/${projectId}/versions`, {
        method: 'POST',
        headers: {'X-Editor-Session-Token': editorSession.sessionToken},
        body: JSON.stringify({
            fileObjectId: uploads.projectUpload.objectId,
            stageCoverObjectId: uploads.coverUpload.objectId,
            manifest: {
                editor: 'TURBOWARP',
                source: 'WEB_EDITOR',
                stageWidth: form.stageWidth,
                stageHeight: form.stageHeight
            },
            versionType: form.versionType,
            changeLog: '从 TurboWarp 编辑器提交',
            sourceAccess: form.remixPermission
        })
    });
    return {coverObjectId: uploads.coverUpload.objectId, versionId: version.id};
};

const workPayload = (projectId, version, form, revision) => ({
    projectId,
    versionId: version.versionId,
    title: form.name.trim(),
    categoryId: form.categoryId,
    tagIds: form.tagIds,
    coverObjectId: version.coverObjectId,
    summary: form.summary.trim(),
    instruction: form.instructions.trim() || null,
    originType: 'ORIGINAL',
    originWorkId: null,
    remixPermission: form.remixPermission,
    visibility: form.visibility,
    versionType: form.versionType,
    stageWidth: form.stageWidth,
    stageHeight: form.stageHeight,
    introVideoUrl: null,
    notifyFollowers: form.notifyFollowers,
    copyrightAccepted: form.copyrightAccepted,
    revision
});

const saveWorkDraft = (session, existingWork, projectId, version, form) => {
    const payload = workPayload(projectId, version, form, existingWork ? existingWork.revision : null);
    if (!existingWork) {
        return authorizedRequest(session, '/works', {method: 'POST', body: JSON.stringify(payload)});
    }
    return authorizedRequest(session, `/works/${existingWork.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
    });
};

const submissionKey = workId => {
    const storageKey = `pp:work-submit-key:${workId}`;
    let value = localStorage.getItem(storageKey);
    if (!value) {
        const random = window.crypto && window.crypto.randomUUID ?
            window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16)
                .slice(2)}`;
        value = `work-${workId}-${random}`.slice(0, 128);
        localStorage.setItem(storageKey, value);
    }
    return {storageKey, value};
};

export const loadWorkPublishOptions = async () => {
    const [session, categories, tags] = await Promise.all([
        refreshPlanetSession(),
        publicRequest('/categories?scene=WORK'),
        publicRequest('/tags?scene=WORK')
    ]);
    const profile = await authorizedRequest(session, '/users/me');
    return {categories, profile, session, tags};
};

export const saveCurrentProjectDraft = async ({
    coverFile,
    form,
    onProgress,
    projectId: candidateProjectId,
    projectTitle,
    serializeProject,
    session
}) => {
    onProgress('正在检查项目状态', 8);
    let projectId = currentProjectId(candidateProjectId);
    let existingWork = projectId ? await findProjectWork(session, projectId) : null;
    if (existingWork && !['DRAFT', 'REJECTED', 'OFFLINE'].includes(existingWork.status)) {
        const message = existingWork.status === 'PENDING' ?
            '这个项目已有作品正在审核，请等待审核结果。' :
            '这个项目已有已发布作品，请先在后台下线后再提交新版本。';
        throw new Error(message);
    }
    onProgress('正在打包当前 SB3', 16);
    const content = await serializeProject();
    const safeTitle = (form.name || projectTitle || '未命名作品').replace(/[\\/:*?"<>|]/g, '_');
    const projectFile = new File([content], `${safeTitle}.sb3`, {type: 'application/zip'});
    const hadProject = Boolean(projectId);
    let uploads = null;
    let createdProject = false;
    let versionSaved = false;
    try {
        uploads = await uploadVersionFiles(session, projectFile, coverFile, onProgress);
        projectId = await createOrUpdateProject(session, projectId, form.name.trim());
        createdProject = !hadProject;
        existingWork = existingWork || await findProjectWork(session, projectId);
        const version = await saveVersion(session, projectId, uploads, form, onProgress);
        versionSaved = true;
        onProgress('正在保存作品资料', 76);
        const work = await saveWorkDraft(session, existingWork, projectId, version, form);
        onProgress('草稿已保存', 100);
        return {projectId, work};
    } catch (error) {
        if (!versionSaved && createdProject) {
            try {
                await authorizedRequest(session, `/projects/${projectId}`, {method: 'DELETE'});
                window.history.replaceState(null, '', '/create/editor');
            } catch (cleanupError) {
                error.message += ' 新建项目自动回退失败，请联系管理员处理。';
            }
        }
        if (!versionSaved && uploads) {
            const cleanupResults = await Promise.allSettled([
                abortUpload(session, uploads.projectUpload.objectId),
                abortUpload(session, uploads.coverUpload.objectId)
            ]);
            if (cleanupResults.some(result => result.status === 'rejected')) {
                error.message += ' 临时上传记录自动清理不完整，请联系管理员处理。';
            }
        }
        throw error;
    }
};

export const publishCurrentProject = async ({
    coverFile,
    form,
    onProgress,
    projectId: candidateProjectId,
    projectTitle,
    serializeProject,
    session
}) => {
    const saved = await saveCurrentProjectDraft({
        coverFile,
        form,
        onProgress,
        projectId: candidateProjectId,
        projectTitle,
        serializeProject,
        session
    });
    onProgress('正在提交审核', 90);
    const key = submissionKey(saved.work.id);
    const submission = await authorizedRequest(session, `/works/${saved.work.id}/submit`, {
        method: 'POST',
        headers: {'Idempotency-Key': key.value},
        body: JSON.stringify({
            copyrightAccepted: form.copyrightAccepted,
            notifyFollowers: form.notifyFollowers
        })
    });
    localStorage.removeItem(key.storageKey);
    onProgress('提交完成', 100);
    return {...saved, submission};
};
