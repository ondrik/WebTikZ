// Read what TeX said.
//
// TikZJax hands us the transcript as plain text, exactly as TeX would write it
// to input.log.  This module turns that into a short list of things that went
// wrong, each pointing back at a line the user can actually see.  It touches no
// DOM so it can be tested with `node --test`.

/**
 * @typedef {object} Issue
 * @property {'error'|'warning'} severity
 * @property {string} message      one line, what happened
 * @property {string} [context]    the source line TeX was reading
 * @property {number} [texLine]    line number in the document TeX compiled
 */

// TeX asks what to do about an error even in a batch run; the answer never
// comes, so the transcript carries a block of menu text we should not show.
const PROMPT_NOISE =
    /^(\?|Type <return>|Type  ?H|R to run|I to insert|H for help|1 or \.\.\.|S to scroll|See the |\s*\.\.\.)/;

/** True for the follow-on error TeX reports when it gives up after another. */
const isSecondary = (message) => /^(Emergency stop|==> Fatal error occurred)/.test(message);

/**
 * Parse a TeX transcript.
 *
 * @param {string} transcript
 * @returns {{issues: Issue[], errors: Issue[], warnings: Issue[]}}
 */
export function parseTexLog(transcript) {
    const lines = String(transcript ?? '').split('\n');
    /** @type {Issue[]} */
    const issues = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('! ')) {
            // "! Undefined control sequence." then, further down,
            // "l.12 \dr" / "      awx" -- the line and where on it TeX stopped.
            let message = line.slice(2).trim();
            let texLine;
            let context;

            for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
                const next = lines[j];
                const at = /^l\.(\d+) ?(.*)$/.exec(next);
                if (at) {
                    texLine = Number(at[1]);
                    context = (at[2] + (lines[j + 1] ?? '').trim()).trim();
                    break;
                }
                if (next.startsWith('! ')) break;
                // A long message wraps onto the next line; a finished sentence
                // means what follows is TeX's standard advice, not the message.
                if (/[.?!]\s*$/.test(message) || PROMPT_NOISE.test(next)) continue;
                if (next.trim() && message.length < 200 && !next.startsWith('(')) {
                    message += ' ' + next.trim();
                }
            }

            issues.push({ severity: 'error', message: tidy(message), context, texLine });
            continue;
        }

        const warning = /(?:^| )((?:LaTeX|Package \S+|Class \S+) Warning: .*)$/.exec(line);
        if (warning) {
            let message = warning[1];
            const onLine = /on input line (\d+)/.exec(message);
            // Warnings wrap; take the continuation lines that are clearly part of it.
            for (let j = i + 1; j < lines.length && lines[j].startsWith('(') === false; j++) {
                if (!lines[j].trim() || /^\S+:/.test(lines[j])) break;
                if (!/^\s{2,}/.test(lines[j])) break;
                message += ' ' + lines[j].trim();
                i = j;
            }
            issues.push({
                severity: 'warning',
                message: tidy(message),
                texLine: onLine ? Number(onLine[1]) : undefined
            });
            continue;
        }

        const box = /^(Overfull|Underfull) \\([hv])box .*$/.exec(line);
        if (box) issues.push({ severity: 'warning', message: tidy(line) });
    }

    // TeX's "Emergency stop" repeats an error already reported; keep it only if
    // it is all we have, so the list leads with the thing to fix.
    const real = issues.filter((issue) => !(issue.severity === 'error' && isSecondary(issue.message)));
    const deduped = dedupe(real.length ? real : issues);

    return {
        issues: deduped,
        errors: deduped.filter((i) => i.severity === 'error'),
        warnings: deduped.filter((i) => i.severity === 'warning')
    };
}

const tidy = (message) => message.replace(/\s+/g, ' ').replace(/\s*\.$/, '').trim();

function dedupe(issues) {
    const seen = new Set();
    return issues.filter((issue) => {
        const key = `${issue.severity}|${issue.message}|${issue.texLine ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Where a line number in TeX's document lands in what the user is editing.
 *
 * TikZJax's worker builds the file it compiles as
 *
 *     \usepackage{...}\usetikzlibrary{...}<preamble>\begin{document}\n<picture>\n\end{document}
 *
 * with no newline before \begin{document}, so the preamble shares its last line
 * with it and the picture starts one line later.
 *
 * @param {number} texLine
 * @param {string} preamble the user's preamble text (packages and libraries add no lines)
 * @returns {{target: 'picture'|'preamble', line: number}}
 */
export function locateTexLine(texLine, preamble = '') {
    const preambleLines = preamble ? preamble.split('\n').length : 1;
    const pictureStartsAt = preambleLines + 1;

    if (texLine >= pictureStartsAt) return { target: 'picture', line: texLine - pictureStartsAt + 1 };
    return { target: 'preamble', line: Math.max(1, texLine) };
}

/**
 * One line for the log pane's header.
 *
 * @param {{errors: Issue[], warnings: Issue[]}} parsed
 * @returns {string}
 */
export function summarize({ errors, warnings }) {
    const parts = [];
    if (errors.length) parts.push(`${errors.length} error${errors.length === 1 ? '' : 's'}`);
    if (warnings.length) parts.push(`${warnings.length} warning${warnings.length === 1 ? '' : 's'}`);
    return parts.join(', ');
}
