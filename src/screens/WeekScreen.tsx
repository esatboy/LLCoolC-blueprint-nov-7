import { useMemo, useState } from 'react';
import { repo } from '../data/repo';
import { useCaptures, useDueCaptures, useMeta } from '../data/hooks';
import { CaptureCard } from '../components/CaptureCard';
import { PILLAR_BY_ID } from '../lib/pillars';
import { applyAnswer } from '../lib/scheduler';
import { buildWeekly, weekKey, type Decision } from '../lib/weekly';
import type { Tab } from '../types';

/** The day-off view: about 10 minutes, every part skippable. */
export default function WeekScreen({ onGo }: { onGo: (t: Tab) => void }) {
  const captures = useCaptures();
  const due = useDueCaptures();
  const skippedWeek = useMeta<string>('weeklySkippedWeek', '');
  const [picked, setPicked] = useState<string[]>([]);
  const now = useMemo(() => Date.now(), []);
  const key = weekKey(now);
  const view = useMemo(() => buildWeekly(captures ?? [], now), [captures, now]);
  if (!captures) return null;

  if (skippedWeek === key) {
    return (
      <section className="space-y-4 py-6 text-center">
        <h2 className="font-display text-2xl">Skipped this week</h2>
        <p className="text-muted">No guilt. Your ideas keep.</p>
        <button onClick={() => void repo.setMeta('weeklySkippedWeek', '')} className="min-h-12 rounded-xl border border-line px-5 font-semibold">Show it anyway</button>
      </section>
    );
  }

  const decisions = view.decisions.filter((d) => !picked.includes(d.topic));
  const { summary } = view;

  async function pick(d: Decision, id: string) {
    const cap = captures!.find((c) => c.id === id)!;
    await repo.updateCapture(id, applyAnswer(cap, 'fire', Date.now(), 'weekly'));
    await repo.logEvent('weekly_pick', { topic: d.topic });
    setPicked((p) => [...p, d.topic]);
  }

  return (
    <section className="space-y-5 py-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Day-off check-in</h2>
          <p className="text-muted">About 10 minutes. Do as much or as little as you like.</p>
        </div>
        <button onClick={() => void repo.setMeta('weeklySkippedWeek', key)} className="min-h-12 shrink-0 rounded-xl border border-line px-4">Skip week</button>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <Stat n={summary.captures} label="captured" />
        <Stat n={summary.fires} label="earned 🔥" />
        <Stat n={summary.pillarsMoved.length} label="pillars moved" />
      </div>
      {summary.pillarsMoved.length > 0 && (
        <p className="text-muted">Moved: {summary.pillarsMoved.map((p) => `${PILLAR_BY_ID[p].emoji} ${PILLAR_BY_ID[p].name}`).join(', ')}</p>
      )}

      {decisions.map((d) => (
        <div key={d.topic} className="space-y-3 rounded-3xl bg-surface2 p-3">
          <p className="font-display text-xl">
            You've saved {d.captures.length} things about {d.topic}. Pick your favorite.
          </p>
          <ul className="space-y-3">
            {d.captures.map((c) => (
              <li key={c.id} className="space-y-2">
                <CaptureCard c={c} />
                <button onClick={() => void pick(d, c.id)} className="min-h-12 w-full rounded-xl bg-accent font-bold text-accentink">🔥 This one</button>
              </li>
            ))}
          </ul>
          <button onClick={() => setPicked((p) => [...p, d.topic])} className="min-h-12 w-full rounded-xl border border-line">Not now</button>
        </div>
      ))}
      {view.decisions.length > 0 && decisions.length === 0 && <p className="rounded-2xl bg-surface2 p-4">Decisions made. Nice work.</p>}

      {view.clusters.length > 0 ? (
        <div>
          <h3 className="mb-2 font-semibold">What you gathered this week</h3>
          <ul className="space-y-2">
            {view.clusters.map((c) => (
              <li key={c.pillar} className="rounded-xl border border-line bg-surface p-3">
                <span className="font-semibold">{PILLAR_BY_ID[c.pillar].emoji} {PILLAR_BY_ID[c.pillar].name}</span>
                <span className="text-muted"> · {c.count} idea{c.count === 1 ? '' : 's'}{c.topics.length ? ` · ${c.topics.join(', ')}` : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-2xl bg-surface2 p-4 font-display text-xl">Quiet week. Capture one thing you noticed on shift.</p>
      )}

      <div className="grid gap-3">
        {due.length > 0 && <button onClick={() => onGo('still')} className="min-h-14 rounded-xl border border-line font-semibold">🔥 {due.length} ready for "Still you?"</button>}
        <button onClick={() => onGo('pager')} className="min-h-14 rounded-xl border border-line font-semibold">▤ See your one-pager</button>
      </div>
    </section>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <p className="font-display text-3xl">{n}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
