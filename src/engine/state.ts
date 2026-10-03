import { mulberry32, shuffled } from './rng';

export const IN_TRAY = 0;
export const LOOSE = 1;
export const LOCKED = 2;
export const DRAGGING = 3;

/**
 * Serializable puzzle state. dx/dy are each piece's offset from its solved position
 * in board pixels, so a piece is home when dx = dy = 0 and rot = 0.
 */
export type PuzzleState = {
  where: number[];
  dx: number[];
  dy: number[];
  /** Quarter turns clockwise, 0..3. */
  rot: number[];
  group: number[];
  /** Draw order on the board, back to front. */
  order: number[];
  trayOrder: number[];
};

export function createState(count: number, seed: number, rotation: boolean): PuzzleState {
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const ids = Array.from({ length: count }, (_, i) => i);
  return {
    where: ids.map(() => IN_TRAY),
    dx: ids.map(() => 0),
    dy: ids.map(() => 0),
    rot: ids.map(() => (rotation ? Math.floor(rand() * 4) : 0)),
    group: ids.slice(),
    order: ids.slice(),
    trayOrder: shuffled(ids, rand),
  };
}

export const placedCount = (s: PuzzleState) => s.where.reduce((n, w) => n + (w === LOCKED ? 1 : 0), 0);
export const isComplete = (s: PuzzleState) => s.where.every((w) => w === LOCKED);
export const membersOf = (s: PuzzleState, groupId: number) =>
  s.group.reduce<number[]>((acc, g, i) => (g === groupId && s.where[i] !== IN_TRAY ? (acc.push(i), acc) : acc), []);

export type DropResult = { locked: boolean; merged: boolean; pieces: number[] };

/**
 * Resolves a drop for the group containing `piece`: locks it onto the board if it is
 * near home, otherwise merges it with any correctly-aligned neighbouring loose group.
 * Mutates `s`.
 */
export function resolveDrop(s: PuzzleState, piece: number, cols: number, rows: number, snap: number): DropResult {
  let members = membersOf(s, s.group[piece]);
  const result: DropResult = { locked: false, merged: false, pieces: members };
  if (s.rot[piece] !== 0) return result;

  const tryLock = () => {
    if (Math.hypot(s.dx[piece], s.dy[piece]) > snap) return false;
    for (const m of members) {
      s.dx[m] = 0;
      s.dy[m] = 0;
      s.where[m] = LOCKED;
    }
    // Locked pieces sit underneath everything that is still loose.
    const set = new Set(members);
    s.order = [...members, ...s.order.filter((p) => !set.has(p))];
    return true;
  };

  if (tryLock()) return { ...result, locked: true };

  let changed = true;
  while (changed) {
    changed = false;
    for (const m of members) {
      const c = m % cols, r = Math.floor(m / cols);
      const neighbours = [c > 0 ? m - 1 : -1, c < cols - 1 ? m + 1 : -1, r > 0 ? m - cols : -1, r < rows - 1 ? m + cols : -1];
      for (const n of neighbours) {
        if (n < 0 || s.group[n] === s.group[m] || s.where[n] !== LOOSE || s.rot[n] !== 0) continue;
        if (Math.abs(s.dx[m] - s.dx[n]) > snap || Math.abs(s.dy[m] - s.dy[n]) > snap) continue;
        const target = s.group[n];
        const tx = s.dx[n], ty = s.dy[n];
        for (const p of members) {
          s.dx[p] = tx;
          s.dy[p] = ty;
          s.group[p] = target;
        }
        members = membersOf(s, target);
        result.merged = true;
        changed = true;
        break;
      }
      if (changed) break;
    }
  }
  result.pieces = members;
  if (result.merged && tryLock()) result.locked = true;
  return result;
}

/** Moves a group to the top of the draw order. */
export function bringToFront(s: PuzzleState, pieces: number[]) {
  const set = new Set(pieces);
  s.order = [...s.order.filter((p) => !set.has(p)), ...pieces];
}

/** Pieces still in the tray, in tray order, optionally filtered. */
export function trayList(s: PuzzleState, filter?: (piece: number) => boolean) {
  return s.trayOrder.filter((p) => s.where[p] === IN_TRAY && (!filter || filter(p)));
}

export function accuracy(total: number, moves: number) {
  if (moves <= 0) return 100;
  return Math.max(1, Math.min(100, Math.round((total / moves) * 100)));
}
