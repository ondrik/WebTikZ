// What the names in the picker mean, and what the editor offers to complete.
//
// The authoritative list of loadable names is src/catalog.js, generated from
// the vendored TeX files.  This file only adds plain-language descriptions; a
// name with no description here still shows up, just without one.

/** One short line per TikZ library, in the words a user would use. */
export const LIBRARY_NOTES = {
    '3d': 'Draw on the xy, xz and yz planes',
    angles: 'Mark and label the angle between two lines',
    animations: 'Animate parts of a picture over time',
    arrows: 'The older arrow tip collection (prefer arrows.meta)',
    'arrows.meta': 'Arrow tips you can size and restyle: Stealth, Latex, Bar',
    automata: 'States and transitions for finite automata',
    babel: 'Survive active characters from language packages',
    backgrounds: 'Draw a frame or background behind the picture',
    bending: 'Bend arrow tips along the curve they sit on',
    calc: 'Coordinate arithmetic: ($(a)!0.5!(b)$)',
    calendar: 'Typeset calendars',
    curvilinear: 'Move along a curve by arc length',
    cd: 'Commutative diagrams (the tikz-cd syntax)',
    chains: 'Lay nodes out in a chain, one after another',
    circuits: 'Circuit diagrams (base library)',
    'circuits.ee': 'Electrical engineering symbols',
    'circuits.ee.IEC': 'Electrical symbols, IEC shapes',
    'circuits.logic': 'Logic gates (base library)',
    'circuits.logic.CDH': 'Logic gates, CDH shapes',
    'circuits.logic.IEC': 'Logic gates, IEC shapes',
    'circuits.logic.US': 'Logic gates, US shapes',
    datavisualization: 'PGF data visualisation (charts, axes)',
    'datavisualization.3d': 'Three-dimensional data visualisation',
    'datavisualization.barcharts': 'Bar charts',
    'datavisualization.formats.functions': 'Plot functions in data visualisations',
    'datavisualization.polar': 'Polar axes',
    'datavisualization.sparklines': 'Sparklines',
    decorations: 'Decorate paths (base library)',
    'decorations.footprints': 'Footprint decorations',
    'decorations.fractals': 'Koch curves and other fractals',
    'decorations.markings': 'Put marks, arrows or nodes along a path',
    'decorations.pathmorphing': 'Snake, zigzag, wavy and coiled paths',
    'decorations.pathreplacing': 'Braces, brackets and ticks along a path',
    'decorations.shapes': 'Stamp shapes along a path',
    'decorations.text': 'Set text along a path',
    er: 'Entity-relationship diagrams',
    fadings: 'Fade parts of a picture out',
    fit: 'Size a node so it fits around other nodes',
    fixedpointarithmetic: 'Fixed-point arithmetic for calculations',
    folding: 'Fold-out paper models',
    fpu: 'Floating point unit: very large and small numbers',
    graphs: 'Build graphs from a concise edge syntax',
    'graphs.standard': 'Ready-made graphs: cycles, complete graphs, grids',
    intersections: 'Find where two paths cross',
    lindenmayersystems: 'L-systems: plants, fractals',
    math: 'Do arithmetic and define functions inside a picture',
    matrix: 'Arrange nodes in a matrix',
    mindmap: 'Mind maps',
    patterns: 'Fill shapes with hatching and dots',
    'patterns.meta': 'Define your own fill patterns',
    perspective: 'Three-point perspective drawing',
    petri: 'Petri nets: places, transitions, tokens',
    'pgfplots.contourlua': 'Contour plots (pgfplots, needs Lua — not available here)',
    plothandlers: 'Extra ways to join plotted points (loaded by default)',
    plotmarks: 'Marks for plotted points: +, x, o, stars',
    positioning: 'Place nodes relative to others: right=2cm of a',
    quantikz: 'Quantum circuits: wires, gates, measurements (the current syntax)',
    quantikz2: 'Quantum circuits, quantikz version 2 (what \\usepackage{quantikz} loads)',
    quotes: 'Label edges and angles with "quoted" text',
    rdf: 'Attach RDF metadata to a picture',
    scopes: 'Shorthand braces for scopes',
    shadings: 'Smooth colour gradients',
    shadows: 'Drop shadows behind shapes',
    shapes: 'All the shape libraries at once',
    'shapes.arrows': 'Arrow-shaped nodes',
    'shapes.callouts': 'Speech and thought bubbles',
    'shapes.gates.ee': 'Electrical engineering node shapes',
    'shapes.gates.ee.IEC': 'Electrical engineering node shapes, IEC',
    'shapes.gates.logic': 'Logic gate node shapes (base library)',
    'shapes.gates.logic.IEC': 'Logic gate shapes, IEC',
    'shapes.gates.logic.US': 'Logic gate shapes, US',
    'shapes.geometric': 'Diamonds, ellipses, polygons, stars',
    'shapes.misc': 'Rounded rectangles, crosses, strike-out shapes',
    'shapes.multipart': 'Nodes split into several parts',
    'shapes.symbols': 'Clouds, starbursts, tape, magnifying glass',
    snakes: 'Snaked paths (superseded by decorations)',
    spy: 'Magnify part of a picture in an inset',
    'svg.path': 'Use SVG path syntax inside TikZ',
    through: 'Draw a circle through a given point',
    trees: 'Tree layouts and edge styles',
    turtle: 'Turtle graphics: forward, turn, repeat',
    views: 'Set up 3d views'
};

