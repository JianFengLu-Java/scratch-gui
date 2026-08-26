import {
    findVmTarget,
    getSelectedTarget,
    listPermissionTargets
} from '../../../src/lib/planet-collaboration-targets';

const costume = {
    assetId: '0f1e2d3c4b5a69788796a5b4c3d2e1f0',
    name: '行走'
};

const targets = {
    editingTarget: 'sprite-1',
    sprites: {
        'sprite-1': {
            costumes: [costume],
            currentCostume: 0,
            id: 'sprite-1',
            isStage: false,
            name: '星球猫'
        }
    },
    stage: {
        costumes: [{assetId: 'backdrop-asset', name: '太空'}],
        currentCostume: 0,
        id: 'stage-1',
        isStage: true,
        name: '舞台'
    }
};

describe('planet collaboration targets', () => {
    test('lists stage, sprites and their costumes as separate targets', () => {
        const result = listPermissionTargets(targets);

        expect(result.map(target => target.kind)).toEqual([
            'stage',
            'costume',
            'sprite',
            'costume'
        ]);
        expect(result[3]).toMatchObject({parentName: '星球猫', targetName: '行走'});
        expect(result[3].targetId).toMatch(/^costume:sprite-[a-z0-9]+:/);
    });

    test('uses the active costume while the costume editor is open', () => {
        const listedCostume = listPermissionTargets(targets)[3];
        const selected = getSelectedTarget(targets, true);

        expect(selected.targetId).toBe(listedCostume.targetId);
        expect(selected.targetName).toBe('行走 · 星球猫');
    });

    test('restores the owner and costume index after a remote project update', () => {
        const listedCostume = listPermissionTargets(targets)[3];
        const runtimeTarget = {
            getName: () => '星球猫',
            isOriginal: true,
            isStage: false,
            sprite: {costumes: [costume]}
        };

        expect(findVmTarget([runtimeTarget], listedCostume.targetId)).toEqual({
            costumeIndex: 0,
            target: runtimeTarget
        });
    });
});
