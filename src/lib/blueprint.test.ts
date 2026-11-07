import { describe, expect, it } from 'vitest';
import { pillarViews, unsortedCaptures } from './blueprint';
import type { Capture } from '../types';

const cap = (o: Partial<Capture>): Capture => ({
  id: Math.random().toString(36), type: 'text', tags: [], createdAt: 1, origin: 'vision', pillar: 'food',
  suggestedPillar: 'food', strength: 1, status: 'active', nextResurfaceAt: null, resonanceHistory: [], ...o,
});

describe('pillar views', () => {
  it('orders strongest first and counts strong ideas for the fill', () => {
    const v = pillarViews([cap({ id: 'a', strength: 1 }), cap({ id: 'b', strength: 5 }), cap({ id: 'c', strength: 3 })]).food;
    expect(v.ideas.map((c) => c.id)).toEqual(['b', 'c', 'a']);
    expect(v.strong).toHaveLength(2);
    expect(v.fill).toBeCloseTo(0.4);
  });
  it('fill caps at 1 and ignores archived and unsorted ideas', () => {
    const many = Array.from({ length: 8 }, () => cap({ strength: 3 }));
    const v = pillarViews([...many, cap({ status: 'archived', strength: 9 }), cap({ pillar: null })]).food;
    expect(v.fill).toBe(1);
    expect(v.ideas).toHaveLength(8);
  });
  it('lists unsorted active ideas newest first', () => {
    const out = unsortedCaptures([cap({ id: 'x', pillar: null, createdAt: 1 }), cap({ id: 'y', pillar: null, createdAt: 2 }), cap({ id: 'z' })]);
    expect(out.map((c) => c.id)).toEqual(['y', 'x']);
  });
});
