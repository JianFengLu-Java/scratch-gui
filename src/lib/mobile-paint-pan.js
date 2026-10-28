// Keep single-finger tools in Paper, and route two-finger navigation through
// Scratch Paint's wheel handler so selection handles and scrollbars stay in sync.
const attachMobilePaintPan = (canvas, getZoom) => {
    const doc = canvas.ownerDocument;
    const media = window.matchMedia('(max-width: 1023px)');
    const forwarded = new WeakSet();
    let mode = null;
    let primary = null;
    let buffered = [];
    let ready = false;
    let timer = null;
    let frame = null;
    let applied = null;
    let pending = null;

    const consume = event => {
        event.preventDefault();
        event.stopImmediatePropagation();
    };
    const snapshot = event => ({
        type: event.type,
        touches: Array.from(event.touches),
        targetTouches: Array.from(event.targetTouches),
        changedTouches: Array.from(event.changedTouches)
    });
    const forward = input => {
        const event = new Event(input.type, {bubbles: true, cancelable: true});
        ['touches', 'targetTouches', 'changedTouches'].forEach(key => {
            Object.defineProperty(event, key, {value: input[key]});
        });
        forwarded.add(event);
        canvas.dispatchEvent(event);
    };
    const beginDrawing = () => {
        mode = 'draw';
        buffered.forEach(forward);
        buffered = [];
    };
    const finishDrawing = type => {
        if (mode === 'draw' && primary) {
            forward({type, touches: [], targetTouches: [], changedTouches: [primary]});
        }
    };
    const sample = touches => {
        const pair = Array.from(touches).sort((a, b) => a.identifier - b.identifier);
        const [a, b] = pair;
        return {
            ids: `${a.identifier}:${b.identifier}`,
            x: (a.clientX + b.clientX) / 2,
            y: (a.clientY + b.clientY) / 2,
            distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
        };
    };
    const wheel = (deltaX, deltaY, point, ctrlKey = false) => {
        canvas.dispatchEvent(new WheelEvent('wheel', {
            bubbles: true,
            cancelable: true,
            deltaMode: 0,
            deltaX,
            deltaY,
            clientX: point.x,
            clientY: point.y,
            ctrlKey
        }));
    };
    const flush = () => {
        frame = null;
        if (!applied || !pending) return;
        const zoom = getZoom();
        if (applied.distance > 0 && pending.distance > 0 && Number.isFinite(zoom) && zoom > 0) {
            const nextZoom = Math.max(1 / 3, zoom * pending.distance / applied.distance);
            if (Number.isFinite(nextZoom) && nextZoom !== zoom) wheel(0, (zoom - nextZoom) * 500, applied, true);
        }
        const dx = applied.x - pending.x;
        const dy = applied.y - pending.y;
        if (dx || dy) wheel(dx, dy, pending);
        applied = pending;
    };
    const flushFrame = () => {
        if (frame !== null) cancelAnimationFrame(frame);
        flush();
    };
    const clear = () => {
        clearTimeout(timer);
        if (frame !== null) cancelAnimationFrame(frame);
        timer = frame = null;
        buffered = [];
        mode = primary = applied = pending = null;
        canvas.removeAttribute('data-paint-navigating');
    };
    const navigate = touches => {
        clearTimeout(timer);
        buffered = [];
        finishDrawing('touchend');
        mode = 'navigate';
        canvas.setAttribute('data-paint-navigating', 'true');
        if (touches.length !== 2) {
            flushFrame();
            applied = pending = null;
            return;
        }
        const next = sample(touches);
        if (!applied || applied.ids !== next.ids) {
            flushFrame();
            applied = pending = next;
        } else {
            pending = next;
            if (frame === null) frame = requestAnimationFrame(flush);
        }
    };
    const handleTouch = event => {
        if (forwarded.has(event)) return;
        if (!mode) {
            if (!media.matches || event.type !== 'touchstart' || !canvas.contains(event.target)) return;
            // Touch and mouse/pen editing stay separate; never delay an Apple Pencil stroke.
            if (event.touches.length === 1 && event.touches[0].touchType === 'stylus') return;
            mode = 'pending';
            ready = false;
            // A short grace period prevents the first finger of a pinch from
            // placing a dot. Stationary touches wait until a move or a tap ends.
            timer = setTimeout(() => {
                ready = true;
                if (mode === 'pending' && buffered.length > 1) beginDrawing();
            }, 70);
        }
        consume(event);
        if (event.type === 'touchcancel') {
            finishDrawing('touchcancel');
            clear();
            return;
        }
        if (event.touches.length >= 2) {
            navigate(event.touches);
            return;
        }
        if (mode === 'navigate' || mode === 'blocked') {
            flushFrame();
            mode = 'blocked';
            applied = pending = null;
            canvas.removeAttribute('data-paint-navigating');
            if (!event.touches.length) clear();
            return;
        }
        primary = event.touches[0] || event.changedTouches[0];
        const input = snapshot(event);
        if (mode === 'pending') {
            buffered.push(input);
            if (!event.touches.length || (ready && event.type === 'touchmove')) beginDrawing();
        } else {
            forward(input);
        }
        if (!event.touches.length) clear();
    };
    const cancel = () => {
        finishDrawing('touchcancel');
        clear();
    };
    const types = ['touchstart', 'touchmove', 'touchend', 'touchcancel'];
    types.forEach(type => doc.addEventListener(type, handleTouch, {capture: true, passive: false}));
    media.addEventListener('change', cancel);
    return {
        dispose: () => {
            cancel();
            types.forEach(type => doc.removeEventListener(type, handleTouch, true));
            media.removeEventListener('change', cancel);
        }
    };
};

export default attachMobilePaintPan;
