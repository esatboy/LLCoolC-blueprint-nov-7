import { useRef, useState } from 'react';
import { repo } from '../data/repo';
import { useCaptures, useDueCaptures } from '../data/hooks';
import { CaptureCard } from '../components/CaptureCard';
import { applyAnswer, snoozeUntil } from '../lib/scheduler';
import { fireCount } from '../lib/strength';
import type { Answer, Capture } from '../types';

const ANSWERS: { a: Answer; icon: string; label: string; cls: string }[] = [
  { a: 'fire', icon: '🔥', label: 'Yes', cls: 'bg-accent text-accentink' },
  { a: 'meh', icon: '🤷', label: 'Not sure', cls: 'bg-surface2' },
  { a: 'no', icon: '✗', label: 'Not me', cls: 'bg-surface2' },
];

interface Undo { id: string; prev: Pick<Capture, 'resonanceHistory' | 'strength' | 'status' | 'nextResurfaceAt'>; }

export default function StillYouScreen() {
  const all = useCaptures();
  const due = useDueCaptures();
  const [skipped, setSkipped] = useState<string[]>([]);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [done, setDone] = useState(0);
  const shown = useRef(new Set<string>());

  const queue = due.filter((c) => !skipped.includes(c.id));
  const c = queue[0];
  if (c && !shown.current.has(c.id)) {
    shown.current.add(c.id);
    void repo.logEvent('prompt_shown', { id: c.id });
  }

  async function answer(cap: Capture, a: Answer) {
    const prev = { resonanceHistory: cap.resonanceHistory, strength: cap.strength, status: cap.status, nextResurfaceAt: cap.nextResurfaceAt };
    const patch = applyAnswer(cap, a, Date.now());
    await repo.updateCapture(cap.id, patch);
    await repo.logEvent('resonance_answered', { id: cap.id, answer: a, fires: fireCount(patch.resonanceHistory) });
    setUndo({ id: cap.id, prev });
    setDone((n) => n + 1);
  }

  async function dismissAll() {
    await repo.setMeta('stackSnoozedUntil', snoozeUntil(Date.now()));
    await repo.logEvent('stack_dismissed', { remaining: queue.length });
  }

  return (
    <section className="space-y-4 py-2">
      <div>
        <h2 className="font-display text-2xl">Still you?</h2>
        <p className="text-muted">One tap each. Skip any time.</p>
      </div>

      {c ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">{done + 1} of {done + queue.length}</p>
          <div className="rounded-3xl bg-surface2 p-3">
            <CaptureCard c={c} showPillar />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {ANSWERS.map((x) => (
              <button
                key={x.a}
                onClick={() => void answer(c, x.a)}
                aria-label={`${x.label} ${x.icon}`}
                className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border border-line text-lg font-semibold active:scale-95 ${x.cls}`}
              >
                <span aria-hidden className="text-4xl">{x.icon}</span>
                {x.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setSkipped((s) => [...s, c.id])} className="min-h-12 rounded-xl border border-line">Skip this one</button>
            <button onClick={() => void dismissAll()} className="min-h-12 rounded-xl border border-line">Dismiss all</button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-surface2 p-5 text-center">
          <p className="font-display text-xl">{(all?.length ?? 0) === 0 ? 'Nothing to revisit yet.' : "You're all caught up."}</p>
          <p className="mt-1 text-muted">Ideas come back after 2 days, then a week, then 3 weeks.</p>
        </div>
      )}

      {undo && (
        <div className="flex items-center justify-between rounded-xl border border-line bg-surface p-3">
          <span>Saved.</span>
          <button
            className="min-h-12 rounded-full px-4 font-semibold text-accent"
            onClick={async () => { await repo.updateCapture(undo.id, undo.prev); setUndo(null); setDone((n) => Math.max(0, n - 1)); }}
          >
            Undo
          </button>
        </div>
      )}
    </section>
  );
}
