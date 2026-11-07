import { describe, expect, it } from 'vitest';
import { computeStrength, fireCount, isStrong } from './strength';
import type { Resonance } from '../types';

const r = (answer: Resonance['answer'], at = 1): Resonance => ({ answer, at });

describe('strength scoring', () => {
  it('a new idea starts at 1 and is not strong', () => {
    expect(computeStrength([])).toBe(1);
    expect(isStrong(1)).toBe(false);
  });
  it('🔥 adds 2 and one 🔥 makes an idea strong', () => {
    expect(computeStrength([r('fire')])).toBe(3);
    expect(isStrong(3)).toBe(true);
  });
  it('🤷 subtracts 1 but never below 0', () => {
    expect(computeStrength([r('meh')])).toBe(0);
    expect(computeStrength([r('meh'), r('meh'), r('meh')])).toBe(0);
  });
  it('a 🤷 can cost a strong idea its status', () => {
    expect(isStrong(computeStrength([r('fire'), r('meh')]))).toBe(false);
  });
  it('✗ does not change the score', () => {
    expect(computeStrength([r('fire'), r('no')])).toBe(3);
  });
  it('can be replayed as of a past date', () => {
    const h = [r('fire', 10), r('fire', 20)];
    expect(computeStrength(h, 15)).toBe(3);
    expect(computeStrength(h, 25)).toBe(5);
    expect(fireCount(h, 15)).toBe(1);
  });
});
