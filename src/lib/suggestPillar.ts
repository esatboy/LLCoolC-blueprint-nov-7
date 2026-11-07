import type { CaptureType, PillarId } from '../types';
import { PILLARS } from './pillars';

/**
 * Pillar suggestion lives behind ONE interface so the method can be swapped.
 *   suggestPillar(input, opts) -> { pillar, confidence, source }
 * Default: local keyword heuristic (nothing leaves the device).
 * Optional: an LLM hook (see `llmSuggester`). OFF by default; only used when `opts.llm.enabled` is true,
 * which the UI sets only after an explicit opt-in. It sends capture TEXT (never photos/audio) off-device.
 */

export interface SuggestInput {
  type: CaptureType;
  text?: string;
  tags: string[];
}
export interface PillarSuggestion {
  pillar: PillarId;
  confidence: number; // 0..1
  source: 'heuristic' | 'llm';
}
export interface PillarSuggester {
  name: string;
  suggest(input: SuggestInput): Promise<PillarSuggestion>;
}

/** Quick tags offered at capture time. Each also nudges the pillar suggestion. */
export const QUICK_TAGS: { tag: string; pillar: PillarId }[] = [
  { tag: 'dish', pillar: 'food' },
  { tag: 'plating', pillar: 'food' },
  { tag: 'seating', pillar: 'space' },
  { tag: 'lighting', pillar: 'space' },
  { tag: 'decor', pillar: 'space' },
  { tag: 'music', pillar: 'space' },
  { tag: 'ordering', pillar: 'service' },
  { tag: 'name', pillar: 'brand' },
  { tag: 'hiring', pillar: 'team' },
  { tag: 'price', pillar: 'numbers' },
];
const TAG_PILLAR = new Map(QUICK_TAGS.map((t) => [t.tag, t.pillar]));

const tokenize = (s: string) => s.toLowerCase().match(/[a-z$][a-z'-]*/g) ?? [];

/** Pure, synchronous scoring so it is trivially testable. */
export function heuristicSuggest(input: SuggestInput): PillarSuggestion {
  const text = (input.text ?? '').toLowerCase();
  const tokens = tokenize(text);
  const scores = new Map<PillarId, number>(PILLARS.map((p) => [p.id, 0]));
  const add = (id: PillarId, n: number) => scores.set(id, (scores.get(id) ?? 0) + n);

  for (const p of PILLARS) {
    for (const kw of p.keywords) {
      if (kw === '$') {
        if (text.includes('$')) add(p.id, 1.5);
      } else if (/[\s-]/.test(kw)) {
        if (text.includes(kw)) add(p.id, 3); // phrases are strong signals
      } else if (tokens.some((t) => t === kw || (kw.length >= 5 && t.startsWith(kw)))) {
        add(p.id, 1);
      }
    }
  }
  for (const tag of input.tags) {
    const id = TAG_PILLAR.get(tag);
    if (id) add(id, 2.5);
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [top, topScore] = ranked[0];
  const second = ranked[1][1];
  if (topScore <= 0) {
    // Nothing to go on: photos are most often Space & Vibe or food; give a gentle low-confidence default.
    return { pillar: input.type === 'photo' ? 'space' : 'food', confidence: 0, source: 'heuristic' };
  }
  return { pillar: top, confidence: topScore / (topScore + second + 1), source: 'heuristic' };
}

export const heuristicSuggester: PillarSuggester = {
  name: 'heuristic',
  suggest: async (input) => heuristicSuggest(input),
};

/**
 * ===== OPTIONAL LLM HOOK (off by default, explicit opt-in required) =====
 * Sends { text, tags, pillars } to a user-supplied HTTPS endpoint and expects { pillar: PillarId }.
 * This SENDS DATA OFF THE DEVICE. Never constructed unless the user turned it on in Settings.
 */
export function llmSuggester(endpoint: string, fetchImpl: typeof fetch = fetch): PillarSuggester {
  return {
    name: 'llm',
    async suggest(input) {
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input.text ?? '', tags: input.tags, pillars: PILLARS.map((p) => p.id) }),
      });
      if (!res.ok) throw new Error(`LLM endpoint returned ${res.status}`);
      const data = (await res.json()) as { pillar?: string };
      const found = PILLARS.find((p) => p.id === data.pillar);
      if (!found) throw new Error('LLM returned an unknown pillar');
      return { pillar: found.id, confidence: 0.8, source: 'llm' };
    },
  };
}

export interface SuggestOptions {
  llm?: { enabled: boolean; endpoint: string };
  suggester?: PillarSuggester; // inject any suggester (tests, future methods)
}

/** The single entry point the app calls. Never throws: falls back to the heuristic. */
export async function suggestPillar(input: SuggestInput, opts: SuggestOptions = {}): Promise<PillarSuggestion> {
  const chosen: PillarSuggester =
    opts.suggester ??
    (opts.llm?.enabled && opts.llm.endpoint && input.text?.trim() ? llmSuggester(opts.llm.endpoint) : heuristicSuggester);
  try {
    return await chosen.suggest(input);
  } catch {
    return heuristicSuggest(input);
  }
}
