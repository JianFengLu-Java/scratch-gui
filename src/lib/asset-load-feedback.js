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

const updateAssetLoad = (loadId, finished, total) => {
    publish({finished, loadId, total, type: 'progress'});
};

const finishAssetLoad = (loadId, name, status) => {
    publish({loadId, name, status, type: 'finish'});
};

export {
    finishAssetLoad,
    startAssetLoad,
    subscribeAssetLoadFeedback,
    updateAssetLoad
};
