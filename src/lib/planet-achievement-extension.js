import BlockType from 'scratch-vm/src/extension-support/block-type';
import ArgumentType from 'scratch-vm/src/extension-support/argument-type';
import {readPlanetEnvelope, refreshPlanetSession} from './planet-session';

export const ACHIEVEMENT_EXTENSION_ID = 'planetachievement';
export const ACHIEVEMENT_NOTICE = 'PLANET_ACHIEVEMENT_NOTICE';
export const achievementIcon = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="16" fill="#3676c8"/>' +
    '<g fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M27 18h26v17a13 13 0 0 1-26 0zM27 22H18v7a13 13 0 0 0 13 13M53 22h9v7a13 13 0 0 1-13 13' +
    'M40 48v13M28 63h24"/></g></svg>'
)}`;

const installed = new WeakMap();
const projectId = () => {
    const match = location.pathname.match(/^\/create\/(\d+)\/editor\/?$/);
    return match ? match[1] : null;
};

// Only a fixed, parent-owned API bridge is exposed to game scripts. No account tokens cross the frame boundary.
const createPlayerBridge = onReset => {
    const params = new URLSearchParams(location.search);
    const channel = params.get('achievementChannel');
    if (window.parent === window || !channel || !/^\/create\/embed\.html$/.test(location.pathname)) return null;
    const pending = new Map();
    window.addEventListener('message', event => {
        if (event.source !== window.parent || event.origin !== location.origin ||
            !event.data || event.data.channel !== channel) return;
        if (event.data.type === 'PLANET_ACHIEVEMENT_RESET') {
            for (const request of pending.values()) {
                clearTimeout(request.timer);
                request.reject(new Error('登录状态已变化，请重新触发成就'));
            }
            pending.clear();
            onReset();
            return;
        }
        if (event.data.type !== 'PLANET_ACHIEVEMENT_REPLY') return;
        const request = pending.get(event.data.requestId);
        if (!request) return;
        pending.delete(event.data.requestId);
        clearTimeout(request.timer);
        if (event.data.error) request.reject(new Error(String(event.data.error)));
        else request.resolve(event.data.result);
    });
    return (action, achievementId) => new Promise((resolve, reject) => {
        const requestId = crypto.randomUUID();
        const timer = setTimeout(() => {
            pending.delete(requestId);
            reject(new Error('成就服务暂时没有响应，请稍后重试'));
        }, 12000);
        pending.set(requestId, {resolve, reject, timer});
        window.parent.postMessage({type: 'PLANET_ACHIEVEMENT_REQUEST',
            channel,
            requestId,
            action,
            achievementId}, location.origin);
    });
};

export class PlanetAchievementClient {
    constructor (runtime, options) {
        this.runtime = runtime;
        this.options = options;
        this.items = [];
        this.previewEarned = new Set();
        this.pending = new Map();
        this.retryAfter = new Map();
        this.lastResult = '';
        this.generation = 0;
        this.ready = Promise.resolve();
    }
    notice (message) {
        this.lastResult = message;
        this.runtime.emit(ACHIEVEMENT_NOTICE, message);
    }
    reload () {
        const generation = ++this.generation;
        this.items = [];
        this.previewEarned.clear();
        this.pending.clear();
        this.retryAfter.clear();
        this.lastResult = '';
        this.ready = Promise.resolve().then(() => this.options.list())
            .then(items => {
                if (generation === this.generation) this.items = items.filter(item => item.enabled).slice(0, 32);
            })
            .catch(error => {
                if (generation === this.generation) this.lastResult = error.message;
            });
        return this.ready;
    }
    menu () {
        return this.items.length ? this.items.map(item => ({text: item.name, value: item.id})) :
            [{text: '请选择成就', value: '0'}];
    }
    async has (id) {
        await this.ready;
        const item = this.items.find(value => value.id === id);
        return Boolean(item && (item.earned || this.previewEarned.has(id)));
    }
    unlock (id) {
        if (this.pending.has(id)) return this.pending.get(id);
        const generation = this.generation;
        const request = this.performUnlock(id, generation).finally(() => {
            if (this.pending.get(id) === request) this.pending.delete(id);
        });
        this.pending.set(id, request);
        return request;
    }
    async performUnlock (id, generation) {
        await this.ready;
        if (generation !== this.generation) return;
        const item = this.items.find(value => value.id === id);
        if (!item) {
            this.lastResult = '请从当前项目的成就列表中选择徽章';
            return;
        }
        if (item.earned || this.previewEarned.has(id) || (this.retryAfter.get(id) || 0) > Date.now()) return;
        if (this.options.preview) {
            this.previewEarned.add(id);
            this.notice(`预览获得成就：${item.name}（正式游玩时领取）`);
            return;
        }
        try {
            const result = await this.options.claim(id);
            if (generation !== this.generation) return;
            item.earned = true;
            this.lastResult = result.firstAward ? `获得成就：${item.name}` : `已获得成就：${item.name}`;
        } catch (error) {
            if (generation !== this.generation) return;
            this.retryAfter.set(id, Date.now() + 3000);
            this.lastResult = error.message;
            this.notice(error.message);
        }
    }
}

export class PlanetAchievementExtension {
    constructor (runtime) {
        this.client = runtime.planetAchievementClient;
    }
    getInfo () {
        return {
            id: ACHIEVEMENT_EXTENSION_ID,
            name: '游戏成就',
            color1: '#3676c8',
            color2: '#2e63aa',
            color3: '#26548f',
            menuIconURI: achievementIcon,
            blockIconURI: achievementIcon,
            blocks: [
                {opcode: 'unlock',
                    blockType: BlockType.COMMAND,
                    text: '获得成就 [ACHIEVEMENT]',
                    arguments: {ACHIEVEMENT: {type: ArgumentType.STRING, menu: 'achievements', defaultValue: '0'}}},
                {opcode: 'has',
                    blockType: BlockType.BOOLEAN,
                    text: '已获得成就 [ACHIEVEMENT]？',
                    disableMonitor: true,
                    arguments: {ACHIEVEMENT: {type: ArgumentType.STRING, menu: 'achievements', defaultValue: '0'}}},
                {opcode: 'result', blockType: BlockType.REPORTER, text: '成就操作结果', disableMonitor: true},
                {blockType: BlockType.BUTTON, text: '管理成就', func: 'manage'},
                {blockType: BlockType.BUTTON, text: '刷新成就列表', func: 'refresh'}
            ],
            menus: {achievements: {acceptReporters: false, items: 'achievementMenu'}}
        };
    }
    achievementMenu () {
        return this.client.menu();
    }
    unlock (args) {
        return this.client.unlock(String(args.ACHIEVEMENT));
    }
    has (args) {
        return this.client.has(String(args.ACHIEVEMENT));
    }
    result () {
        return this.client.lastResult;
    }
    manage () {
        this.client.options.manage();
    }
    refresh () {
        return this.client.reload().then(() => {
            this.client.notice(this.client.items.length ? '成就列表已刷新' : this.client.lastResult || '还没有可用的成就');
        });
    }
}

export const installPlanetAchievements = vm => {
    if (installed.has(vm)) return;
    installed.set(vm, true);
    const state = {};
    const bridge = createPlayerBridge(() => state.client.reload());
    const client = new PlanetAchievementClient(vm.runtime, {
        preview: !bridge,
        list: async () => {
            if (bridge) return bridge('list');
            const id = projectId();
            if (!id) throw new Error('请先保存为云端项目，再管理成就');
            const session = await refreshPlanetSession();
            return fetch(`/backend-api/projects/${id}/achievements`, {
                credentials: 'include',
                headers: {Authorization: `${session.tokenType || 'Bearer'} ${session.accessToken}`}
            }).then(readPlanetEnvelope);
        },
        claim: id => bridge('claim', id),
        manage: () => {
            const id = projectId();
            if (!id) return client.notice('请先保存为云端项目，再管理成就');
            vm.runtime.emit('PLANET_ACHIEVEMENT_MANAGE', id);
        }
    });
    state.client = client;
    vm.runtime.planetAchievementClient = client;
    vm.extensionManager.addBuiltinExtension(ACHIEVEMENT_EXTENSION_ID, PlanetAchievementExtension);
    // Install before SB3 deserialization in both the editor and embed runtime.
    vm.extensionManager.loadExtensionURL(ACHIEVEMENT_EXTENSION_ID);
    vm.runtime.on('PROJECT_LOADED', () => client.reload());
    vm.runtime.on('PROJECT_START', () => {
        if (!bridge) client.previewEarned.clear();
    });
    window.addEventListener('focus', () => {
        if (!bridge) client.reload();
    });
    client.reload();
};
