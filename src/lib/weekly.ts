import type { Capture, PillarId } from '../types';
import { byStrength } from './blueprint';
import { DAY } from './scheduler';
import { computeStrength, isStrong } from './strength';

/** Weekly "day-off" view logic. Pure: no clock, no DB. */
export const WEEK_MS = 7 * DAY;
export const DECISION_MIN = 3; // "you've saved 3+ things about X"
export const MAX_DECISIONS = 2;

const STOP = new Set(
  'a an and are as at be but by for from has have if in into is it its me my of on or our so that the their them then there these they this to too up was we were what when with you your just need want should would could can will more most very also get got one two make made keep like idea ideas thing things something really maybe about over under than some each every still'.split(' '),
);

const stem = (t: string) => (t.length > 4 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t);

/** Unigrams and bigrams of meaningful words in one capture (a set, so repeats count once). */
export function termsOf(c: Pick<Capture, 'text' | 'tags'>): Set<string> {
  const out = new Set<string>();
  const segments = [...(c.text ?? '').toLowerCase().split(/[.,;:!?\n()]+/), ...c.tags.map((t) => t.toLowerCase())];
  for (const seg of segments) {
    let prev: string | null = null;
    for (const raw of seg.match(/[a-z][a-z'-]*/g) ?? []) {
      if (STOP.has(raw) || raw.length < 4) { prev = null; continue; }
      const t = stem(raw);
      out.add(t);
      if (prev) out.add(`${prev} ${t}`);
      prev = t;
    }
  }
  return out;
}

const score = (term: string, df: number) => df + (term.includes(' ') ? 0.5 : 0); // prefer phrases on ties

function docFreq(caps: Capture[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const c of caps) for (const t of termsOf(c)) df.set(t, (df.get(t) ?? 0) + 1);
  return df;
}

function bestTerm(caps: Capture[], minDf: number): { term: string; members: Capture[] } | null {
  const df = docFreq(caps);
  let best: [string, number] | null = null;
  for (const [t, n] of df) {
    if (n < minDf) continue;
    if (!best || score(t, n) > score(best[0], best[1]) || (score(t, n) === score(best[0], best[1]) && t.length > best[0].length)) best = [t, n];
  }
  if (!best) return null;
  const term = best[0];
  return { term, members: caps.filter((c) => termsOf(c).has(term)) };
}

export const pillarOf = (c: Capture): PillarId | null => c.pillar ?? c.suggestedPillar;

export interface Cluster { pillar: PillarId; count: number; topics: string[]; }
export interface Decision { topic: string; pillar: PillarId | null; captures: Capture[]; }
export interface WeeklySummary { captures: number; fires: number; pillarsMoved: PillarId[]; }
export interface WeeklyView { clusters: Cluster[]; decisions: Decision[]; summary: WeeklySummary; }

export function buildWeekly(all: Capture[], now: number): WeeklyView {
  const start = now - WEEK_MS;
  const week = all.filter((c) => c.status === 'active' && c.createdAt >= start);

  // Ideas that clustered together, by pillar
  const byPillar = new Map<PillarId, Capture[]>();
  for (const c of week) {
    const p = pillarOf(c);
    if (p) byPillar.set(p, [...(byPillar.get(p) ?? []), c]);
  }
  const clusters: Cluster[] = [...byPillar.entries()]
    .map(([pillar, caps]) => {
      const df = [...docFreq(caps)].filter(([, n]) => n >= 2).sort((a, b) => score(b[0], b[1]) - score(a[0], a[1]));
      const topics: string[] = [];
      for (const [t] of df) {
        if (topics.length === 2) break;
        if (topics.some((x) => x.includes(t) || t.includes(x))) continue;
        topics.push(t);
      }
      return { pillar, count: caps.length, topics };
    })
    .sort((a, b) => b.count - a.count);

  // Decisions: "you've saved N things about X, pick your favorite"
  const decisions: Decision[] = [];
  let pool = week;
  while (decisions.length < MAX_DECISIONS) {
    const hit = bestTerm(pool, DECISION_MIN);
    if (!hit) break;
    const tally = new Map<PillarId, number>();
    for (const c of hit.members) { const p = pillarOf(c); if (p) tally.set(p, (tally.get(p) ?? 0) + 1); }
    const pillar = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    decisions.push({ topic: hit.term, pillar, captures: [...hit.members].sort(byStrength) });
    const used = new Set(hit.members.map((c) => c.id));
    pool = pool.filter((c) => !used.has(c.id));
  }

  // Progress
  const strongAt = (c: Capture, asOf: number) => c.createdAt <= asOf && isStrong(computeStrength(c.resonanceHistory, asOf));
  const moved = new Set<PillarId>();
  const nowByPillar = new Map<PillarId, number>();
  const thenByPillar = new Map<PillarId, number>();
  for (const c of all) {
    if (c.status !== 'active' || !c.pillar) continue;
    if (strongAt(c, now)) nowByPillar.set(c.pillar, (nowByPillar.get(c.pillar) ?? 0) + 1);
    if (strongAt(c, start)) thenByPillar.set(c.pillar, (thenByPillar.get(c.pillar) ?? 0) + 1);
  }
  for (const [p, n] of nowByPillar) if (n > (thenByPillar.get(p) ?? 0)) moved.add(p);

  return {
    clusters,
    decisions,
    summary: {
      captures: all.filter((c) => c.createdAt >= start).length,
      fires: all.reduce((n, c) => n + c.resonanceHistory.filter((r) => r.answer === 'fire' && r.at >= start).length, 0),
      pillarsMoved: [...moved],
    },
  };
}

/** Local-time Monday of the week containing `now`, as YYYY-MM-DD. Used to remember a skipped week. */
export function weekKey(now: number): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
