import { AlphaType, ClipOp, ColorType, PaintStyle, Skia, SkImage, SkPath } from '@shopify/react-native-skia';
import { generateGeometry, Geometry } from '../../engine/geometry';
import { boardDimensions } from '../../engine/grid';

export type ColorFamily = { id: string; name: string; swatch: string };
export const COLOR_FAMILIES: ColorFamily[] = [
  { id: 'shadow', name: 'Deep Shadow', swatch: '#2b303b' },
  { id: 'light', name: 'Soft Light', swatch: '#e9e6dc' },
  { id: 'stone', name: 'Stone Grey', swatch: '#8d9296' },
  { id: 'ember', name: 'Ember Red', swatch: '#b4533c' },
  { id: 'ochre', name: 'Warm Ochre', swatch: '#c98b3f' },
  { id: 'gold', name: 'Golden', swatch: '#d7b94a' },
  { id: 'moss', name: 'Moss Green', swatch: '#5f8a4e' },
  { id: 'teal', name: 'Lake Teal', swatch: '#3e7f7c' },
  { id: 'sky', name: 'Sky Blue', swatch: '#4f7fb8' },
  { id: 'violet', name: 'Dusk Violet', swatch: '#8062a6' },
];

export function familyOf(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (l < 0.18) return 0;
  if (l > 0.82 && s < 0.3) return 1;
  if (s < 0.14) return 2;
  let h = 0;
  if (max === r / 255) h = ((g - b) / 255 / d) % 6;
  else if (max === g / 255) h = (b - r) / 255 / d + 2;
  else h = (r - g) / 255 / d + 4;
  h = (h * 60 + 360) % 360;
  if (h < 18 || h >= 340) return 3;
  if (h < 45) return 4;
  if (h < 72) return 5;
  if (h < 160) return 6;
  if (h < 200) return 7;
  if (h < 262) return 8;
  return 9;
}

export type BoardAssets = {
  geo: Geometry;
  atlas: SkImage;
  /** Colour family index per piece. */
  families: number[];
  cutLines: SkPath;
  piecePath: (i: number) => SkPath;
};

/**
 * Cuts the image into a sprite atlas: one cell per piece, already clipped to its jigsaw
 * outline with a baked bevel. The board then draws every piece in a single GPU call.
 */
export function buildBoardAssets(image: SkImage, cols: number, rows: number, seed: number): BoardAssets {
  const aspect = image.width() / image.height();
  const { pw, ph } = boardDimensions(cols, rows, aspect);
  const geo = generateGeometry(cols, rows, pw, ph, seed);
  const { margin: m, cellW, cellH } = geo;

  const surface = Skia.Surface.Make(cols * cellW, rows * cellH);
  if (!surface) throw new Error('Could not allocate the puzzle surface');
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  const dark = Skia.Paint();
  dark.setAntiAlias(true);
  dark.setStyle(PaintStyle.Stroke);
  dark.setStrokeWidth(Math.max(1.5, pw * 0.03));
  dark.setColor(Skia.Color('rgba(15,20,30,0.42)'));
  const light = Skia.Paint();
  light.setAntiAlias(true);
  light.setStyle(PaintStyle.Stroke);
  light.setStrokeWidth(Math.max(1, pw * 0.02));
  light.setColor(Skia.Color('rgba(255,255,255,0.38)'));

  const sx = image.width() / geo.width, sy = image.height() / geo.height;
  const paths: SkPath[] = [];
  for (let i = 0; i < cols * rows; i++) {
    const c = i % cols, r = Math.floor(i / cols);
    const path = Skia.Path.MakeFromSVGString(geo.paths[i])!;
    paths.push(path);
    canvas.save();
    canvas.translate(c * cellW, r * cellH);
    canvas.clipPath(path, ClipOp.Intersect, true);
    // Board-space rectangle covered by this cell, clamped to the image.
    const bx0 = Math.max(0, c * pw - m), by0 = Math.max(0, r * ph - m);
    const bx1 = Math.min(geo.width, c * pw + pw + m), by1 = Math.min(geo.height, r * ph + ph + m);
    canvas.drawImageRect(
      image,
      Skia.XYWHRect(bx0 * sx, by0 * sy, (bx1 - bx0) * sx, (by1 - by0) * sy),
      Skia.XYWHRect(bx0 - (c * pw - m), by0 - (r * ph - m), bx1 - bx0, by1 - by0),
      paint,
    );
    // Bevel: a lit edge offset towards the top-left, then a dark outline. Both are clipped to the piece.
    canvas.save();
    canvas.translate(light.getStrokeWidth(), light.getStrokeWidth());
    canvas.drawPath(path, light);
    canvas.restore();
    canvas.drawPath(path, dark);
    canvas.restore();
  }
  surface.flush();
  const atlas = surface.makeImageSnapshot();

  // Average colour per piece from a cols x rows thumbnail.
  let families = new Array(cols * rows).fill(2);
  try {
    const tiny = Skia.Surface.Make(cols, rows)!;
    tiny.getCanvas().drawImageRect(image, Skia.XYWHRect(0, 0, image.width(), image.height()), Skia.XYWHRect(0, 0, cols, rows), paint);
    tiny.flush();
    const px = tiny.makeImageSnapshot().readPixels(0, 0, { width: cols, height: rows, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
    if (px) families = families.map((_, i) => familyOf(Number(px[i * 4]), Number(px[i * 4 + 1]), Number(px[i * 4 + 2])));
  } catch {
    // Colour sorting is optional; fall back to a single family.
  }

  return { geo, atlas, families, cutLines: Skia.Path.MakeFromSVGString(geo.cutLines) ?? Skia.Path.Make(), piecePath: (i) => paths[i] };
}
