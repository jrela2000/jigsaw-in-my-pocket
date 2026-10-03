import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import { Atlas, Canvas, Circle, Fill, Group, Image as SkiaImage, Path, Rect, RoundedRect, Shadow, Skia, SkImage, useRectBuffer, useRSXformBuffer } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useDerivedValue, useSharedValue, withDecay, withTiming } from 'react-native-reanimated';
import { BoardAssets } from './assets';
import { bringToFront, DRAGGING, IN_TRAY, isComplete, LOOSE, membersOf, placedCount, PuzzleState, resolveDrop, trayList } from '../../engine/state';
import { isEdgePiece } from '../../engine/geometry';
import { shuffled } from '../../engine/rng';
import { colors } from '../../theme';

export const TRAY_H = 92;
export const CHIPS_H = 52;
const TRAY_CELL = 76;
const TRAY_PAD = 14;
const BOARD_PAD = 18;

export type TrayFilter = { kind: 'all' } | { kind: 'edges' } | { kind: 'family'; family: number };
export type BoardStats = { placed: number; trayAll: number; trayEdges: number; families: { family: number; count: number }[]; zoom: number };
export type DropEvent = { locked: boolean; merged: boolean; complete: boolean };

export type PuzzleBoardHandle = {
  fit: () => void;
  zoomBy: (factor: number) => void;
  scatter: () => void;
  /** Highlights where one unplaced piece goes. Returns false when nothing is left to hint. */
  hint: () => boolean;
  snapshot: () => PuzzleState;
};

type Props = {
  assets: BoardAssets;
  image: SkImage;
  initial: PuzzleState;
  background: string;
  showReference: boolean;
  filter: TrayFilter;
  allowRotate: boolean;
  onStats: (stats: BoardStats) => void;
  onDrop: (e: DropEvent, state: PuzzleState) => void;
};

