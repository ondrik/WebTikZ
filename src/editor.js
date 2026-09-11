// The editor: CodeMirror 5, set up for TeX.
//
// Version 5 loads from plain script tags, which is what keeps this project free
// of a build step; it is exposed as the global CodeMirror by index.html.

import { COMPLETIONS } from './tikzdata.js';

const THEMES = { light: 'idea', dark: 'material-darker' };

/**
 * @param {HTMLTextAreaElement} textarea
 * @param {object} options
 * @param {() => void} [options.onChange]
 * @param {(line: number, ch: number) => void} [options.onCursor]
 * @param {() => void} [options.onRender]  Ctrl+Enter
 * @param {() => void} [options.onSave]    Ctrl+S
 * @param {string} [options.placeholder]
 */
export function createEditor(textarea, options = {}) {
    const cm = CodeMirror.fromTextArea(textarea, {
        mode: 'stex',
        lineNumbers: true,
        lineWrapping: true,
        indentUnit: 2,
        tabSize: 2,
        indentWithTabs: false,
        matchBrackets: true,
        autoCloseBrackets: '()[]{}$$',
        styleActiveLine: { nonEmpty: true },
        showTrailingSpace: true,
        foldGutter: true,
        gutters: ['CodeMirror-linenumbers', 'tex-errors', 'CodeMirror-foldgutter'],
        placeholder: options.placeholder ?? '',
        theme: THEMES.light,
        extraKeys: {
            'Ctrl-Enter': () => options.onRender?.(),
            'Cmd-Enter': () => options.onRender?.(),
            'Ctrl-S': () => options.onSave?.(),
            'Cmd-S': () => options.onSave?.(),
            'Ctrl-Space': 'autocomplete',
            'Ctrl-/': 'toggleComment',
            'Cmd-/': 'toggleComment',
            Tab: (editor) => {
                if (editor.somethingSelected()) editor.indentSelection('add');
                else editor.replaceSelection('  ', 'end');
            }
        },
        hintOptions: { hint: tikzHints, completeSingle: false }
    });

    cm.on('change', () => options.onChange?.());
    cm.on('cursorActivity', () => {
        const where = cm.getCursor();
        options.onCursor?.(where.line + 1, where.ch + 1);
    });

    // Offer completions as soon as a command is being typed: a backslash
    // followed by letters is never anything else.
    cm.on('inputRead', (editor, change) => {
        if (editor.state.completionActive || change.origin !== '+input') return;
        const line = editor.getLine(editor.getCursor().line).slice(0, editor.getCursor().ch);
        if (/\\[a-zA-Z]{2,}$/.test(line)) editor.showHint({ hint: tikzHints, completeSingle: false });
    });

    /** @type {number[]} lines currently marked with an error */
    let marked = [];

    return {
        cm,

        getValue: () => cm.getValue(),

        setValue(text) {
            if (cm.getValue() === text) return;
            const cursor = cm.getCursor();
            cm.setValue(text);
            // Keep the caret where it was when a re-load is really the same
            // document arriving again (an undo of an external change, say).
            if (cursor.line < cm.lineCount()) cm.setCursor(cursor);
            cm.clearHistory();
        },

        focus: () => cm.focus(),
        refresh: () => cm.refresh(),

        setTheme(mode) {
            cm.setOption('theme', THEMES[mode] ?? THEMES.light);
        },

        setKeymap(name) {
            cm.setOption('keyMap', name === 'default' ? 'default' : name);
        },

        /**
         * Underline the lines TeX complained about.
         * @param {Array<{line: number, severity: string, message: string}>} issues
         */
        markErrors(issues) {
            for (const line of marked) {
                cm.removeLineClass(line, 'background', 'cm-tex-error');
                cm.setGutterMarker(line, 'tex-errors', null);
            }
            marked = [];

            for (const issue of issues) {
                const line = issue.line - 1;
                if (line < 0 || line >= cm.lineCount()) continue;
                cm.addLineClass(line, 'background', 'cm-tex-error');

                const marker = document.createElement('span');
                marker.className = 'gutter-error';
                marker.textContent = '!';
                marker.title = issue.message;
                cm.setGutterMarker(line, 'tex-errors', marker);
                marked.push(line);
            }
        },

        goToLine(line) {
            const target = Math.max(0, Math.min(cm.lineCount() - 1, line - 1));
            cm.setCursor({ line: target, ch: 0 });
            cm.scrollIntoView({ line: target, ch: 0 }, 120);
            cm.focus();
        }
    };
}

/** Completions for TikZ: commands from the list, plus words already on screen. */
function tikzHints(cm) {
    const cursor = cm.getCursor();
    const line = cm.getLine(cursor.line);
    const start = /[\\a-zA-Z.]*$/.exec(line.slice(0, cursor.ch))[0];
    const from = { line: cursor.line, ch: cursor.ch - start.length };

    const seen = new Set();
    const list = [];
    for (const candidate of COMPLETIONS) {
        if (!candidate.toLowerCase().startsWith(start.toLowerCase()) || seen.has(candidate)) continue;
        seen.add(candidate);
        list.push(candidate);
    }

    // Names the user has already used in this picture -- node names, styles.
    if (start.length >= 2) {
        for (const word of new Set(cm.getValue().match(/[A-Za-z][\w.-]{2,}/g) ?? [])) {
            if (word.toLowerCase().startsWith(start.toLowerCase()) && !seen.has(word)) {
                seen.add(word);
                list.push(word);
            }
        }
    }

    return { list: list.slice(0, 40), from, to: cursor };
}
