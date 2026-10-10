jest.mock('react-native-reanimated', () => ({
  Easing: { bezier: () => (t: number) => t },
  useReducedMotion: () => false,
  useSharedValue: (v: number) => ({ value: v }),
  withDelay: (_d: number, v: unknown) => v,
  withTiming: (v: unknown) => v,
}));
import { easeOutCubic, MAX_STAGGERED, pickVariant, revealDelay, STAGGER_MS } from '../src/lib/motion';

describe('motion helpers', () => {
  it('staggers 140ms apart and caps', () => {
    expect(revealDelay(0)).toBe(0);
    expect(revealDelay(2)).toBe(2 * STAGGER_MS);
    expect(revealDelay(50)).toBe(MAX_STAGGERED * STAGGER_MS);
    expect(revealDelay(1, 1000)).toBe(1000 + STAGGER_MS);
    expect(revealDelay(-3)).toBe(0);
  });
  it('eases 0 to 1 and clamps', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(2)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
  it('never repeats the last variant', () => {
    for (let last = 0; last < 3; last++) {
      for (let i = 0; i < 20; i++) expect(pickVariant(3, last, () => i / 20)).not.toBe(last);
    }
    expect(pickVariant(3, -1, () => 0.99)).toBe(2);
    expect(pickVariant(1, 0)).toBe(0);
  });
});
