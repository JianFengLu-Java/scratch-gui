const compactKey = value => {
    let hash = 2166136261;
    const source = String(value || '');
    for (let index = 0; index < source.length; index++) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
};

const assetKey = costume => {
    const value = costume && (costume.assetId || costume.md5 || costume.md5ext);
    const normalized = String(value || '')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 48);
    return normalized || compactKey(costume && costume.name);
};

const getCostumeTargetId = (ownerName, costume, isStage) => (
    `costume:${isStage ? 'stage' : `sprite-${compactKey(ownerName)}`}:` +
    `${assetKey(costume)}-${compactKey(costume && costume.name)}`
);

const getSelectedTarget = (targets, costumeMode) => {
    const editingTargetId = targets.editingTarget;
    const selected = targets.stage && targets.stage.id === editingTargetId ?
        targets.stage : targets.sprites && targets.sprites[editingTargetId];
    if (!selected) return null;
    const ownerName = selected.name || (selected.isStage ? '舞台' : '角色');
    if (costumeMode) {
        const costumes = selected.costumes || [];
        const costume = costumes[selected.currentCostume] || selected.costume;
        if (costume) {
            return {
                targetId: getCostumeTargetId(ownerName, costume, selected.isStage),
                targetName: `${costume.name} · ${ownerName}`
            };
        }
    }
    return {
        targetId: selected.isStage ? 'stage' : `sprite:${ownerName}`,
        targetName: ownerName
    };
};

const listPermissionTargets = targets => {
    const targetList = [];
    const append = target => {
        if (!target || !target.id) return;
        const ownerName = target.name || (target.isStage ? '舞台' : '角色');
        targetList.push({
            kind: target.isStage ? 'stage' : 'sprite',
            targetId: target.isStage ? 'stage' : `sprite:${ownerName}`,
            targetName: ownerName
        });
        (target.costumes || []).forEach(costume => {
            if (!costume || !costume.name) return;
            targetList.push({
                kind: 'costume',
                parentName: ownerName,
                targetId: getCostumeTargetId(ownerName, costume, target.isStage),
                targetName: costume.name
            });
        });
    };
    append(targets.stage);
    Object.values(targets.sprites || {}).forEach(append);
    return targetList;
};

const findVmTarget = (runtimeTargets, permissionTargetId) => {
    for (const target of runtimeTargets || []) {
        if (!target || (!target.isStage && !target.isOriginal)) continue;
        const ownerName = target.getName();
        if ((permissionTargetId === 'stage' && target.isStage) ||
            permissionTargetId === `sprite:${ownerName}`) {
            return {costumeIndex: null, target};
        }
        const costumes = (target.sprite && target.sprite.costumes) || [];
        const costumeIndex = costumes.findIndex(costume => (
            getCostumeTargetId(ownerName, costume, target.isStage) === permissionTargetId
        ));
        if (costumeIndex !== -1) return {costumeIndex, target};
    }
    return null;
};

export {
    findVmTarget,
    getCostumeTargetId,
    getSelectedTarget,
    listPermissionTargets
};
