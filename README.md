# WebTikZ

A TikZ editor that runs entirely in the browser — a web counterpart to
[QTikZ](https://github.com/fhackenberger/ktikz): write TikZ on the left, watch
the picture appear on the right.

There is no server and no build step. The rendering backend is
[TikZJax](https://github.com/drgrice1/tikzjax): a real TeX engine compiled to
WebAssembly, with PGF/TikZ preloaded, running in a Web Worker in your browser.

*Work in progress — see the sections below as they get filled in.*

## Running it

WebTikZ cannot be opened as a `file://` URL: TeX runs in a Web Worker (not
allowed on `file://`) and TikZJax caches results with `crypto.subtle`, which
browsers only expose in a secure context. Serve the directory instead:

```sh
./serve.sh          # http://localhost:8000
```

Any static web server works, as does any static host (GitHub Pages, Netlify,
…) — the whole application is plain files.

## Licensing

WebTikZ is free software under the GNU GPL version 3; see `LICENSE`. It ships
third-party components under their own licenses in `vendor/`; see `NOTICE`.
