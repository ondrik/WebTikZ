// WebTikZ: putting the pieces together.
//
// The shape of the thing: one drawing is open at a time, the editor writes into
// it, and every change is saved to localStorage and (optionally) recompiled a
// moment later.  Rendering goes through src/tikzjax.js; everything it tells us
// ends up in one of three places -- the canvas, the log pane, or the status bar.

import { TEX_PACKAGES, TIKZ_LIBRARIES } from './catalog.js';
import { fromTex, makeDrawing, STARTER_CODE, toStandaloneTex } from './document.js';
import { createEditor } from './editor.js';
import { EXAMPLES } from './examples.js';
import {
    copyPng, copySvgMarkup, copyText, download, savePng, saveSvg, saveTex
} from './exporter.js';
import { createPreview } from './preview.js';
import { fromFragment, toFragment } from './share.js';
import {
    checkEnvironment, loadDrawings, loadSettings, newId, saveDrawings, saveSettings
} from './store.js';
import { locateTexLine, parseTexLog, summarize } from './texlog.js';
import { LIBRARY_NOTES, PACKAGE_NOTES } from './tikzdata.js';
import { createRenderer } from './tikzjax.js';
import {
    attachMenu, buildChecklist, el, filterChecklist, helpContent, renderDrawingList,
    renderExamples, renderIssues, syncChecklist, toast
} from './ui.js';

const settings = loadSettings();
let drawings = loadDrawings();

/** The drawing being edited. Never a reference into `drawings`. */
let current = { id: null, ...makeDrawing() };
let firstRenderDone = false;
let saveTimer = null;
let renderTimer = null;
/** True while a drawing is being loaded into the editors, so that filling them
 *  in does not count as the user typing (which would save and re-render). */
let loading = false;

const editor = createEditor(el('editor'), {
    placeholder: 'Write a tikzpicture here.',
    onChange: () => { current.code = editor.getValue(); touched(); },
    onCursor: (line, column) => { el('status-cursor').textContent = `Line ${line}, column ${column}`; },
    onRender: () => renderNow({ fresh: false }),
    onSave: () => saveTex(current)
});

const preamble = createEditor(el('preamble'), {
    placeholder: '\\tikzset{...}, \\newcommand{...}, \\definecolor{...}',
    onChange: () => { current.preamble = preamble.getValue(); touched(); },
    onRender: () => renderNow({ fresh: false }),
    onSave: () => saveTex(current)
});

const preview = createPreview({
    canvas: el('canvas'),
    sheet: el('sheet'),
    stage: el('stage'),
    empty: el('canvas-empty'),
    dimensions: el('dimensions'),
    zoomLabel: el('btn-zoom-level')
});

const renderer = createRenderer({ stage: el('stage') });

// ------------------------------------------------------------------ drawing

/** Copy the current drawing without its storage id. */
const asDrawing = () => ({
    name: current.name,
    code: current.code,
    preamble: current.preamble,
    libraries: current.libraries,
    packages: current.packages
});

/** Something changed: save it, and queue a render if that is wanted. */
function touched() {
    if (loading) return;

    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 500);

    el('dot-preamble').hidden = !current.preamble.trim();

    if (settings.autoRender) {
        clearTimeout(renderTimer);
        renderTimer = setTimeout(() => renderNow({ fresh: false }), settings.autoRenderDelay);
    }
}

function save() {
    if (!current.id) current.id = newId();

    const record = { ...asDrawing(), id: current.id, modified: Date.now() };
    drawings = [record, ...drawings.filter((d) => d.id !== current.id)];
    settings.currentId = current.id;

    const saved = saveDrawings(drawings) && saveSettings(settings);
    el('status-state').textContent = saved ? statusText : 'Not saved: this browser is refusing to store data';
    refreshDrawingList();
}

let statusText = 'Ready';
const setStatus = (text) => { statusText = text; el('status-state').textContent = text; };

function openDrawing(drawing, { id = null, render = true } = {}) {
    current = { id, ...makeDrawing(drawing) };

    loading = true;
    editor.setValue(current.code);
    preamble.setValue(current.preamble);
    loading = false;

    el('doc-title').value = current.name;
    el('dot-preamble').hidden = !current.preamble.trim();
    syncChecklists();
    refreshDrawingList();

    settings.currentId = id;
    saveSettings(settings);

    if (render) renderNow({ fresh: false, refit: true });
}

function setSidebar(open) {
    el('sidebar').hidden = !open;
    el('btn-drawings').setAttribute('aria-expanded', String(open));
}

