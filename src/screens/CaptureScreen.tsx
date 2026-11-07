import { useEffect, useMemo, useRef, useState } from 'react';
import { repo } from '../data/repo';
import { useCaptures, useDueCaptures } from '../data/hooks';
import { confirmPillar, refreshSuggestion, saveCapture } from '../lib/capture';
import { fileToVariants } from '../lib/image';
import { PILLARS, PILLAR_BY_ID } from '../lib/pillars';
import { isStrong } from '../lib/strength';
import { QUICK_TAGS } from '../lib/suggestPillar';
import { loadSampleData } from '../lib/seed';
import type { Origin } from '../types';
import { Chip, fmtDuration } from '../components/ui';

const ORIGINS: { id: Origin; label: string }[] = [
  { id: 'vision', label: 'My vision' },
  { id: 'lesson', label: 'Lesson from work' },
  { id: 'inspiration', label: 'Inspiration' },
];

const DRAFT_KEY = 'draft-text';
const readDraft = () => { try { return localStorage.getItem(DRAFT_KEY) ?? ''; } catch { return ''; } };
const writeDraft = (v: string) => { try { v ? localStorage.setItem(DRAFT_KEY, v) : localStorage.removeItem(DRAFT_KEY); } catch { /* private mode */ } };

function pickMime(): string {
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'])
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
  return '';
}

export default function CaptureScreen({ onGo }: { onGo: (t: 'blueprint' | 'still') => void }) {
  const captures = useCaptures();
  const due = useDueCaptures().length;
  const [mode, setMode] = useState<'idle' | 'write' | 'record'>('idle');
  const [draft, setDraft] = useState(readDraft);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // "No blank page": nudge toward the pillar with the fewest strong ideas.
  const nudge = useMemo(() => {
    const strong = new Map(PILLARS.map((p) => [p.id, 0]));
    for (const c of captures ?? []) if (c.status === 'active' && c.pillar && isStrong(c.strength)) strong.set(c.pillar, (strong.get(c.pillar) ?? 0) + 1);
    return [...PILLARS].sort((a, b) => strong.get(a.id)! - strong.get(b.id)!)[0];
  }, [captures]);

  const unsorted = (captures ?? []).filter((c) => c.status === 'active' && !c.pillar).length;

  async function saveText() {
    const text = draft.trim();
    if (!text) return;
    const c = await saveCapture({ type: 'text', text });
    writeDraft('');
    setDraft('');
    setMode('idle');
    setSavedId(c.id);
  }

  async function onPhotos(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError('');
    try {
      let last = '';
      for (const f of Array.from(files)) {
        const { blob, thumb } = await fileToVariants(f);
        last = (await saveCapture({ type: 'photo', blob, thumb, mime: 'image/jpeg' })).id;
      }
      setSavedId(last);
    } catch {
      setError("Couldn't read that photo. Try again?");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <section className="space-y-4 py-2">
      {captures && captures.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-surface p-4">
          <p className="mb-3">Capture your first idea below. Or see how it looks filled in:</p>
          <button onClick={() => void loadSampleData()} className="min-h-12 w-full rounded-xl border border-line px-4 font-semibold">
            Load sample data
          </button>
        </div>
      )}

      {mode === 'idle' && (
        <button onClick={() => setMode('write')} className="block w-full rounded-2xl bg-surface2 p-4 text-left">
          <span className="block text-sm font-semibold uppercase tracking-wide text-muted">
            {nudge.emoji} {nudge.name}
          </span>
          <span className="font-display text-xl">{nudge.prompt}</span>
        </button>
      )}

      {mode === 'write' && (
        <div className="space-y-3 rounded-2xl border border-line bg-surface p-3">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => { setDraft(e.target.value); writeDraft(e.target.value); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void saveText(); }}
            placeholder={nudge.prompt}
            rows={5}
            className="w-full resize-none rounded-xl border border-line bg-bg p-3 text-lg"
          />
          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <button onClick={() => setMode('idle')} className="min-h-14 rounded-xl border border-line font-semibold">Close</button>
            <button disabled={!draft.trim()} onClick={() => void saveText()} className="min-h-14 rounded-xl bg-accent text-lg font-bold text-accentink disabled:opacity-40">
              Save idea
            </button>
          </div>
        </div>
      )}

      {mode === 'record' && <Recorder onDone={(id) => { setMode('idle'); if (id) setSavedId(id); }} onError={setError} />}

      {mode !== 'record' && (
        <div className="grid grid-cols-3 gap-3">
          <BigBtn icon="✍️" label="Write" onClick={() => setMode('write')} />
          <BigBtn icon="📷" label={busy ? 'Saving…' : 'Photo'} onClick={() => fileRef.current?.click()} />
          <BigBtn icon="🎙️" label="Voice" onClick={() => { setError(''); setMode('record'); }} />
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void onPhotos(e.target.files)} />
        </div>
      )}

      {error && <p role="alert" className="rounded-xl bg-surface2 p-3 text-fire">{error}</p>}

      {unsorted > 0 && (
        <button onClick={() => onGo('blueprint')} className="flex min-h-14 w-full items-center justify-between rounded-xl border border-line bg-surface px-4 text-left">
          <span>{unsorted} idea{unsorted === 1 ? '' : 's'} waiting to be sorted</span>
          <span aria-hidden>→</span>
        </button>
      )}

      {due > 0 && (
        <button onClick={() => onGo('still')} className="flex min-h-14 w-full items-center justify-between rounded-xl border border-line bg-surface px-4 text-left">
          <span>🔥 {due} idea{due === 1 ? '' : 's'} ready: Still you?</span>
          <span aria-hidden>→</span>
        </button>
      )}

      {savedId && <SavedSheet key={savedId} id={savedId} onClose={() => setSavedId(null)} />}
    </section>
  );
}

function BigBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex min-h-28 flex-col items-center justify-center gap-1 rounded-2xl bg-accent text-accentink shadow-sm active:scale-95">
      <span aria-hidden className="text-4xl">{icon}</span>
      <span className="text-lg font-bold">{label}</span>
    </button>
  );
}

/** Tap once to record, tap Stop to save. Audio stays on-device as a Blob. */
function Recorder({ onDone, onError }: { onDone: (id?: string) => void; onError: (m: string) => void }) {
  const [ms, setMs] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const cancelled = useRef(false);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let tick = 0;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mime = pickMime();
        const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        recRef.current = rec;
        rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
        rec.onstop = async () => {
          stream?.getTracks().forEach((t) => t.stop());
          if (cancelled.current || !chunks.current.length) return onDone();
          const type = rec.mimeType || mime || 'audio/webm';
          const durationMs = Date.now() - startedAt.current;
          const saved = await saveCapture({ type: 'voice', blob: new Blob(chunks.current, { type }), mime: type, durationMs });
          onDone(saved.id);
        };
        startedAt.current = Date.now();
        rec.start(1000);
        tick = window.setInterval(() => {
          const e = Date.now() - startedAt.current;
          setMs(e);
          if (e > 5 * 60_000) rec.stop(); // safety stop at 5 min
        }, 250);
      } catch {
        onError('Microphone is blocked or unavailable. Allow it in your browser settings to record voice notes.');
        onDone();
      }
    })();
    return () => {
      window.clearInterval(tick);
      cancelled.current = true;
      if (recRef.current?.state === 'recording') recRef.current.stop();
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface p-4 text-center" role="status">
      <p className="font-display text-4xl tabular-nums">{fmtDuration(ms)}</p>
      <p className="text-muted"><span aria-hidden className="text-fire">●</span> Recording. Talk it out.</p>
      <button
        onClick={() => { cancelled.current = false; recRef.current?.stop(); }}
        className="min-h-20 w-full rounded-2xl bg-fire text-xl font-bold text-white"
      >
        ■ Stop and save
      </button>
      <button
        onClick={() => { cancelled.current = true; recRef.current?.stop(); }}
        className="min-h-12 w-full rounded-xl border border-line font-semibold"
      >
        Discard
      </button>
    </div>
  );
}

/** Appears after every save. Everything on it is optional; it fades away on its own. */
function SavedSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const captures = useCaptures();
  const cap = captures?.find((c) => c.id === id);
  const [touched, setTouched] = useState(0);
  const [changing, setChanging] = useState(false);
  const [caption, setCaption] = useState('');

  useEffect(() => {
    const t = window.setTimeout(onClose, 12_000);
    return () => window.clearTimeout(t);
  }, [touched, onClose]);

  if (!cap) return null;
  const bump = () => setTouched((n) => n + 1);
  const sug = cap.suggestedPillar ? PILLAR_BY_ID[cap.suggestedPillar] : null;
  const sorted = cap.pillar ? PILLAR_BY_ID[cap.pillar] : null;

  const setTags = async (tag: string) => {
    bump();
    const tags = cap.tags.includes(tag) ? cap.tags.filter((t) => t !== tag) : [...cap.tags, tag];
    await repo.updateCapture(id, { tags });
    await refreshSuggestion(id);
  };

  return (
    <div
      className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 mx-auto max-w-xl space-y-3 rounded-t-3xl border border-line bg-surface p-4 shadow-2xl"
      onPointerDown={bump}
      role="dialog"
      aria-label="Saved. Optional details."
    >
      <div className="flex items-center justify-between">
        <p className="font-display text-xl">Saved ✓</p>
        <button
          onClick={() => {
            if (caption.trim()) void repo.updateCapture(id, { text: caption.trim() }).then(() => refreshSuggestion(id));
            onClose();
          }}
          className="min-h-12 rounded-full px-5 font-semibold text-accent"
        >
          Done
        </button>
      </div>

      {sorted ? (
        <p className="text-ok">Sorted into {sorted.emoji} {sorted.name}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {sug && (
            <button
              onClick={async () => { bump(); await confirmPillar(id, sug.id); }}
              className="min-h-12 rounded-full bg-accent px-4 font-semibold text-accentink"
            >
              {sug.emoji} {sug.name} ✓
            </button>
          )}
          <button onClick={() => { bump(); setChanging((v) => !v); }} className="min-h-12 rounded-full border border-line px-4">
            {changing ? 'Hide' : 'Other pillar'}
          </button>
        </div>
      )}
      {changing && !sorted && (
        <div className="flex flex-wrap gap-2">
          {PILLARS.map((p) => (
            <Chip key={p.id} onClick={async () => { await confirmPillar(id, p.id); setChanging(false); }}>{p.emoji} {p.name}</Chip>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Where did this come from?">
        {ORIGINS.map((o) => (
          <Chip key={o.id} selected={cap.origin === o.id} onClick={() => { bump(); void repo.updateCapture(id, { origin: o.id }); }}>{o.label}</Chip>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Quick tags">
        {QUICK_TAGS.map((t) => (
          <Chip key={t.tag} selected={cap.tags.includes(t.tag)} onClick={() => void setTags(t.tag)}>#{t.tag}</Chip>
        ))}
      </div>

      {cap.type !== 'text' && (
        <input
          value={caption}
          onChange={(e) => { setCaption(e.target.value); bump(); }}
          placeholder="Add a few words (optional)"
          className="min-h-12 w-full rounded-xl border border-line bg-bg px-3"
        />
      )}
    </div>
  );
}
