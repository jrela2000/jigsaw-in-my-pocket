import { useEffect } from 'react';
import { Platform } from 'react-native';
import { ImageFormat, Skia } from '@shopify/react-native-skia';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { CAPTION_FRAC, COLLAGE_ASPECT, COLLAGE_WIDTH } from '../config/collage';

export type CollageJob = {
  photos: { uri: string }[];
  cells: [number, number, number, number][];
  mattingFrac: number;
  caption: string | null;
};

async function render(job: CollageJob): Promise<{ uri: string; width: number; height: number }> {
  // Web keeps the canvas smaller: it is a preview environment, not a print source.
  const W = Platform.OS === 'web' ? 2000 : COLLAGE_WIDTH;
  const H = Math.round(W / COLLAGE_ASPECT);
  const surface = Skia.Surface.Make(W, H);
  if (!surface) throw new Error('Not enough memory to build the collage');
  const canvas = surface.getCanvas();
  canvas.drawColor(Skia.Color('#f6f3ec'));
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  const gap = Math.round(W * job.mattingFrac);
  const areaH = job.caption ? Math.round(H * (1 - CAPTION_FRAC)) : H;

  for (let i = 0; i < job.cells.length; i++) {
    const photo = job.photos[i];
    if (!photo) continue;
    const data = await Skia.Data.fromURI(photo.uri);
    const image = Skia.Image.MakeImageFromEncoded(data);
    if (!image) continue;
    const [cx, cy, cw, ch] = job.cells[i];
    const x = cx * W + gap, y = cy * areaH + gap, w = cw * W - gap * 2, h = ch * areaH - gap * 2;
    // Cover-crop the photo into its cell.
    const scale = Math.max(w / image.width(), h / image.height());
    const sw = w / scale, sh = h / scale;
    canvas.drawImageRect(image, Skia.XYWHRect((image.width() - sw) / 2, (image.height() - sh) / 2, sw, sh), Skia.XYWHRect(x, y, w, h), paint);
  }

  if (job.caption) {
    try {
      const asset = Asset.fromModule(require('@expo-google-fonts/newsreader/400Regular_Italic/Newsreader_400Regular_Italic.ttf'));
      await asset.downloadAsync();
      const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(await Skia.Data.fromURI(asset.localUri ?? asset.uri));
      if (typeface) {
        const font = Skia.Font(typeface, H * CAPTION_FRAC * 0.42);
        const text = Skia.Paint();
        text.setAntiAlias(true);
        text.setColor(Skia.Color('#141b2b'));
        const width = font.measureText(job.caption).width;
        canvas.drawText(job.caption, (W - width) / 2, areaH + (H - areaH) * 0.62, text, font);
      }
    } catch (err) {
      console.warn('[collage] caption skipped', err);
    }
  }

  surface.flush();
  const base64 = surface.makeImageSnapshot().encodeToBase64(ImageFormat.JPEG, 93);
  if (Platform.OS === 'web') return { uri: `data:image/jpeg;base64,${base64}`, width: W, height: H };
  const uri = `${FileSystem.cacheDirectory}collage-${Date.now()}.jpg`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return { uri, width: W, height: H };
}

/** Headless: renders the collage once and reports the file. Loaded lazily so Skia is ready on web. */
export default function CollageRender({ job, onDone, onError }: {
  job: CollageJob; onDone: (r: { uri: string; width: number; height: number }) => void; onError: () => void;
}) {
  useEffect(() => {
    let live = true;
    render(job).then((r) => live && onDone(r)).catch((err) => { console.warn(err); if (live) onError(); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job]);
  return null;
}
