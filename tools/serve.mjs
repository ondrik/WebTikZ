// A static file server with no dependencies, used by tools/smoke.mjs.
//
// One rule matters here: the .gz files TikZJax fetches are data, not a transfer
// encoding.  Serving them with Content-Encoding: gzip would make the browser
// unpack them before the worker's own inflater sees them, and the worker would
// then fail on what looks like a corrupt file.

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.wasm': 'application/wasm',
    '.gz': 'application/gzip',
    '.tex': 'text/x-tex; charset=utf-8',
    '.map': 'application/json; charset=utf-8'
};

/**
 * @param {string} root directory to serve
 * @param {number} [port] 0 picks a free one
 * @returns {Promise<{url: string, close: () => Promise<void>}>}
 */
export function serve(root, port = 0) {
    const server = createServer(async (request, response) => {
        try {
            const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
            let file = join(root, normalize(path).replace(/^(\.\.[/\\])+/, ''));

            let info = await stat(file).catch(() => null);
            if (info?.isDirectory()) {
                file = join(file, 'index.html');
                info = await stat(file).catch(() => null);
            }
            if (!info) {
                response.writeHead(404, { 'content-type': 'text/plain' });
                return response.end('not found');
            }

            response.writeHead(200, {
                'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
                'content-length': info.size,
                'cache-control': 'no-store'
            });
            createReadStream(file).pipe(response);
        } catch (error) {
            response.writeHead(500, { 'content-type': 'text/plain' });
            response.end(String(error));
        }
    });

    return new Promise((resolve) => {
        server.listen(port, '127.0.0.1', () => {
            resolve({
                url: `http://127.0.0.1:${server.address().port}`,
                close: () => new Promise((done) => server.close(done))
            });
        });
    });
}
