// Everything that survives a reload: the drawings and the settings.
//
// localStorage, because a drawing is small text and belongs to the browser it
// was written in.  Every read is defensive: a corrupted or absent entry gives
// the default rather than an exception, so a bad value can never lock a user
// out of their editor.

const DRAWINGS_KEY = 'webtikz.drawings.v1';
const SETTINGS_KEY = 'webtikz.settings.v1';

/** @typedef {import('./document.js').Drawing} Drawing */
/** @typedef {Drawing & {id: string, modified: number}} StoredDrawing */

export const DEFAULT_SETTINGS = {
    theme: 'system',          // system | light | dark
    autoRender: true,
    autoRenderDelay: 700,     // ms after the last keystroke
    editorWidth: 46,          // per cent of the workspace
    keymap: 'default',        // default | vim | emacs | sublime
    background: 'paper',      // paper | checker | dark
    grid: true,
    invert: false,
    logOpen: false,
    pngScale: 2,
    pngOpaque: true,
    currentId: null
};

const read = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
    } catch {
        return fallback;
    }
};

const write = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        // Private browsing, or the quota is full.  Losing the save is bad but
        // losing the session because of it would be worse.
        return false;
    }
};

/** @returns {typeof DEFAULT_SETTINGS} */
export function loadSettings() {
    const stored = read(SETTINGS_KEY, {});
    return { ...DEFAULT_SETTINGS, ...(stored && typeof stored === 'object' ? stored : {}) };
}

export function saveSettings(settings) {
    return write(SETTINGS_KEY, settings);
}

/** @returns {StoredDrawing[]} newest first */
export function loadDrawings() {
    const stored = read(DRAWINGS_KEY, []);
    if (!Array.isArray(stored)) return [];
    return stored
        .filter((d) => d && typeof d === 'object' && typeof d.code === 'string')
        .map((d) => ({
            id: String(d.id ?? newId()),
            name: String(d.name ?? 'Untitled drawing'),
            code: String(d.code ?? ''),
            preamble: String(d.preamble ?? ''),
            libraries: Array.isArray(d.libraries) ? d.libraries.map(String) : [],
            packages: Array.isArray(d.packages) ? d.packages.map(String) : [],
            modified: Number(d.modified) || Date.now()
        }))
        .sort((a, b) => b.modified - a.modified);
}

export function saveDrawings(drawings) {
    return write(DRAWINGS_KEY, drawings);
}

export const newId = () =>
    (crypto.randomUUID ? crypto.randomUUID() : `d${Date.now()}${Math.random().toString(16).slice(2)}`);

/** Is this browser going to let TikZJax work at all? */
export function checkEnvironment() {
    const problems = [];
    if (location.protocol === 'file:') {
        problems.push('WebTikZ has to be served over http, because TeX runs in a Web Worker.');
    }
    if (!window.isSecureContext) {
        problems.push('This page is not a secure context, so TikZJax cannot hash its cache keys.');
    }
    return { ok: problems.length === 0, problems };
}
