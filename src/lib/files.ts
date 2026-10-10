import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const web = Platform.OS === 'web';
const root = () => `${FileSystem.documentDirectory}puzzles/`;
const cacheRoot = () => `${FileSystem.cacheDirectory}daily/`;

async function ensureDir(dir: string) {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
}

/** Copies a picked photo into app storage so the puzzle survives the picker's temp file being cleaned up. */
export async function keepOriginal(id: string, uri: string): Promise<string> {
  if (web) return uri;
  await ensureDir(root() + id);
  const dest = `${root()}${id}/source.jpg`;
  if (uri.startsWith('http')) await FileSystem.downloadAsync(uri, dest);
  else await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

/** Centre-crops to `aspect` and scales to the board size. Returns the board image URI. */
export async function makeBoardImage(id: string, uri: string, srcW: number, srcH: number, aspect: number, width: number, height: number) {
  let cw = srcW, ch = Math.round(srcW / aspect);
  if (ch > srcH) {
    ch = srcH;
    cw = Math.round(srcH * aspect);
  }
  // Web, remote image that already has the board's shape (daily art): use it as is. Re-encoding it in
  // the browser is slow on phones and would store a megabyte of image data with the saved puzzle.
  // (The board builder scales the image to the board, so a crop of under 2% is not worth the work.)
  if (web && /^https?:/.test(uri) && cw >= srcW * 0.98 && ch >= srcH * 0.98) return uri;
  const result = await manipulateAsync(
    uri,
    [{ crop: { originX: Math.floor((srcW - cw) / 2), originY: Math.floor((srcH - ch) / 2), width: cw, height: ch } }, { resize: { width, height } }],
    { compress: 0.92, format: SaveFormat.JPEG },
  );
  if (web) return result.uri;
  await ensureDir(root() + id);
  const dest = `${root()}${id}/board.jpg`;
  await FileSystem.moveAsync({ from: result.uri, to: dest });
  return dest;
}

/** Downloads a remote image once and returns the local copy (offline daily puzzle). */
export async function cacheRemote(key: string, url: string): Promise<string> {
  if (web) return url;
  await ensureDir(cacheRoot());
  const dest = `${cacheRoot()}${key}.jpg`;
  const info = await FileSystem.getInfoAsync(dest);
  if (!info.exists) await FileSystem.downloadAsync(url, dest);
  return dest;
}

export async function deletePuzzleFiles(id: string) {
  if (web) return;
  await FileSystem.deleteAsync(root() + id, { idempotent: true });
}

export async function cacheSizeBytes(): Promise<number> {
  if (web) return 0;
  try {
    const dir = cacheRoot();
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) return 0;
    let total = 0;
    for (const name of await FileSystem.readDirectoryAsync(dir)) {
      const f = await FileSystem.getInfoAsync(dir + name);
      if (f.exists && !f.isDirectory) total += f.size ?? 0;
    }
    return total;
  } catch {
    return 0;
  }
}

export async function clearCache() {
  if (web) return;
  await FileSystem.deleteAsync(cacheRoot(), { idempotent: true });
}

export async function readBytes(uri: string): Promise<ArrayBuffer> {
  const res = await fetch(uri);
  return res.arrayBuffer();
}
