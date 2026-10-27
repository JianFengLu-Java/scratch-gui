const safeFileName = value => (value || '未命名作品')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim() || '未命名作品';

const dataUriToFile = (dataUri, title) => {
    const match = /^data:(image\/[^;,]+);base64,([a-z\d+/]+={0,2})$/i.exec(dataUri || '');
    if (!match) throw new Error('舞台截图格式无效，请改为上传封面图片。');
    const binary = window.atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return new File([bytes], `${safeFileName(title)}-舞台.png`, {type: match[1] || 'image/png'});
};

const compressedDataUriToFile = (dataUri, title) => new Promise(resolve => {
    // Validate inside the Promise executor so decoding failures reject the capture.
    // Async image/canvas callbacks can then fall back without throwing outside it.
    const originalFile = dataUriToFile(dataUri, title);
    const image = new Image();
    image.onload = () => {
        try {
            const naturalWidth = image.naturalWidth || image.width;
            const naturalHeight = image.naturalHeight || image.height;
            const scale = Math.min(1, 640 / Math.max(naturalWidth, naturalHeight));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(naturalHeight * scale));
            const context = canvas.getContext('2d');
            if (!context || typeof canvas.toBlob !== 'function') {
                resolve(originalFile);
                return;
            }
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(blob => {
                try {
                    if (!blob) {
                        resolve(originalFile);
                        return;
                    }
                    const extension = blob.type === 'image/webp' ? 'webp' : 'png';
                    resolve(new File([blob], `${safeFileName(title)}-舞台.${extension}`, {
                        type: blob.type || 'image/png'
                    }));
                } catch (error) {
                    resolve(originalFile);
                }
            }, 'image/webp', 0.76);
        } catch (error) {
            resolve(originalFile);
        }
    };
    image.onerror = () => resolve(originalFile);
    image.src = dataUri;
});

export const capturePlanetStageCover = (vm, title, options = {}) => new Promise((resolve, reject) => {
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
        const renderer = vm.renderer;
        // A hidden stage must still have a backing canvas for autosave covers.
        if (renderer.canvas && (!renderer.canvas.width || !renderer.canvas.height)) {
            const [width, height] = renderer.getNativeSize();
            renderer.resize(width, height);
        }
        vm.postIOData('video', {forceTransparentPreview: true});
        renderer.requestSnapshot(dataUri => {
            if (settled) return;
            Promise.resolve().then(() => (options.compress ? compressedDataUriToFile(dataUri, title) :
                dataUriToFile(dataUri, title))).then(succeed, fail);
        });
        renderer.draw();
    } catch (error) {
        fail(new Error('生成舞台封面失败，请重试或上传封面图片。'));
    }
});
