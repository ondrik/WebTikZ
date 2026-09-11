// Minimal Chrome DevTools Protocol client, used by tools/smoke.mjs.
//
// No dependencies: Node has had a global WebSocket since 22, and Chrome speaks
// the protocol over one.  Enough to open a page, evaluate expressions in it,
// watch its console, and take screenshots -- which is all a smoke test needs.
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launchChrome({ port = 9333, binary = 'google-chrome' } = {}) {
    const profile = await mkdtemp(join(tmpdir(), 'webtikz-chrome-'));
    const child = spawn(binary, [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-features=Translate,MediaRouter',
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profile}`,
        'about:blank'
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d; });

    let version;
    for (let i = 0; i < 60; i++) {
        try {
            version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
            break;
        } catch { await sleep(250); }
    }
    if (!version) { child.kill(); throw new Error(`Chrome did not start:\n${stderr}`); }

    return {
        wsUrl: version.webSocketDebuggerUrl,
        version: version.Browser,
        async close() {
            child.kill();
            // Chrome needs a moment to let go of its profile directory;
            // deleting it out from under the shutdown throws ENOTEMPTY.
            await new Promise((resolve) => {
                child.once('exit', resolve);
                setTimeout(resolve, 3000);
            });
            await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
        }
    };
}

export async function connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = (e) => rej(new Error('ws error')); });

    let nextId = 1;
    const pending = new Map();
    const listeners = [];

    ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && pending.has(msg.id)) {
            const { resolve, reject } = pending.get(msg.id);
            pending.delete(msg.id);
            msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
        } else if (msg.method) {
            for (const l of listeners) l(msg);
        }
    };

    const send = (method, params = {}, sessionId) =>
        new Promise((resolve, reject) => {
            const id = nextId++;
            pending.set(id, { resolve, reject });
            ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
        });

    return {
        send,
        on: (fn) => listeners.push(fn),
        close: () => ws.close()
    };
}

// Open a fresh tab and return a session bound to it.
export async function newPage(browser, { width = 1280, height = 900 } = {}) {
    const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });

    const console_ = [];
    const errors = [];
    browser.on((msg) => {
        if (msg.sessionId !== sessionId) return;
        if (msg.method === 'Runtime.consoleAPICalled') {
            console_.push({
                type: msg.params.type,
                text: msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' ')
            });
        } else if (msg.method === 'Runtime.exceptionThrown') {
            errors.push(msg.params.exceptionDetails.exception?.description
                ?? msg.params.exceptionDetails.text);
        } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
            const entry = msg.params.entry;
            errors.push(`[${entry.source}] ${entry.text}${entry.url ? ` (${entry.url})` : ''}`);
        }
    });

    const call = (method, params) => browser.send(method, params, sessionId);
    await call('Page.enable');
    await call('Emulation.setDeviceMetricsOverride',
        { width, height, deviceScaleFactor: 1, mobile: false });
    await call('Runtime.enable');
    await call('Log.enable');

    const evaluate = async (expression) => {
        const r = await call('Runtime.evaluate', {
            expression, returnByValue: true, awaitPromise: true
        });
        if (r.exceptionDetails) {
            throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
        }
        return r.result.value;
    };

    return {
        call,
        evaluate,
        console: console_,
        errors,
        async goto(url) {
            await call('Page.navigate', { url });
            // Wait for document.readyState instead of load events: simpler and
            // enough, since everything interesting here happens after load.
            for (let i = 0; i < 200; i++) {
                if (await evaluate('document.readyState') === 'complete') return;
                await sleep(100);
            }
            throw new Error(`page did not finish loading: ${url}`);
        },
        async waitFor(expression, { timeout = 60000, interval = 250 } = {}) {
            const deadline = Date.now() + timeout;
            for (;;) {
                const v = await evaluate(expression);
                if (v) return v;
                if (Date.now() > deadline) throw new Error(`timed out waiting for: ${expression}`);
                await sleep(interval);
            }
        },
        async screenshot(path) {
            const { data } = await call('Page.captureScreenshot', { format: 'png' });
            const { writeFile } = await import('node:fs/promises');
            await writeFile(path, Buffer.from(data, 'base64'));
        }
    };
}

export { sleep };