const closeSidebar = () => setSidebar(false);

function refreshDrawingList() {
    el('count-setup').textContent =
        current.libraries.length + current.packages.length
            ? ` ${current.libraries.length + current.packages.length}`
            : '';

    renderDrawingList(el('doclist'), drawings, current.id, {
        onOpen: (id) => {
            const found = drawings.find((d) => d.id === id);
            if (!found) return;
            openDrawing(found, { id });
            // On a narrow screen the list covers the editor it just filled.
            if (window.matchMedia('(max-width: 900px)').matches) closeSidebar();
        },
        onDelete: (id) => {
            const found = drawings.find((d) => d.id === id);
            if (!found || !confirm(`Delete "${found.name}"? This cannot be undone.`)) return;
            drawings = drawings.filter((d) => d.id !== id);
            saveDrawings(drawings);
            if (current.id === id) current.id = null;
            refreshDrawingList();
            toast('Drawing deleted');
        }
    });
}

// ----------------------------------------------------------------- renderng

async function renderNow({ fresh = false, refit = false } = {}) {
    clearTimeout(renderTimer);

    if (!current.code.trim()) {
        preview.showEmpty('Write a picture, then press Render.');
        showLog('', { issues: [], errors: [], warnings: [] }, null);
        return;
    }

    preview.setBusy(true);
    setStatus(firstRenderDone ? 'Compiling…' : 'Starting the TeX engine…');

    const result = await renderer.render(asDrawing(), { fresh });

    // A newer render is already running; it owns the canvas from here.
    if (result.reason === 'superseded') return;

    firstRenderDone = true;
    preview.setBusy(false);
    // A counter anything outside can watch -- the smoke test waits on it, and
    // it makes "did that actually re-render?" answerable in the console.
    document.body.dataset.renders = String(Number(document.body.dataset.renders ?? 0) + 1);

    const parsed = parseTexLog(result.log);
    const issues = parsed.issues.map(describe);
    showLog(result.log, parsed, result);
    markIssues(issues);

    if (result.ok && result.svg) {
        // Re-rendering keeps the view where the user put it; a drawing that was
        // just opened gets framed, but never magnified past its real size.
        const wasShowing = preview.hasPicture();
        preview.showPicture(result.svg, { keepView: wasShowing && !refit });
        if (refit || !wasShowing) preview.fit({ enlarge: false });

        setStatus('Ready');
        el('status-timing').textContent = result.cached
            ? 'from cache'
            : `rendered in ${(result.ms / 1000).toFixed(1)} s`;
        return;
    }

    el('status-timing').textContent = '';

    if (result.reason === 'no-engine') {
        setStatus('The TeX engine did not answer');
        preview.showError(
            'The TeX engine did not answer',
            'Reload the page. If this keeps happening, check that WebTikZ is served over '
            + 'http(s) and not opened as a file.',
            openLogPane
        );
        return;
    }

    if (result.reason === 'timeout') {
        setStatus('TeX gave up');
        preview.showError('This picture is taking too long',
            'TeX ran for 90 seconds without finishing. Try a smaller picture.', openLogPane);
        return;
    }

    setStatus('TeX stopped');
    const first = issues.find((i) => i.severity === 'error');
    preview.showError(
        first ? `TeX stopped${first.where ? ` at ${first.where.toLowerCase()}` : ''}` : 'TeX stopped',
        first ? first.message : 'The transcript below says what happened.',
        openLogPane
    );
}

/** Attach a human-readable location to an issue. */
function describe(issue) {
    if (!issue.texLine) return { ...issue, where: null, target: null, line: null };

    const at = locateTexLine(issue.texLine, current.preamble);
    return {
        ...issue,
        target: at.target,
        line: at.line,
        where: `${at.target === 'preamble' ? 'Preamble' : 'Picture'}, line ${at.line}`
    };
}

function markIssues(issues) {
    editor.markErrors(issues.filter((i) => i.target === 'picture' && i.severity === 'error'));
    preamble.markErrors(issues.filter((i) => i.target === 'preamble' && i.severity === 'error'));

    renderIssues(el('issues'), issues, (issue) => {
        showTab(issue.target === 'preamble' ? 'preamble' : 'code');
        (issue.target === 'preamble' ? preamble : editor).goToLine(issue.line);
    });
}

