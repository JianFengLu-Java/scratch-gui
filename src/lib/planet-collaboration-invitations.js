import {readPlanetEnvelope, refreshPlanetSession} from './planet-session';

const API_ROOT = '/backend-api';

const authorizedRequest = async (path, options = {}, sessionOverride = null) => {
    const session = sessionOverride || await refreshPlanetSession();
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

export const fetchPlanetCollaborationInviteData = async projectId => {
    const session = await refreshPlanetSession();
    const encodedProjectId = encodeURIComponent(projectId);
    const members = await authorizedRequest(
        `/projects/${encodedProjectId}/collaborators`, {}, session
    );
    const viewerUserId = String((session.user && session.user.id) || '');
    const canManage = members.some(member =>
        String(member.id) === viewerUserId && member.role === 'OWNER'
    );
    const friendPage = canManage ? await authorizedRequest(
        '/users/me/friends?page=1&pageSize=100', {}, session
    ) : {items: []};
    return {
        canManage,
        friends: friendPage.items || [],
        members,
        viewerUserId
    };
};

export const createPlanetCollaborationLink = projectId => authorizedRequest(
    `/projects/${encodeURIComponent(projectId)}/collaboration-links`, {
        body: JSON.stringify({expiresInHours: 24}),
        method: 'POST'
    }
);

export const invitePlanetFriend = (projectId, userId) => authorizedRequest(
    `/projects/${encodeURIComponent(projectId)}/collaborators`, {
        body: JSON.stringify({userId}),
        method: 'POST'
    }
);

export const removePlanetCollaborator = (projectId, userId) => authorizedRequest(
    `/projects/${encodeURIComponent(projectId)}/collaborators/${encodeURIComponent(userId)}`, {
        method: 'DELETE'
    }
);
