import {fetchCode, fetchSprite} from '../backpack-api';
import {placeInViewport} from './code-payload';

// Capture a destination before loading. Changing the selected sprite while an
// asset downloads must not silently send it to a different target.
const importBackpackItem = async ({item, vm, targetId, workspaceMetrics, isRtl}) => {
    if (item.type === 'sprite') {
        const sprite = await fetchSprite(item.bodyUrl);
        return vm.addSprite(sprite);
    }

    const requireTarget = () => {
        if (!targetId || !vm.runtime.getTargetById(targetId)) {
            throw new Error('目标角色或舞台已不存在，请重新选择');
        }
    };
    requireTarget();
    if (item.type === 'costume') {
        await vm.addCostume(item.body, {name: item.name}, targetId);
    } else if (item.type === 'sound') {
        await vm.addSound({md5: item.body, name: item.name}, targetId);
    } else if (item.type === 'script') {
        const payload = await fetchCode(item.bodyUrl);
        requireTarget();
        const centered = placeInViewport(payload, workspaceMetrics, isRtl);
        await vm.shareBlocksToTarget(centered, targetId);
        vm.runtime.emitProjectChanged();
    } else {
        throw new Error('暂不支持这种书包素材');
    }
    vm.refreshWorkspace();
};

export default importBackpackItem;
