const ASSET_LIBRARY_API = '/backend-api/editor-assets/libraries';

// Do not cache the remote manifest: opening a library should reflect admin CRUD
// changes immediately. Bundled manifests remain an offline/startup fallback.
const asyncLibrary = (type, fallback) => () => fetch(`${ASSET_LIBRARY_API}/${type}`, {
    credentials: 'same-origin'
})
    .then(response => {
        if (!response.ok) throw new Error(`Asset library request failed: ${response.status}`);
        return response.json();
    })
    .then(envelope => {
        if (envelope.code !== 'OK' || !Array.isArray(envelope.data)) {
            throw new Error('Asset library response is invalid');
        }
        return envelope.data;
    })
    .catch(() => fallback().then(mod => mod.default));

export const getBackdropLibrary = asyncLibrary(
    'BACKDROP',
    () => import(/* webpackChunkName: "library-backdrops" */ './backdrops.json')
);
export const getCostumeLibrary = asyncLibrary(
    'COSTUME',
    () => import(/* webpackChunkName: "library-costumes" */ './costumes.json')
);
export const getSoundLibrary = asyncLibrary(
    'SOUND',
    () => import(/* webpackChunkName: "library-sounds" */ './sounds.json')
);
export const getSpriteLibrary = asyncLibrary(
    'SPRITE',
    () => import(/* webpackChunkName: "library-sprites" */ './sprites.json')
);
