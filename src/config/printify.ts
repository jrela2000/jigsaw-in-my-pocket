/**
 * Printify jigsaw puzzle catalog mapping.
 *
 * These are the piece counts and print areas of Printify's "Jigsaw Puzzle (30, 110, 252, 500,
 * 1000-Piece)" blueprint. Blueprint / provider / variant IDs are NOT filled in yet: run
 * `node scripts/fetch-printify-catalog.mjs` with your Printify token (see SETUP_CHECKLIST.md)
 * and paste the IDs it prints here and into supabase/functions/_shared/config.ts.
 */
export type PuzzleSize = {
  pieces: number;
  /** Print size in inches, landscape. */
  widthIn: number;
  heightIn: number;
  label: string;
  blurb: string;
  estimate: string;
  free: boolean;
};

export const PUZZLE_SIZES: PuzzleSize[] = [
  { pieces: 30, widthIn: 9.6, heightIn: 8, label: 'Quick & Relaxing', blurb: 'Large interlocking joints', estimate: 'Est. 5–10 min', free: true },
  { pieces: 110, widthIn: 10, heightIn: 8, label: 'Classic Flow', blurb: 'Balanced contemplative pace', estimate: 'Est. 20–30 min', free: true },
  { pieces: 252, widthIn: 14, heightIn: 11, label: 'Deep Focus', blurb: 'Rich organic shapes', estimate: 'Est. 45–60 min', free: false },
  { pieces: 500, widthIn: 20.5, heightIn: 15, label: 'Challenger', blurb: 'Intricate edge profiles', estimate: 'Est. 2–3 hours', free: false },
  { pieces: 1000, widthIn: 29.25, heightIn: 19.75, label: 'Masterpiece', blurb: 'Fine-art atelier scale', estimate: 'Est. 5+ hours', free: false },
];

export const sizeFor = (pieces: number) =>
  PUZZLE_SIZES.reduce((best, s) => (Math.abs(s.pieces - pieces) < Math.abs(best.pieces - pieces) ? s : best));

/** Largest free-tier piece count; anything above needs Pro or a rewarded unlock. */
export const FREE_MAX_PIECES = 110;
