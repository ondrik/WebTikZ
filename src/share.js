// Put a drawing in a link.
//
// The whole drawing travels in the URL fragment, so a shared link needs no
// server and nothing is uploaded anywhere: the text never leaves the browser
// until someone pastes the link themselves.  Fragments are compressed because
// TikZ code is repetitive and links get pasted into places that dislike long
// URLs; `deflate-raw` is available in every browser that can run TikZJax.

const MAGIC = 'z';   // compressed payload
const PLAIN = 'j';   // uncompressed fallback

/** @typedef {import('./document.js').Drawing} Drawing */

const bytesToBase64url = (bytes) => {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const base64urlToBytes = (text) => {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

const squeeze = async (bytes, format) => {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream(format));
    return new Uint8Array(await new Response(stream).arrayBuffer());
};

const expand = async (bytes, format) => {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
    return new Uint8Array(await new Response(stream).arrayBuffer());
};

/**
 * @param {Drawing} drawing
 * @returns {Promise<string>} the fragment, including its leading '#'
 */
export async function toFragment(drawing) {
    const payload = JSON.stringify({
        n: drawing.name,
        c: drawing.code,
        p: drawing.preamble || undefined,
        l: drawing.libraries.length ? drawing.libraries : undefined,
        k: drawing.packages.length ? drawing.packages : undefined
    });
    const bytes = new TextEncoder().encode(payload);

    try {
        return `#${MAGIC}=${bytesToBase64url(await squeeze(bytes, 'deflate-raw'))}`;
    } catch {
        return `#${PLAIN}=${bytesToBase64url(bytes)}`;
    }
}

/**
 * @param {string} fragment as found in location.hash
 * @returns {Promise<Partial<Drawing>|null>} null when there is nothing to open
 */
export async function fromFragment(fragment) {
    const match = /^#?([zj])=(.+)$/.exec(String(fragment ?? '').trim());
    if (!match) return null;

    try {
        const raw = base64urlToBytes(match[2]);
        const bytes = match[1] === MAGIC ? await expand(raw, 'deflate-raw') : raw;
        const data = JSON.parse(new TextDecoder().decode(bytes));
        if (!data || typeof data.c !== 'string') return null;

        return {
            name: typeof data.n === 'string' ? data.n : 'Shared drawing',
            code: data.c,
            preamble: typeof data.p === 'string' ? data.p : '',
            libraries: Array.isArray(data.l) ? data.l.map(String) : [],
            packages: Array.isArray(data.k) ? data.k.map(String) : []
        };
    } catch {
        return null;
    }
}
