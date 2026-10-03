// Scheduled weekly. Keeps daily_puzzles filled 60 days ahead with CC0 / public-domain museum paintings.
// Sources: Art Institute of Chicago API and The Met Open Access API. Only works explicitly flagged public domain are used.
import { admin, env, json, safeEqual } from '../_shared/util.ts';

type Art = { title: string; artist: string; museum_source: string; credit_line: string; license: string; image_url: string };

// Subjects that do not fit a calm daily puzzle.
const SKIP = /battle|war\b|death|dead|martyr|crucif|slave|execution|massacre|mocked|sacrifice|shoots|beheading|judith|hydra|chastised|ambush/i;

async function fromAIC(page: number): Promise<Art[]> {
  const url = `https://api.artic.edu/api/v1/artworks/search?limit=100&page=${page}&fields=title,artist_title,image_id,is_public_domain,thumbnail` +
    `&query[bool][must][0][term][is_public_domain]=true&query[bool][must][1][term][artwork_type_id]=1&query[bool][must][2][exists][field]=image_id`;
  const res = await fetch(url, { headers: { 'AIC-User-Agent': 'StudioJigsaw (daily puzzle)' } });
  if (!res.ok) return [];
  const body = await res.json();
  return (body.data ?? [])
    .filter((a: any) => a.is_public_domain && a.image_id && a.artist_title && a.thumbnail && a.thumbnail.width > a.thumbnail.height * 1.1 && a.thumbnail.width < a.thumbnail.height * 1.9)
    .map((a: any) => ({
      title: a.title, artist: a.artist_title, museum_source: 'Art Institute of Chicago',
      credit_line: 'Art Institute of Chicago · CC0 Public Domain', license: 'CC0',
      image_url: `https://www.artic.edu/iiif/2/${a.image_id}/full/1686,/0/default.jpg`,
    }));
}

async function fromMet(limit: number): Promise<Art[]> {
  const search = await fetch('https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&isHighlight=true&medium=Paintings&q=landscape');
  if (!search.ok) return [];
  const ids: number[] = ((await search.json()).objectIDs ?? []).sort(() => Math.random() - 0.5).slice(0, limit * 2);
  const out: Art[] = [];
  for (const id of ids) {
    if (out.length >= limit) break;
    const res = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
    if (!res.ok) continue;
    const o = await res.json();
    if (!o.isPublicDomain || !o.primaryImage || !o.artistDisplayName) continue;
    out.push({
      title: o.title, artist: o.artistDisplayName, museum_source: 'The Metropolitan Museum of Art',
      credit_line: `The Metropolitan Museum of Art · ${o.creditLine ?? 'Open Access'} · CC0`, license: 'CC0', image_url: o.primaryImage,
    });
  }
  return out;
}

Deno.serve(async (req) => {
  if (!safeEqual(req.headers.get('x-cron-secret') ?? '', env('CRON_SECRET'))) return json({ error: 'forbidden' }, 403);
  const db = admin();
  const today = new Date();
  const dates = Array.from({ length: 60 }, (_, i) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + i)).toISOString().slice(0, 10));
  const { data: existing } = await db.from('daily_puzzles').select('puzzle_date,image_url');
  const taken = new Set((existing ?? []).map((r) => r.puzzle_date));
  const used = new Set((existing ?? []).map((r) => r.image_url));
  const missing = dates.filter((d) => !taken.has(d));
  if (!missing.length) return json({ added: 0 });

  const pool = [...(await fromAIC(1 + Math.floor(Math.random() * 8))), ...(await fromMet(15))]
    .filter((a) => !used.has(a.image_url) && !SKIP.test(a.title))
    .sort(() => Math.random() - 0.5);
  const rows = missing.slice(0, pool.length).map((puzzle_date, i) => ({ puzzle_date, piece_count: 110, ...pool[i] }));
  if (rows.length) {
    const { error } = await db.from('daily_puzzles').upsert(rows, { onConflict: 'puzzle_date', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  return json({ added: rows.length, stillMissing: missing.length - rows.length });
});
