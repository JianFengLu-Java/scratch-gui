// Fit the project's original aspect ratio into the preview cell, including controls and borders.
// Property controls and the target list get their own cells and never affect the canvas aspect ratio.
const fitMobileStage = (stage, availableSize) => {
    const bounds = availableSize || {width: 0, height: 0};
    const width = Math.max(1, Math.min(480, bounds.width - 2));
    const height = Math.max(1, bounds.height - 50);
    const scale = Math.min(1, width / stage.width, height / stage.height);
    return {width: stage.width * scale, height: stage.height * scale, scale};
};

export default fitMobileStage;
