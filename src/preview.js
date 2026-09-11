// The canvas the picture sits on: zoom, pan, and what to say when there is
// nothing to show.
//
// Sizes come out of TeX in TeX points (1/72.27 inch) but are written into the
// SVG with the unit "pt", which CSS reads as 1/72 inch.  Everything on screen
// therefore lands 0.37% large, uniformly.  Rather than fight it, the ruler grid
// is computed in the same stretched unit so a square is exactly one TikZ
// centimetre of the picture as drawn.
const PT_PER_CM = 28.45274;
const CM_PX = (PT_PER_CM * 96) / 72;

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/**
 * @param {object} parts
 * @param {HTMLElement} parts.canvas   the scrolling viewport
 * @param {HTMLElement} parts.sheet    the page the picture is drawn on
 * @param {HTMLElement} parts.stage    where TikZJax puts the svg
 * @param {HTMLElement} parts.empty    the "nothing here yet" layer
 * @param {HTMLElement} parts.dimensions
 * @param {HTMLElement} parts.zoomLabel
 * @param {(zoom: number) => void} [parts.onZoomChange]
 */
export function createPreview({ canvas, sheet, stage, empty, dimensions, zoomLabel, onZoomChange }) {
    let zoom = 1;
    let panX = 0;
    let panY = 0;
    /** Natural size of the current picture, in the SVG's own points. */
    let size = null;

    const busy = document.createElement('div');
    busy.className = 'busy';
    busy.hidden = true;
    busy.textContent = 'Running TeX';
    canvas.appendChild(busy);

    function apply() {
        sheet.style.transform = `translate(-50%, -50%) translate(${panX}px, ${panY}px) scale(${zoom})`;
        canvas.style.setProperty('--grid', `${CM_PX * zoom}px`);
        canvas.style.setProperty('--grid-x', `${canvas.clientWidth / 2 + panX}px`);
        canvas.style.setProperty('--grid-y', `${canvas.clientHeight / 2 + panY}px`);
        zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
        onZoomChange?.(zoom);
    }

    function setZoom(next, origin) {
        const target = clamp(next, MIN_ZOOM, MAX_ZOOM);
        if (origin) {
            // Keep whatever is under the pointer under the pointer.
            const box = canvas.getBoundingClientRect();
            const dx = origin.x - box.left - box.width / 2 - panX;
            const dy = origin.y - box.top - box.height / 2 - panY;
            const factor = target / zoom;
            panX -= dx * (factor - 1);
            panY -= dy * (factor - 1);
        }
        zoom = target;
        apply();
    }

    /**
     * @param {{enlarge?: boolean}} [options] whether a picture smaller than the
     *   canvas may be scaled up.  Automatic fits do not: a two-centimetre
     *   drawing blown up to fill the screen is a surprise, not a service.
     */
    function fit({ enlarge = true } = {}) {
        if (!size) return;
        const margin = 28;
        const available = {
            w: Math.max(40, canvas.clientWidth - margin * 2),
            h: Math.max(40, canvas.clientHeight - margin * 2)
        };
        const natural = { w: (size.w * 96) / 72, h: (size.h * 96) / 72 };
        const wanted = Math.min(available.w / natural.w, available.h / natural.h, MAX_ZOOM);
        panX = 0;
        panY = 0;
        setZoom(enlarge ? wanted : Math.min(1, wanted));
    }

    /**
     * Show a freshly compiled picture.
     * @param {SVGElement} svg
     * @param {{keepView?: boolean}} [options] keep zoom and pan across re-renders
     */
    function showPicture(svg, { keepView = true } = {}) {
        empty.hidden = true;
        empty.replaceChildren();
        sheet.classList.remove('empty', 'stale');

        size = {
            w: parseFloat(svg.getAttribute('width')) || 100,
            h: parseFloat(svg.getAttribute('height')) || 100
        };
        // The sheet is sized in the same stretched points the browser uses to
        // lay the svg out, so the paper is exactly the picture's bounding box.
        sheet.style.width = `${(size.w * 96) / 72}px`;
        sheet.style.height = `${(size.h * 96) / 72}px`;

        dimensions.textContent =
            `${size.w.toFixed(1)} × ${size.h.toFixed(1)} pt  ·  ` +
            `${(size.w / PT_PER_CM).toFixed(2)} × ${(size.h / PT_PER_CM).toFixed(2)} cm`;

        if (!keepView) fit();
        else apply();
    }

    /** No picture: either nothing has been rendered yet, or TeX refused. */
    function showMessage(node) {
        sheet.classList.add('empty');
        size = null;
        dimensions.textContent = '';
        empty.replaceChildren(node);
        empty.hidden = false;
    }

    function showEmpty(text = 'Write a picture, then press Render.') {
        showMessage(document.createTextNode(text));
    }

    /**
     * @param {string} headline
     * @param {string} detail
     * @param {() => void} onOpenLog
     */
    function showError(headline, detail, onOpenLog) {
        const box = document.createElement('div');
        box.className = 'canvas-error';

        const title = document.createElement('h2');
        title.textContent = headline;

        const message = document.createElement('p');
        message.textContent = detail;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-small';
        button.textContent = 'Show what TeX said';
        button.addEventListener('click', onOpenLog);

        box.append(title, message, button);
        showMessage(box);
    }

    const setBusy = (on) => {
        busy.hidden = !on;
        sheet.classList.toggle('stale', on && !sheet.classList.contains('empty'));
    };

    // ---------------------------------------------------------------- input

    canvas.addEventListener('wheel', (event) => {
        if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setZoom(zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12), { x: event.clientX, y: event.clientY });
        } else {
            event.preventDefault();
            panX -= event.shiftKey ? event.deltaY : event.deltaX;
            panY -= event.shiftKey ? 0 : event.deltaY;
            apply();
        }
    }, { passive: false });

    canvas.addEventListener('pointerdown', (event) => {
        if (event.button !== 0 && event.button !== 1) return;
        if (event.target.closest('.canvas-error')) return;
        canvas.setPointerCapture(event.pointerId);
        canvas.classList.add('panning');
        const from = { x: event.clientX, y: event.clientY, panX, panY };

        const move = (move_) => {
            panX = from.panX + (move_.clientX - from.x);
            panY = from.panY + (move_.clientY - from.y);
            apply();
        };
        const up = () => {
            canvas.classList.remove('panning');
            canvas.removeEventListener('pointermove', move);
            canvas.removeEventListener('pointerup', up);
            canvas.removeEventListener('pointercancel', up);
        };

        canvas.addEventListener('pointermove', move);
        canvas.addEventListener('pointerup', up);
        canvas.addEventListener('pointercancel', up);
    });

    new ResizeObserver(() => apply()).observe(canvas);

    apply();

    return {
        showPicture,
        showEmpty,
        showError,
        setBusy,
        fit,
        zoomIn: () => setZoom(zoom * 1.25),
        zoomOut: () => setZoom(zoom / 1.25),
        resetZoom: () => { panX = 0; panY = 0; setZoom(1); },
        zoom: () => zoom,
        hasPicture: () => size !== null,
        svg: () => stage.querySelector('svg'),
        setBackground: (kind) => { canvas.dataset.background = kind; },
        setGrid: (on) => canvas.classList.toggle('nogrid', !on),
        setInvert: (on) => canvas.classList.toggle('invert', on)
    };
}