function showLog(transcript, parsed, result) {
    el('transcript').textContent = transcript
        || (result?.cached
            ? 'This picture came back from the cache, so TeX did not run.\nRender again from the menu to see the transcript.'
            : 'TeX has not said anything yet.');

    const status = el('log-status');
    status.textContent = summarize(parsed) || (result?.ok ? 'no problems' : '');
    status.classList.toggle('has-error', parsed.errors.length > 0);
    status.classList.toggle('has-warning', parsed.errors.length === 0 && parsed.warnings.length > 0);

    // An error is worth showing unasked; a warning is not.
    if (parsed.errors.length) openLogPane();
}

const openLogPane = () => setLogOpen(true);

function setLogOpen(open) {
    el('logpane').classList.toggle('open', open);
    el('log-body').hidden = !open;
    el('btn-log').setAttribute('aria-expanded', String(open));
    settings.logOpen = open;
    saveSettings(settings);
}

// ------------------------------------------------------------------ tabs

function showTab(name) {
    for (const tab of document.querySelectorAll('.tab')) {
        tab.setAttribute('aria-selected', String(tab.dataset.tab === name));
    }
    el('panel-code').hidden = name !== 'code';
    el('panel-preamble').hidden = name !== 'preamble';
    el('panel-setup').hidden = name !== 'setup';

    if (name === 'code') editor.refresh();
    if (name === 'preamble') preamble.refresh();
}

// -------------------------------------------------------------- checklists

function syncChecklists() {
    syncChecklist(el('list-libraries'), current.libraries);
    syncChecklist(el('list-packages'), current.packages);
    refreshDrawingList();
}

function setupChecklists() {
    buildChecklist(el('list-libraries'), TIKZ_LIBRARIES, LIBRARY_NOTES, (name, on) => {
        current.libraries = on
            ? [...current.libraries, name].sort()
            : current.libraries.filter((l) => l !== name);
        refreshDrawingList();
        touched();
    });

    buildChecklist(el('list-packages'), TEX_PACKAGES, PACKAGE_NOTES, (name, on) => {
        current.packages = on
            ? [...current.packages, name].sort()
            : current.packages.filter((p) => p !== name);
        refreshDrawingList();
        touched();
    });

    el('setup-filter').addEventListener('input', (event) => {
        filterChecklist(el('list-libraries'), event.target.value);
        filterChecklist(el('list-packages'), event.target.value);
    });
}

// ------------------------------------------------------------------ theme

const systemPrefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;
const effectiveTheme = () => (settings.theme === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : settings.theme);

function applyTheme() {
    const mode = effectiveTheme();
    document.documentElement.dataset.theme = mode;
    editor.setTheme(mode);
    preamble.setTheme(mode);
    el('btn-theme').title = mode === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme';
    el('theme-icon').textContent = mode === 'dark' ? '☀' : '☾';

    // A dark canvas wants light ink; offer the switch only where it helps.
    el('lbl-invert').hidden = settings.background !== 'dark';
}

// ------------------------------------------------------------------ export

async function withPicture(what, action) {
    const svg = preview.svg();
    if (!svg) return toast('Render the picture first', { bad: true });
    try {
        await action(svg);
    } catch (error) {
        toast(`Could not ${what}: ${error.message}`, { bad: true });
    }
}

function setupExport() {
    attachMenu(el('btn-export'), el('menu-export'));

    el('menu-export').addEventListener('click', async (event) => {
        const action = event.target.closest('button[data-export]')?.dataset.export;
        if (!action) return;

        const pngOptions = { scale: Number(el('sel-png-scale').value), opaque: el('chk-png-opaque').checked };

        if (action === 'svg') await withPicture('save the SVG', (svg) => saveSvg(svg, current.name));
        if (action === 'png') await withPicture('save the PNG', (svg) => savePng(svg, current.name, pngOptions));
        if (action === 'tex') saveTex(current);
        if (action === 'copy-png') {
            await withPicture('copy the picture', async (svg) => {
                await copyPng(svg, pngOptions);
                toast('Picture copied');
            });
        }
        if (action === 'copy-svg') {
            await withPicture('copy the SVG', async (svg) => {
                await copySvgMarkup(svg);
                toast('SVG markup copied');
            });
        }
        if (action === 'copy-link') await copyLink();
    });

    el('sel-png-scale').value = String(settings.pngScale);
    el('chk-png-opaque').checked = settings.pngOpaque;
    el('sel-png-scale').addEventListener('change', (e) => {
        settings.pngScale = Number(e.target.value);
        saveSettings(settings);
    });
    el('chk-png-opaque').addEventListener('change', (e) => {
        settings.pngOpaque = e.target.checked;
        saveSettings(settings);
    });
}

