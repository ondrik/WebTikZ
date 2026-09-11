#!/bin/sh
# Serve WebTikZ locally.
#
# WebTikZ cannot run from a file:// URL: TikZJax compiles TeX in a Web Worker
# (blocked on file://) and hashes its cache keys with window.crypto.subtle
# (only available in a secure context, i.e. https or localhost).  Serving the
# directory over http://localhost satisfies both.
set -eu

PORT="${1:-8000}"
DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

echo "WebTikZ: http://localhost:${PORT}/"
echo "Press Ctrl+C to stop."

exec python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$DIR"
