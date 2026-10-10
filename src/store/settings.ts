import { create } from 'zustand';
import { readJson, writeJson } from '../lib/json';
import { EMPTY_STREAK, Streak, completeDaily } from '../lib/streak';
import { FREE_HINTS } from '../config/env';
import type { TextureId } from '../theme';

type Persisted = {
  onboarded: boolean;
  birthYear: number | null;
  haptics: boolean;
  sound: boolean;
  reminders: boolean;
  reminderOffered: boolean;
  streak: Streak;
  hintsLeft: number;
  completions: number;
  completionsAtLastAd: number;
  lastAdAt: number;
  texture: TextureId;
  /** Development-only Pro switch, used when RevenueCat is not configured yet. */
  demoPro: boolean;
};

const DEFAULTS: Persisted = {
  onboarded: false, birthYear: null, haptics: true, sound: true, reminders: false, reminderOffered: false,
  streak: EMPTY_STREAK, hintsLeft: FREE_HINTS, completions: 0, completionsAtLastAd: 0, lastAdAt: 0,
  texture: 'oak', demoPro: false,
};

type SettingsStore = Persisted & {
  set: (patch: Partial<Persisted>) => void;
  recordDaily: (date: string) => Streak;
};

const KEY = 'settings.v1';

export const useSettings = create<SettingsStore>((set, get) => ({
  ...DEFAULTS,
  ...readJson<Partial<Persisted>>(KEY, {}),
  set: (patch) => {
    set(patch);
    const { set: _s, recordDaily: _r, ...data } = get();
    writeJson(KEY, data);
  },
  recordDaily: (date) => {
    const streak = completeDaily(get().streak, date);
    get().set({ streak });
    return streak;
  },
}));

export const ageOf = (birthYear: number | null) => (birthYear == null ? null : new Date().getFullYear() - birthYear);
export const isUnder13 = (birthYear: number | null) => birthYear != null && new Date().getFullYear() - birthYear < 13;
export const isMinor = (birthYear: number | null) => birthYear != null && new Date().getFullYear() - birthYear < 18;
