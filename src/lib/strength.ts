import type { Answer, Resonance } from '../types';

/** Strength scoring. Pure. A fresh idea is 1; each 🔥 adds 2; each 🤷 takes 1 (never below 0); ✗ doesn't score (it archives). */
export const START_STRENGTH = 1;
export const FIRE_POINTS = 2;
export const MEH_PENALTY = 1;
export const STRONG_THRESHOLD = 3; // at least one 🔥
export const HERO_FIRES = 2; // "repeated 🔥"

export function computeStrength(history: Resonance[], asOf: number = Infinity): number {
  let s = START_STRENGTH;
  for (const r of history) {
    if (r.at > asOf) continue;
    if (r.answer === 'fire') s += FIRE_POINTS;
    else if (r.answer === 'meh') s = Math.max(0, s - MEH_PENALTY);
  }
  return s;
}

export const fireCount = (history: Resonance[], asOf: number = Infinity): number =>
  history.filter((r) => r.answer === 'fire' && r.at <= asOf).length;

export const isStrong = (strength: number): boolean => strength >= STRONG_THRESHOLD;

export const answerLabel: Record<Answer, string> = { fire: '🔥', meh: '🤷', no: '✗' };
