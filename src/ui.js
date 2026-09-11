// Small pieces of interface: lists, menus, messages.
//
// Nothing here decides anything; src/main.js owns the behaviour and passes in
// what should happen.  Everything builds DOM nodes rather than HTML strings,
// so a drawing named <script> stays a drawing named <script>.

/** @param {string} id */
export const el = (id) => document.getElementById(id);

/**
 * Say something briefly, then get out of the way.
 * @param {string} message
 * @param {{bad?: boolean}} [options]
 */
export function toast(message, { bad = false } = {}) {
    const node = document.createElement('div');
    node.className = bad ? 'toast bad' : 'toast';
    node.textContent = message;
    el('toasts').appendChild(node);
    setTimeout(() => node.remove(), bad ? 5200 : 2600);
}

/**
 * A list of checkboxes for libraries or packages.
 *
 * @param {HTMLElement} container
 * @param {readonly string[]} names
 * @param {Record<string, string>} notes
 * @param {(name: string, on: boolean) => void} onToggle
 */
export function buildChecklist(container, names, notes, onToggle) {
    container.replaceChildren();

    for (const name of names) {
        const label = document.createElement('label');
        label.dataset.name = name;

        const box = document.createElement('input');
        box.type = 'checkbox';
        box.addEventListener('change', () => {
            label.classList.toggle('on', box.checked);
            onToggle(name, box.checked);
        });

        const title = document.createElement('span');
        title.className = 'name';
        title.textContent = name;

        label.append(box, title);

        if (notes[name]) {
            const note = document.createElement('span');
            note.className = 'what';
            note.textContent = ` — ${notes[name]}`;
            label.append(note);
        }

        container.appendChild(label);
    }
}

/**
 * Tick exactly the boxes in `selected`.
 * @param {HTMLElement} container
 * @param {readonly string[]} selected
 */
export function syncChecklist(container, selected) {
    const wanted = new Set(selected);
    for (const label of container.querySelectorAll('label')) {
        const box = label.querySelector('input');
        const on = wanted.has(label.dataset.name);
        box.checked = on;
        label.classList.toggle('on', on);
    }
}

/**
 * Show only entries matching the query; a ticked entry always stays visible so
 * nothing silently disappears from the record of what is loaded.
 * @param {HTMLElement} container
 * @param {string} query
 */
export function filterChecklist(container, query) {
    const needle = query.trim().toLowerCase();
    for (const label of container.querySelectorAll('label')) {
        const hit = !needle
            || label.dataset.name.toLowerCase().includes(needle)
            || label.textContent.toLowerCase().includes(needle);
        label.hidden = !hit && !label.querySelector('input').checked;
    }
}

/**
 * The clickable list of what TeX complained about.
 *
 * @param {HTMLElement} list
 * @param {Array<{severity: string, message: string, where?: string, target?: string, line?: number}>} issues
 * @param {(issue: object) => void} onJump
 */
export function renderIssues(list, issues, onJump) {
    list.replaceChildren();

    for (const issue of issues) {
        const item = document.createElement('li');
        item.className = issue.severity;

        const button = document.createElement('button');
        button.type = 'button';

        const what = document.createElement('span');
        what.className = 'what';
        what.textContent = issue.message;
        button.appendChild(what);

        if (issue.where) {
            const where = document.createElement('span');
            where.className = 'where';
            where.textContent = issue.where;
            button.append(document.createElement('br'), where);
        }

        if (issue.line) button.addEventListener('click', () => onJump(issue));
        else button.disabled = true;

        item.appendChild(button);
        list.appendChild(item);
    }
}

/** "just now", "14 minutes ago", "3 days ago" */
export function formatWhen(timestamp) {
    const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
    if (seconds < 45) return 'just now';
    const units = [
        ['minute', 60],
        ['hour', 3600],
        ['day', 86400],
        ['month', 2592000]
    ];
    let label = 'minute';
    let size = 60;
    for (const [name, span] of units) {
        if (seconds >= span) { label = name; size = span; }
    }
    const count = Math.round(seconds / size);
    return `${count} ${label}${count === 1 ? '' : 's'} ago`;
}

/**
 * The saved-drawings list.
 *
 * @param {HTMLElement} list
 * @param {Array<{id: string, name: string, modified: number}>} drawings
 * @param {string|null} currentId
 * @param {{onOpen: (id: string) => void, onDelete: (id: string) => void}} handlers
 */