async function copyLink() {
    const link = location.origin + location.pathname + (await toFragment(asDrawing()));
    try {
        await copyText(link);
        toast(link.length > 8000 ? 'Link copied — it is long, some apps may cut it' : 'Link copied');
    } catch {
        // Clipboard access can be refused; showing the link still lets them copy it.
        prompt('Copy this link:', link);
    }
}

// -------------------------------------------------------------------- files

function openTexFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
        const parsed = fromTex(String(reader.result));
        openDrawing({ ...parsed, name: file.name.replace(/\.[^.]+$/, '') }, { id: null });
        save();

        if (parsed.dropped.length) {
            toast(`Opened. Left out: ${parsed.dropped.slice(0, 3).join(', ')}`
                + (parsed.dropped.length > 3 ? ` and ${parsed.dropped.length - 3} more` : ''));
        } else {
            toast(`Opened ${file.name}`);
        }
    };
    reader.onerror = () => toast('That file could not be read', { bad: true });
    reader.readAsText(file);
}

function setupFiles() {
    el('btn-open').addEventListener('click', () => el('file-input').click());
    el('file-input').addEventListener('change', (event) => {
        const [file] = event.target.files;
        if (file) openTexFile(file);
        event.target.value = '';
    });

    document.addEventListener('dragover', (event) => {
        if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
    });
    document.addEventListener('drop', (event) => {
        const [file] = event.dataTransfer?.files ?? [];
        if (!file) return;
        event.preventDefault();
        openTexFile(file);
    });

    el('btn-export-library').addEventListener('click', () => {
        download(new Blob([JSON.stringify({ webtikz: 1, drawings }, null, 2)], { type: 'application/json' }),
            'webtikz-drawings.json');
    });

    el('btn-import-library').addEventListener('click', () => el('library-input').click());
    el('library-input').addEventListener('change', (event) => {
        const [file] = event.target.files;
        event.target.value = '';
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(String(reader.result));
                const incoming = Array.isArray(data) ? data : data.drawings;
                if (!Array.isArray(incoming)) throw new Error('no drawings in that file');

                const known = new Set(drawings.map((d) => d.id));
                const added = incoming
                    .filter((d) => d && typeof d.code === 'string')
                    .map((d) => ({ ...makeDrawing(d), id: known.has(d.id) ? newId() : (d.id ?? newId()),
                        modified: Number(d.modified) || Date.now() }));

                drawings = [...added, ...drawings];
                saveDrawings(drawings);
                refreshDrawingList();
                toast(`Imported ${added.length} drawing${added.length === 1 ? '' : 's'}`);
            } catch (error) {
                toast(`That is not a WebTikZ export: ${error.message}`, { bad: true });
            }
        };
        reader.readAsText(file);
    });
}

// -------------------------------------------------------------------- chrome

function setupToolbar() {
    el('btn-render').addEventListener('click', () => renderNow({ fresh: true }));

    el('chk-auto').checked = settings.autoRender;
    el('chk-auto').addEventListener('change', (event) => {
        settings.autoRender = event.target.checked;
        saveSettings(settings);
        if (settings.autoRender) renderNow({ fresh: false });
    });

    el('btn-drawings').addEventListener('click', () => setSidebar(el('sidebar').hidden));

    el('btn-new-doc').addEventListener('click', () => {
        openDrawing(makeDrawing({ name: `Drawing ${drawings.length + 1}`, code: STARTER_CODE }), { id: null });
        save();
        showTab('code');
        editor.focus();
    });

    el('doc-title').addEventListener('input', (event) => {
        current.name = event.target.value;
        touched();
    });

    el('btn-theme').addEventListener('click', () => {
        settings.theme = effectiveTheme() === 'dark' ? 'light' : 'dark';
        saveSettings(settings);
        applyTheme();
    });

    el('btn-help').addEventListener('click', () => el('dlg-help').showModal());

    el('btn-examples').addEventListener('click', () => el('dlg-examples').showModal());
    renderExamples(el('examplelist'), EXAMPLES, (id) => {
        const example = EXAMPLES.find((e) => e.id === id);
        el('dlg-examples').close();
        openDrawing(makeDrawing(example), { id: null });
        save();
        showTab('code');
    });

    for (const tab of document.querySelectorAll('.tab')) {
        tab.addEventListener('click', () => showTab(tab.dataset.tab));
    }

    el('btn-log').addEventListener('click', () => setLogOpen(el('log-body').hidden));

    el('btn-zoom-in').addEventListener('click', () => preview.zoomIn());
    el('btn-zoom-out').addEventListener('click', () => preview.zoomOut());
    el('btn-zoom-level').addEventListener('click', () => preview.resetZoom());
    el('btn-zoom-fit').addEventListener('click', () => preview.fit());

    el('chk-grid').checked = settings.grid;
    el('chk-grid').addEventListener('change', (event) => {
        settings.grid = event.target.checked;
        preview.setGrid(settings.grid);
        saveSettings(settings);
    });

    el('chk-invert').checked = settings.invert;
    el('chk-invert').addEventListener('change', (event) => {
        settings.invert = event.target.checked;
        preview.setInvert(settings.invert);
        saveSettings(settings);
    });

    el('sel-background').value = settings.background;
    el('sel-background').addEventListener('change', (event) => {
        settings.background = event.target.value;
        preview.setBackground(settings.background);
        saveSettings(settings);
        applyTheme();
    });
}

