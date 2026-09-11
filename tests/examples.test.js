import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TEX_PACKAGES, TIKZ_LIBRARIES } from '../src/catalog.js';
import { EXAMPLES } from '../src/examples.js';
import { LIBRARY_NOTES, PACKAGE_NOTES } from '../src/tikzdata.js';

// Whether the examples actually compile is tools/smoke.mjs's job; this is the
// cheap half of that question, and it runs in milliseconds.
test('every example asks only for things the engine has', () => {
    for (const example of EXAMPLES) {
        for (const library of example.libraries) {
            assert.ok(TIKZ_LIBRARIES.includes(library), `${example.id}: no such library ${library}`);
        }
        for (const pkg of example.packages) {
            assert.ok(TEX_PACKAGES.includes(pkg), `${example.id}: no such package ${pkg}`);
        }
    }
});

test('every example is complete enough to open', () => {
    const ids = new Set();
    for (const example of EXAMPLES) {
        assert.ok(!ids.has(example.id), `duplicate id ${example.id}`);
        ids.add(example.id);
        assert.ok(example.name.length > 0, `${example.id} has no name`);
        assert.ok(example.uses.length > 0, `${example.id} does not say what it shows`);
        assert.match(example.code, /\\begin\{(tikzpicture|tikzcd)\}/, `${example.id} has no picture`);
    }
});

test('the pickers describe everything they offer', () => {
    for (const library of TIKZ_LIBRARIES) {
        assert.ok(LIBRARY_NOTES[library], `no description for the ${library} library`);
    }
    for (const pkg of TEX_PACKAGES) {
        assert.ok(PACKAGE_NOTES[pkg], `no description for the ${pkg} package`);
    }
});

test('the pickers do not describe things that are not there', () => {
    for (const library of Object.keys(LIBRARY_NOTES)) {
        assert.ok(TIKZ_LIBRARIES.includes(library), `${library} is described but not vendored`);
    }
    for (const pkg of Object.keys(PACKAGE_NOTES)) {
        assert.ok(TEX_PACKAGES.includes(pkg), `${pkg} is described but not vendored`);
    }
});
