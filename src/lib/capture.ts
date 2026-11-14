import { repo } from '../data/repo';
import { DEFAULT_SETTINGS, type Capture, type CaptureType, type Origin, type PillarId, type Settings } from '../types';
import { newId } from './id';
import { initialResurfaceAt } from './scheduler';
import { START_STRENGTH } from './strength';
import { suggestPillar } from './suggestPillar';

export interface NewCapture {
  type: CaptureType;
  text?: string;
  blob?: Blob;
  thumb?: Blob;
  mime?: string;
  durationMs?: number;
  tags?: string[];
  origin?: Origin;
}

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await repo.getMeta<Partial<Settings>>('settings', {})) };
}

async function suggestFor(c: Pick<Capture, 'type' | 'text' | 'tags'>): Promise<PillarId> {
  const s = await getSettings();
  return (await suggestPillar(c, { llm: { enabled: s.llmOptIn, endpoint: s.llmEndpoint } })).pillar;
}

/** Saves instantly with defaults (origin = My vision, pillar unsorted but pre-suggested). Zero required taps. */
export async function saveCapture(n: NewCapture): Promise<Capture> {
  const now = Date.now();
  const base = { type: n.type, text: n.text, tags: n.tags ?? [] };
  const capture: Capture = {
    id: newId(),
    ...base,
    blob: n.blob,
    thumb: n.thumb,
    mime: n.mime,
    durationMs: n.durationMs,
    createdAt: now,
    origin: n.origin ?? 'vision',
    pillar: null,
    suggestedPillar: await suggestFor(base),
    strength: START_STRENGTH,
    status: 'active',
    nextResurfaceAt: initialResurfaceAt(now),
    resonanceHistory: [],
  };
  await repo.addCapture(capture);
  await repo.logEvent('capture_created', { type: n.type, origin: capture.origin });
  return capture;
}

/** Re-suggest after caption/tag edits (only while still unsorted). */
export async function refreshSuggestion(id: string): Promise<void> {
  const c = await repo.getCapture(id);
  if (!c || c.pillar) return;
  await repo.updateCapture(id, { suggestedPillar: await suggestFor(c) });
}

export async function confirmPillar(id: string, pillar: PillarId): Promise<void> {
  await repo.updateCapture(id, { pillar });
  await repo.logEvent('pillar_confirmed', { pillar });
}
