import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

let started = false;

/**
 * Web only: fetches the puzzle engine (a multi-megabyte download) and the board screen while
 * the visitor is still on the gallery, so opening a puzzle does not wait for either.
 */
export function preloadBoard() {
  if (started) return;
  started = true;
  const run = async () => {
    try {
      await LoadSkiaWeb({ locateFile: (file: string) => `${process.env.EXPO_BASE_URL ?? ''}/${file}` });
      // Must come after the engine: the board module needs it at import time.
      await import('../components/board/BoardScreen');
    } catch {
      started = false; // The board screen loads it on demand instead.
    }
  };
  setTimeout(run, 1200);
}
