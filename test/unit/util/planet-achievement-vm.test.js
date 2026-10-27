// Font embedding is unrelated to execution; this headless VM has no renderer or costumes.
jest.mock('scratch-render-fonts', () => () => ({}), {virtual: true});
import VM from 'scratch-vm/src/virtual-machine';
import {PlanetAchievementClient, PlanetAchievementExtension} from '../../../src/lib/planet-achievement-extension';

const project = () => ({
    targets: [{
        isStage: true, name: 'Stage', variables: {result: ['result', 0]}, lists: {}, broadcasts: {},
        blocks: {
            flag: {opcode: 'event_whenflagclicked', next: 'unlock', parent: null, inputs: {}, fields: {},
                shadow: false, topLevel: true, x: 0, y: 0},
            unlock: {opcode: 'planetachievement_unlock', next: 'if', parent: 'flag',
                inputs: {ACHIEVEMENT: [1, [10, '42']]}, fields: {}, shadow: false, topLevel: false},
            if: {opcode: 'control_if', next: null, parent: 'unlock',
                inputs: {CONDITION: [2, 'has'], SUBSTACK: [2, 'set']}, fields: {}, shadow: false, topLevel: false},
            has: {opcode: 'planetachievement_has', next: null, parent: 'if',
                inputs: {ACHIEVEMENT: [1, [10, '42']]}, fields: {}, shadow: false, topLevel: false},
            set: {opcode: 'data_setvariableto', next: null, parent: 'if',
                inputs: {VALUE: [1, [4, '1']]}, fields: {VARIABLE: ['result', 'result']}, shadow: false, topLevel: false}
        },
        comments: {}, currentCostume: 0, costumes: [], sounds: [], volume: 100,
        layerOrder: 0, tempo: 60, videoTransparency: 50, videoState: 'on', textToSpeechLanguage: null
    }],
    monitors: [], extensions: ['planetachievement'], meta: {semver: '3.0.0', vm: '0.2.0', agent: 'test'}
});

test.each([false, true])('real VM executes and reloads achievement blocks (compiler=%s)', async enabled => {
    const vm = new VM();
    const claim = jest.fn(async () => ({firstAward: true}));
    const client = new PlanetAchievementClient(vm.runtime, {
        list: async () => [{id: '42', name: '通关', enabled: true}], claim
    });
    vm.runtime.planetAchievementClient = client;
    vm.extensionManager.addBuiltinExtension('planetachievement', PlanetAchievementExtension);
    await vm.extensionManager.loadExtensionURL('planetachievement');
    await vm.loadProject(project());
    vm.setCompilerOptions({enabled});
    await client.reload();
    vm.greenFlag();
    if (enabled) expect(vm.runtime.threads[0].isCompiled).toBe(true);
    for (let tick = 0; tick < 30; tick++) {
        vm.runtime._step();
        await Promise.resolve();
    }
    expect(Number(vm.runtime.getTargetForStage().variables.result.value)).toBe(1);
    expect(claim).toHaveBeenCalledTimes(1);
    const saved = JSON.parse(vm.toJSON());
    expect(saved.extensions).toContain('planetachievement');
    const savedUnlock = Object.values(saved.targets[0].blocks)
        .find(block => block.opcode === 'planetachievement_unlock');
    expect(savedUnlock.inputs.ACHIEVEMENT[1][1]).toBe('42');
    await vm.loadProject(saved);
    expect(Object.values(vm.runtime.getTargetForStage().blocks._blocks)
        .some(block => block.opcode === 'planetachievement_unlock')).toBe(true);
    vm.quit();
});
