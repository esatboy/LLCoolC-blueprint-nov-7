import { describe, expect, it } from 'vitest';
import { applyAnswer, DAY, dueCaptures, initialResurfaceAt, MAX_STACK, nextAfterAnswer, restorePatch, snoozeUntil } from './scheduler';
import type { Resonance } from '../types';

const NOW = Date.UTC(2026, 5, 1, 12);
const fire = (at = NOW): Resonance => ({ at, answer: 'fire' });

describe('scheduler', () => {
  it('first prompt is 2 days after capture', () => {
    expect(initialResurfaceAt(NOW)).toBe(NOW + 2 * DAY);
  });

  it('🔥 climbs the ladder 7d, 21d, 45d and caps at 45d', () => {
    const days = [1, 2, 3, 4, 5].map((n) => {
      const h = Array.from({ length: n }, () => fire());
      return (nextAfterAnswer(h, 'fire', NOW)! - NOW) / DAY;
    });
    expect(days).toEqual([7, 21, 45, 45, 45]);
  });

  it('🤷 pushes back 7 days without climbing', () => {
    expect(nextAfterAnswer([{ at: NOW, answer: 'meh' }], 'meh', NOW)).toBe(NOW + 7 * DAY);
  });

  it('✗ archives and clears the schedule', () => {
    const p = applyAnswer({ resonanceHistory: [] }, 'no', NOW);
    expect(p.status).toBe('archived');
    expect(p.nextResurfaceAt).toBeNull();
  });

  it('applyAnswer appends history and rescores', () => {
    const p = applyAnswer({ resonanceHistory: [fire(NOW - DAY)] }, 'fire', NOW);
    expect(p.resonanceHistory).toHaveLength(2);
    expect(p.strength).toBe(5); // 1 + 2 + 2
    expect(p.status).toBe('active');
    expect(p.nextResurfaceAt).toBe(NOW + 21 * DAY);
  });

  it('restoring brings an idea back in 2 days', () => {
    expect(restorePatch(NOW)).toEqual({ status: 'active', nextResurfaceAt: NOW + 2 * DAY });
  });

  describe('dueCaptures', () => {
    const mk = (n: number, status: 'active' | 'archived' = 'active') => ({ status, nextResurfaceAt: n as number | null });
    it('returns only due, active items, oldest due first', () => {
      const out = dueCaptures([mk(NOW - 1), mk(NOW + 5), mk(NOW - 9), mk(NOW - 3, 'archived'), { status: 'active' as const, nextResurfaceAt: null }], NOW);
      expect(out.map((c) => c.nextResurfaceAt)).toEqual([NOW - 9, NOW - 1]);
    });
    it(`never returns more than ${MAX_STACK}`, () => {
      const many = Array.from({ length: 12 }, (_, i) => mk(NOW - i - 1));
      expect(dueCaptures(many, NOW)).toHaveLength(5);
    });
    it('treats exactly-due as due', () => {
      expect(dueCaptures([mk(NOW)], NOW)).toHaveLength(1);
    });
  });

  describe('snoozeUntil', () => {
    it('after midnight but before 4am: same day 4am', () => {
      const t = new Date(2026, 0, 10, 1, 0).getTime();
      expect(snoozeUntil(t)).toBe(new Date(2026, 0, 10, 4, 0).getTime());
    });
    it('after 4am: next day 4am', () => {
      const t = new Date(2026, 0, 10, 15, 0).getTime();
      expect(snoozeUntil(t)).toBe(new Date(2026, 0, 11, 4, 0).getTime());
    });
  });
});
