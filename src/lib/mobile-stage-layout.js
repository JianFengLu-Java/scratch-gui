// A scene starts at its useful content height, independently of the block library split.
export const getMobileSceneDefaultHeight = (stage, viewportWidth) => {
    // Match the scene grid's bounded inspector column instead of assigning a
    // fixed percentage of the screen to properties on wider phones/tablets.
    const propertiesWidth = Math.max(110, Math.min(160, viewportWidth * 0.32));
    const canvasWidth = Math.max(1, Math.min(stage.width, 480, viewportWidth - 22 - propertiesWidth));
    return Math.ceil(92 + Math.max(140, canvasWidth * stage.height / stage.width));
};

// Fit the project's original aspect ratio into the preview cell, including controls and borders.
// Use the available column space without changing the project's original aspect ratio.
const fitMobileStage = (stage, availableSize) => {
    const bounds = availableSize || {width: 0, height: 0};
    const width = Math.max(1, Math.min(480, bounds.width - 2));
    const controlsHeight = Number.isFinite(bounds.controlsHeight) ? Math.max(0, bounds.controlsHeight) : 48;
    const height = Math.max(1, bounds.height - controlsHeight - 2);
    const scale = Math.min(1, width / stage.width, height / stage.height);
    return {width: stage.width * scale, height: stage.height * scale, scale};
};

export default fitMobileStage;
