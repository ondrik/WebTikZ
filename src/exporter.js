// Getting the picture out: as SVG, as PNG, or as TeX you can compile elsewhere.
//
// The SVG that TikZJax produces sets text in Computer Modern by name -- it
// relies on the @font-face rules the page loaded.  A file saved as-is would
// therefore render its labels in whatever the viewer happens to have, so before
// anything leaves the app the fonts it uses are embedded in it.  That also
// keeps the canvas clean when drawing to PNG, since nothing has to be fetched.

import { fileNameFor, toStandaloneTex } from './document.js';

const FONT_DIRECTORY = 'vendor/tikzjax/fonts';

/** @type {Map<string, Promise<string|null>>} family -> data: URI */
const fontCache = new Map();

async function fontAsDataUri(family) {
    if (!fontCache.has(family)) {
        fontCache.set(family, (async () => {
            try {
                const response = await fetch(`${FONT_DIRECTORY}/${family}.woff2`);
                if (!response.ok) return null;
                const buffer = new Uint8Array(await response.arrayBuffer());
                let binary = '';
                for (const byte of buffer) binary += String.fromCharCode(byte);
                return `data:font/woff2;base64,${btoa(binary)}`;
            } catch {
                return null;
            }
        })());
    }
    return fontCache.get(family);
}

/** Families named anywhere in the markup, whether by attribute or by style. */
function familiesUsed(svg) {
    const found = new Set();
    for (const match of svg.outerHTML.matchAll(/font-family\s*[:=]\s*["']?([\w-]+)/g)) {
        // Only the Computer Modern faces we ship can be embedded.
        if (/^(cm|ms|eu|la|line|rsfs|stmary|tc|wasy)/.test(match[1])) found.add(match[1]);
    }
    return [...found];
}

/**
 * A copy of the picture that stands on its own: fonts embedded, size in
 * pixels, ready to be written to a file or drawn into a canvas.
 *
 * @param {SVGElement} svg
 * @param {{scale?: number}} [options]
 * @returns {Promise<{markup: string, width: number, height: number}>}
 */
export async function selfContainedSvg(svg, { scale = 1 } = {}) {
    const copy = svg.cloneNode(true);

    const width = (parseFloat(svg.getAttribute('width')) || 100) * (96 / 72);
    const height = (parseFloat(svg.getAttribute('height')) || 100) * (96 / 72);

    copy.setAttribute('width', `${width * scale}`);
    copy.setAttribute('height', `${height * scale}`);
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    copy.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    const faces = [];
    for (const family of familiesUsed(svg)) {
        const uri = await fontAsDataUri(family);
        if (uri) faces.push(`@font-face{font-family:${family};src:url(${uri}) format("woff2");}`);
    }

    if (faces.length) {
        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.textContent = faces.join('\n');
        copy.prepend(style);
    }

    return {
        markup: `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(copy)}`,
        width: width * scale,
        height: height * scale
    };
}

/**
 * @param {SVGElement} svg
 * @param {{scale?: number, opaque?: boolean}} [options]
 * @returns {Promise<Blob>}
 */
export async function toPngBlob(svg, { scale = 2, opaque = true } = {}) {
    const { markup, width, height } = await selfContainedSvg(svg, { scale });

    const image = new Image();
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));

    try {
        await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = () => reject(new Error('the picture could not be rasterised'));
            image.src = url;
        });

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width));
        canvas.height = Math.max(1, Math.round(height));

        const context = canvas.getContext('2d');
        if (opaque) {
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        return await new Promise((resolve, reject) => {
            canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))), 'image/png');
        });
    } finally {
        URL.revokeObjectURL(url);
    }
}

/** Hand a blob to the browser as a download. */
export function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function saveSvg(svg, name) {
    const { markup } = await selfContainedSvg(svg);
    download(new Blob([markup], { type: 'image/svg+xml' }), fileNameFor(name, 'svg'));
}

export async function savePng(svg, name, options) {
    download(await toPngBlob(svg, options), fileNameFor(name, 'png'));
}

export function saveTex(drawing) {
    download(new Blob([toStandaloneTex(drawing)], { type: 'text/x-tex' }), fileNameFor(drawing.name, 'tex'));
}

export async function copyPng(svg, options) {
    const blob = await toPngBlob(svg, options);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

export async function copyText(text) {
    await navigator.clipboard.writeText(text);
}

export async function copySvgMarkup(svg) {
    const { markup } = await selfContainedSvg(svg);
    await copyText(markup);
}
