/** Collage layouts as unit rectangles [x, y, w, h] on a 0..1 canvas. */
export type CollageLayout = { id: string; name: string; sub: string; pro: boolean; cells: [number, number, number, number][] };

const grid = (cols: number, rows: number): [number, number, number, number][] =>
  Array.from({ length: cols * rows }, (_, i) => [(i % cols) / cols, Math.floor(i / cols) / rows, 1 / cols, 1 / rows]);

export const COLLAGE_LAYOUTS: CollageLayout[] = [
  { id: 'split2', name: '2 Split', sub: 'Free', pro: false, cells: grid(2, 1) },
  { id: 'trio', name: '3 Columns', sub: '3 photos', pro: true, cells: grid(3, 1) },
  { id: 'grid2', name: '2×2 Grid', sub: '4 photos', pro: true, cells: grid(2, 2) },
  { id: 'hero3', name: 'Hero + 3', sub: '4 photos', pro: true, cells: [[0, 0, 1, 0.6], [0, 0.6, 1 / 3, 0.4], [1 / 3, 0.6, 1 / 3, 0.4], [2 / 3, 0.6, 1 / 3, 0.4]] },
  { id: 'hero4', name: '1 Large + 4', sub: '5 photos', pro: true, cells: [[0, 0, 0.56, 1], [0.56, 0, 0.22, 0.5], [0.78, 0, 0.22, 0.5], [0.56, 0.5, 0.22, 0.5], [0.78, 0.5, 0.22, 0.5]] },
  { id: 'grid3x2', name: '3×2 Grid', sub: '6 photos', pro: true, cells: grid(3, 2) },
  { id: 'grid3', name: '3×3 Grid', sub: '9 photos', pro: true, cells: grid(3, 3) },
];

export const MATTING = [
  { id: 'flush', name: 'Flush', frac: 0 },
  { id: 'thin', name: 'Thin', frac: 0.006 },
  { id: 'classic', name: 'Classic', frac: 0.018 },
] as const;

/** Collage canvas: 14:11 like the 252-piece print, rendered at up to 4500 px wide. */
export const COLLAGE_ASPECT = 14 / 11;
export const COLLAGE_WIDTH = 4500;
/** Share of the canvas height used by the caption strip when enabled. */
export const CAPTION_FRAC = 0.09;
