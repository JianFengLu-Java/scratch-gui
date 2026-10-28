// Route touch dragging through Scratch Paint's existing wheel pan handler. It
// updates the view and scrollbars without changing the image or active tool.
const attachMobilePaintPan = canvas => {
    const media = window.matchMedia('(max-width: 1023px)');
    let enabled = false;
    let drag = null;
    let frame = null;
    let deltaX = 0;
    let deltaY = 0;
    let point = null;
    const active = () => enabled && media.matches;
    const consume = event => {
        event.preventDefault();
        event.stopImmediatePropagation();
    };
    const flush = () => {
        frame = null;
        const x = deltaX;
        const y = deltaY;
        deltaX = 0;
        deltaY = 0;
        if (!point || (!x && !y)) return;
        canvas.dispatchEvent(new WheelEvent('wheel', {
            bubbles: true,
            cancelable: true,
            deltaMode: 0,
            deltaX: -x,
            deltaY: -y,
            clientX: point.x,
            clientY: point.y
        }));
    };
    const cancel = () => {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        deltaX = 0;
        deltaY = 0;
        const pointer = drag && drag.id;
        drag = null;
        canvas.removeAttribute('data-paint-pan-dragging');
        if (pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
    };
    const updateMode = () => {
        if (active()) canvas.setAttribute('data-paint-pan-mode', 'true');
        else {
            cancel();
            canvas.removeAttribute('data-paint-pan-mode');
        }
    };
    const start = event => {
        if (!active() || event.button !== 0) return;
        consume(event);
        if (drag) return;
        drag = {id: event.pointerId, x: event.clientX, y: event.clientY};
        point = {x: event.clientX, y: event.clientY};
        canvas.setPointerCapture(event.pointerId);
        canvas.setAttribute('data-paint-pan-dragging', 'true');
    };
    const move = event => {
        if (!drag || drag.id !== event.pointerId) return;
        consume(event);
        deltaX += event.clientX - drag.x;
        deltaY += event.clientY - drag.y;
        drag.x = event.clientX;
        drag.y = event.clientY;
        point = {x: event.clientX, y: event.clientY};
        if (frame === null) frame = requestAnimationFrame(flush);
    };
    const end = event => {
        if (!drag || drag.id !== event.pointerId) return;
        consume(event);
        if (frame !== null) cancelAnimationFrame(frame);
        flush();
        cancel();
    };
    // Paper also handles legacy mouse/touch events; suppress those while
    // panning so a finger movement cannot draw or move selected artwork.
    const blockDrawing = event => {
        if (active()) consume(event);
    };
    const listeners = {
        pointerdown: start,
        pointermove: move,
        pointerup: end,
        pointercancel: end,
        lostpointercapture: end,
        mousedown: blockDrawing,
        touchstart: blockDrawing,
        touchmove: blockDrawing,
        touchend: blockDrawing
    };
    Object.keys(listeners).forEach(type => {
        canvas.addEventListener(type, listeners[type], {capture: true, passive: false});
    });
    media.addEventListener('change', updateMode);
    return {
        setEnabled: value => {
            enabled = value;
            updateMode();
        },
        dispose: () => {
            cancel();
            canvas.removeAttribute('data-paint-pan-mode');
            Object.keys(listeners).forEach(type => canvas.removeEventListener(type, listeners[type], true));
            media.removeEventListener('change', updateMode);
        }
    };
};

export default attachMobilePaintPan;
