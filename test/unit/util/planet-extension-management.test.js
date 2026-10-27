jest.mock('scratch-render-fonts', () => () => ({}), {virtual: true});
import VM from 'scratch-vm/src/virtual-machine';
import MonitorRecord from 'scratch-vm/src/engine/monitor-record';
import {
    closeExtension, enableExtension, getEnabledExtensionCategories, getExtensionUsage,
    getRegisteredExtensions, installExtensionManagement, isExtensionEnabled
} from '../../../src/lib/planet-extension-management';

let registrations;
class TestExtension {
    constructor () {
        registrations++;
    }
    getInfo () {
        return {id: 'testextension', name: 'Test extension',
            blocks: [{opcode: 'noop', blockType: 'command', text: 'test block'}]};
    }
    noop () {}
}

const blankTarget = (isStage, name) => ({
    isStage, name, variables: {}, lists: {}, broadcasts: {}, blocks: {},
    comments: {}, currentCostume: 0, costumes: [], sounds: [], volume: 100,
    layerOrder: 0, tempo: 60, videoTransparency: 50, videoState: 'off'
});
const blankProject = () => ({targets: [blankTarget(true, 'Stage'), blankTarget(false, 'Sprite')],
    monitors: [], extensions: [], meta: {semver: '3.0.0', vm: '0.2.0', agent: 'test'}});

let vm;
beforeEach(async () => {
    registrations = 0;
    vm = new VM();
    vm.extensionManager.addBuiltinExtension('testextension', TestExtension);
    installExtensionManagement(vm);
    await vm.loadProject(blankProject());
});
afterEach(() => vm.quit());

test('enable, close and enable again update the palette without evaluating the extension twice', async () => {
    await enableExtension(vm, 'testextension');
    expect(getEnabledExtensionCategories(vm).map(category => category.id)).toContain('testextension');
    closeExtension(vm, 'testextension');
    expect(isExtensionEnabled(vm, 'testextension')).toBe(false);
    expect(getEnabledExtensionCategories(vm).map(category => category.id)).not.toContain('testextension');
    expect(getRegisteredExtensions(vm)).toContainEqual(expect.objectContaining({id: 'testextension', enabled: false}));
    await enableExtension(vm, 'testextension');
    expect(isExtensionEnabled(vm, 'testextension')).toBe(true);
    expect(getEnabledExtensionCategories(vm).map(category => category.id)).toContain('testextension');
    expect(registrations).toBe(1);
});

test.each([0, 1])('loose blocks on target %s prevent closing; project data is preserved', async index => {
    await enableExtension(vm, 'testextension');
    const target = vm.runtime.targets[index];
    target.blocks.createBlock({id: 'loose', opcode: 'testextension_noop', next: null,
        parent: null, topLevel: true, inputs: {}, fields: {}, shadow: false});
    const before = vm.toJSON();
    expect(getExtensionUsage(vm, 'testextension').blocks).toBe(1);
    expect(() => closeExtension(vm, 'testextension')).toThrow('先移除相关积木');
    expect(isExtensionEnabled(vm, 'testextension')).toBe(true);
    expect(vm.toJSON()).toBe(before);
    target.blocks.deleteBlock('loose');
    closeExtension(vm, 'testextension');
    expect(isExtensionEnabled(vm, 'testextension')).toBe(false);
});

test('a visible extension monitor prevents closing; hidden monitors do not trap the user', async () => {
    await enableExtension(vm, 'testextension');
    vm.runtime.requestAddMonitor(new MonitorRecord({id: 'monitor', opcode: 'testextension_value', visible: true}));
    expect(() => closeExtension(vm, 'testextension')).toThrow('监视器');
    vm.runtime.requestUpdateMonitor({id: 'monitor', visible: false});
    closeExtension(vm, 'testextension');
    expect(isExtensionEnabled(vm, 'testextension')).toBe(false);
});

test('importing blocks automatically restores a closed category and project reload clears palette preferences', async () => {
    await enableExtension(vm, 'testextension');
    closeExtension(vm, 'testextension');
    vm.runtime.getTargetForStage().blocks.createBlock({id: 'imported', opcode: 'testextension_noop',
        next: null, parent: null, topLevel: true, inputs: {}, fields: {}, shadow: false});
    vm.runtime.emitProjectChanged();
    expect(isExtensionEnabled(vm, 'testextension')).toBe(true);
    vm.runtime.getTargetForStage().blocks.deleteBlock('imported');
    closeExtension(vm, 'testextension');
    await vm.loadProject(blankProject());
    expect(isExtensionEnabled(vm, 'testextension')).toBe(true);
});

test('failed extension loads leave the extension closed and a later retry can succeed', async () => {
    const load = jest.spyOn(vm.extensionManager, 'loadExtensionURL').mockRejectedValueOnce(new Error('network failed'));
    await expect(enableExtension(vm, 'testextension')).rejects.toThrow('network failed');
    expect(isExtensionEnabled(vm, 'testextension')).toBe(false);
    await enableExtension(vm, 'testextension');
    expect(load).toHaveBeenCalledTimes(2);
    expect(isExtensionEnabled(vm, 'testextension')).toBe(true);
});
