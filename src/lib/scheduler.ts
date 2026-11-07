import type { Answer, Capture, Resonance } from '../types';
import { computeStrength } from './strength';

/** Resurfacing scheduler. All functions are pure (no clock, no DB): pass `now` in. */
export const DAY = 86_400_000;
export const LADDER_DAYS = [2, 7, 21, 45]; // first prompt after 2 days, then 7, 21, 45 (cap)
export const MEH_PUSHBACK_DAYS = 7;
export const MAX_STACK = 5;

export const initialResurfaceAt = (createdAt: number): number => createdAt + LADDER_DAYS[0] * DAY;

/** When should this idea come back after `answer`? `historyWithAnswer` already includes the new answer. */
export function nextAfterAnswer(historyWithAnswer: Resonance[], answer: Answer, now: number): number | null {
  if (answer === 'no') return null; // archived
  if (answer === 'meh') return now + MEH_PUSHBACK_DAYS * DAY;
  const fires = historyWithAnswer.filter((r) => r.answer === 'fire').length;
  return now + LADDER_DAYS[Math.min(fires, LADDER_DAYS.length - 1)] * DAY;
}

/** The fields to patch onto a capture after she answers "Still you?". */
export function applyAnswer(
  capture: Pick<Capture, 'resonanceHistory'>,
  answer: Answer,
  now: number,
  source: Resonance['source'] = 'prompt',
): Pick<Capture, 'resonanceHistory' | 'strength' | 'status' | 'nextResurfaceAt'> {
  const resonanceHistory = [...capture.resonanceHistory, { at: now, answer, source }];
  return {
    resonanceHistory,
    strength: computeStrength(resonanceHistory),
    status: answer === 'no' ? 'archived' : 'active',
    nextResurfaceAt: nextAfterAnswer(resonanceHistory, answer, now),
  };
}

/** Undo an archive: back to active, back in the stack in 2 days. */
export const restorePatch = (now: number): Pick<Capture, 'status' | 'nextResurfaceAt'> => ({
  status: 'active',
  nextResurfaceAt: now + LADDER_DAYS[0] * DAY,
});

/** Captures due for a "Still you?" prompt: oldest-due first, never more than `limit`. */
export function dueCaptures<T extends Pick<Capture, 'status' | 'nextResurfaceAt'>>(captures: T[], now: number, limit = MAX_STACK): T[] {
  return captures
    .filter((c) => c.status === 'active' && c.nextResurfaceAt !== null && c.nextResurfaceAt <= now)
    .sort((a, b) => (a.nextResurfaceAt as number) - (b.nextResurfaceAt as number))
    .slice(0, limit);
}

/** "Dismiss all" hides the stack until the next 4am local time, so a 1am session doesn't re-prompt in the morning. */
export function snoozeUntil(now: number): number {
  const d = new Date(now);
  d.setHours(4, 0, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}
