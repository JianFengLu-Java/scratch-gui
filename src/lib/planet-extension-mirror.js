// Keep official extension URLs in projects for portability; rewrite only the network load.
const OFFICIAL_ORIGIN = 'https://extensions.turbowarp.org';
const API = '/backend-api/editor-assets/extensions';
let pendingLibrary = null;

const absoluteURL = path => new URL(path, window.location.href).href;

const fetchExtensionLibrary = () => {
    if (!pendingLibrary) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        pendingLibrary = fetch(`${API}/library`, {signal: controller.signal})
            .then(response => {
                if (!response.ok) throw new Error(`Extension mirror HTTP ${response.status}`);
                return response.json();
            })
            .then(response => {
                const data = response.data;
                if (response.code !== 'OK' || !data || !Array.isArray(data.extensions) ||
                    !data.resources || typeof data.resources !== 'object') {
                    throw new Error('Invalid extension mirror catalog');
                }
                return data;
            })
            .catch(error => {
                pendingLibrary = null;
                throw error;
            })
            .finally(() => clearTimeout(timeout));
    }
    return pendingLibrary;
};

const mirroredResourceURL = (library, path) => {
    const sha = library.resources[path];
    if (typeof sha !== 'string' || !/^[a-f0-9]{64}$/.test(sha)) {
        throw new Error(`Extension resource is not mirrored: ${path}`);
    }
    return absoluteURL(`${API}/files/${sha}`);
};

const isMirroredExtensionURL = url => {
    try {
        const parsed = new URL(url);
        const base = new URL(absoluteURL(API));
        // Compare protocol and host as custom desktop schemes have origin === 'null'.
        return parsed.protocol === base.protocol && parsed.host === base.host &&
            !parsed.username && !parsed.password && !parsed.search && !parsed.hash &&
            new RegExp(`^${API}/files/[a-f0-9]{64}$`).test(parsed.pathname);
    } catch (e) {
        return false;
    }
};

const rewriteExtensionURL = async url => {
    let parsed;
    try {
        parsed = new URL(url);
    } catch (e) {
        return url;
    }
    if (parsed.origin !== OFFICIAL_ORIGIN) return url;
    const library = await fetchExtensionLibrary();
    return mirroredResourceURL(library, decodeURIComponent(parsed.pathname.slice(1)));
};

export {fetchExtensionLibrary, mirroredResourceURL, isMirroredExtensionURL, rewriteExtensionURL};
