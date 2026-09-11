// Reading TeX's mind: the transcripts here are real output from the engine
// WebTikZ ships, trimmed to the interesting part.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { locateTexLine, parseTexLog, summarize } from '../src/texlog.js';

test('a missing coordinate is reported with its line and its source', () => {
    const { errors } = parseTexLog(`(input.tex
LaTeX2e <2023-11-01> patch level 1
! Package tikz Error: Cannot parse this coordinate.
See the tikz package documentation for explanation.
Type  H <return>  for immediate help.
 ...
l.2   \\draw (0,0) -- ;
                      \\end{tikzpicture}
? `);

    assert.equal(errors.length, 1);
    assert.equal(errors[0].message, 'Package tikz Error: Cannot parse this coordinate');
    assert.equal(errors[0].texLine, 2);
    assert.match(errors[0].context, /\\draw \(0,0\) --/);
});

test("TeX's standard advice is not mistaken for part of the message", () => {
    const { errors } = parseTexLog(`! Undefined control sequence.
l.3 \\drawx
           (0,0);
See the tikz package documentation for explanation.`);

    assert.equal(errors[0].message, 'Undefined control sequence');
});

test('a message that wraps is put back together', () => {
    const { errors } = parseTexLog(`! Package pgfkeys Error: I do not know the key '/tikz/thickk' and I am
going to ignore it.
l.5 \\draw[thickk] (0,0);`);

    assert.match(errors[0].message, /I am going to ignore it/);
});

test('the follow-on Emergency stop is dropped when a real error was reported', () => {
    const { errors } = parseTexLog(`! Undefined control sequence.
l.3 \\drawx
! Emergency stop.
l.3 \\drawx`);

    assert.equal(errors.length, 1);
    assert.equal(errors[0].message, 'Undefined control sequence');
});

test('an Emergency stop on its own is still reported', () => {
    const { errors } = parseTexLog('! Emergency stop.\nl.9 \\end{tikzpicture}');
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /Emergency stop/);
});

test('warnings are collected separately from errors', () => {
    const parsed = parseTexLog(`Package pgfplots Warning: running in backwards compatibility mode on input line 1.
Overfull \\hbox (3.0pt too wide) in paragraph at lines 1--2
! Undefined control sequence.
l.4 \\nope`);

    assert.equal(parsed.errors.length, 1);
    assert.equal(parsed.warnings.length, 2);
    assert.equal(parsed.warnings[0].texLine, 1);
    assert.equal(summarize(parsed), '1 error, 2 warnings');
});

test('a clean run has nothing to report', () => {
    const parsed = parseTexLog(`This is e-TeX, Version 3.14159265-2.6
(input.tex
Output written on input.dvi (1 page, 4836 bytes).`);

    assert.deepEqual(parsed.issues, []);
    assert.equal(summarize(parsed), '');
});

test('nothing at all is not an error', () => {
    assert.deepEqual(parseTexLog('').issues, []);
    assert.deepEqual(parseTexLog(undefined).issues, []);
});

// The engine compiles
//     <packages><libraries><preamble>\begin{document}\n<picture>\n\end{document}
// with no newline before \begin{document}, which is what these pin down.
test('with no preamble, the picture starts on TeX line 2', () => {
    assert.deepEqual(locateTexLine(2, ''), { target: 'picture', line: 1 });
    assert.deepEqual(locateTexLine(7, ''), { target: 'picture', line: 6 });
});

test('a preamble pushes the picture down by its own line count', () => {
    const preamble = '\\tikzset{a/.style={red}}\n\\newcommand{\\R}{\\mathbb{R}}\n\\def\\x{1}';
    assert.deepEqual(locateTexLine(4, preamble), { target: 'picture', line: 1 });
    assert.deepEqual(locateTexLine(6, preamble), { target: 'picture', line: 3 });
});

test('an error inside the preamble points at the preamble', () => {
    const preamble = 'line one\nline two\nline three';
    assert.deepEqual(locateTexLine(2, preamble), { target: 'preamble', line: 2 });
    assert.deepEqual(locateTexLine(1, ''), { target: 'preamble', line: 1 });
});
