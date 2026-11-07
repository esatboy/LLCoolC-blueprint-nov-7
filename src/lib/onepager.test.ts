import { describe, expect, it } from 'vitest';
import { chooseHeroes, selectOnePager, slug, suggestNames, suggestOneLiners } from './onepager';
import type { Capture } from '../types';

const cap = (o: Partial<Capture>): Capture => ({
  id: Math.random().toString(36).slice(2), type: 'text', text: 'x', tags: [], createdAt: 1, origin: 'vision', pillar: 'food',
  suggestedPillar: 'food', strength: 3, status: 'active', nextResurfaceAt: null, resonanceHistory: [], ...o,
});
const photo = (o: Partial<Capture> = {}) => cap({ type: 'photo', blob: new Blob(['x']), text: undefined, ...o });

describe('one-pager content', () => {
  it('uses only strong ideas, at most 2 per pillar, strongest first', () => {
    const { sections } = selectOnePager([
      cap({ text: 'weak', strength: 1 }),
      cap({ text: 'good', strength: 3 }),
      cap({ text: 'best', strength: 7 }),
      cap({ text: 'also good', strength: 5 }),
    ]);
    expect(sections[0].ideas).toEqual(['best', 'also good']);
  });
  it('thin pillars become nudges, not blank sections', () => {
    const out = selectOnePager([cap({ text: 'jollof' })]);
    expect(out.sections.find((s) => s.pillar.id === 'guest')!.thin).toBe(true);
    expect(out.missing).toHaveLength(6);
  });
  it('skips archived, unsorted and photo-caption ideas', () => {
    const out = selectOnePager([cap({ status: 'archived' }), cap({ pillar: null }), photo({ text: 'caption', strength: 9 })]);
    expect(out.sections[0].thin).toBe(true);
  });
  it('picks up to 6 strongest photos, flags too few', () => {
    const photos = Array.from({ length: 9 }, (_, i) => photo({ strength: i }));
    expect(selectOnePager(photos).heroes).toHaveLength(6);
    expect(selectOnePager(photos).heroes[0].strength).toBe(8);
    expect(selectOnePager([photo(), photo()]).photoShortfall).toBe(true);
  });
  it('hero override wins and ignores missing ids', () => {
    const a = photo({ id: 'a' }), b = photo({ id: 'b', strength: 9 });
    expect(chooseHeroes([a, b], ['a', 'gone']).map((c) => c.id)).toEqual(['a']);
  });
});

describe('pre-filled pitch and name', () => {
  it('always offers a pitch, even with no ideas', () => {
    expect(suggestOneLiners(selectOnePager([]).sections).length).toBeGreaterThan(0);
  });
  it('builds a pitch from the top food idea', () => {
    const s = suggestOneLiners(selectOnePager([cap({ text: 'Jollof bowl: smoky base, rice on the side', strength: 5 })]).sections);
    expect(s[0]).toBe('Counter-service food built around Jollof bowl.');
  });
  it('pulls name ideas from Brand & Name', () => {
    expect(suggestNames([cap({ pillar: 'brand', text: 'Name idea: Benne & Bay. Benne seed meets Lowcountry.' })])).toEqual(['Benne & Bay']);
  });
  it('slugs file names', () => {
    expect(slug('Benne & Bay!')).toBe('benne-bay');
    expect(slug('')).toBe('concept');
  });
});
