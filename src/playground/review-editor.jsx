/**
 * Independent source-review entry. Persistence and collaboration are intentionally absent.
 */
import './import-first';

import React from 'react';

import Interface from './render-interface.jsx';
import render from './app-target';

const reviewParams = new URLSearchParams(location.search);
const reviewTask = reviewParams.get('review_task');
const reviewVersion = reviewParams.get('review_version');
const reviewParentOrigin = (() => {
    try {
        return new URL(document.referrer).origin;
    } catch (error) {
        return '*';
    }
})();
const notifyProjectLoaded = () => {
    if (window.parent === window || !reviewTask || !reviewVersion) return;
    window.parent.postMessage({
        type: 'LET_CODING_REVIEW_SOURCE_LOADED',
        taskId: reviewTask,
        projectVersionId: reviewVersion
    }, reviewParentOrigin);
};

const readOnlyGestureTargets = [
    '.blocklyDraggable',
    '.blocklyFlyoutButton',
    '.blocklyWorkspaceComment'
].join(',');
const blockReadOnlyGesture = event => {
    const target = event.target;
    if (target instanceof Element && target.closest(readOnlyGestureTargets)) {
        event.preventDefault();
        event.stopImmediatePropagation();
    }
};
['pointerdown', 'mousedown', 'touchstart', 'click', 'dblclick', 'contextmenu'].forEach(type => {
    document.addEventListener(type, blockReadOnlyGesture, {capture: true, passive: false});
});

render(<Interface
    backpackVisible={false}
    canChangeLanguage={false}
    canChangeTheme={false}
    canCreateCopy={false}
    canCreateNew={false}
    canEditTitle={false}
    canManageFiles={false}
    canRemix={false}
    canSave={false}
    canShare={false}
    canUseCloud={false}
    enableCommunity={false}
    hasCloudPermission={false}
    onProjectLoaded={notifyProjectLoaded}
    readOnly
/>);
