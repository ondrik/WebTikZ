# WebTikZ

A TikZ editor that runs entirely in your browser — a web counterpart to
[QTikZ](https://github.com/fhackenberger/ktikz). Write TikZ on the left, watch
the picture appear on the right.

**<https://ondrik.github.io/WebTikZ/>**

There is no server, no account, and no build step. TeX itself runs in the page:
the engine is [TikZJax](https://github.com/drgrice1/tikzjax), a real TeX
compiled to WebAssembly with PGF/TikZ preloaded, running in a Web Worker. Your
drawings never leave the browser.

```sh
git clone <this repository>
cd WebTikZ
./serve.sh            # then open http://localhost:8000
```

## What it does

**Write and see.** A CodeMirror editor with LaTeX highlighting, bracket
matching, TikZ completions (<kbd>Ctrl</kbd>+<kbd>Space</kbd>), and search. The
picture is recompiled a moment after you stop typing, or on
<kbd>Ctrl</kbd>+<kbd>Enter</kbd>.

**Preamble and libraries, like QTikZ's templates.** A separate preamble tab for
`\tikzset`, macros and colours, and a picker for the 80 TikZ libraries and 14
TeX packages the engine can load. The picker is generated from the vendored TeX
files, so anything it offers will compile — `arrows.meta`, `automata`,
`decorations.*`, `pgfplots`, `tikz-cd`, `tikz-3dplot` and the rest.

**Errors that point somewhere.** The TeX transcript is shown as it was written,
with the errors pulled out of it and mapped back to the line you wrote — click
one and the cursor lands there, with the line marked in the gutter.

**A canvas, not a thumbnail.** Zoom, pan, fit; a ruler grid where one square is
one TikZ centimetre; the picture's real size in points and centimetres; paper,
transparent or dark backgrounds, and a light-ink switch for dark ones.

**Get the picture out.** Save as SVG or PNG (1×, 2×, 4×), copy either to the
clipboard, or save a `.tex` file that compiles with a real LaTeX. Exported
files embed the Computer Modern faces they use, so text survives the trip.

**Settings where you expect them.** The gear menu switches the editor between
standard, Vim, Emacs and Sublime keys, sets how long after a keystroke the
picture is recompiled, and clears the picture cache when you want TeX to run
again from scratch.

**Keep your work.** Drawings are saved in the browser as you type, listed in a
sidebar, and can be exported as a JSON file. Any drawing can also be put in a
link: the whole thing travels compressed in the URL fragment, so sharing one
uploads nothing.

Open a `.tex` file (or drop one on the window) and WebTikZ takes it apart into
picture, preamble, libraries and packages, saying what it had to leave out.

## Running it

WebTikZ cannot be opened as a `file://` URL. TeX runs in a Web Worker, which
`file://` does not allow, and TikZJax keys its cache with `crypto.subtle`, which
browsers only expose in a secure context. Serve the directory:

```sh
./serve.sh [port]                        # python3 -m http.server, localhost only
python3 -m http.server 8000              # the same thing by hand
npx serve .                              # or any other static server
```

For deployment, copy the whole directory to any static host — GitHub Pages,
Netlify, a university web space. It is ordinary files; `https` or `localhost` is
the only requirement. The first visit downloads about 7 MB of engine (the TeX
core dump and the fonts), which the browser then caches.

This copy is published straight from `master` (Pages source: branch `master`,
folder `/`), so a push deploys it. The one thing a host has to get right is
serving `vendor/tikzjax/*.gz` as files rather than as gzip *transfer* encoding;
GitHub Pages does, sending them as `application/gzip` with no
`Content-Encoding`. A host that sets that header instead will break the engine,
because the worker unpacks those files itself.

## What TikZJax can and cannot do

It is a real TeX, but a fixed one. It has PGF/TikZ, the `standalone` class and
`xcolor` preloaded, and can load the TikZ libraries and the packages listed in
the Libraries tab. It cannot do anything that needs the outside world or a
different engine:

- no `\includegraphics`, no reading or writing files, no shell-escape;
- no packages beyond the vendored ones (no `fontspec`, `siunitx`, `chemfig`, …);
- Computer Modern only — TeX sets the text, so there are no system fonts;
- no LuaTeX-only features, which rules out `graphdrawing` and contour plots;
- each render allocates a large WebAssembly heap, so very heavy pictures are
  slow and very heavy ones may exhaust memory.

A picture you have already compiled comes back from an IndexedDB cache
instantly, which is also why it prints no TeX output the second time. Press
**Render** to compile it again for real.

## Keyboard

| | |
|---|---|
| <kbd>Ctrl</kbd>+<kbd>Enter</kbd> | Render now |
| <kbd>Ctrl</kbd>+<kbd>S</kbd> | Save the TeX source |
| <kbd>Ctrl</kbd>+<kbd>O</kbd> | Open a `.tex` file |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> | Copy the picture |
| <kbd>Ctrl</kbd>+<kbd>Space</kbd> | Complete a command |
| <kbd>Ctrl</kbd>+<kbd>0</kbd> / <kbd>+</kbd> / <kbd>−</kbd> | Zoom |
| <kbd>Ctrl</kbd>+scroll | Zoom the canvas |
| <kbd>F1</kbd> | Help |

## Working on it

No dependencies, no build step, no `node_modules`. Source is native ES modules
in `src/`, loaded directly by `index.html`.

```sh
npm test              # node --test tests/*.test.js -- the DOM-free modules
npm run smoke         # drives the app in headless Chrome and checks it works
npm run smoke:all     # ...and compiles every example
npm run vendor        # re-fetch TikZJax and CodeMirror, then regenerate the catalog
```

The smoke test speaks the Chrome DevTools protocol directly (`tools/cdp.mjs`,
about 150 lines) and needs nothing but Chrome or Chromium on `PATH`.

| | |
|---|---|
| `src/tikzjax.js` | the bridge to the engine: insert a `text/tikz` script, watch for the SVG, the error marker, or silence |
| `src/texlog.js` | turns a TeX transcript into errors that point at a line |
| `src/document.js` | what a drawing is; reads and writes `.tex` |
| `src/catalog.js` | **generated** by `tools/gen-catalog.mjs` from the vendored TeX files |
| `src/preview.js`, `src/editor.js`, `src/exporter.js`, `src/ui.js` | the parts that touch the DOM |
| `src/main.js` | the wiring |

TikZJax has no API — it watches the page for `<script type="text/tikz">` tags
and replaces them with SVG, reporting what TeX said through `console.log`. The
shim at the top of `index.html` is there to catch that output; it has to run
before the engine loads.

## Licensing

WebTikZ is free software under the GNU GPL version 3; see `LICENSE`. It ships
third-party components under their own licenses in `vendor/`; see `NOTICE`.
TikZJax is Glenn Rice's fork of Jim Fowler's original, which is built on
`web2js` and `dvi2html`; the editor is CodeMirror 5.
