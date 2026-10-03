import { PUZZLE_SIZES, PuzzleSize } from '../config/printify';

export type DpiGrade = 'excellent' | 'warning' | 'blocked';

/** Effective print DPI when an image of the given pixel size covers a print of the given inches. */
export function effectiveDpi(pxW: number, pxH: number, inW: number, inH: number): number {
  const landscape = pxW >= pxH;
  const w = landscape ? inW : inH;
  const h = landscape ? inH : inW;
  // The image is scaled to cover the print area, so the tighter axis decides the DPI.
  return Math.floor(Math.min(pxW / w, pxH / h));
}

export const gradeDpi = (dpi: number): DpiGrade => (dpi >= 300 ? 'excellent' : dpi >= 150 ? 'warning' : 'blocked');

export function dpiForSize(pxW: number, pxH: number, size: PuzzleSize) {
  const dpi = effectiveDpi(pxW, pxH, size.widthIn, size.heightIn);
  return { dpi, grade: gradeDpi(dpi) };
}

/** Largest print size this image can be ordered at without being blocked. */
export function largestPrintable(pxW: number, pxH: number): PuzzleSize | null {
  const ok = PUZZLE_SIZES.filter((s) => dpiForSize(pxW, pxH, s).grade !== 'blocked');
  return ok.length ? ok[ok.length - 1] : null;
}

/** DPI of one collage cell: the cell only occupies a fraction of the print. */
export function cellDpi(pxW: number, pxH: number, cellFracW: number, cellFracH: number, size: PuzzleSize) {
  const dpi = Math.floor(Math.min(pxW / (size.widthIn * cellFracW), pxH / (size.heightIn * cellFracH)));
  return { dpi, grade: gradeDpi(dpi) };
}
