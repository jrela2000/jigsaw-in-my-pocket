import fallback from '../../assets/data/daily-fallback.json';
import { dateKey } from '../lib/streak';
import { readJson, writeJson } from '../lib/json';
import { supabase } from './supabase';

export type DailyArt = {
  date: string;
  title: string;
  artist: string;
  museum: string;
  credit: string;
  license: string;
  imageUrl: string;
  pieces: number;
};

const dayIndex = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

/** Bundled CC0 rotation, used offline and until the Supabase schedule is live. */
function fromBundle(date: string): DailyArt {
  const list = fallback as Omit<DailyArt, 'date' | 'pieces'>[];
  const art = list[((dayIndex(date) % list.length) + list.length) % list.length];
  return { ...art, date, pieces: 110 };
}

const cacheKey = (date: string) => `daily.${date}`;

export async function getDaily(date = dateKey()): Promise<DailyArt> {
  const cached = readJson<DailyArt | null>(cacheKey(date), null);
  if (cached) return cached;
  let art: DailyArt | null = null;
  if (supabase) {
    const { data } = await supabase
      .from('daily_puzzles')
      .select('puzzle_date,title,artist,museum_source,credit_line,license,image_url,piece_count')
      .eq('puzzle_date', date)
      .maybeSingle();
    if (data) {
      art = {
        date, title: data.title, artist: data.artist, museum: data.museum_source, credit: data.credit_line,
        license: data.license ?? 'CC0', imageUrl: data.image_url, pieces: data.piece_count ?? 110,
      };
    }
  }
  art ??= fromBundle(date);
  writeJson(cacheKey(date), art);
  return art;
}

/** The last `days` daily puzzles, newest first (Pro archive). */
export function archiveDates(days: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 1; i <= days; i++) out.push(dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)));
  return out;
}

export const dailyPreview = (date: string) => readJson<DailyArt | null>(cacheKey(date), null) ?? fromBundle(date);
