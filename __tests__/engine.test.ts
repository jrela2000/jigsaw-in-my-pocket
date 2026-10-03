import { generateGeometry, hEdgePoints, vEdgePoints, isEdgePiece, MARGIN_FRACTION } from '../src/engine/geometry';
import { gridFor, boardSizeFor } from '../src/engine/grid';
import { createState, resolveDrop, placedCount, isComplete, trayList, LOOSE, LOCKED, IN_TRAY, accuracy } from '../src/engine/state';
import { effectiveDpi, gradeDpi, dpiForSize, largestPrintable, cellDpi } from '../src/engine/dpi';
import { PUZZLE_SIZES } from '../src/config/printify';
import { completeDaily, currentStreak, EMPTY_STREAK } from '../src/lib/streak';

describe('grid', () => {
  it.each(PUZZLE_SIZES)('matches the Printify piece count for $pieces pieces', (size) => {
    const g = gridFor(size.pieces, size.widthIn / size.heightIn);
    expect(Math.abs(g.cols * g.rows - size.pieces) / size.pieces).toBeLessThan(0.03);
    const pieceAspect = (size.widthIn / size.heightIn) * (g.rows / g.cols);
    expect(pieceAspect).toBeGreaterThan(0.75);
    expect(pieceAspect).toBeLessThan(1.34);
  });
  it('handles portrait and square boards', () => {
    const p = gridFor(252, 11 / 14);
    expect(p.rows).toBeGreaterThan(p.cols);
    const s = gridFor(110, 1);
    expect(Math.abs(s.cols - s.rows)).toBeLessThanOrEqual(1);
  });
  it('gives whole-pixel pieces', () => {
    const g = gridFor(1000, 1.48);
    const b = boardSizeFor(g, 1.48, 2400);
    expect(b.width).toBe(b.pw * g.cols);
    expect(Number.isInteger(b.pw) && Number.isInteger(b.ph)).toBe(true);
  });
});

describe('geometry', () => {
  const g = generateGeometry(6, 5, 100, 90, 42);
  it('creates one closed path per piece', () => {
    expect(g.paths).toHaveLength(30);
    for (const p of g.paths) expect(p.startsWith('M') && p.endsWith('Z')).toBe(true);
  });
  it('is deterministic for a seed and differs across seeds', () => {
    expect(generateGeometry(6, 5, 100, 90, 42).paths).toEqual(g.paths);
    expect(generateGeometry(6, 5, 100, 90, 43).paths).not.toEqual(g.paths);
  });
  it('has flat borders and shared interior edges', () => {
    expect(hEdgePoints(g, 0, 2)).toHaveLength(2);
    expect(vEdgePoints(g, 1, 6)).toHaveLength(2);
    // The bottom edge of (1,2) is by construction the top edge of (2,2): same edge object.
    expect(hEdgePoints(g, 2, 2)).toHaveLength(10);
    expect(g.hEdges[2][2]).not.toBeNull();
  });
  it('keeps every tab inside the cell margin', () => {
    const limit = Math.max(g.pw, g.ph) * MARGIN_FRACTION;
    for (let r = 1; r < g.rows; r++)
      for (let c = 0; c < g.cols; c++)
        for (const [, y] of hEdgePoints(g, r, c)) expect(Math.abs(y - r * g.ph)).toBeLessThanOrEqual(limit);
    for (let r = 0; r < g.rows; r++)
      for (let c = 1; c < g.cols; c++)
        for (const [x] of vEdgePoints(g, r, c)) expect(Math.abs(x - c * g.pw)).toBeLessThanOrEqual(limit);
  });
  it('path coordinates stay inside the cell', () => {
    for (const p of g.paths) {
      const nums = p.match(/-?\d+(\.\d+)?/g)!.map(Number);
      for (let i = 0; i < nums.length; i += 2) {
        expect(nums[i]).toBeGreaterThanOrEqual(0);
        expect(nums[i]).toBeLessThanOrEqual(g.cellW);
        expect(nums[i + 1]).toBeGreaterThanOrEqual(0);
        expect(nums[i + 1]).toBeLessThanOrEqual(g.cellH);
      }
    }
  });
  it('identifies edge pieces', () => {
    const edges = Array.from({ length: 30 }, (_, i) => i).filter((i) => isEdgePiece(i, 6, 5));
    expect(edges).toHaveLength(18);
  });
});

