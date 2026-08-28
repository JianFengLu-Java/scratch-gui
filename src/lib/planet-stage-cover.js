const safeFileName = value => (value || '未命名作品')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim() || '未命名作品';

const dataUriToFile = (dataUri, title) => {
    const match = /^data:([^;,]+);base64,(.*)$/i.exec(dataUri || '');
    if (!match) throw new Error('舞台截图格式无效，请改为上传封面图片。');
    const binary = window.atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return new File([bytes], `${safeFileName(title)}-舞台.png`, {type: match[1] || 'image/png'});
};

export const capturePlanetStageCover = (vm, title) => new Promise((resolve, reject) => {
    if (!vm || !vm.renderer || typeof vm.renderer.requestSnapshot !== 'function') {
        reject(new Error('当前项目暂时无法读取舞台，请改为上传封面图片。'));
        return;
    }

    let settled = false;
    let timeout = null;
    const finish = callback => value => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        try {
            vm.postIOData('video', {forceTransparentPreview: false});
        } catch (error) {
            // Restoring the video preview is best effort and must not hide the cover result.
        }
        callback(value);
    };
    const succeed = finish(resolve);
    const fail = finish(reject);
    timeout = setTimeout(() => fail(new Error('舞台截图超时，请重试或上传封面图片。')), 5000);

    try {
        vm.postIOData('video', {forceTransparentPreview: true});
        vm.renderer.requestSnapshot(dataUri => {
            try {
                succeed(dataUriToFile(dataUri, title));
            } catch (error) {
                fail(error);
            }
        });
        vm.renderer.draw();
    } catch (error) {
        fail(new Error('生成舞台封面失败，请重试或上传封面图片。'));
    }
});
