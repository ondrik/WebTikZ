#!/bin/sh
# Re-vendor the third-party assets that WebTikZ ships in vendor/.
#
# Everything WebTikZ depends on is committed to this repository, so you only
# need this script to upgrade a dependency (or to verify what is committed).
# Run it from anywhere:
#
#     ./tools/fetch-vendor.sh
#
# Requires: curl, tar, python3.
set -eu

TIKZJAX_VERSION="1.0.0-beta24"
CODEMIRROR_VERSION="5.65.21"

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
TMP="${ROOT}/.vendor-tmp"

rm -rf "$TMP"
mkdir -p "$TMP"

fetch() {
    # fetch <url> <destination>
    echo "  fetching $1"
    curl -fsSL --retry 3 -o "$2" "$1"
}

# --------------------------------------------------------------------------
# TikZJax (GPL-3.0+), the TeX/TikZ -> SVG engine.
#
# We use Glenn Rice's fork rather than the tikzjax.com build: it re-renders
# dynamically inserted script tags, runs TeX in a Web Worker, reports the TeX
# transcript, and can load TeX packages and TikZ libraries on demand.
#
# The assets must be served from the same origin as the page, because a Web
# Worker script cannot be loaded cross-origin -- hence vendoring rather than a
# CDN reference.
# --------------------------------------------------------------------------
echo "TikZJax ${TIKZJAX_VERSION}"
fetch "https://registry.npmjs.org/@drgrice1/tikzjax/-/tikzjax-${TIKZJAX_VERSION}.tgz" \
    "${TMP}/tikzjax.tgz"
mkdir -p "${TMP}/tikzjax"
tar xzf "${TMP}/tikzjax.tgz" -C "${TMP}/tikzjax"

rm -rf "${ROOT}/vendor/tikzjax"
mkdir -p "${ROOT}/vendor/tikzjax"
cp -r "${TMP}/tikzjax/package/dist/." "${ROOT}/vendor/tikzjax/"

# Trim what the browser never requests:
#   bakoma/ttf  - TTF originals of the fonts; fonts.css only uses fonts/*.woff2
#   *.map       - webpack source maps (1.4 MB, only useful when debugging TikZJax)
rm -rf "${ROOT}/vendor/tikzjax/bakoma"
rm -f "${ROOT}/vendor/tikzjax"/*.map

# Neither the npm package nor the fork's git repository ships a license file.
# The npm package metadata declares "GPL-3.0+"; the upstream project it forks
# (kisonecat/tikzjax) carries the LPPL 1.3c, fetched here for reference.
fetch "https://raw.githubusercontent.com/kisonecat/tikzjax/master/LICENSE.md" \
    "${ROOT}/vendor/tikzjax/LICENSE.upstream-kisonecat.md"
cp "${TMP}/tikzjax/package/README.md" "${ROOT}/vendor/tikzjax/README.upstream.md"
cp "${TMP}/tikzjax/package/package.json" "${ROOT}/vendor/tikzjax/package.json"
printf '%s\n' "$TIKZJAX_VERSION" > "${ROOT}/vendor/tikzjax/VERSION"

cat > "${ROOT}/vendor/tikzjax/LICENSE.txt" <<'LICENSE_NOTE'
The files in this directory are the unmodified `dist` output of the npm package
@drgrice1/tikzjax (minus the unused bakoma/ TTF fonts and the webpack source
maps), plus this note.

    Upstream:  https://github.com/drgrice1/tikzjax
    Package:   https://www.npmjs.com/package/@drgrice1/tikzjax
    Forked from: https://github.com/kisonecat/tikzjax by Jim Fowler

Licensing, as declared by the projects themselves:

  * @drgrice1/tikzjax declares "license": "GPL-3.0+" in its package.json
    (a copy of which is kept next to this file).  Neither the npm tarball nor
    the fork's git repository contains a license text file.
  * The upstream project kisonecat/tikzjax is distributed under the LaTeX
    Project Public License 1.3c; its license text is kept next to this file as
    LICENSE.upstream-kisonecat.md.

WebTikZ itself is distributed under the GNU General Public License version 3
(see ../../LICENSE), which is compatible with the declared license of this
component.

The bundled TeX system files (tex_files/) are taken from TeX Live.  PGF/TikZ is
dual licensed under the GNU GPL v2 or later and the LPPL 1.3c; the LaTeX base
and AMS packages are under the LPPL 1.3c.  The web fonts (fonts/) are derived
from the BaKoMa Type 1 versions of Donald E. Knuth's Computer Modern typefaces
and are freely redistributable.
LICENSE_NOTE

# --------------------------------------------------------------------------
# CodeMirror 5 (MIT), the editor component.
#
# Version 5 rather than 6 on purpose: it loads as plain <script> tags, so
# WebTikZ needs no bundler and no build step.
# --------------------------------------------------------------------------
echo "CodeMirror ${CODEMIRROR_VERSION}"
fetch "https://registry.npmjs.org/codemirror/-/codemirror-${CODEMIRROR_VERSION}.tgz" \
    "${TMP}/codemirror.tgz"
mkdir -p "${TMP}/codemirror"
tar xzf "${TMP}/codemirror.tgz" -C "${TMP}/codemirror"

CM_SRC="${TMP}/codemirror/package"
CM_DST="${ROOT}/vendor/codemirror"
rm -rf "$CM_DST"

for f in \
    lib/codemirror.js \
    lib/codemirror.css \
    mode/stex/stex.js \
    addon/edit/matchbrackets.js \
    addon/edit/closebrackets.js \
    addon/edit/trailingspace.js \
    addon/selection/active-line.js \
    addon/display/placeholder.js \
    addon/display/panel.js \
    addon/comment/comment.js \
    addon/dialog/dialog.js \
    addon/dialog/dialog.css \
    addon/search/search.js \
    addon/search/searchcursor.js \
    addon/search/jump-to-line.js \
    addon/hint/show-hint.js \
    addon/hint/show-hint.css \
    addon/fold/foldcode.js \
    addon/fold/foldgutter.js \
    addon/fold/foldgutter.css \
    addon/fold/brace-fold.js \
    keymap/vim.js \
    keymap/emacs.js \
    keymap/sublime.js \
    theme/idea.css \
    theme/material-darker.css
do
    mkdir -p "${CM_DST}/$(dirname "$f")"
    cp "${CM_SRC}/${f}" "${CM_DST}/${f}"
done

cp "${CM_SRC}/LICENSE" "${CM_DST}/LICENSE"
printf '%s\n' "$CODEMIRROR_VERSION" > "${CM_DST}/VERSION"

rm -rf "$TMP"

# The library and package pickers are generated from what was just vendored.
node "${ROOT}/tools/gen-catalog.mjs"

echo
echo "Vendored into ${ROOT}/vendor:"
du -sh "${ROOT}/vendor"/* 
