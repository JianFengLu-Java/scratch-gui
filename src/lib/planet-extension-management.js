// Closing an unused extension removes its palette. Keep VM registration intact so enabling
// it again cannot evaluate an unsandboxed script twice or duplicate its event listeners.
export const EXTENSION_STATE_CHANGED = 'PLANET_EXTENSION_STATE_CHANGED';
const sessions = new WeakMap();
const matchesExtension = (opcode, id) => typeof opcode === 'string' && opcode.startsWith(`${id}_`);

export const getExtensionUsage = (vm, id) => {
    let blocks = 0;
    let monitors = 0;
    for (const target of vm.runtime.targets) {
        for (const block of Object.values(target.blocks._blocks)) {
            if (matchesExtension(block.opcode, id)) blocks++;
        }
    }
    vm.runtime.getMonitorState().valueSeq()
        .forEach(monitor => {
            if (monitor.visible && matchesExtension(monitor.opcode, id)) monitors++;
        });
    return {blocks, monitors};
};

export const installExtensionManagement = vm => {
    if (sessions.has(vm)) return sessions.get(vm);
    const session = {closed: new Set(), loading: new Map()};
    sessions.set(vm, session);
    // Project imports and backpack blocks may introduce an extension that was closed.
    // Existing blocks always take precedence over palette preferences.
    vm.on('PROJECT_CHANGED', () => {
        let changed = false;
        for (const id of session.closed) {
            const usage = getExtensionUsage(vm, id);
            if (usage.blocks || usage.monitors) {
                session.closed.delete(id);
                changed = true;
            }
        }
        if (changed) vm.emit(EXTENSION_STATE_CHANGED);
    });
    vm.runtime.on('PROJECT_LOADED', () => {
        session.closed.clear();
        vm.emit(EXTENSION_STATE_CHANGED);
    });
    return session;
};

export const isExtensionEnabled = (vm, id) => (
    vm.extensionManager.isExtensionLoaded(id) && !installExtensionManagement(vm).closed.has(id)
);

export const getEnabledExtensionCategories = (vm, target) => {
    const {closed} = installExtensionManagement(vm);
    return vm.runtime.getBlocksXML(target).filter(category => !closed.has(category.id));
};

export const getRegisteredExtensions = vm => vm.runtime._blockInfo
    .filter(category => vm.extensionManager.isExtensionLoaded(category.id))
    .map(category => ({
        id: category.id,
        name: category.name,
        iconURL: category.menuIconURI || category.blockIconURI,
        enabled: isExtensionEnabled(vm, category.id)
    }));

export const closeExtension = (vm, id) => {
    if (!vm.extensionManager.isExtensionLoaded(id)) return;
    const usage = getExtensionUsage(vm, id);
    if (usage.blocks || usage.monitors) {
        const error = new Error('项目仍在使用此扩展的积木或监视器，请先移除相关积木并取消监视器，再关闭。');
        error.code = 'EXTENSION_IN_USE';
        throw error;
    }
    installExtensionManagement(vm).closed.add(id);
    vm.emit(EXTENSION_STATE_CHANGED);
};

export const enableExtension = async (vm, id, url = id) => {
    const session = installExtensionManagement(vm);
    if (!vm.extensionManager.isExtensionLoaded(id)) {
        if (!session.loading.has(url)) {
            const pending = vm.extensionManager.loadExtensionURL(url)
                .finally(() => session.loading.delete(url));
            session.loading.set(url, pending);
        }
        await session.loading.get(url);
    }
    session.closed.delete(id);
    vm.emit(EXTENSION_STATE_CHANGED);
};
