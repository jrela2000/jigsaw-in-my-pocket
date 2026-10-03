import { mulberry32 } from './rng';

export type Pt = [number, number];
/** One jigsaw edge in unit space: 10 points = start + three cubic beziers, `along` in 0..1. */
export type Edge = { pts: Pt[]; flip: 1 | -1 };

export type Geometry = {
  cols: number;
  rows: number;
  pw: number;
  ph: number;
  width: number;
  height: number;
  /** Margin around each piece cell that leaves room for tabs. */
  margin: number;
  cellW: number;
  cellH: number;
  /** SVG path per piece, in cell-local coordinates (origin = cell top-left). */
  paths: string[];
  /** Every interior cut line in board coordinates. */
  cutLines: string;
  /** hEdges[r][c] is the edge on top of piece (r, c); vEdges[r][c] is the edge on its left. */
  hEdges: (Edge | null)[][];
  vEdges: (Edge | null)[][];
};

const TAB = 0.09;
const JITTER = 0.035;
export const MARGIN_FRACTION = 0.33;

function makeEdge(rand: () => number): Edge {
  const j = () => (rand() * 2 - 1) * JITTER;
  const flip = rand() < 0.5 ? 1 : -1;
  const a = j(), b = j(), c = j(), d = j(), e = j();
  const t = TAB;
  return {
    flip,
    pts: [
      [0, 0],
      [0.2, a], [0.5 + b + d, -t + c], [0.5 - t + b, t + c],
      [0.5 - 2 * t + b + d, 3 * t + c], [0.5 + 2 * t + b - d, 3 * t + c], [0.5 + t + b, t + c],
      [0.5 + b + d, -t + c], [0.8, e], [1, 0],
    ],
  };
}

const f = (n: number) => (Math.round(n * 100) / 100).toString();

/** Board-space points of the horizontal edge above piece (r, c), left to right. */
export function hEdgePoints(g: Pick<Geometry, 'pw' | 'ph' | 'hEdges'>, r: number, c: number): Pt[] {
  const edge = g.hEdges[r][c];
  const x0 = c * g.pw, y0 = r * g.ph;
  if (!edge) return [[x0, y0], [x0 + g.pw, y0]];
  return edge.pts.map(([al, ac]) => [x0 + al * g.pw, y0 + ac * edge.flip * g.ph]);
}

/** Board-space points of the vertical edge left of piece (r, c), top to bottom. */
export function vEdgePoints(g: Pick<Geometry, 'pw' | 'ph' | 'vEdges'>, r: number, c: number): Pt[] {
  const edge = g.vEdges[r][c];
  const x0 = c * g.pw, y0 = r * g.ph;
  if (!edge) return [[x0, y0], [x0, y0 + g.ph]];
  return edge.pts.map(([al, ac]) => [x0 + ac * edge.flip * g.pw, y0 + al * g.ph]);
}

function segment(pts: Pt[], ox: number, oy: number): string {
  if (pts.length === 2) return `L${f(pts[1][0] - ox)} ${f(pts[1][1] - oy)}`;
  let s = '';
  for (let i = 1; i < pts.length; i += 3) {
    s += `C${f(pts[i][0] - ox)} ${f(pts[i][1] - oy)} ${f(pts[i + 1][0] - ox)} ${f(pts[i + 1][1] - oy)} ${f(pts[i + 2][0] - ox)} ${f(pts[i + 2][1] - oy)}`;
  }
  return s;
}

export function generateGeometry(cols: number, rows: number, pw: number, ph: number, seed: number): Geometry {
  const rand = mulberry32(seed);
  const hEdges: (Edge | null)[][] = [];
  const vEdges: (Edge | null)[][] = [];
  for (let r = 0; r <= rows; r++) {
    hEdges.push([]);
    for (let c = 0; c < cols; c++) hEdges[r].push(r === 0 || r === rows ? null : makeEdge(rand));
  }
  for (let r = 0; r < rows; r++) {
    vEdges.push([]);
    for (let c = 0; c <= cols; c++) vEdges[r].push(c === 0 || c === cols ? null : makeEdge(rand));
  }
  const margin = Math.ceil(Math.max(pw, ph) * MARGIN_FRACTION);
  const g = { pw, ph, hEdges, vEdges };
  const paths: string[] = [];
  let cutLines = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ox = c * pw - margin, oy = r * ph - margin;
      const top = hEdgePoints(g, r, c);
      const right = vEdgePoints(g, r, c + 1);
      const bottom = hEdgePoints(g, r + 1, c).slice().reverse();
      const left = vEdgePoints(g, r, c).slice().reverse();
      paths.push(
        `M${f(top[0][0] - ox)} ${f(top[0][1] - oy)}` +
          segment(top, ox, oy) + segment(right, ox, oy) + segment(bottom, ox, oy) + segment(left, ox, oy) + 'Z',
      );
      if (r > 0) cutLines += `M${f(top[0][0])} ${f(top[0][1])}` + segment(top, 0, 0);
      if (c > 0) {
        const l = vEdgePoints(g, r, c);
        cutLines += `M${f(l[0][0])} ${f(l[0][1])}` + segment(l, 0, 0);
      }
    }
  }
  return {
    cols, rows, pw, ph, width: cols * pw, height: rows * ph, margin,
    cellW: pw + margin * 2, cellH: ph + margin * 2, paths, cutLines, hEdges, vEdges,
  };
}

export const isEdgePiece = (i: number, cols: number, rows: number) => {
  const c = i % cols, r = Math.floor(i / cols);
  return c === 0 || r === 0 || c === cols - 1 || r === rows - 1;
};
