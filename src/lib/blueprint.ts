import type { Capture, PillarId } from '../types';
import { PILLARS } from './pillars';
import { fireCount, isStrong } from './strength';

export const FILL_TARGET = 5; // strong ideas that make a pillar "full"

/** Strongest first: strength, then repeated 🔥, then newest. */
export function byStrength(a: Capture, b: Capture): number {
  return b.strength - a.strength || fireCount(b.resonanceHistory) - fireCount(a.resonanceHistory) || b.createdAt - a.createdAt;
}

export interface PillarView {
  id: PillarId;
  ideas: Capture[]; // active + sorted, strongest first
  strong: Capture[];
  fill: number; // 0..1
}

/** Derived `Pillar` view: nothing is stored, it is computed from captures. */
export function pillarViews(captures: Capture[]): Record<PillarId, PillarView> {
  const out = {} as Record<PillarId, PillarView>;
  for (const p of PILLARS) {
    const ideas = captures.filter((c) => c.status === 'active' && c.pillar === p.id).sort(byStrength);
    const strong = ideas.filter((c) => isStrong(c.strength));
    out[p.id] = { id: p.id, ideas, strong, fill: Math.min(1, strong.length / FILL_TARGET) };
  }
  return out;
}

export const unsortedCaptures = (captures: Capture[]): Capture[] =>
  captures.filter((c) => c.status === 'active' && !c.pillar).sort((a, b) => b.createdAt - a.createdAt);
