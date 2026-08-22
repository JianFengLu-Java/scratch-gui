import {readPlanetEnvelope, refreshPlanetSession} from './planet-session';

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

export const fetchPlanetCollaborationPermissions = projectId => authorizedRequest(
    `/projects/${encodeURIComponent(projectId)}/collaboration-permissions`
);

export const savePlanetCollaborationPermissions = (projectId, permissions) => authorizedRequest(
    `/projects/${encodeURIComponent(projectId)}/collaboration-permissions`, {
        method: 'PUT',
        body: JSON.stringify(permissions)
    }
);
