import { Platform } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { sizeFor } from '../config/printify';
import { dpiForSize } from '../engine/dpi';
import type { PuzzleMeta } from '../store/puzzles';

export function printQuality(meta: PuzzleMeta) {
  const size = sizeFor(meta.pieces);
  return { size, ...dpiForSize(meta.sourceW, meta.sourceH, size) };
}

/** Crops the original to the print's aspect ratio (cover, centred) at up to 300 DPI. */
export async function preparePrintImage(meta: PuzzleMeta): Promise<string> {
  const size = sizeFor(meta.pieces);
  const landscape = meta.sourceW >= meta.sourceH;
  const aspect = landscape ? size.widthIn / size.heightIn : size.heightIn / size.widthIn;
  let cw = meta.sourceW, ch = Math.round(cw / aspect);
  if (ch > meta.sourceH) {
    ch = meta.sourceH;
    cw = Math.round(ch * aspect);
  }
  const maxW = Math.round((landscape ? size.widthIn : size.heightIn) * 300);
  const actions: Parameters<typeof manipulateAsync>[1] = [
    { crop: { originX: Math.floor((meta.sourceW - cw) / 2), originY: Math.floor((meta.sourceH - ch) / 2), width: cw, height: ch } },
  ];
  if (cw > maxW) actions.push({ resize: { width: maxW } });
  const out = await manipulateAsync(meta.sourceUri, actions, { compress: Platform.OS === 'web' ? 0.9 : 0.95, format: SaveFormat.JPEG });
  return out.uri;
}