function setupSplitter() {
    const splitter = el('splitter');
    const workspace = el('workspace');

    const setWidth = (percent) => {
        settings.editorWidth = Math.min(80, Math.max(20, percent));
        document.documentElement.style.setProperty('--editor-width', `${settings.editorWidth}%`);
    };

    setWidth(settings.editorWidth);

    splitter.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        splitter.setPointerCapture(event.pointerId);

        const move = (moved) => {
            const box = workspace.getBoundingClientRect();
            const sidebar = el('sidebar').hidden ? 0 : el('sidebar').offsetWidth;
            setWidth(((moved.clientX - box.left - sidebar) / (box.width - sidebar)) * 100);
        };
        const up = () => {
            splitter.removeEventListener('pointermove', move);
            splitter.removeEventListener('pointerup', up);
            saveSettings(settings);
            editor.refresh();
            preamble.refresh();
        };

        splitter.addEventListener('pointermove', move);
        splitter.addEventListener('pointerup', up);
    });

    // Keyboard users get the same control.
    splitter.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        setWidth(settings.editorWidth + (event.key === 'ArrowLeft' ? -2 : 2));
        saveSettings(settings);
    });
}

function setupShortcuts() {
    document.addEventListener('keydown', (event) => {
        const meta = event.ctrlKey || event.metaKey;

        if (event.key === 'F1') {
            event.preventDefault();
            el('dlg-help').showModal();
            return;
        }
        if (!meta) return;

        switch (event.key) {
            case 'Enter':
                event.preventDefault();
                renderNow({ fresh: false });
                break;
            case 's':
                event.preventDefault();
                saveTex(current);
                break;
            case 'o':
                event.preventDefault();
                el('file-input').click();
                break;
            case 'C':
                if (!event.shiftKey) return;
                event.preventDefault();
                withPicture('copy the picture', async (svg) => {
                    await copyPng(svg, { scale: settings.pngScale, opaque: settings.pngOpaque });
                    toast('Picture copied');
                });
                break;
            case '0':
                event.preventDefault();
                preview.resetZoom();
                break;
            case '=':
            case '+':
                event.preventDefault();
                preview.zoomIn();
                break;
            case '-':
                event.preventDefault();
                preview.zoomOut();
                break;
            default:
        }
    });
}

// --------------------------------------------------------------------- boot

async function start() {
    const environment = checkEnvironment();
    if (!environment.ok) {
        const banner = el('insecure-banner');
        banner.hidden = false;
        banner.textContent = `${environment.problems.join(' ')} Serve the folder instead — for example with `;
        const how = document.createElement('code');
        how.textContent = './serve.sh';
        banner.append(how, ', then open http://localhost:8000.');
    }

    setupChecklists();
    setupToolbar();
    setupExport();
    setupFiles();
    setupSplitter();
    setupShortcuts();

    el('help-body').appendChild(helpContent());
    applyTheme();
    window.matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => { if (settings.theme === 'system') applyTheme(); });

    preview.setBackground(settings.background);
    preview.setGrid(settings.grid);
    preview.setInvert(settings.invert);
    setLogOpen(settings.logOpen);

    // What to open: a shared link wins, then whatever was open last, then a
    // starting picture.
    const shared = await fromFragment(location.hash);
    if (shared) {
        history.replaceState(null, '', location.pathname + location.search);
        openDrawing(shared, { id: null, render: false });
        save();
        toast('Opened the drawing from the link');
    } else {
        const last = drawings.find((d) => d.id === settings.currentId) ?? drawings[0];
        openDrawing(last ?? makeDrawing({ name: 'First drawing' }), { id: last?.id ?? null, render: false });
        if (!last) save();
    }

    showTab('code');
    editor.focus();
    await renderNow({ fresh: false, refit: true });
}

start();
