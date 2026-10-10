import { create } from 'zustand';
import { kv } from '../lib/kv';
import { readJson, writeJson } from '../lib/json';
import type { PuzzleState } from '../engine/state';
import type { TextureId } from '../theme';

export type PuzzleKind = 'photo' | 'collage' | 'daily';

export type PuzzleMeta = {
  id: string;
  title: string;
  kind: PuzzleKind;
  /** Image used on the board, already cropped to the board aspect. */
  imageUri: string;
  /** Full-resolution original, kept on device for print orders. */
  sourceUri: string;
  sourceW: number;
  sourceH: number;
  /** Nominal piece count (matches a Printify size); the cut is cols x rows. */
  pieces: number;
  cols: number;
  rows: number;
  /** Board image size in pixels. */
  boardW: number;
  boardH: number;
  seed: number;
  rotation: boolean;
  texture: TextureId;
  createdAt: number;
  updatedAt: number;
  elapsedMs: number;
  placed: number;
  moves: number;
  completedAt: number | null;
  credit?: string;
  dailyDate?: string;
};

type PuzzleStore = {
  puzzles: PuzzleMeta[];
  add: (meta: PuzzleMeta) => void;
  update: (id: string, patch: Partial<PuzzleMeta>) => void;
  remove: (id: string) => void;
};

const KEY = 'puzzles.v1';
const saveKey = (id: string) => `puzzle-state.${id}`;

export const usePuzzles = create<PuzzleStore>((set, get) => ({
  puzzles: readJson<PuzzleMeta[]>(KEY, []),
  add: (meta) => {
    set({ puzzles: [meta, ...get().puzzles.filter((p) => p.id !== meta.id)] });
    writeJson(KEY, get().puzzles);
  },
  update: (id, patch) => {
    set({ puzzles: get().puzzles.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
    writeJson(KEY, get().puzzles);
  },
  remove: (id) => {
    set({ puzzles: get().puzzles.filter((p) => p.id !== id) });
    writeJson(KEY, get().puzzles);
    kv.remove(saveKey(id));
  },
}));

export const loadPuzzleState = (id: string) => readJson<PuzzleState | null>(saveKey(id), null);
export const savePuzzleState = (id: string, state: PuzzleState) => writeJson(saveKey(id), state);
export const getPuzzle = (id: string) => usePuzzles.getState().puzzles.find((p) => p.id === id);
