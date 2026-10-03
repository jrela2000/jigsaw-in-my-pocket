import { Image } from 'react-native';
import { create } from 'zustand';
import { boardDimensions, gridFor } from '../engine/grid';
import { sizeFor } from '../config/printify';
import { keepOriginal, makeBoardImage, cacheRemote } from './files';
import { newId } from './json';
import { PuzzleKind, PuzzleMeta, usePuzzles } from '../store/puzzles';
import { useSettings } from '../store/settings';
import type { TextureId } from '../theme';
import type { DailyArt } from '../services/daily';

export type Framing = 'print' | 'original' | '4:3' | '16:9' | '1:1';

/** Photo waiting on the New Puzzle screen (picked photo or a rendered collage). */
export type Draft = { uri: string; width: number; height: number; title: string; kind: PuzzleKind };
export const useDraft = create<{ draft: Draft | null; setDraft: (d: Draft | null) => void }>((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
}));

export function aspectFor(framing: Framing, width: number, height: number, pieces: number) {
  const landscape = width >= height;
  const orient = (a: number) => (landscape ? a : 1 / a);
  if (framing === 'original') return width / height;
  if (framing === '4:3') return orient(4 / 3);
  if (framing === '16:9') return orient(16 / 9);
  if (framing === '1:1') return 1;
  const size = sizeFor(pieces);
  return orient(size.widthIn / size.heightIn);
}

export const imageSize = (uri: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => Image.getSize(uri, (width, height) => resolve({ width, height }), reject));

export async function createPuzzle(input: {
  uri: string; width: number; height: number; title: string; kind: PuzzleKind; pieces: number; framing: Framing;
  rotation: boolean; texture?: TextureId; extra?: Partial<PuzzleMeta>;
}): Promise<PuzzleMeta> {
  const id = newId();
  const aspect = aspectFor(input.framing, input.width, input.height, input.pieces);
  const grid = gridFor(input.pieces, aspect);
  const board = boardDimensions(grid.cols, grid.rows, aspect);
  const sourceUri = await keepOriginal(id, input.uri);
  const imageUri = await makeBoardImage(id, sourceUri, input.width, input.height, board.width / board.height, board.width, board.height);
  const now = Date.now();
  const meta: PuzzleMeta = {
    id, title: input.title, kind: input.kind, imageUri, sourceUri, sourceW: input.width, sourceH: input.height,
    pieces: input.pieces, cols: grid.cols, rows: grid.rows, boardW: board.width, boardH: board.height, seed: Math.floor(Math.random() * 2 ** 31), rotation: input.rotation,
    texture: input.texture ?? useSettings.getState().texture, createdAt: now, updatedAt: now, elapsedMs: 0, placed: 0, moves: 0,
    completedAt: null, ...input.extra,
  };
  usePuzzles.getState().add(meta);
  return meta;
}

/** Opens (or resumes) the daily puzzle for the given artwork. */
export async function startDaily(art: DailyArt, pieces: number): Promise<PuzzleMeta> {
  const existing = usePuzzles.getState().puzzles.find((p) => p.dailyDate === art.date && p.pieces === pieces);
  if (existing) return existing;
  const uri = await cacheRemote(art.date, art.imageUrl);
  const { width, height } = await imageSize(uri);
  return createPuzzle({
    uri, width, height, title: art.title, kind: 'daily', pieces, framing: 'original', rotation: false,
    extra: { dailyDate: art.date, credit: `${art.artist} · ${art.credit}` },
  });
}
