#!/bin/sh
# Install the TeX files listed in tools/extra-tex-files.txt into
# vendor/tikzjax/tex_files, gzipped, which is how TikZJax expects to find them:
# the worker fetches tex_files/<filename>.gz whenever TeX asks for <filename>.
#
#     ./tools/add-tex-files.sh
#
# Needs a TeX distribution with the packages installed (it locates them with
# kpsewhich, the same way TikZJax's own genTexFiles.js does).  The results are
# committed, so this is only needed when the list changes or a package is
# updated.
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
LIST="${ROOT}/tools/extra-tex-files.txt"
DEST="${ROOT}/vendor/tikzjax/tex_files"

command -v kpsewhich >/dev/null 2>&1 || {
    echo "kpsewhich not found: install a TeX distribution (TeX Live) to add TeX files." >&2
    exit 1
}
[ -d "$DEST" ] || {
    echo "${DEST} is missing: run ./tools/fetch-vendor.sh first." >&2
    exit 1
}

missing=0
added=0

while IFS= read -r name; do
    case "$name" in '' | '#'*) continue ;; esac

    path="$(kpsewhich "$name" || true)"
    if [ -z "$path" ]; then
        echo "  MISSING  $name"
        missing=$((missing + 1))
        continue
    fi

    gzip -9 -c "$path" > "${DEST}/${name}.gz"
    echo "  added    $name  ($(kpsewhich --var-value=TEXMFDIST >/dev/null 2>&1 && echo "$path" || echo "$path"))"
    added=$((added + 1))
done < "$LIST"

echo
echo "${added} file(s) installed into vendor/tikzjax/tex_files."
[ "$missing" -eq 0 ] || { echo "${missing} file(s) not found by kpsewhich." >&2; exit 1; }

# The pickers are generated from what is present, so refresh them.
node "${ROOT}/tools/gen-catalog.mjs"