export const PuzzleBoard = forwardRef<PuzzleBoardHandle, Props>(function PuzzleBoard(
  { assets, image, initial, background, showReference, filter, allowRotate, onStats, onDrop }, ref,
) {
  const { geo, atlas, families } = assets;
  const { cols, rows, pw, ph, margin, cellW, cellH, width: W, height: H } = geo;
  const count = cols * rows;
  const trayScale = (TRAY_CELL - 18) / (Math.max(pw, ph) * 1.3);

  // JS-side source of truth. The shared values below mirror it for the UI thread.
  const state = useRef<PuzzleState>(initial);
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const where = useSharedValue(initial.where.slice());
  const dx = useSharedValue(initial.dx.slice());
  const dy = useSharedValue(initial.dy.slice());
  const rot = useSharedValue(initial.rot.slice());
  const group = useSharedValue(initial.group.slice());
  const order = useSharedValue(initial.order.slice());
  const trayIds = useSharedValue<number[]>([]);
  const trayPos = useSharedValue<number[]>(new Array(count).fill(-1));
  const scroll = useSharedValue(0);
  const maxScroll = useSharedValue(0);

  const cw = useSharedValue(0);
  const trayTop = useSharedValue(0);
  const boardH = useSharedValue(0);
  const camX = useSharedValue(0);
  const camY = useSharedValue(0);
  const camS = useSharedValue(1);
  const fitS = useSharedValue(1);

  const mode = useSharedValue(0); // 0 idle, 1 pan camera, 2 dragging, 3 scrolling tray, 4 touching tray, 5 touching piece
  const dragPiece = useSharedValue(-1);
  const pendingTray = useSharedValue(-1);
  const fromTray = useSharedValue(0);
  const startDx = useSharedValue(0);
  const startDy = useSharedValue(0);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const pinchS = useSharedValue(1);
  const lastTap = useSharedValue(0);

  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hintPiece, setHintPiece] = useState<{ piece: number; x: number; y: number; loose: boolean } | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomTarget = useRef({ s: 1, at: 0 });

  const passes = useCallback((p: number) => {
    const f = filterRef.current;
    if (f.kind === 'edges') return isEdgePiece(p, cols, rows);
    if (f.kind === 'family') return families[p] === f.family;
    return true;
  }, [cols, rows, families]);

  const publish = useCallback((zoom?: number) => {
    const s = state.current;
    const inTray = trayList(s);
    const fam = new Map<number, number>();
    for (const p of inTray) fam.set(families[p], (fam.get(families[p]) ?? 0) + 1);
    onStats({
      placed: placedCount(s),
      trayAll: inTray.length,
      trayEdges: inTray.filter((p) => isEdgePiece(p, cols, rows)).length,
      families: [...fam.entries()].map(([family, n]) => ({ family, count: n })).sort((a, b) => b.count - a.count),
      zoom: zoom ?? camS.value / (fitS.value || 1),
    });
  }, [families, cols, rows, onStats, camS, fitS]);

  /** Copies the JS state to the UI thread and recomputes the tray layout. */
  const push = useCallback(() => {
    const s = state.current;
    const list = trayList(s, passes);
    const pos = new Array(count).fill(-1);
    list.forEach((p, i) => (pos[p] = i));
    where.value = s.where.slice();
    dx.value = s.dx.slice();
    dy.value = s.dy.slice();
    rot.value = s.rot.slice();
    group.value = s.group.slice();
    order.value = s.order.slice();
    trayIds.value = list;
    trayPos.value = pos;
    const max = Math.max(0, list.length * TRAY_CELL + TRAY_PAD * 2 - cw.value);
    maxScroll.value = max;
    if (scroll.value > max) scroll.value = max;
  }, [passes, count, where, dx, dy, rot, group, order, trayIds, trayPos, maxScroll, scroll, cw]);

  const fit = useCallback((animate = true) => {
    const availH = boardH.value;
    if (!cw.value || !availH) return;
    const s = Math.min((cw.value - BOARD_PAD * 2) / W, (availH - BOARD_PAD * 2) / H);
    fitS.value = s;
    const tx = (cw.value - W * s) / 2, ty = (availH - H * s) / 2;
    if (animate) {
      camS.value = withTiming(s);
      camX.value = withTiming(tx);
      camY.value = withTiming(ty);
    } else {
      camS.value = s;
      camX.value = tx;
      camY.value = ty;
    }
    publish(1);
  }, [W, H, cw, boardH, fitS, camS, camX, camY, publish]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    cw.value = width;
    trayTop.value = height - TRAY_H;
    boardH.value = height - TRAY_H - CHIPS_H;
    setSize({ w: width, h: height });
    fit(false);
    push();
  };

  useEffect(() => {
    scroll.value = 0;
    push();
  }, [filter, push, scroll]);

  const settle = useCallback((result: { locked: boolean; merged: boolean }) => {
    if (result.locked) setHintPiece(null);
    push();
    publish();
    onDrop({ ...result, complete: isComplete(state.current) }, state.current);
  }, [push, publish, onDrop]);

  const handleDrop = useCallback((piece: number, ox: number, oy: number, inTray: boolean, wasInTray: boolean, sdx: number, sdy: number) => {
    const s = state.current;
    if (wasInTray) {
      s.where[piece] = LOOSE;
      s.dx[piece] = sdx;
      s.dy[piece] = sdy;
    }
    const members = membersOf(s, s.group[piece]);
    for (const m of members) {
      // Keep pieces within reach of the board so nothing can be lost off-canvas.
      s.dx[m] += ox;
      s.dy[m] += oy;
    }
    const cx = (piece % cols) * pw + s.dx[piece], cy = Math.floor(piece / cols) * ph + s.dy[piece];
    const fx = Math.min(Math.max(cx, -W * 0.5), W * 1.5 - pw) - cx, fy = Math.min(Math.max(cy, -H * 0.5), H * 1.5 - ph) - cy;
    for (const m of members) {
      s.dx[m] += fx;
      s.dy[m] += fy;
    }
    if (inTray && members.length === 1) {
      s.where[piece] = IN_TRAY;
      s.dx[piece] = 0;
      s.dy[piece] = 0;
      settle({ locked: false, merged: false });
      return;
    }
    bringToFront(s, members);
    const snap = Math.min(15 / camS.value, Math.min(pw, ph) * 0.5);
    settle(resolveDrop(s, piece, cols, rows, snap));
  }, [cols, rows, pw, ph, W, H, camS, settle]);

  const handleTap = useCallback((piece: number) => {
    const s = state.current;
    if (!allowRotate || s.where[piece] === DRAGGING) return;
    if (s.where[piece] === LOOSE && membersOf(s, s.group[piece]).length > 1) return;
    s.rot[piece] = (s.rot[piece] + 1) % 4;
    if (s.where[piece] === LOOSE) {
      const snap = Math.min(15 / camS.value, Math.min(pw, ph) * 0.5);
      settle(resolveDrop(s, piece, cols, rows, snap));
    } else {
      push();
    }
  }, [allowRotate, camS, pw, ph, cols, rows, settle, push]);

  const zoomReport = useCallback((z: number) => publish(z), [publish]);

  useImperativeHandle(ref, () => ({
    fit: () => fit(true),
    zoomBy: (factor) => {
      // Zoom from the last requested level, not the mid-animation value, so quick taps add up.
      const from = Date.now() - zoomTarget.current.at < 400 ? zoomTarget.current.s : camS.value;
      const next = Math.min(fitS.value * 8, Math.max(fitS.value * 0.6, from * factor));
      zoomTarget.current = { s: next, at: Date.now() };
      const fx = cw.value / 2, fy = boardH.value / 2;
      const wx = (fx - camX.value) / camS.value, wy = (fy - camY.value) / camS.value;
      camS.value = withTiming(next);
      camX.value = withTiming(fx - wx * next);
      camY.value = withTiming(fy - wy * next);
      publish(next / fitS.value);
    },
    scatter: () => {
      const s = state.current;
      s.trayOrder = shuffled(s.trayOrder, Math.random);
      scroll.value = 0;
      push();
    },
    hint: () => {
      const s = state.current;
      const list = trayList(s, passes);
      const loose = s.order.filter((p) => s.where[p] === LOOSE);
      const piece = list.length ? list[0] : loose.length ? loose[loose.length - 1] : trayList(s)[0];
      if (piece == null) return false;
      const c = piece % cols, r = Math.floor(piece / cols);
      if (s.where[piece] === IN_TRAY) {
        s.trayOrder = [piece, ...s.trayOrder.filter((p) => p !== piece)];
        scroll.value = withTiming(0);
        push();
      }
      setHintPiece({ piece, x: c * pw + pw / 2 + s.dx[piece], y: r * ph + ph / 2 + s.dy[piece], loose: s.where[piece] === LOOSE });
      if (hintTimer.current) clearTimeout(hintTimer.current);
      hintTimer.current = setTimeout(() => setHintPiece(null), 6000);
      return true;
    },
    snapshot: () => state.current,
  }), [fit, fitS, camS, camX, camY, cw, boardH, publish, scroll, push, passes, cols, pw, ph]);

  useEffect(() => () => { if (hintTimer.current) clearTimeout(hintTimer.current); }, []);
  useEffect(() => { publish(1); }, [publish]);

  // ---- UI-thread rendering buffers -------------------------------------------------------

  const boardSprites = useRectBuffer(count, (rect, i) => {
    'worklet';
    const p = order.value[i];
    rect.setXYWH((p % cols) * cellW, Math.floor(p / cols) * cellH, cellW, cellH);
  });
  const staticSprites = useMemo(
    () => Array.from({ length: count }, (_, p) => Skia.XYWHRect((p % cols) * cellW, Math.floor(p / cols) * cellH, cellW, cellH)),
    [count, cols, cellW, cellH],
  );

  const boardXf = useRSXformBuffer(count, (val, i) => {
    'worklet';
    const p = order.value[i];
    const w = where.value[p];
    if (w !== 1 && w !== 2) {
      val.set(0, 0, 0, 0);
      return;
    }
    const k = rot.value[p];
    const cs = k === 0 ? 1 : k === 2 ? -1 : 0, sn = k === 1 ? 1 : k === 3 ? -1 : 0;
    const cx = (p % cols) * pw + pw / 2 + dx.value[p], cy = Math.floor(p / cols) * ph + ph / 2 + dy.value[p];
    val.set(cs, sn, cx - (cs * cellW - sn * cellH) / 2, cy - (sn * cellW + cs * cellH) / 2);
  });

  const dragXf = useRSXformBuffer(count, (val, p) => {
    'worklet';
    if (where.value[p] !== 3) {
      val.set(0, 0, 0, 0);
      return;
    }
    const k = rot.value[p];
    const cs = k === 0 ? 1 : k === 2 ? -1 : 0, sn = k === 1 ? 1 : k === 3 ? -1 : 0;
    const cx = (p % cols) * pw + pw / 2 + dx.value[p] + dragX.value, cy = Math.floor(p / cols) * ph + ph / 2 + dy.value[p] + dragY.value;
    val.set(cs, sn, cx - (cs * cellW - sn * cellH) / 2, cy - (sn * cellW + cs * cellH) / 2);
  });

  const trayXf = useRSXformBuffer(count, (val, p) => {
    'worklet';
    const pos = trayPos.value[p];
    if (pos < 0 || where.value[p] !== 0) {
      val.set(0, 0, 0, 0);
      return;
    }
    const cx = TRAY_PAD + pos * TRAY_CELL + TRAY_CELL / 2 - scroll.value;
    // Tray pieces outside the visible strip are culled.
    if (cx < -TRAY_CELL || cx > cw.value + TRAY_CELL) {
      val.set(0, 0, 0, 0);
      return;
    }
    const cy = trayTop.value + TRAY_H / 2;
    const k = rot.value[p];
    const cs = (k === 0 ? 1 : k === 2 ? -1 : 0) * trayScale, sn = (k === 1 ? 1 : k === 3 ? -1 : 0) * trayScale;
    val.set(cs, sn, cx - (cs * cellW - sn * cellH) / 2, cy - (sn * cellW + cs * cellH) / 2);
  });

  const camera = useDerivedValue(() => [{ translateX: camX.value }, { translateY: camY.value }, { scale: camS.value }]);

  // ---- Gestures ---------------------------------------------------------------------------

  const gesture = useMemo(() => {
    const hit = (x: number, y: number) => {
      'worklet';
      const s = camS.value;
      const wx = (x - camX.value) / s, wy = (y - camY.value) / s;
      const pad = Math.max(margin * 0.4, 10 / s - Math.min(pw, ph) / 2);
      const o = order.value, w = where.value, ax = dx.value, ay = dy.value;
      for (let i = o.length - 1; i >= 0; i--) {
        const p = o[i];
        if (w[p] !== 1) continue;
        const x0 = (p % cols) * pw + ax[p], y0 = Math.floor(p / cols) * ph + ay[p];
        if (wx >= x0 - pad && wx <= x0 + pw + pad && wy >= y0 - pad && wy <= y0 + ph + pad) return p;
      }
      return -1;
    };
    const trayAt = (x: number) => {
      'worklet';
      const idx = Math.floor((x + scroll.value - TRAY_PAD) / TRAY_CELL);
      const ids = trayIds.value;
      return idx >= 0 && idx < ids.length ? ids[idx] : -1;
    };
    const clampCam = () => {
      'worklet';
      const s = camS.value;
      camX.value = Math.min(cw.value * 0.85, Math.max(cw.value * 0.15 - W * s, camX.value));
      camY.value = Math.min(boardH.value * 0.85, Math.max(boardH.value * 0.15 - H * s, camY.value));
    };
    const finishDrag = (y: number) => {
      'worklet';
      const ox = dragX.value, oy = dragY.value;
      const w = where.value;
      dx.modify((v) => {
        'worklet';
        for (let i = 0; i < v.length; i++) if (w[i] === 3) v[i] += ox;
        return v;
      });
      dy.modify((v) => {
        'worklet';
        for (let i = 0; i < v.length; i++) if (w[i] === 3) v[i] += oy;
        return v;
      });
      where.modify((v) => {
        'worklet';
        for (let i = 0; i < v.length; i++) if (v[i] === 3) v[i] = 1;
        return v;
      });
      dragX.value = 0;
      dragY.value = 0;
      mode.value = 0;
      runOnJS(handleDrop)(dragPiece.value, ox, oy, y >= trayTop.value, fromTray.value === 1, startDx.value, startDy.value);
    };

    const pan = Gesture.Pan()
      .maxPointers(1)
      .minDistance(3)
      .onBegin((e) => {
        fromTray.value = 0;
        dragPiece.value = -1;
        if (e.y >= trayTop.value) {
          pendingTray.value = trayAt(e.x);
          mode.value = 4;
        } else if (e.y >= boardH.value) {
          mode.value = 0;
        } else {
          const p = hit(e.x, e.y);
          dragPiece.value = p;
          mode.value = p >= 0 ? 5 : 1;
        }
      })
      .onStart(() => {
        if (mode.value !== 5) return;
        const g = group.value[dragPiece.value];
        const grp = group.value;
        where.modify((v) => {
          'worklet';
          for (let i = 0; i < v.length; i++) if (grp[i] === g && v[i] === 1) v[i] = 3;
          return v;
        });
        dragX.value = 0;
        dragY.value = 0;
        mode.value = 2;
      })
      .onChange((e) => {
        if (mode.value === 1) {
          camX.value += e.changeX;
          camY.value += e.changeY;
          clampCam();
        } else if (mode.value === 2) {
          dragX.value += e.changeX / camS.value;
          dragY.value += e.changeY / camS.value;
        } else if (mode.value === 3) {
          scroll.value = Math.min(maxScroll.value, Math.max(0, scroll.value - e.changeX));
        } else if (mode.value === 4) {
          const up = -e.translationY, across = Math.abs(e.translationX);
          const p = pendingTray.value;
          if (p >= 0 && (e.y < trayTop.value || (up > 6 && up > across))) {
            // Lift the piece out of the tray, centred just above the finger.
            const s = camS.value;
            const sx = (e.x - camX.value) / s - ((p % cols) * pw + pw / 2);
            const sy = (e.y - 36 - camY.value) / s - (Math.floor(p / cols) * ph + ph / 2);
            dx.modify((v) => { 'worklet'; v[p] = sx; return v; });
            dy.modify((v) => { 'worklet'; v[p] = sy; return v; });
            where.modify((v) => { 'worklet'; v[p] = 3; return v; });
            startDx.value = sx;
            startDy.value = sy;
            fromTray.value = 1;
            dragPiece.value = p;
            dragX.value = 0;
            dragY.value = 0;
            mode.value = 2;
          } else if (across > 6) {
            mode.value = 3;
          }
        }
      })
      .onEnd((e) => {
        if (mode.value === 2) finishDrag(e.y);
        else if (mode.value === 3) scroll.value = withDecay({ velocity: -e.velocityX, clamp: [0, maxScroll.value] });
      })
      .onFinalize((e) => {
        if (mode.value === 2) finishDrag(e.y);
        mode.value = 0;
      });

    const pinch = Gesture.Pinch()
      .onStart(() => {
        pinchS.value = camS.value;
      })
      .onChange((e) => {
        if (mode.value === 2) return;
        const next = Math.min(fitS.value * 8, Math.max(fitS.value * 0.6, pinchS.value * e.scale));
        const wx = (e.focalX - camX.value) / camS.value, wy = (e.focalY - camY.value) / camS.value;
        camS.value = next;
        camX.value = e.focalX - wx * next;
        camY.value = e.focalY - wy * next;
        clampCam();
      })
      .onEnd(() => {
        runOnJS(zoomReport)(camS.value / fitS.value);
      });

    const tap = Gesture.Tap()
      .maxDuration(260)
      .onEnd((e, ok) => {
        if (!ok) return;
        if (e.y >= trayTop.value) {
          const p = trayAt(e.x);
          if (p >= 0) runOnJS(handleTap)(p);
          return;
        }
        if (e.y >= boardH.value) return;
        const p = hit(e.x, e.y);
        if (p >= 0) {
          runOnJS(handleTap)(p);
          return;
        }
        const now = Date.now();
        if (now - lastTap.value < 320) {
          // Double tap on empty canvas toggles between fit and a close-up.
          const zoomedIn = camS.value > fitS.value * 1.4;
          const next = zoomedIn ? fitS.value : fitS.value * 3;
          const wx = (e.x - camX.value) / camS.value, wy = (e.y - camY.value) / camS.value;
          camS.value = withTiming(next);
          camX.value = withTiming(zoomedIn ? (cw.value - W * next) / 2 : e.x - wx * next);
          camY.value = withTiming(zoomedIn ? (boardH.value - H * next) / 2 : e.y - wy * next);
          runOnJS(zoomReport)(next / fitS.value);
          lastTap.value = 0;
        } else {
          lastTap.value = now;
        }
      });

    return Gesture.Simultaneous(pinch, Gesture.Exclusive(pan, tap));
    // Shared values are stable; geometry and callbacks are the real dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, pw, ph, margin, W, H, handleDrop, handleTap, zoomReport]);

  const hintPath = hintPiece ? assets.piecePath(hintPiece.piece) : null;
  const hc = hintPiece ? hintPiece.piece % cols : 0, hr = hintPiece ? Math.floor(hintPiece.piece / cols) : 0;

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ flex: 1 }} onLayout={onLayout} accessibilityLabel="Puzzle board">
        {size.w > 0 ? (
          <Canvas style={{ flex: 1 }}>
            <Fill color={background} />
            <Group transform={camera}>
              <RoundedRect x={-10} y={-10} width={W + 20} height={H + 20} r={14} color="#ffffff">
                <Shadow dx={0} dy={6} blur={18} color="rgba(17,24,39,0.16)" />
              </RoundedRect>
              <Rect x={0} y={0} width={W} height={H} color="#e7ebf6" />
              <SkiaImage image={image} x={0} y={0} width={W} height={H} fit="fill" opacity={showReference ? 0.28 : 0} />
              <Path path={assets.cutLines} style="stroke" strokeWidth={Math.max(1, pw * 0.02)} color="rgba(20,27,43,0.16)" />
              {hintPath ? (
                <Group transform={[{ translateX: hc * pw - margin }, { translateY: hr * ph - margin }]}>
                  <Path path={hintPath} color="rgba(196,155,92,0.45)" />
                  <Path path={hintPath} style="stroke" strokeWidth={Math.max(2, pw * 0.06)} color={colors.brass} />
                </Group>
              ) : null}
              <Atlas image={atlas} sprites={boardSprites} transforms={boardXf} />
              {hintPiece?.loose ? (
                <Circle cx={hintPiece.x} cy={hintPiece.y} r={Math.max(pw, ph) * 0.85} style="stroke" strokeWidth={Math.max(2, pw * 0.07)} color={colors.brass} />
              ) : null}
            </Group>
            <RoundedRect x={0} y={size.h - TRAY_H - CHIPS_H} width={size.w} height={TRAY_H + CHIPS_H + 24} r={22} color="#ffffff">
              <Shadow dx={0} dy={-3} blur={12} color="rgba(17,24,39,0.10)" />
            </RoundedRect>
            <Rect x={0} y={size.h - TRAY_H + 4} width={size.w} height={TRAY_H - 8} color={colors.surfaceLow} />
            <Atlas image={atlas} sprites={staticSprites} transforms={trayXf} />
            {hintPiece && !hintPiece.loose ? (
              <RoundedRect x={TRAY_PAD + 3} y={size.h - TRAY_H + 8} width={TRAY_CELL - 6} height={TRAY_H - 16} r={12} style="stroke" strokeWidth={2.5} color={colors.brass} />
            ) : null}
            <Group transform={camera}>
              <Atlas image={atlas} sprites={staticSprites} transforms={dragXf}>
                <Shadow dx={0} dy={Math.max(3, pw * 0.08)} blur={Math.max(5, pw * 0.12)} color="rgba(17,24,39,0.38)" />
              </Atlas>
            </Group>
          </Canvas>
        ) : null}
      </View>
    </GestureDetector>
  );
});
