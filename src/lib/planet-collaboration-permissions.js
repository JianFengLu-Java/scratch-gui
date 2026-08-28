import {
    readPlanetEnvelope,
    refreshPlanetSession,
    resolvePlanetAssetUrl
} from './planet-session';

const API_ROOT = '/backend-api';

const authorizedRequest = async (path, options = {}) => {
    const session = await refreshPlanetSession();
    return fetch(`${API_ROOT}${path}`, {
        ...options,
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            Authorization: `${session.tokenType || 'Bearer'} ${session.accessToken}`,
            ...(options.body ? {'Content-Type': 'application/json'} : {}),
            ...options.headers
        }
    }).then(readPlanetEnvelope);
};

export const normalizePlanetCollaborationPermissions = permissions => ({
    ...permissions,
    members: Array.isArray(permissions && permissions.members) ? permissions.members.map(member => ({
        ...member,
        avatarUrl: resolvePlanetAssetUrl(member.avatarUrl)
    })) : []
});

export const fetchPlanetCollaborationPermissions = projectId => authorizedRequest(
    `/projects/${encodeURIComponent(projectId)}/collaboration-permissions`
).then(normalizePlanetCollaborationPermissions);

export const savePlanetCollaborationPermissions = (projectId, permissions) => authorizedRequest(
    `/projects/${encodeURIComponent(projectId)}/collaboration-permissions`, {
        method: 'PUT',
        body: JSON.stringify(permissions)
    }
).then(normalizePlanetCollaborationPermissions);
