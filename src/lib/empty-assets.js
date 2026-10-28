/**
 * @fileoverview
 * Utility functions to return json corresponding to default empty assets.
 */

// Painting starts from a local asset, including when the project uses a custom default archive.
const emptyCostumeSVG = '<svg version="1.1" width="2" height="2" viewBox="-1 -1 2 2" ' +
    'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n' +
    '  <!-- Exported by Scratch - http://scratch.mit.edu/ -->\n</svg>';
const emptyCostumeAsset = {
    id: 'cd21514d0531fdffb22204e0ec5ed84a',
    data: new Uint8Array(Array.from(emptyCostumeSVG, character => character.charCodeAt(0)))
};

/**
 * Generate a blank costume object for vm.addCostume with the provided name.
 * @param {string} name the name to use for the costume, caller should localize
 * @return {object} vm costume object
 */
const emptyCostume = name => ({
    name: name,
    md5: `${emptyCostumeAsset.id}.svg`,
    rotationCenterX: 0,
    rotationCenterY: 0,
    bitmapResolution: 1,
    skinId: null
});

/**
 * Generate a new empty sprite. The caller should provide localized versions of the
 * default names.
 * @param {string} name the name to use for the sprite
 * @param {string} soundName the name to use for the default sound
 * @param {string} costumeName the name to use for the default costume
 * @return {object} object expected by vm.addSprite
 */
const emptySprite = (name, soundName, costumeName) => ({
    objName: name,
    sounds: [],
    costumes: [
        {
            costumeName: costumeName,
            baseLayerID: -1,
            baseLayerMD5: `${emptyCostumeAsset.id}.svg`,
            bitmapResolution: 1,
            rotationCenterX: 0,
            rotationCenterY: 0
        }
    ],
    currentCostumeIndex: 0,
    scratchX: 36,
    scratchY: 28,
    scale: 1,
    direction: 90,
    rotationStyle: 'normal',
    isDraggable: false,
    visible: true,
    spriteInfo: {}
});

export {
    emptyCostume,
    emptyCostumeAsset,
    emptySprite
};
