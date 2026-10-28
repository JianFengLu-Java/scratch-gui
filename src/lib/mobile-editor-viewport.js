// Own the viewport only while the mobile editor is mounted. Other pages and
// desktop layouts retain their original browser zoom behavior.
const lockMobileEditorViewport = () => {
    const media = window.matchMedia('(max-width: 1023px)');
    const root = document.documentElement;
    const previousMarker = root.getAttribute('data-mobile-editor-viewport');
    let viewport = null;
    let previousContent = null;
    let created = false;
    const restore = () => {
        if (!viewport) return;
        if (created) viewport.remove();
        else if (previousContent === null) viewport.removeAttribute('content');
        else viewport.setAttribute('content', previousContent);
        if (previousMarker === null) root.removeAttribute('data-mobile-editor-viewport');
        else root.setAttribute('data-mobile-editor-viewport', previousMarker);
        viewport = null;
    };
    const update = () => {
        if (!media.matches) {
            restore();
            return;
        }
        if (viewport) return;
        viewport = document.querySelector('meta[name="viewport"]');
        created = !viewport;
        if (created) {
            viewport = document.createElement('meta');
            viewport.setAttribute('name', 'viewport');
            document.head.appendChild(viewport);
        }
        previousContent = viewport.getAttribute('content');
        viewport.setAttribute('content', 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, ' +
            'user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content');
        root.setAttribute('data-mobile-editor-viewport', 'locked');
    };
    const preventZoom = event => {
        if (media.matches && (event.type !== 'touchmove' || event.touches.length > 1)) event.preventDefault();
    };
    const gestures = ['gesturestart', 'gesturechange', 'gestureend', 'touchmove'];
    gestures.forEach(type => document.addEventListener(type, preventZoom, {capture: true, passive: false}));
    media.addEventListener('change', update);
    update();
    return () => {
        restore();
        media.removeEventListener('change', update);
        gestures.forEach(type => document.removeEventListener(type, preventZoom, true));
    };
};

export default lockMobileEditorViewport;
