import type { AppEvent, Capture } from '../types';
import { fireCount } from './strength';
import { weekKey } from './weekly';

/** Local-only usage metrics. Computed from the on-device event log; nothing is ever sent anywhere. */
export interface Metrics {
  capturesPerWeek: { week: string; count: number }[];
  resonance: { promptsShown: number; answered: number; responseRate: number | null };
  installToFirstExportMs: number | null;
  ideasWithRepeatedFire: number;
}

export function computeMetrics(events: AppEvent[], captures: Capture[]): Metrics {
  const perWeek = new Map<string, number>();
  for (const e of events) if (e.type === 'capture_created') perWeek.set(weekKey(e.at), (perWeek.get(weekKey(e.at)) ?? 0) + 1);

  const shown = new Set(events.filter((e) => e.type === 'prompt_shown').map((e) => String(e.data?.id)));
  const answered = events.filter((e) => e.type === 'resonance_answered').length;

  const install = events.find((e) => e.type === 'install')?.at;
  const firstExport = events.find((e) => e.type === 'onepager_exported')?.at;

  return {
    capturesPerWeek: [...perWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, count]) => ({ week, count })),
    resonance: { promptsShown: shown.size, answered, responseRate: shown.size ? Math.min(1, answered / shown.size) : null },
    installToFirstExportMs: install !== undefined && firstExport !== undefined ? firstExport - install : null,
    ideasWithRepeatedFire: captures.filter((c) => !c.sample && fireCount(c.resonanceHistory) > 1).length,
  };
}

/** The export contains event types, ids and counts only: never the text, photos or audio of any idea. */
export function usageExport(events: AppEvent[], captures: Capture[], now = Date.now()) {
  return { exportedAt: new Date(now).toISOString(), metrics: computeMetrics(events, captures), events };
}
