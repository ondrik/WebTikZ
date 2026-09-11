// Does WebTikZ actually work in a browser?
//
// `node --test tests/*.test.js` covers the parts that run without a DOM.  This
// covers the part that cannot: TeX really compiling in a Web Worker, the picture
// arriving, errors coming back as errors, and a PNG being produced.
//
//     node tools/smoke.mjs                 the checks below
//     node tools/smoke.mjs --examples      also compile every example
//     node tools/smoke.mjs --shots out/    write screenshots
//
// Needs Google Chrome or Chromium on PATH; nothing else.

import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, launchChrome, newPage } from './cdp.mjs';
import { serve } from './serve.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const wantExamples = args.includes('--examples');
const shotsAt = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;

const RENDER_TIMEOUT = 180000;   // the first one downloads and boots the engine

let failures = 0;
const check = (name, ok, detail = '') => {
    if (!ok) failures++;
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

/** The editor is a CodeMirror; its wrapper element exposes the instance. */
const setCode = (text) =>
    `document.querySelectorAll('.CodeMirror')[0].CodeMirror.setValue(${JSON.stringify(text)})`;

const site = await serve(root);
const chrome = await launchChrome();
const browser = await connect(chrome.wsUrl);
const page = await newPage(browser, { width: 1440, height: 900 });

const renderCount = () => page.evaluate('Number(document.body.dataset.renders ?? 0)');

/**
 * Wait for a render to finish, then report what the app is showing.
 * @param {number} after wait for a render later than this one (see renderCount);
 *   the default waits for the first render of all
 */
const settled = async (after = 0, timeout = RENDER_TIMEOUT) => {
    await page.waitFor(`Number(document.body.dataset.renders ?? 0) > ${after}`, { timeout });
    return page.evaluate(`({
        status: document.getElementById('status-state').textContent,
        timing: document.getElementById('status-timing').textContent,
        dimensions: document.getElementById('dimensions').textContent,
        log: document.getElementById('log-status').textContent,
        error: document.querySelector('.canvas-error h2')?.textContent ?? null,
        issues: [...document.querySelectorAll('#issues li')].map((li) => li.textContent),
        hasSvg: !!document.querySelector('#stage svg')
    })`);
};

try {
    console.log(`# WebTikZ smoke test — ${chrome.version}\n`);

    await page.goto(site.url);
    check('the page loads', await page.evaluate('document.title') === 'WebTikZ — a TikZ editor in the browser');

    // 1. The picture a first-time visitor sees.
    let state = await settled();
    check('the starting picture compiles', state.hasSvg && !state.error, state.status);
    check('its size is reported', /pt/.test(state.dimensions), state.dimensions);
    check('no warning or error in the log', state.log === 'no problems' || state.log === '', state.log);

    if (shotsAt) {
        await mkdir(shotsAt, { recursive: true });
        await page.screenshot(join(shotsAt, 'light.png'));
    }

    // 2. A mistake has to come back as a mistake, pointing at the right line.
    let before = await renderCount();
    await page.evaluate(setCode('\\begin{tikzpicture}\n  \\draw (0,0) -- ;\n\\end{tikzpicture}'));
    state = await settled(before);
    check('a broken picture reports an error', state.error !== null, state.error ?? 'no error shown');
    check('the error names a line in the picture',
        state.issues.some((i) => /Picture, line \d/.test(i)),
        state.issues[0] ?? 'no issues listed');

    // 3. And fixing it has to recover.
    before = await renderCount();
    await page.evaluate(setCode('\\begin{tikzpicture}\n  \\draw[thick] (0,0) circle (1);\n\\end{tikzpicture}'));
    state = await settled(before);
    check('fixing the picture renders again', state.hasSvg && !state.error, state.status);

    // 4. A TeX package that has to be fetched on demand.
    before = await renderCount();
    await page.evaluate(`document.getElementById('btn-examples').click()`);
    await page.evaluate(`[...document.querySelectorAll('#examplelist button')]
        .find((b) => b.textContent.includes('Function plot')).click()`);
    state = await settled(before);
    check('the pgfplots example compiles', state.hasSvg && !state.error, state.error ?? state.status);

    // 5. Exporting has to produce a real file, with the fonts inside it.
    const png = await page.evaluate(`(async () => {
        const { toPngBlob, selfContainedSvg } = await import('./src/exporter.js');
        const svg = document.querySelector('#stage svg');
        const blob = await toPngBlob(svg, { scale: 2, opaque: true });
        const { markup } = await selfContainedSvg(svg);
        return { bytes: blob.size, fonts: (markup.match(/@font-face/g) || []).length,
                 embedded: markup.includes('data:font/woff2;base64,') };
    })()`);
    check('PNG export produces an image', png.bytes > 5000, `${png.bytes} bytes`);
    check('SVG export embeds its fonts', png.embedded && png.fonts > 0, `${png.fonts} faces`);

    // 6. A link has to survive the round trip.
    const shared = await page.evaluate(`(async () => {
        const { toFragment, fromFragment } = await import('./src/share.js');
        const drawing = { name: 'x', code: '\\\\draw (0,0);', preamble: '', libraries: ['calc'], packages: [] };
        const back = await fromFragment(await toFragment(drawing));
        return back.code === drawing.code && back.libraries[0] === 'calc';
    })()`);
    check('a drawing survives a share link', shared === true);

    // 7. The dark theme is a supported way to work, not an afterthought.
    await page.evaluate(`document.getElementById('btn-theme').click()`);
    const dark = await page.evaluate(`document.documentElement.dataset.theme`);
    check('the dark theme applies', dark === 'dark', dark);
    if (shotsAt) await page.screenshot(join(shotsAt, 'dark.png'));
    await page.evaluate(`document.getElementById('btn-theme').click()`);

    // 8. The settings the toolbar offers have to take effect.
    // Each evaluate shares one global scope, so these stay expressions.
    await page.evaluate(`(() => {
        document.getElementById('btn-settings').click();
        const keys = document.getElementById('sel-keymap');
        keys.value = 'vim';
        keys.dispatchEvent(new Event('change'));
    })()`);
    const keymap = await page.evaluate(`document.querySelectorAll('.CodeMirror')[0].CodeMirror.getOption('keyMap')`);
    check('the editor keymap can be changed', keymap === 'vim', String(keymap));
    await page.evaluate(`(() => {
        const keys = document.getElementById('sel-keymap');
        keys.value = 'default';
        keys.dispatchEvent(new Event('change'));
    })()`);

    // 9. Every example, if asked: this is the slow one.
    if (wantExamples) {
        const names = await page.evaluate(`(async () => (await import('./src/examples.js')).EXAMPLES.map((e) => e.name))()`);
        for (const name of names) {
            const mark = await renderCount();
            await page.evaluate(`document.getElementById('btn-examples').click()`);
            await page.evaluate(`[...document.querySelectorAll('#examplelist button')]
                .find((b) => b.textContent.includes(${JSON.stringify(name)})).click()`);
            const result = await settled(mark);
            check(`example: ${name}`, result.hasSvg && !result.error, result.error ?? result.log);
        }
    }

    const errors = page.errors.filter((e) => !e.includes('invalid.site'));
    check('the browser console stays clean', errors.length === 0, errors.slice(0, 2).join(' | '));
} catch (error) {
    check('the run completed', false, error.message);
    console.error(error);
} finally {
    await chrome.close().catch(() => {});
    await site.close();
}

console.log(`\n${failures ? `${failures} check(s) failed` : 'all checks passed'}`);
process.exit(failures ? 1 : 0);
