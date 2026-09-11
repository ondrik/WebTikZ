// Talking to TikZJax.
//
// TikZJax has no API: it watches the page for <script type="text/tikz"> tags,
// replaces each with the SVG it compiled, and says what TeX printed by calling
// console.log from its worker.  So a render here means "insert a script tag and
// watch what happens to it":
//
//   * success -- the generated <svg> fires a bubbling tikzjax-load-finished;
//   * failure -- TikZJax swaps in <img src="//invalid.site/img-not-found.png">;
//   * neither -- the engine never came up, and only a timeout will tell us.
//
// The transcript is collected from the console shim installed in index.html.

import { renderAttributes } from './document.js';

/** TikZJax's own marker for a compile that threw. */
const FAILURE_IMAGE = 'invalid.site';

/** @typedef {{ok: boolean, svg: SVGElement|null, log: string, ms: number, cached: boolean, reason?: string}} RenderResult */

/**
 * @param {object} options
 * @param {HTMLElement} options.stage element the picture is rendered into
 * @param {number} [options.timeout] give up after this many milliseconds
 * @returns {{render: (drawing: object, opts?: {fresh?: boolean}) => Promise<RenderResult>,
 *            clearCache: () => Promise<void>, busy: () => boolean}}
 */
export function createRenderer({ stage, timeout = 90000 }) {
    let generation = 0;
    let collecting = null;

    // Collect everything TeX prints, from the moment a render starts until it
    // settles.  The shim in index.html routes console.log here.
    window.__tikzConsoleSink = (line) => { if (collecting) collecting.push(line); };

    const inFlight = new Set();

    async function render(drawing, { fresh = false } = {}) {
        const mine = ++generation;
        const started = performance.now();
        const lines = [];
        collecting = lines;

        stage.replaceChildren();

        const script = document.createElement('script');
        script.type = 'text/tikz';
        for (const [key, value] of Object.entries(renderAttributes(drawing))) script.dataset[key] = value;
        // A fresh run skips TikZJax's IndexedDB cache, which is how you get a
        // transcript back for a picture that compiled before.
        if (fresh) script.dataset.disableCache = 'true';
        script.appendChild(document.createTextNode(drawing.code));

        const settled = watch(stage, script, timeout);
        inFlight.add(settled);
        stage.appendChild(script);

        let outcome;
        try {
            outcome = await settled;
        } finally {
            inFlight.delete(settled);
            if (collecting === lines) collecting = null;
        }

        // A newer render started while this one was compiling: its result is
        // what the user should see, so drop this one on the floor.
        if (mine !== generation) return { ok: false, svg: null, log: '', ms: 0, cached: false, reason: 'superseded' };

        const log = lines.join('\n');
        return {
            ok: outcome.ok,
            svg: outcome.svg,
            log,
            ms: Math.round(performance.now() - started),
            // Nothing printed means TeX never ran: TikZJax served the picture
            // from its cache.
            cached: outcome.ok && log.trim() === '',
            reason: outcome.reason
        };
    }

    /** Forget every picture TikZJax has cached in IndexedDB. */
    async function clearCache() {
        await new Promise((resolve) => {
            const request = indexedDB.deleteDatabase('TikzJax');
            request.onsuccess = request.onerror = request.onblocked = () => resolve();
        });
    }

    return { render, clearCache, busy: () => inFlight.size > 0 };
}

/**
 * Resolve once the inserted script tag has turned into a picture, an error
 * marker, or nothing at all for too long.
 *
 * @param {HTMLElement} stage
 * @param {HTMLScriptElement} script
 * @param {number} timeout
 */
function watch(stage, script, timeout) {
    return new Promise((resolve) => {
        let done = false;

        const finish = (outcome) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            observer.disconnect();
            stage.removeEventListener('tikzjax-load-finished', onLoaded);
            resolve(outcome);
        };

        const onLoaded = (event) => {
            const svg = event.target instanceof SVGElement ? event.target : stage.querySelector('svg');
            finish({ ok: true, svg });
        };

        stage.addEventListener('tikzjax-load-finished', onLoaded);

        const observer = new MutationObserver(() => {
            if (stage.querySelector(`img[src*="${FAILURE_IMAGE}"]`)) {
                finish({ ok: false, svg: null, reason: 'tex' });
            }
        });
        observer.observe(stage, { childList: true, subtree: true });

        // Nothing happened at all: either TeX is stuck on this picture or the
        // engine never started.  Which one it is shows in whether the script
        // tag was ever taken over by TikZJax.
        const timer = setTimeout(
            () => finish({ ok: false, svg: null, reason: script.isConnected ? 'no-engine' : 'timeout' }),
            timeout
        );
    });
}