/** One short line per TeX package that can be loaded. */
export const PACKAGE_NOTES = {
    amsbsy: 'Bold maths symbols',
    amsfonts: 'AMS fonts, including \\mathbb',
    amsmath: 'Proper maths: align, cases, matrices, \\text',
    amsopn: 'Declare new maths operators',
    amssymb: 'The AMS symbol fonts',
    amstext: '\\text inside maths',
    array: 'Better column specifications in tabular and matrix',
    calc: 'Arithmetic on lengths and counters',
    etoolbox: 'Tools for defining and patching macros',
    'hf-tikz': 'Highlight parts of a formula',
    ifthen: 'Conditionals: \\ifthenelse',
    mathtools: 'Extends amsmath: \\mathclap, better matrices, paired delimiters',
    pgfplots: 'Plot functions and data: axis, \\addplot',
    'tikz-3dplot': 'Three-dimensional coordinate systems and views',
    quantikz: 'Quantum circuit diagrams: \\begin{quantikz}, \\gate, \\ctrl, \\meter',
    'tikz-cd': 'Commutative diagrams with arrows between cells',
    xparse: 'Define commands with rich argument specifications',
    xstring: 'Test and manipulate strings'
};

/**
 * Words the editor offers while you type.  Deliberately short: the point is to
 * save keystrokes on the things people write constantly, not to reproduce the
 * TikZ manual.
 */
export const COMPLETIONS = [
    // structure
    '\\begin{tikzpicture}', '\\end{tikzpicture}', '\\begin{scope}', '\\end{scope}',
    '\\begin{axis}', '\\end{axis}', '\\begin{matrix}', '\\begin{pgfonlayer}',
    // paths
    '\\draw', '\\fill', '\\filldraw', '\\shade', '\\shadedraw', '\\path', '\\clip',
    '\\node', '\\coordinate', '\\pic', '\\useasboundingbox',
    // path operations
    'rectangle', 'circle', 'ellipse', 'arc', 'grid', 'parabola', 'sin', 'cos',
    'to', 'edge', 'node', 'cycle', 'plot', 'controls', 'curve to',
    // settings
    '\\tikzset', '\\tikzstyle', '\\usetikzlibrary', '\\definecolor', '\\colorlet',
    '\\pgfmathsetmacro', '\\pgfmathparse', '\\foreach', '\\addplot', '\\addplot3',
    '\\newcommand', '\\renewcommand', '\\def',
    // frequent keys
    'thick', 'very thick', 'ultra thick', 'thin', 'dashed', 'dotted', 'densely dashed',
    'draw=', 'fill=', 'opacity=', 'fill opacity=', 'rounded corners', 'line width=',
    'anchor=', 'above', 'below', 'left', 'right', 'above left', 'below right',
    'midway', 'near start', 'near end', 'pos=', 'sloped', 'inner sep=', 'outer sep=',
    'minimum size=', 'minimum width=', 'minimum height=', 'text width=', 'align=',
    'scale=', 'xshift=', 'yshift=', 'rotate=', 'shift=', 'transform shape',
    'every node/.style=', 'every path/.style=',
    // arrows and shapes people reach for
    '->', '<-', '<->', '-latex', '-Stealth', 'Stealth-Stealth',
    'circle, draw', 'rectangle, draw', 'ellipse, draw',
    // colours that exist without any package
    'red', 'green', 'blue', 'cyan', 'magenta', 'yellow', 'black', 'gray', 'white',
    'darkgray', 'lightgray', 'brown', 'lime', 'olive', 'orange', 'pink', 'purple',
    'teal', 'violet'
];
