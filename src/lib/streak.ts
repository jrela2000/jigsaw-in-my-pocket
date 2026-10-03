export type Streak = { count: number; lastDate: string | null; best: number; dailyCompleted: number };

export const EMPTY_STREAK: Streak = { count: 0, lastDate: null, best: 0, dailyCompleted: 0 };

export const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const dayNumber = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

/** Streak after completing the daily puzzle dated `date`. Completing an old daily never extends it. */
export function completeDaily(streak: Streak, date: string, today = dateKey()): Streak {
  if (streak.lastDate === date) return streak;
  const dailyCompleted = streak.dailyCompleted + 1;
  if (date !== today) return { ...streak, dailyCompleted };
  const consecutive = streak.lastDate != null && dayNumber(date) - dayNumber(streak.lastDate) === 1;
  const count = consecutive ? streak.count + 1 : 1;
  return { count, lastDate: date, best: Math.max(streak.best, count), dailyCompleted };
}

/** The streak to show today: it lapses once a full day has been missed. */
export function currentStreak(streak: Streak, today = dateKey()): number {
  if (!streak.lastDate) return 0;
  return dayNumber(today) - dayNumber(streak.lastDate) <= 1 ? streak.count : 0;
}
