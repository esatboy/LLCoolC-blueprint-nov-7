import type { Capture, PillarId } from '../types';
import { byStrength } from './blueprint';
import { PILLARS, type PillarDef } from './pillars';
import { isStrong } from './strength';

/** Pure content selection for the concept one-pager (rendering lives in onepagerRender.ts). */

export const MAX_IDEAS_PER_PILLAR = 2;
export const MIN_HEROES = 3;
export const MAX_HEROES = 6;

export interface ConceptMeta {
  name: string;
  oneLiner: string;
  heroIds: string[] | null; // null = automatic
}
export const DEFAULT_CONCEPT: ConceptMeta = { name: '', oneLiner: '', heroIds: null };

export interface Section {
  pillar: PillarDef;
  ideas: string[]; // strongest first
  thin: boolean; // no strong idea yet -> "here's what's missing" nudge instead of a blank block
}
export interface OnePagerContent {
  sections: Section[];
  heroes: Capture[];
  missing: PillarDef[];
  photoShortfall: boolean;
}

const ideaText = (c: Capture) => (c.text ?? '').replace(/\s+/g, ' ').trim();

/** Photos ranked strongest first; user override wins (kept in her order). */
export function chooseHeroes(captures: Capture[], override: string[] | null): Capture[] {
  const photos = captures.filter((c) => c.status === 'active' && c.type === 'photo' && c.blob);
  if (override) {
    const byId = new Map(photos.map((c) => [c.id, c]));
    return override.map((id) => byId.get(id)).filter((c): c is Capture => !!c).slice(0, MAX_HEROES);
  }
  return [...photos].sort(byStrength).slice(0, MAX_HEROES);
}

export function selectOnePager(captures: Capture[], heroOverride: string[] | null = null): OnePagerContent {
  const active = captures.filter((c) => c.status === 'active');
  const sections: Section[] = PILLARS.map((pillar) => {
    const ideas = active
      .filter((c) => c.pillar === pillar.id && c.type !== 'photo' && ideaText(c) && isStrong(c.strength))
      .sort(byStrength)
      .slice(0, MAX_IDEAS_PER_PILLAR)
      .map(ideaText);
    return { pillar, ideas, thin: ideas.length === 0 };
  });
  const heroes = chooseHeroes(captures, heroOverride);
  return { sections, heroes, missing: sections.filter((s) => s.thin).map((s) => s.pillar), photoShortfall: heroes.length < MIN_HEROES };
}

const clause = (t: string, max = 70): string => {
  const first = t.split(/[:.\n]/)[0].trim();
  return first.length > max ? first.slice(0, max - 1).trimEnd() + '…' : first;
};

/** Pre-filled pitch options so the field is never blank. Always returns at least one. */
export function suggestOneLiners(sections: Section[]): string[] {
  const get = (id: PillarId) => sections.find((s) => s.pillar.id === id)?.ideas[0];
  const food = get('food'), service = get('service'), space = get('space');
  const out: string[] = [];
  if (food) out.push(`Counter-service food built around ${clause(food)}.`);
  if (service && space) out.push(`${clause(service)}, in a space with ${clause(space, 45).toLowerCase()}.`);
  else if (service) out.push(`${clause(service)}.`);
  out.push('A warm, fast, counter-service spot rooted in West African and Southern cooking.');
  return out.slice(0, 3);
}

/** Names pulled from Brand & Name ideas written like "Name idea: Benne & Bay." */
export function suggestNames(captures: Capture[]): string[] {
  const names: string[] = [];
  for (const c of captures) {
    if (c.status !== 'active' || c.pillar !== 'brand') continue;
    const m = /name(?:\s+idea)?\s*[:\-]\s*([^.\n]+)/i.exec(c.text ?? '');
    if (m) names.push(m[1].trim());
  }
  return [...new Set(names)].slice(0, 3);
}

export const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'concept';
