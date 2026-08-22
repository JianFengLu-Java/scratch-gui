export const PLANET_EDITOR_RESOURCE_COMMAND_EVENT = 'planet-editor-resource-command';
export const PLANET_PROJECT_CHAT_READY_EVENT = 'planet-project-chat-ready';
export const PLANET_PROJECT_CHAT_STATE_EVENT = 'planet-project-chat-state';
export const PLANET_BACKPACK_TOGGLE_EVENT = 'planet-backpack-toggle';
export const PLANET_BACKPACK_STATE_EVENT = 'planet-backpack-state';
export const PLANET_AI_ASSISTANT_STATE_EVENT = 'planet-ai-assistant-state';
export const PLANET_COLLABORATION_PERMISSIONS_READY_EVENT = 'planet-collaboration-permissions-ready';
export const PLANET_COLLABORATION_PERMISSIONS_STATE_EVENT = 'planet-collaboration-permissions-state';

export const dispatchEditorResourceCommand = command => {
    window.dispatchEvent(new CustomEvent(PLANET_EDITOR_RESOURCE_COMMAND_EVENT, {
        detail: {command}
    }));
};
