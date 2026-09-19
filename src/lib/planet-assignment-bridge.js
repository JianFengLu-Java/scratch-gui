
const params = new URLSearchParams(location.search);
const enabled = params.get('assignment') === '1';
const channel = params.get('channel');
const parentOrigin = params.get('parentOrigin');
const readOnly = params.get('readonly') === 'true';
const MAX_BYTES = 20 * 1024 * 1024;
let vm;
let ready = false;
let loading = false;
const send = (type, extra = {}) => {
    if (!channel || !parentOrigin || parentOrigin === '*' || window.parent === window) return;
    window.parent.postMessage({type, channel, ...extra}, parentOrigin === 'null' ? '*' : parentOrigin);
};
window.addEventListener('message', async event => {
    if (!enabled || event.source !== window.parent || event.origin !== parentOrigin || !event.data ||
        event.data.channel !== channel || !ready || !vm) return;
    const {type, requestId, data} = event.data;
    if (type === 'ASSIGNMENT_PING') return send('ASSIGNMENT_READY');
    if (loading) return;
    try {
        if (type === 'ASSIGNMENT_LOAD') {
            if (!(data instanceof ArrayBuffer) || !data.byteLength || data.byteLength > MAX_BYTES) {
                throw new Error('作品文件无效或超过 20 MB');
            }
            loading = true;
            vm.stopAll();
            await vm.loadProject(data);
            send('ASSIGNMENT_LOADED', {requestId});
        } else if (type === 'ASSIGNMENT_EXPORT' && !readOnly) {
            loading = true;
            const blob = await vm.saveProjectSb3();
            if (blob.size > MAX_BYTES) throw new Error('作品超过 20 MB，请减少素材后保存');
            send('ASSIGNMENT_EXPORTED', {requestId, data: await blob.arrayBuffer()});
        }
    } catch (error) {
        send('ASSIGNMENT_ERROR', {requestId, message: error.message || '作品处理失败'});
    } finally {
        loading = false;
    }
});
export const assignmentEditorProps = {
    backpackVisible: false, canCreateCopy: false, canCreateNew: false, canEditTitle: false,
    canManageFiles: false, canRemix: false, canSave: false, canShare: false,
    canUseCloud: false, enableCommunity: false, hasCloudPermission: false, readOnly,
    onVmInit: value => {
        vm = value;
        vm.on('PROJECT_CHANGED', () => {
            if (ready && !loading && !readOnly) send('ASSIGNMENT_DIRTY');
        });
    },
    onProjectLoaded: () => { ready = true; send('ASSIGNMENT_READY'); }
};

if (enabled && readOnly) {
    const block = event => {
        if (event.target instanceof Element && event.target.closest('.blocklyDraggable,.blocklyFlyoutButton,.blocklyWorkspaceComment')) {
            event.preventDefault(); event.stopImmediatePropagation();
        }
    };
    ['pointerdown', 'mousedown', 'touchstart', 'click', 'dblclick', 'contextmenu'].forEach(type => {
        document.addEventListener(type, block, {capture: true, passive: false});
    });
}
