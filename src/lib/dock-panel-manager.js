const CASCADE_OFFSETS = [
    {x: 0, y: 0},
    {x: 24, y: 22},
    {x: -24, y: 44},
    {x: 48, y: 66},
    {x: -48, y: 88}
];

const panelRecords = new Map();
let panelStack = [];
let nextInstanceId = 0;
let listeningForEscape = false;

const syncPanelStack = () => {
    const topPanelKey = panelStack[panelStack.length - 1];
    panelStack.forEach((panelKey, index) => {
        const record = panelRecords.get(panelKey);
        if (!record) return;
        record.element.style.setProperty('--dock-panel-stack-index', String(index));
        record.element.setAttribute('data-dock-panel-active', String(panelKey === topPanelKey));
    });
};

const handleEscape = event => {
    if (event.defaultPrevented || event.repeat || event.key !== 'Escape') return;
    const topPanelKey = panelStack[panelStack.length - 1];
    const record = panelRecords.get(topPanelKey);
    if (!record) return;

    const target = event.target;
    const modal = target && typeof target.closest === 'function' ?
        target.closest('[role="dialog"][aria-modal="true"]') : null;
    if (modal && !modal.hasAttribute('data-dock-panel')) return;

    event.preventDefault();
    record.onClose();
};

const updateEscapeListener = () => {
    if (panelRecords.size > 0 && !listeningForEscape) {
        document.addEventListener('keydown', handleEscape);
        listeningForEscape = true;
    } else if (panelRecords.size === 0 && listeningForEscape) {
        document.removeEventListener('keydown', handleEscape);
        listeningForEscape = false;
    }
};

const claimCascadeSlot = () => {
    const occupiedSlots = new Set([...panelRecords.values()].map(record => record.cascadeSlot));
    let availableSlot = 0;
    while (availableSlot < CASCADE_OFFSETS.length && occupiedSlots.has(availableSlot)) {
        availableSlot += 1;
    }
    if (availableSlot < CASCADE_OFFSETS.length) return availableSlot;
    return panelRecords.size % CASCADE_OFFSETS.length;
};

export const registerDockPanel = (panelId, element, onClose) => {
    const panelKey = `${panelId}:${nextInstanceId}`;
    nextInstanceId += 1;
    const cascadeSlot = claimCascadeSlot();
    const cascade = CASCADE_OFFSETS[cascadeSlot];
    let registered = true;

    panelRecords.set(panelKey, {
        cascadeSlot,
        element,
        onClose
    });
    panelStack = [...panelStack, panelKey];
    element.style.setProperty('--dock-panel-cascade-x', `${cascade.x}px`);
    element.style.setProperty('--dock-panel-cascade-y', `${cascade.y}px`);
    syncPanelStack();
    updateEscapeListener();

    return Object.freeze({
        activate: () => {
            if (!registered || panelStack[panelStack.length - 1] === panelKey) return;
            panelStack = [...panelStack.filter(key => key !== panelKey), panelKey];
            syncPanelStack();
        },
        unregister: () => {
            if (!registered) return;
            registered = false;
            panelRecords.delete(panelKey);
            panelStack = panelStack.filter(key => key !== panelKey);
            syncPanelStack();
            updateEscapeListener();
        }
    });
};