describe('state', () => {
  const cols = 4, rows = 3, snap = 12;
  const onBoard = (s: ReturnType<typeof createState>, p: number, dx: number, dy: number) => {
    s.where[p] = LOOSE; s.dx[p] = dx; s.dy[p] = dy; s.rot[p] = 0;
  };
  it('starts with every piece in the tray', () => {
    const s = createState(12, 1, true);
    expect(trayList(s)).toHaveLength(12);
    expect(placedCount(s)).toBe(0);
    expect(s.rot.some((r) => r !== 0)).toBe(true);
    expect(createState(12, 1, false).rot.every((r) => r === 0)).toBe(true);
  });
  it('locks a piece dropped near home and ignores one far away', () => {
    const s = createState(12, 1, false);
    onBoard(s, 5, 8, -6);
    expect(resolveDrop(s, 5, cols, rows, snap).locked).toBe(true);
    expect(s.where[5]).toBe(LOCKED);
    expect([s.dx[5], s.dy[5]]).toEqual([0, 0]);
    onBoard(s, 6, 40, 0);
    expect(resolveDrop(s, 6, cols, rows, snap).locked).toBe(false);
    expect(s.where[6]).toBe(LOOSE);
  });
  it('never locks a rotated piece', () => {
    const s = createState(12, 1, false);
    onBoard(s, 5, 0, 0);
    s.rot[5] = 1;
    expect(resolveDrop(s, 5, cols, rows, snap).locked).toBe(false);
  });
  it('merges neighbouring loose pieces into a group that moves together', () => {
    const s = createState(12, 1, false);
    onBoard(s, 5, 300, 200);
    onBoard(s, 6, 305, 196);
    const res = resolveDrop(s, 6, cols, rows, snap);
    expect(res.merged).toBe(true);
    expect(s.group[6]).toBe(s.group[5]);
    expect([s.dx[6], s.dy[6]]).toEqual([300, 200]);
    // Non-neighbours with the same offset do not merge.
    onBoard(s, 0, 300, 200);
    expect(resolveDrop(s, 0, cols, rows, snap).merged).toBe(false);
    // Dropping the merged group home locks both pieces.
    s.dx[5] = s.dx[6] = 3; s.dy[5] = s.dy[6] = 2;
    const lock = resolveDrop(s, 5, cols, rows, snap);
    expect(lock.locked).toBe(true);
    expect(s.where[5]).toBe(LOCKED);
    expect(s.where[6]).toBe(LOCKED);
  });
  it('chains merges across several groups', () => {
    const s = createState(12, 1, false);
    onBoard(s, 0, 100, 100); onBoard(s, 2, 100, 100); onBoard(s, 1, 104, 97);
    resolveDrop(s, 1, cols, rows, snap);
    expect(new Set([s.group[0], s.group[1], s.group[2]]).size).toBe(1);
  });
  it('completes when all pieces are locked and keeps locked pieces at the back', () => {
    const s = createState(12, 1, false);
    for (let p = 0; p < 12; p++) { onBoard(s, p, 1, 1); resolveDrop(s, p, cols, rows, snap); }
    expect(isComplete(s)).toBe(true);
    expect(s.order.slice().sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i));
    expect(s.where.includes(IN_TRAY)).toBe(false);
  });
  it('reports accuracy', () => {
    expect(accuracy(100, 100)).toBe(100);
    expect(accuracy(100, 125)).toBe(80);
    expect(accuracy(100, 0)).toBe(100);
  });
});

describe('print resolution', () => {
  it('grades DPI at the 300 / 150 thresholds', () => {
    expect(gradeDpi(300)).toBe('excellent');
    expect(gradeDpi(299)).toBe('warning');
    expect(gradeDpi(150)).toBe('warning');
    expect(gradeDpi(149)).toBe('blocked');
  });
  it('uses the tighter axis and respects orientation', () => {
    expect(effectiveDpi(4200, 3000, 14, 11)).toBe(272);
    expect(effectiveDpi(3000, 4200, 14, 11)).toBe(272);
  });
  it('blocks large prints for small photos and suggests a smaller size', () => {
    const big = PUZZLE_SIZES[4];
    expect(dpiForSize(1600, 1200, big).grade).toBe('blocked');
    expect(largestPrintable(1600, 1200)!.pieces).toBe(110);
    expect(largestPrintable(400, 300)).toBeNull();
    expect(largestPrintable(9000, 6100)!.pieces).toBe(1000);
  });
  it('checks collage cells against their share of the print', () => {
    const size = PUZZLE_SIZES[2];
    expect(cellDpi(2100, 1650, 0.5, 0.5, size).grade).toBe('excellent');
    expect(cellDpi(900, 700, 0.5, 0.5, size).grade).toBe('blocked');
  });
});

describe('daily streak', () => {
  it('counts consecutive days and resets after a gap', () => {
    let s = completeDaily(EMPTY_STREAK, '2026-10-01', '2026-10-01');
    s = completeDaily(s, '2026-10-02', '2026-10-02');
    s = completeDaily(s, '2026-10-02', '2026-10-02');
    expect(s.count).toBe(2);
    expect(currentStreak(s, '2026-10-03')).toBe(2);
    expect(currentStreak(s, '2026-10-04')).toBe(0);
    s = completeDaily(s, '2026-10-05', '2026-10-05');
    expect(s.count).toBe(1);
    expect(s.best).toBe(2);
    expect(s.dailyCompleted).toBe(3);
  });
  it('does not extend the streak for archive puzzles', () => {
    const s = completeDaily(EMPTY_STREAK, '2026-09-01', '2026-10-01');
    expect(s.count).toBe(0);
    expect(s.dailyCompleted).toBe(1);
  });
});
