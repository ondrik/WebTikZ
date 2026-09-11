// Pictures to start from.
//
// Each one is chosen to show a different corner of TikZ and to compile with the
// vendored engine -- tests/examples.test.js checks the libraries they ask for
// exist, and tools/smoke.mjs compiles every one of them in a real browser.

/** @typedef {import('./document.js').Drawing} Drawing */

/** @type {ReadonlyArray<Drawing & {id: string, uses: string}>} */
export const EXAMPLES = [
    {
        id: 'axes',
        name: 'Unit circle',
        uses: 'plain TikZ',
        libraries: [],
        packages: [],
        preamble: '',
        code: `\\begin{tikzpicture}
  \\draw[help lines, step=0.5] (-1.4,-1.4) grid (1.4,1.4);
  \\draw[->] (-1.5,0) -- (1.5,0) node[right] {$x$};
  \\draw[->] (0,-1.5) -- (0,1.5) node[above] {$y$};
  \\draw[thick, blue] (0,0) circle (1);
  \\draw[red, thick] (0,0) -- (60:1) node[midway, above left] {$r$};
  \\fill[red] (60:1) circle (1.5pt);
\\end{tikzpicture}`
    },
    {
        id: 'flowchart',
        name: 'Flowchart',
        uses: 'shapes.geometric, arrows.meta, positioning',
        libraries: ['shapes.geometric', 'arrows.meta', 'positioning'],
        packages: [],
        preamble: `\\tikzset{
  block/.style = {rectangle, draw, rounded corners, minimum width=26mm, minimum height=8mm, align=center},
  decide/.style = {diamond, draw, aspect=2, inner sep=1pt, align=center},
  flow/.style = {-{Stealth[length=2mm]}, thick}
}`,
        code: `\\begin{tikzpicture}[node distance=9mm and 14mm]
  \\node[block] (read) {Read the source};
  \\node[decide, below=of read] (ok) {Compiles?};
  \\node[block, below=of ok] (show) {Show the picture};
  \\node[block, right=of ok] (fix) {Report the error};

  \\draw[flow] (read) -- (ok);
  \\draw[flow] (ok) -- node[left] {yes} (show);
  \\draw[flow] (ok) -- node[above] {no} (fix);
  \\draw[flow] (fix) |- (read);
\\end{tikzpicture}`
    },
    {
        id: 'automaton',
        name: 'Finite automaton',
        uses: 'automata, positioning',
        libraries: ['automata', 'positioning'],
        packages: [],
        preamble: '',
        code: `\\begin{tikzpicture}[shorten >=1pt, node distance=24mm, on grid, auto]
  \\node[state, initial] (q0) {$q_0$};
  \\node[state, right=of q0] (q1) {$q_1$};
  \\node[state, accepting, right=of q1] (q2) {$q_2$};

  \\path[->]
    (q0) edge[bend left] node {a} (q1)
         edge[loop above] node {b} ()
    (q1) edge[bend left] node {a} (q2)
         edge[bend left] node {b} (q0)
    (q2) edge[loop above] node {a, b} ();
\\end{tikzpicture}`
    },
    {
        id: 'cd',
        name: 'Commutative diagram',
        uses: 'tikz-cd',
        libraries: [],
        packages: ['tikz-cd', 'amssymb'],
        preamble: '',
        code: `\\begin{tikzcd}[row sep=large, column sep=large]
  A \\arrow[r, "f"] \\arrow[d, "g"'] & B \\arrow[d, "h"] \\\\
  C \\arrow[r, "k"'] \\arrow[ru, dashed, "\\exists\\,u" description] & D
\\end{tikzcd}`
    },
    {
        id: 'plot',
        name: 'Function plot',
        uses: 'pgfplots',
        libraries: [],
        packages: ['pgfplots'],
        preamble: '\\pgfplotsset{compat=1.18}',
        code: `\\begin{tikzpicture}
  \\begin{axis}[
      width=85mm, height=60mm,
      xlabel=$x$, ylabel=$y$,
      domain=-3:3, samples=120,
      axis lines=middle,
      legend pos=north west,
      grid=major]
    \\addplot[thick, blue] {exp(-x^2)};
    \\addlegendentry{$e^{-x^2}$}
    \\addplot[thick, red, dashed] {x^2/9};
    \\addlegendentry{$x^2/9$}
  \\end{axis}
\\end{tikzpicture}`
    },
    {
        id: 'bars',
        name: 'Bar chart',
        uses: 'pgfplots',
        libraries: [],
        packages: ['pgfplots'],
        preamble: '\\pgfplotsset{compat=1.18}',
        code: `\\begin{tikzpicture}
  \\begin{axis}[
      ybar, width=85mm, height=55mm,
      bar width=7mm,
      ylabel={Pictures drawn},
      symbolic x coords={Mon, Tue, Wed, Thu, Fri},
      xtick=data, ymin=0,
      nodes near coords,
      enlarge x limits=0.15]
    \\addplot[draw=blue!60!black, fill=blue!25] coordinates
      {(Mon,3) (Tue,7) (Wed,5) (Thu,9) (Fri,4)};
  \\end{axis}
\\end{tikzpicture}`
    },
    {
        id: 'tree',
        name: 'Tree',
        uses: 'trees',
        libraries: ['trees'],
        packages: [],
        preamble: '',
        code: `\\begin{tikzpicture}[
    level distance=13mm,
    every node/.style={circle, draw, minimum size=7mm, inner sep=0pt},
    level 1/.style={sibling distance=28mm},
    level 2/.style={sibling distance=14mm}]
  \\node {8}
    child {node {3}
      child {node {1}}
      child {node {6}}}
    child {node {10}
      child {node {9}}
      child {node {14}}};
\\end{tikzpicture}`
    },
    {
        id: 'braces',
        name: 'Braces and measurements',
        uses: 'decorations.pathreplacing, calc',
        libraries: ['decorations.pathreplacing', 'calc'],
        packages: [],
        preamble: '',
        code: `\\begin{tikzpicture}
  \\fill[blue!12] (0,0) rectangle (5,1.6);
  \\draw (0,0) rectangle (5,1.6);
  \\foreach \\x in {1,...,4} \\draw[gray] (\\x,0) -- (\\x,1.6);

  \\draw[decorate, decoration={brace, amplitude=5pt}, thick]
    (0,1.75) -- (2,1.75) node[midway, above=6pt] {two cells};
  \\draw[decorate, decoration={brace, mirror, amplitude=5pt}, thick]
    (0,-0.15) -- (5,-0.15) node[midway, below=6pt] {five cells};
\\end{tikzpicture}`
    },
    {
        id: 'petri',
        name: 'Petri net',
        uses: 'petri, positioning',
        libraries: ['petri', 'positioning'],
        packages: [],
        preamble: '',
        code: `\\begin{tikzpicture}[node distance=16mm, thick]
  \\node[place, tokens=2, label=above:ready] (ready) {};
  \\node[transition, right=of ready] (start) {}
    edge[pre] (ready);
  \\node[place, right=of start, label=above:running] (run) {}
    edge[pre] (start);
  \\node[transition, right=of run] (stop) {}
    edge[pre] (run);
  \\draw[->] (stop) .. controls +(up:12mm) and +(up:12mm) .. (ready);
\\end{tikzpicture}`
    },
    {
        id: 'spiral',
        name: 'Decorated path',
        uses: 'decorations.pathmorphing',
        libraries: ['decorations.pathmorphing'],
        packages: [],
        preamble: '',
        code: `\\begin{tikzpicture}
  \\draw[decorate, decoration={coil, aspect=0.5, segment length=3mm, amplitude=3mm}, thick]
    (0,0) -- (4,0);
  \\draw[decorate, decoration={snake, segment length=5mm, amplitude=1.5mm}, thick, blue]
    (0,-1) -- (4,-1);
  \\draw[decorate, decoration={zigzag, segment length=4mm, amplitude=2mm}, thick, red]
    (0,-2) -- (4,-2);
\\end{tikzpicture}`
    },
    {
        id: 'mindmap',
        name: 'Mind map',
        uses: 'mindmap, trees',
        libraries: ['mindmap', 'trees'],
        packages: [],
        preamble: '',
        code: `\\begin{tikzpicture}[mindmap, concept color=blue!40, text=black,
    level 1/.append style={level distance=26mm, sibling angle=90}]
  \\node[concept] {TikZ}
    child[concept color=green!45] { node[concept] {paths} }
    child[concept color=orange!45] { node[concept] {nodes} }
    child[concept color=red!35] { node[concept] {styles} };
\\end{tikzpicture}`
    },
    {
        id: 'threed',
        name: 'Three dimensions',
        uses: 'tikz-3dplot',
        libraries: [],
        packages: ['tikz-3dplot'],
        preamble: '\\tdplotsetmaincoords{70}{125}',
        code: `\\begin{tikzpicture}[tdplot_main_coords, scale=1.6]
  \\draw[->] (0,0,0) -- (1.3,0,0) node[anchor=north east] {$x$};
  \\draw[->] (0,0,0) -- (0,1.3,0) node[anchor=north west] {$y$};
  \\draw[->] (0,0,0) -- (0,0,1.3) node[anchor=south] {$z$};

  \\draw[fill=blue!15, opacity=0.8] (0,0,0) -- (1,0,0) -- (1,1,0) -- (0,1,0) -- cycle;
  \\draw[thick, red, ->] (0,0,0) -- (1,1,1) node[above right] {$v$};
  \\draw[dashed] (1,1,0) -- (1,1,1);
\\end{tikzpicture}`
    }
];
