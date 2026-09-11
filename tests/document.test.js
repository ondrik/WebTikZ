import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TEX_PACKAGES, TIKZ_LIBRARIES } from '../src/catalog.js';
import {
    fileNameFor, fromTex, makeDrawing, renderAttributes, toStandaloneTex
} from '../src/document.js';

test('a new drawing has something to render', () => {
    const drawing = makeDrawing();
    assert.match(drawing.code, /\\begin\{tikzpicture\}/);
    assert.deepEqual(drawing.libraries, []);
});

test('makeDrawing copies the arrays it is given', () => {
    const libraries = ['calc'];
    const drawing = makeDrawing({ libraries });
    libraries.push('fit');
    assert.deepEqual(drawing.libraries, ['calc']);
});

test('render attributes carry what the engine needs, and nothing else', () => {
    const plain = renderAttributes(makeDrawing());
    assert.deepEqual(plain, { showConsole: 'true' });

    const full = renderAttributes(makeDrawing({
        libraries: ['calc', 'arrows.meta'],
        packages: ['pgfplots'],
        preamble: '\\pgfplotsset{compat=1.18}'
    }));
    assert.equal(full.tikzLibraries, 'calc,arrows.meta');
    assert.deepEqual(JSON.parse(full.texPackages), { pgfplots: '' });
    assert.equal(full.addToPreamble, '\\pgfplotsset{compat=1.18}');
});

test('the saved .tex compiles on its own', () => {
    const tex = toStandaloneTex(makeDrawing({
        code: '\\begin{tikzpicture}\\draw (0,0);\\end{tikzpicture}',
        libraries: ['calc'],
        packages: ['amsmath'],
        preamble: '\\def\\x{1}'
    }));

    assert.match(tex, /^\\documentclass\[border=2mm\]\{standalone\}/);
    assert.match(tex, /\\usepackage\{tikz\}/);
    assert.match(tex, /\\usepackage\{amsmath\}/);
    assert.match(tex, /\\usetikzlibrary\{calc\}/);
    assert.ok(tex.indexOf('\\def\\x{1}') < tex.indexOf('\\begin{document}'));
    assert.ok(tex.indexOf('\\begin{tikzpicture}') > tex.indexOf('\\begin{document}'));
    assert.match(tex, /\\end\{document\}\n$/);
});

test('a pasted document is taken apart into its pieces', () => {
    const drawing = fromTex(`\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{tikz}
\\usetikzlibrary{arrows.meta, calc}
\\newcommand{\\R}{\\mathbb{R}}
\\begin{document}
\\begin{tikzpicture}
  \\draw (0,0) -- (1,1);
\\end{tikzpicture}
\\end{document}`);

    assert.deepEqual(drawing.libraries, ['arrows.meta', 'calc']);
    assert.deepEqual(drawing.packages, ['amsmath']);
    assert.equal(drawing.preamble, '\\newcommand{\\R}{\\mathbb{R}}');
    assert.match(drawing.code, /^\\begin\{tikzpicture\}/);
    assert.ok(!drawing.code.includes('\\end{document}'));
});

test('what the engine cannot load is reported rather than silently kept', () => {
    const drawing = fromTex(`\\documentclass{standalone}
\\usepackage{geometry}
\\usetikzlibrary{nonexistent}
\\begin{document}
\\begin{tikzpicture}\\end{tikzpicture}
\\end{document}`);

    assert.deepEqual(drawing.packages, []);
    assert.deepEqual(drawing.libraries, []);
    assert.deepEqual(drawing.dropped,
        ['\\documentclass{standalone}', '\\usepackage{geometry}', '\\usetikzlibrary{nonexistent}']);
});

test('packages the engine loads by itself are not requested again', () => {
    const drawing = fromTex('\\usepackage{tikz}\n\\usepackage{xcolor}\n\\begin{document}\nx\n\\end{document}');
    assert.deepEqual(drawing.packages, []);
    assert.deepEqual(drawing.dropped, []);
});

test('bare picture code is taken as it is', () => {
    const drawing = fromTex('\\begin{tikzpicture}\\draw (0,0) circle (1);\\end{tikzpicture}');
    assert.match(drawing.code, /^\\begin\{tikzpicture\}/);
    assert.deepEqual(drawing.dropped, []);
});

test('everything a drawing asks for is something the engine has', () => {
    // fromTex is the only place drawings come in from outside, so this is where
    // an unavailable name would slip through.
    const drawing = fromTex(`\\usetikzlibrary{positioning,automata}
\\usepackage{pgfplots}
\\begin{document}
x
\\end{document}`);
    for (const library of drawing.libraries) assert.ok(TIKZ_LIBRARIES.includes(library), library);
    for (const pkg of drawing.packages) assert.ok(TEX_PACKAGES.includes(pkg), pkg);
});

test('file names survive awkward drawing names', () => {
    assert.equal(fileNameFor('My drawing: #3!', 'svg'), 'My-drawing-3.svg');
    assert.equal(fileNameFor('   ', 'png'), 'drawing.png');
    assert.equal(fileNameFor('../../etc/passwd', 'tex'), 'etcpasswd.tex');
});
