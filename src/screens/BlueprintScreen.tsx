import { useRef, useState } from 'react';
import { repo } from '../data/repo';
import { useCaptures } from '../data/hooks';
import { CaptureCard, ORIGIN_LABEL } from '../components/CaptureCard';
import { BlobImg, Chip } from '../components/ui';
import { byStrength, pillarViews, unsortedCaptures } from '../lib/blueprint';
import { confirmPillar } from '../lib/capture';
import { PILLARS, PILLAR_BY_ID } from '../lib/pillars';
import { restorePatch } from '../lib/scheduler';
import { clearSampleData } from '../lib/seed';
import type { Capture, Origin, PillarId } from '../types';

type View = { k: 'home' } | { k: 'pillar'; id: PillarId } | { k: 'archive' };

export default function BlueprintScreen() {
  const captures = useCaptures();
  const [view, setView] = useState<View>({ k: 'home' });
  if (!captures) return null;

  const views = pillarViews(captures);
  const unsorted = unsortedCaptures(captures);
  const archived = captures.filter((c) => c.status === 'archived');
  const shaping = PILLARS.filter((p) => views[p.id].strong.length > 0).length;
  const hasSample = captures.some((c) => c.sample);

  if (view.k === 'pillar') return <PillarDetail id={view.id} captures={captures} onBack={() => setView({ k: 'home' })} />;
  if (view.k === 'archive') return <Archive items={archived} onBack={() => setView({ k: 'home' })} />;

  return (
    <section className="space-y-4 py-2">
      <div>
        <h2 className="font-display text-2xl">Your concept</h2>
        <p className="text-muted">{shaping} of 7 pillars taking shape</p>
      </div>

      {unsorted.length > 0 && <SortInbox items={unsorted} />}

      <ul className="space-y-3">
        {PILLARS.map((p) => {
          const v = views[p.id];
          return (
            <li key={p.id}>
              <button
                onClick={() => setView({ k: 'pillar', id: p.id })}
                className="block min-h-20 w-full rounded-2xl border border-line bg-surface p-4 text-left"
              >
                <span className="flex items-center justify-between">
                  <span className="font-display text-xl">{p.emoji} {p.name}</span>
                  <Pips strong={v.strong.length} />
                </span>
                <span className="mt-1 block text-muted">
                  {v.ideas.length === 0
                    ? p.prompt
                    : `${v.strong.length} strong · ${v.ideas.length} idea${v.ideas.length === 1 ? '' : 's'}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-3">
        {archived.length > 0 && (
          <button onClick={() => setView({ k: 'archive' })} className="min-h-12 rounded-xl border border-line px-4">
            Archived ({archived.length})
          </button>
        )}
        {hasSample && (
          <button onClick={() => void clearSampleData()} className="min-h-12 rounded-xl border border-line px-4">
            Clear sample data
          </button>
        )}
      </div>
    </section>
  );
}

/** Fill indicator: one pip per strong idea, up to 5. */
function Pips({ strong }: { strong: number }) {
  return (
    <span className="flex gap-1" role="img" aria-label={`${Math.min(strong, 5)} of 5 strong ideas`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`size-3.5 rounded-full border ${i < strong ? 'border-accent bg-accent' : 'border-line'}`} />
      ))}
    </span>
  );
}

/** One suggestion at a time. Swipe right (or tap) to confirm, swipe left to leave for later. */
function SortInbox({ items }: { items: Capture[] }) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const [changing, setChanging] = useState(false);
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);

  const queue = items.filter((c) => !skipped.includes(c.id));
  const c = queue[0];
  if (!c) {
    return <p className="rounded-2xl bg-surface2 p-4 text-muted">Sorting paused. {items.length} left for later.</p>;
  }
  const sug = PILLAR_BY_ID[c.suggestedPillar ?? 'food'];
  const confirm = (id: PillarId) => { setChanging(false); void confirmPillar(c.id, id); };

  return (
    <div className="space-y-3 rounded-2xl bg-surface2 p-3">
      <p className="font-semibold">Sort · {queue.length} to go</p>
      <div
        style={{ transform: `translateX(${dx}px) rotate(${dx / 30}deg)`, touchAction: 'pan-y' }}
        onPointerDown={(e) => { startX.current = e.clientX; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (startX.current !== null) setDx(e.clientX - startX.current); }}
        onPointerUp={() => {
          if (dx > 90) confirm(sug.id);
          else if (dx < -90) setSkipped((s) => [...s, c.id]);
          startX.current = null; setDx(0);
        }}
        onPointerCancel={() => { startX.current = null; setDx(0); }}
      >
        <CaptureCard c={c} />
      </div>
      <button onClick={() => confirm(sug.id)} className="min-h-14 w-full rounded-xl bg-accent text-lg font-bold text-accentink">
        {sug.emoji} {sug.name} ✓
      </button>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setChanging((v) => !v)} className="min-h-12 rounded-xl border border-line">Other pillar</button>
        <button onClick={() => setSkipped((s) => [...s, c.id])} className="min-h-12 rounded-xl border border-line">Later</button>
      </div>
      {changing && (
        <div className="flex flex-wrap gap-2">
          {PILLARS.map((p) => <Chip key={p.id} onClick={() => confirm(p.id)}>{p.emoji} {p.name}</Chip>)}
        </div>
      )}
      <p className="text-center text-sm text-muted">Swipe right to confirm · left for later</p>
    </div>
  );
}

function PillarDetail({ id, captures, onBack }: { id: PillarId; captures: Capture[]; onBack: () => void }) {
  const p = PILLAR_BY_ID[id];
  const { ideas, strong } = pillarViews(captures)[id];
  const photos = ideas.filter((c) => c.type === 'photo');
  const rest = ideas.filter((c) => c.type !== 'photo');
  const [open, setOpen] = useState<string | null>(null);
  const [zoom, setZoom] = useState<Capture | null>(null);

  return (
    <section className="space-y-4 py-2">
      <button onClick={onBack} className="min-h-12 rounded-full px-2 font-semibold text-accent">← Blueprint</button>
      <div>
        <h2 className="font-display text-2xl">{p.emoji} {p.name}</h2>
        <p className="text-muted">{strong.length} strong · {ideas.length} idea{ideas.length === 1 ? '' : 's'}</p>
      </div>

      {ideas.length === 0 && <p className="rounded-2xl bg-surface2 p-4 font-display text-xl">{p.prompt}</p>}

      {photos.length > 0 && (
        <div>
          <h3 className="mb-2 font-semibold">Moodboard</h3>
          <ul className="columns-2 gap-2 [&>li]:mb-2">
            {photos.map((c) => (
              <li key={c.id} className="break-inside-avoid">
                <button onClick={() => setZoom(c)} className="relative block w-full overflow-hidden rounded-xl">
                  <BlobImg blob={c.thumb ?? c.blob} alt={c.text ?? 'Photo'} className="w-full" />
                  {c.text && <span className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-left text-xs text-white">{c.text}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="space-y-3">
        {rest.map((c) => (
          <li key={c.id}>
            <CaptureCard c={c} onClick={() => setOpen(open === c.id ? null : c.id)} />
            {open === c.id && <Editor c={c} onDone={() => setOpen(null)} />}
          </li>
        ))}
      </ul>

      {zoom && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-black/85 p-4" onClick={() => setZoom(null)} role="dialog" aria-label="Photo">
          <div className="max-h-full w-full max-w-xl space-y-3" onClick={(e) => e.stopPropagation()}>
            <BlobImg blob={zoom.blob} alt={zoom.text ?? 'Photo'} className="max-h-[60vh] w-full rounded-xl object-contain" />
            <Editor c={zoom} onDone={() => setZoom(null)} />
          </div>
        </div>
      )}
    </section>
  );
}

/** Move / re-tag / archive one idea. */
function Editor({ c, onDone }: { c: Capture; onDone: () => void }) {
  return (
    <div className="mt-2 space-y-3 rounded-2xl border border-line bg-surface2 p-3">
      <p className="text-sm font-semibold text-muted">Move to</p>
      <div className="flex flex-wrap gap-2">
        {PILLARS.map((p) => (
          <Chip key={p.id} selected={c.pillar === p.id} onClick={() => { void confirmPillar(c.id, p.id); onDone(); }}>{p.emoji} {p.name}</Chip>
        ))}
      </div>
      <p className="text-sm font-semibold text-muted">From</p>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(ORIGIN_LABEL) as Origin[]).map((o) => (
          <Chip key={o} selected={c.origin === o} onClick={() => void repo.updateCapture(c.id, { origin: o })}>{ORIGIN_LABEL[o]}</Chip>
        ))}
      </div>
      <button
        onClick={() => { void repo.updateCapture(c.id, { status: 'archived', nextResurfaceAt: null }); onDone(); }}
        className="min-h-12 w-full rounded-xl border border-line font-semibold"
      >
        Archive (you can bring it back)
      </button>
    </div>
  );
}

function Archive({ items, onBack }: { items: Capture[]; onBack: () => void }) {
  return (
    <section className="space-y-4 py-2">
      <button onClick={onBack} className="min-h-12 rounded-full px-2 font-semibold text-accent">← Blueprint</button>
      <h2 className="font-display text-2xl">Archived</h2>
      <p className="text-muted">Set aside, never deleted. Bring back anything that is still you.</p>
      <ul className="space-y-3">
        {[...items].sort(byStrength).map((c) => (
          <li key={c.id} className="space-y-2">
            <CaptureCard c={c} showPillar />
            <button onClick={() => void repo.updateCapture(c.id, restorePatch(Date.now()))} className="min-h-12 w-full rounded-xl border border-line font-semibold">
              Restore
            </button>
          </li>
        ))}
      </ul>
      {items.length === 0 && <p className="text-muted">Nothing archived.</p>}
    </section>
  );
}