export function renderDrawingList(list, drawings, currentId, { onOpen, onDelete }) {
    list.replaceChildren();

    for (const drawing of drawings) {
        const item = document.createElement('li');
        if (drawing.id === currentId) item.className = 'current';

        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'doc-open';
        open.title = drawing.name;

        const name = document.createElement('span');
        name.textContent = drawing.name || 'Untitled drawing';

        const when = document.createElement('span');
        when.className = 'doc-when';
        when.textContent = formatWhen(drawing.modified);

        open.append(name, when);
        open.addEventListener('click', () => onOpen(drawing.id));

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'doc-menu';
        remove.title = `Delete ${drawing.name}`;
        remove.setAttribute('aria-label', `Delete ${drawing.name}`);
        remove.textContent = '×';
        remove.addEventListener('click', () => onDelete(drawing.id));

        item.append(open, remove);
        list.appendChild(item);
    }

    if (!drawings.length) {
        const empty = document.createElement('li');
        empty.style.padding = '10px';
        empty.style.color = 'var(--ink-faint)';
        empty.textContent = 'No drawings saved yet.';
        list.appendChild(empty);
    }
}

/**
 * The examples dialog.
 * @param {HTMLElement} list
 * @param {ReadonlyArray<{id: string, name: string, uses: string}>} examples
 * @param {(id: string) => void} onPick
 */
export function renderExamples(list, examples, onPick) {
    list.replaceChildren();

    for (const example of examples) {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';

        const title = document.createElement('span');
        title.className = 'title';
        title.textContent = example.name;

        const uses = document.createElement('span');
        uses.className = 'uses';
        uses.textContent = example.uses;

        button.append(title, uses);
        button.addEventListener('click', () => onPick(example.id));
        item.appendChild(button);
        list.appendChild(item);
    }
}

/** A popup that closes when you click away from it or press Escape. */
export function attachMenu(button, menu) {
    const close = () => {
        menu.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        document.removeEventListener('pointerdown', onOutside, true);
        document.removeEventListener('keydown', onKey, true);
    };

    const onOutside = (event) => {
        if (!menu.contains(event.target) && event.target !== button) close();
    };
    const onKey = (event) => { if (event.key === 'Escape') close(); };

    button.addEventListener('click', () => {
        if (!menu.hidden) return close();
        menu.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        document.addEventListener('pointerdown', onOutside, true);
        document.addEventListener('keydown', onKey, true);
    });

    // Acting on an item is the end of the interaction, but the settings
    // controls inside the menu are not items.
    menu.addEventListener('click', (event) => {
        if (event.target.closest('button[data-export]')) close();
    });

    return { close };
}

/** Content of the help dialog, built once. */
export function helpContent() {
    const wrap = document.createElement('div');

    const intro = document.createElement('p');
    intro.textContent =
        'WebTikZ compiles TikZ in your browser with TikZJax: a TeX engine built to '
        + 'WebAssembly, with PGF/TikZ preloaded. Nothing is uploaded anywhere.';
    wrap.appendChild(intro);

    wrap.appendChild(section('Shortcuts', [
        ['Ctrl / Cmd + Enter', 'Render now'],
        ['Ctrl / Cmd + S', 'Save the TeX source'],
        ['Ctrl / Cmd + O', 'Open a .tex file'],
        ['Ctrl / Cmd + Shift + C', 'Copy the picture'],
        ['Ctrl / Cmd + Space', 'Complete a command'],
        ['Ctrl / Cmd + F', 'Find in the editor'],
        ['Ctrl / Cmd + 0', 'Zoom back to 100%'],
        ['Drag, or scroll', 'Move around the canvas'],
        ['Ctrl / Cmd + scroll', 'Zoom the canvas'],
        ['F1', 'This window']
    ], { keys: true }));

    wrap.appendChild(section('What the engine can do', [
        ['Libraries', 'Every TikZ library is available, but you have to tick it under Libraries.'],
        ['Packages', 'amsmath, pgfplots, tikz-cd, tikz-3dplot, array, xparse and a few more.'],
        ['Fonts', 'Computer Modern only, and text is set by TeX itself.'],
        ['Not available', '\\includegraphics, external files, shell-escape, LuaTeX-only features.']
    ], { keys: false }));

    const cache = document.createElement('p');
    cache.textContent =
        'Pictures you have already compiled come back from a cache in the browser, '
        + 'which is why an unchanged drawing reappears instantly and prints no TeX output.';
    wrap.appendChild(cache);

    return wrap;
}

/**
 * @param {string} heading
 * @param {Array<[string, string]>} rows
 * @param {{keys: boolean}} options whether the left column holds keystrokes;
 *   a keycap around a word that is not a key just misleads
 */
function section(heading, rows, { keys }) {
    const wrap = document.createElement('section');
    const title = document.createElement('h3');
    title.textContent = heading;

    const table = document.createElement('table');
    for (const [left, right] of rows) {
        const tr = document.createElement('tr');
        const td1 = document.createElement('td');
        const label = document.createElement(keys ? 'kbd' : 'strong');
        label.textContent = left;
        td1.appendChild(label);
        const td2 = document.createElement('td');
        td2.textContent = right;
        tr.append(td1, td2);
        table.appendChild(tr);
    }

    wrap.append(title, table);
    return wrap;
}
