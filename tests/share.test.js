import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeDrawing } from '../src/document.js';
import { fromFragment, toFragment } from '../src/share.js';

test('a drawing survives the trip through a link', async () => {
    const drawing = makeDrawing({
        name: 'Bézier ✎',
        code: '\\begin{tikzpicture}\n  \\draw (0,0) .. controls (1,1) .. (2,0);\n\\end{tikzpicture}',
        preamble: '\\tikzset{every node/.style={draw}}',
        libraries: ['calc', 'arrows.meta'],
        packages: ['amsmath']
    });

    const back = await fromFragment(await toFragment(drawing));

    assert.equal(back.name, drawing.name);
    assert.equal(back.code, drawing.code);
    assert.equal(back.preamble, drawing.preamble);
    assert.deepEqual(back.libraries, drawing.libraries);
    assert.deepEqual(back.packages, drawing.packages);
});

test('the fragment is compressed, not just encoded', async () => {
    const drawing = makeDrawing({ code: '\\draw (0,0) circle (1);\n'.repeat(60) });
    const fragment = await toFragment(drawing);
    assert.ok(fragment.startsWith('#z='));
    assert.ok(fragment.length < 400, `fragment was ${fragment.length} characters`);
});

test('the fragment is URL-safe', async () => {
    const fragment = await toFragment(makeDrawing({ code: 'a'.repeat(500) }));
    assert.match(fragment.slice(1), /^z=[A-Za-z0-9_-]+$/);
});

test('nonsense in the fragment opens nothing rather than breaking', async () => {
    assert.equal(await fromFragment(''), null);
    assert.equal(await fromFragment('#'), null);
    assert.equal(await fromFragment('#z=not-valid-base64!!'), null);
    assert.equal(await fromFragment('#z=AAAA'), null);
    assert.equal(await fromFragment('#other=thing'), null);
});
