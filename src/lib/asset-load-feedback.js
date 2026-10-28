let nextLoadId = 0;
const listeners = [];

const publish = event => {
    listeners.slice().forEach(listener => listener(event));
};

const subscribeAssetLoadFeedback = listener => {
    listeners.push(listener);
    return () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) listeners.splice(index, 1);
    };
};

const startAssetLoad = (assetType, name) => {
    const loadId = ++nextLoadId;
    publish({assetType, loadId, name, type: 'start'});
    return loadId;
};

const updateAssetLoad = (loadId, finished, total, name) => {
    publish({finished, loadId, total, name, type: 'progress'});
};

const finishAssetLoad = (loadId, name, status) => {
    publish({loadId, name, status, type: 'finish'});
};

const loadAssetWithFeedback = (vm, assetType, initialName, operation) => {
    const loadId = startAssetLoad(assetType, initialName);
    const baselineFinished = vm.runtime.finishedAssetRequests;
    const baselineTotal = vm.runtime.totalAssetRequests;
    let name = initialName;
    const progress = () => updateAssetLoad(loadId,
        Math.max(0, vm.runtime.finishedAssetRequests - baselineFinished),
        Math.max(0, vm.runtime.totalAssetRequests - baselineTotal), name);
    const setName = value => {
        name = value;
        progress();
    };
    vm.on('ASSET_PROGRESS', progress);
    return Promise.resolve()
        .then(() => operation(setName))
        .then(result => {
            finishAssetLoad(loadId, name, 'success');
            return result;
        }, error => {
            finishAssetLoad(loadId, name, 'error');
            throw error;
        })
        .finally(() => vm.off('ASSET_PROGRESS', progress));
};

export {
    finishAssetLoad,
    startAssetLoad,
    loadAssetWithFeedback,
    subscribeAssetLoadFeedback,
    updateAssetLoad
};
