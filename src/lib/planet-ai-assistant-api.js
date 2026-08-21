import {readPlanetEnvelope, refreshPlanetSession} from './planet-session';

const API_ROOT = '/backend-api/ai-assistant';

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

export const listAssistantConversations = projectId => {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}&page=1&pageSize=50` :
        '?page=1&pageSize=50';
    return authorizedRequest(`/conversations${query}`);
};

export const createAssistantConversation = projectId => authorizedRequest('/conversations', {
    method: 'POST',
    body: JSON.stringify({
        projectId: projectId || null,
        title: '新对话'
    })
});

export const loadAssistantMessages = conversationId => authorizedRequest(
    `/conversations/${encodeURIComponent(conversationId)}/messages?pageSize=100`
);

export const sendAssistantMessage = (conversationId, content, editorContext) => authorizedRequest(
    `/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: 'POST',
        body: JSON.stringify({content, editorContext})
    }
);

export const submitAssistantToolResults = (
    conversationId,
    assistantMessageId,
    results,
    editorContext
) => authorizedRequest(
    `/conversations/${encodeURIComponent(conversationId)}/tool-results`, {
        method: 'POST',
        body: JSON.stringify({assistantMessageId, results, editorContext})
    }
);

export const archiveAssistantConversation = conversationId => authorizedRequest(
    `/conversations/${encodeURIComponent(conversationId)}`, {method: 'DELETE'}
);
