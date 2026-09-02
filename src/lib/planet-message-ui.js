let pendingRuntime = null;

const availableRuntime = () => {
    const runtime = window.PlanetMessageUi;
    return runtime && runtime.messageUiVersion >= 4 && typeof runtime.mountBubbleMessage === 'function' &&
        typeof runtime.mountComposer === 'function' &&
        typeof runtime.splitEifEmojiTokens === 'function' ? runtime : null;
};

// Built from frontend-web's RichMessageComposer and EifEmojiPicker. Keep its
// React 19 runtime isolated instead of importing it into the editor's React 16.
export const loadPlanetMessageUi = () => {
    const runtime = availableRuntime();
    if (runtime) return Promise.resolve(runtime);
    if (pendingRuntime) return pendingRuntime;

    pendingRuntime = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        let timeout = null;
        const finish = error => {
            clearTimeout(timeout);
            script.onload = null;
            script.onerror = null;
            if (error) {
                script.remove();
                reject(error);
            } else {
                resolve(availableRuntime());
            }
        };
        timeout = setTimeout(() => finish(new Error('消息输入框加载超时')), 15000);
        script.src = '/editor-chat-ui/runtime.js?v=4';
        script.async = true;
        script.onload = () => finish(availableRuntime() ? null : new Error('消息组件不可用'));
        script.onerror = () => finish(new Error('消息输入框加载失败'));
        document.head.appendChild(script);
    }).catch(error => {
        pendingRuntime = null;
        throw error;
    });
    return pendingRuntime;
};
