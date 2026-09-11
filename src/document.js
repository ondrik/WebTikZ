// What a drawing is, and how it turns into TeX.
//
// A drawing is the picture body plus everything the engine needs to compile it:
// a preamble, TikZ libraries and TeX packages.  Keeping those four together is
// what lets a drawing be saved, shared in a link, or written out as a .tex file
// that compiles anywhere.  No DOM here either, so `node --test` can check it.

import { TEX_PACKAGES, TIKZ_LIBRARIES } from './catalog.js';

/** @typedef {{name: string, code: string, preamble: string, libraries: string[], packages: string[]}} Drawing */

/** Loaded by the engine before the preamble runs, so requesting them is moot. */
const ALWAYS_LOADED = new Set(['tikz', 'pgf', 'xcolor', 'color', 'inputenc', 'fontenc']);

export const STARTER_CODE = `\\begin{tikzpicture}
  \\draw[help lines, step=0.5] (-1.4,-1.4) grid (1.4,1.4);
  \\draw[->] (-1.5,0) -- (1.5,0) node[right] {$x$};
  \\draw[->] (0,-1.5) -- (0,1.5) node[above] {$y$};
  \\draw[thick, blue] (0,0) circle (1);
  \\fill[red] (45:1) circle (1.5pt) node[above right] {$e^{i\\pi/4}$};
\\end{tikzpicture}`;

/**
 * @param {Partial<Drawing>} [fields]
 * @returns {Drawing}
 */
export function makeDrawing(fields = {}) {
    return {
        name: fields.name ?? 'Untitled drawing',
        code: fields.code ?? STARTER_CODE,
        preamble: fields.preamble ?? '',
        libraries: [...(fields.libraries ?? [])],
        packages: [...(fields.packages ?? [])]
    };
}

/**
 * The data attributes TikZJax reads off a text/tikz script tag.
 *
 * @param {Drawing} drawing
 * @returns {Record<string, string>}
 */
export function renderAttributes(drawing) {
    const data = { showConsole: 'true' };
    if (drawing.libraries.length) data.tikzLibraries = drawing.libraries.join(',');
    if (drawing.packages.length) {
        data.texPackages = JSON.stringify(Object.fromEntries(drawing.packages.map((p) => [p, ''])));
    }
    if (drawing.preamble.trim()) data.addToPreamble = drawing.preamble;
    return data;
}

/**
 * A standalone document that compiles with a real LaTeX -- what you get when
 * you save a drawing as .tex.  `standalone` with a small border is what QTikZ
 * produces too, and it crops to the picture.
 *
 * @param {Drawing} drawing
 * @returns {string}
 */
export function toStandaloneTex(drawing) {
    const lines = ['\\documentclass[border=2mm]{standalone}', '\\usepackage{tikz}'];

    for (const pkg of drawing.packages) lines.push(`\\usepackage{${pkg}}`);
    if (drawing.libraries.length) lines.push(`\\usetikzlibrary{${drawing.libraries.join(',')}}`);
    if (drawing.preamble.trim()) lines.push('', drawing.preamble.replace(/\s+$/, ''));

    lines.push('', '\\begin{document}', drawing.code.replace(/\s+$/, ''), '\\end{document}', '');
    return lines.join('\n');
}

/**
 * Take a complete .tex file apart into a drawing.
 *
 * People paste whole documents -- from a paper, from a colleague -- and TikZJax
 * supplies its own \documentclass and \begin{document}, so a pasted file would
 * otherwise fail in a way that says nothing useful.  Anything that is not a
 * recognised preamble line is kept in the preamble verbatim, so nothing is lost.
 *
 * @param {string} text
 * @returns {Drawing & {dropped: string[]}} `dropped` lists preamble lines that
 *   were left out, either because the engine supplies them itself or because
 *   the package is not one of the vendored ones.
 */
export function fromTex(text) {
    const source = String(text ?? '');
    const body = /\\begin\{document\}([\s\S]*?)(?:\\end\{document\}|$)/.exec(source);

    if (!body) {
        // No document environment: treat the whole thing as picture code.
        return { ...makeDrawing({ code: source.trim() }), dropped: [] };
    }

    const preambleText = source.slice(0, body.index);
    const code = body[1].replace(/^\n+/, '').replace(/\s+$/, '');

    const libraries = [];
    const packages = [];
    const dropped = [];
    const keep = [];

    for (const line of preambleText.split('\n')) {
        const libs = /^\s*\\usetikzlibrary\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}\s*$/.exec(line);
        if (libs) {
            for (const name of libs[1].split(',').map((l) => l.trim()).filter(Boolean)) {
                if (TIKZ_LIBRARIES.includes(name)) libraries.push(name);
                else dropped.push(`\\usetikzlibrary{${name}}`);
            }
            continue;
        }

        const pkg = /^\s*\\usepackage\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}\s*$/.exec(line);
        if (pkg) {
            for (const name of pkg[1].split(',').map((p) => p.trim()).filter(Boolean)) {
                // tikz and xcolor come with the engine; anything it has no TeX
                // source for has to go, or the compile stops on a missing file.
                if (ALWAYS_LOADED.has(name)) continue;
                if (TEX_PACKAGES.includes(name)) packages.push(name);
                else dropped.push(`\\usepackage{${name}}`);
            }
            continue;
        }

        // The document class and the input encoding are the engine's business.
        if (/^\s*\\documentclass/.test(line) || /^\s*\\(input|include)\b/.test(line)) {
            if (line.trim()) dropped.push(line.trim());
            continue;
        }

        keep.push(line);
    }

    return {
        ...makeDrawing({
            code,
            preamble: keep.join('\n').replace(/^\s*\n/gm, '\n').trim(),
            libraries: [...new Set(libraries)],
            packages: [...new Set(packages)]
        }),
        dropped
    };
}

/**
 * A filename for a drawing: its name, made safe, with the given extension.
 *
 * @param {string} name
 * @param {string} extension
 */
export function fileNameFor(name, extension) {
    const base = String(name ?? '')
        .trim()
        .replace(/[^\w.\- ]+/g, '')
        .replace(/\s+/g, '-')
        .replace(/^[-.]+|[-.]+$/g, '')
        .slice(0, 60);
    return `${base || 'drawing'}.${extension}`;
}
