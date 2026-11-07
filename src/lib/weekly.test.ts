import { describe, expect, it } from 'vitest';
import { buildWeekly, termsOf, weekKey } from './weekly';
import { computeMetrics } from './events';
import { DAY } from './scheduler';
import type { AppEvent, Capture } from '../types';

const NOW = new Date(2026, 5, 10, 12).getTime(); // a Wednesday
const cap = (o: Partial<Capture>): Capture => ({
  id: Math.random().toString(36).slice(2), type: 'text', text: '', tags: [], createdAt: NOW - DAY, origin: 'vision',
  pillar: 'space', suggestedPillar: 'space', strength: 1, status: 'active', nextResurfaceAt: null, resonanceHistory: [], ...o,
});

describe('weekly view', () => {
  it('finds "counter seating" as a decision when 3+ ideas share it', () => {
    const caps = [
      cap({ text: 'Counter seating with 8 stools' }),
      cap({ text: 'Counter seating height 36 inch' }),
      cap({ text: 'Lisbon counter seating, chat with the cook' }),
      cap({ text: 'Green tile', pillar: 'space' }),
    ];
    const w = buildWeekly(caps, NOW);
    expect(w.decisions).toHaveLength(1);
    expect(w.decisions[0].topic).toBe('counter seating');
    expect(w.decisions[0].captures).toHaveLength(3);
  });
  it('offers no decision when nothing repeats', () => {
    const w = buildWeekly([cap({ text: 'green tile' }), cap({ text: 'jollof bowl', pillar: 'food' })], NOW);
    expect(w.decisions).toEqual([]);
  });
  it('ignores ideas older than a week and archived ones', () => {
    const old = Array.from({ length: 4 }, () => cap({ text: 'counter seating', createdAt: NOW - 9 * DAY }));
    expect(buildWeekly([...old, cap({ text: 'counter seating', status: 'archived' })], NOW).decisions).toEqual([]);
  });
  it('clusters by pillar, using the suggestion for unsorted ideas', () => {
    const w = buildWeekly([cap({ text: 'a stool', pillar: null, suggestedPillar: 'space' }), cap({ text: 'b', pillar: 'food', suggestedPillar: 'food' })], NOW);
    expect(w.clusters.map((c) => [c.pillar, c.count])).toEqual(expect.arrayContaining([['space', 1], ['food', 1]]));
  });
  it('summarizes captures, 🔥 earned and pillars that moved this week', () => {
    const earned = cap({
      pillar: 'food', createdAt: NOW - 20 * DAY, strength: 3,
      resonanceHistory: [{ at: NOW - 2 * DAY, answer: 'fire' }],
    });
    const w = buildWeekly([earned, cap({ text: 'new one' })], NOW);
    expect(w.summary.captures).toBe(1);
    expect(w.summary.fires).toBe(1);
    expect(w.summary.pillarsMoved).toEqual(['food']);
  });
  it('termsOf drops stopwords and keeps phrases', () => {
    const t = termsOf({ text: 'We need the counter seating, stools', tags: ['decor'] });
    expect(t.has('counter seating')).toBe(true);
    expect(t.has('stool')).toBe(true);
    expect(t.has('need')).toBe(false);
  });
  it('weekKey is the Monday of that week', () => {
    expect(weekKey(NOW)).toBe('2026-06-08');
    expect(weekKey(new Date(2026, 5, 14, 23).getTime())).toBe('2026-06-08'); // Sunday
  });
});

describe('local metrics', () => {
  const ev = (type: string, at: number, data?: Record<string, unknown>): AppEvent => ({ type, at, data });
  it('computes captures per week, response rate, install-to-export and repeat 🔥', () => {
    const events = [
      ev('install', 1000), ev('capture_created', NOW), ev('capture_created', NOW + 1), ev('capture_created', NOW + 8 * DAY),
      ev('prompt_shown', 1, { id: 'a' }), ev('prompt_shown', 2, { id: 'a' }), ev('prompt_shown', 3, { id: 'b' }),
      ev('resonance_answered', 4, { id: 'a' }), ev('onepager_exported', 6000),
    ];
    const fires2 = cap({ resonanceHistory: [{ at: 1, answer: 'fire' }, { at: 2, answer: 'fire' }] });
    const sample = cap({ sample: true, resonanceHistory: [{ at: 1, answer: 'fire' }, { at: 2, answer: 'fire' }] });
    const m = computeMetrics(events, [fires2, sample, cap({})]);
    expect(m.capturesPerWeek).toEqual([{ week: '2026-06-08', count: 2 }, { week: '2026-06-15', count: 1 }]);
    expect(m.resonance).toEqual({ promptsShown: 2, answered: 1, responseRate: 0.5 });
    expect(m.installToFirstExportMs).toBe(5000);
    expect(m.ideasWithRepeatedFire).toBe(1); // sample data is excluded
  });
  it('returns nulls before any export or prompt', () => {
    const m = computeMetrics([], []);
    expect(m.installToFirstExportMs).toBeNull();
    expect(m.resonance.responseRate).toBeNull();
  });
});
