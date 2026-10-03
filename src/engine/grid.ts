export type Grid = { cols: number; rows: number };

/**
 * Picks the cols x rows grid whose piece total is closest to `count` while keeping
 * pieces close to square for the given board aspect ratio (width / height).
 */
export function gridFor(count: number, aspect: number): Grid {
  let best: Grid = { cols: 1, rows: 1 };
  let bestScore = Infinity;
  const maxCols = Math.ceil(Math.sqrt(count * Math.max(aspect, 1 / aspect))) + 6;
  for (let cols = 1; cols <= maxCols; cols++) {
    for (const rows of [Math.floor(count / cols), Math.ceil(count / cols)]) {
      if (rows < 1) continue;
      const pieceAspect = (aspect * rows) / cols;
      const squareness = Math.abs(Math.log(pieceAspect));
      const countError = Math.abs(cols * rows - count) / count;
      const score = squareness * 2 + countError * 6;
      if (score < bestScore) {
        bestScore = score;
        best = { cols, rows };
      }
    }
  }
  return best;
}

/** Board pixel size: every piece gets whole-pixel dimensions so atlas cells never bleed. */
export function boardSizeFor(grid: Grid, aspect: number, longSide: number) {
  const w = aspect >= 1 ? longSide : longSide * aspect;
  const h = aspect >= 1 ? longSide / aspect : longSide;
  const pw = Math.max(8, Math.round(w / grid.cols));
  const ph = Math.max(8, Math.round(h / grid.rows));
  return { pw, ph, width: pw * grid.cols, height: ph * grid.rows };
}

/** Board resolution: large puzzles get more pixels so individual pieces stay sharp when zoomed in. */
export const boardLongSide = (pieces: number) => (pieces >= 500 ? 2400 : 1600);

export function boardDimensions(cols: number, rows: number, aspect: number) {
  return boardSizeFor({ cols, rows }, aspect, boardLongSide(cols * rows));
}
