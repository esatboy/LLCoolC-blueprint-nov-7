import { useEffect, useMemo, useRef, useState } from 'react';
import { repo } from '../data/repo';
import { useCaptures } from '../data/hooks';
import { BlobImg, Chip } from '../components/ui';
import { byStrength } from '../lib/blueprint';
import {
  DEFAULT_CONCEPT, MAX_HEROES, selectOnePager, slug, suggestNames, suggestOneLiners, type ConceptMeta,
} from '../lib/onepager';
import { canvasToPdf, canvasToPng, downloadBlob, renderOnePager, shareOrDownload } from '../lib/onepagerRender';
import type { Tab } from '../types';

export default function OnePagerScreen({ onGo }: { onGo: (t: Tab) => void }) {
  const captures = useCaptures();
  const [concept, setConcept] = useState<ConceptMeta | null>(null);
  const [busy, setBusy] = useState<'pdf' | 'png' | null>(null);
  const [note, setNote] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const token = useRef(0);

  useEffect(() => {
    void repo.getMeta<ConceptMeta>('concept', DEFAULT_CONCEPT).then((c) => setConcept({ ...DEFAULT_CONCEPT, ...c }));
  }, []);

  const content = useMemo(() => selectOnePager(captures ?? [], concept?.heroIds ?? null), [captures, concept?.heroIds]);
  const names = useMemo(() => suggestNames(captures ?? []), [captures]);
  const pitches = useMemo(() => suggestOneLiners(content.sections), [content.sections]);
  const photos = useMemo(
    () => (captures ?? []).filter((c) => c.status === 'active' && c.type === 'photo' && c.blob).sort(byStrength),
    [captures],
  );

  const name = concept?.name || names[0] || '';
  const oneLiner = concept?.oneLiner || pitches[0] || '';

  const update = (patch: Partial<ConceptMeta>) => {
    const next = { ...(concept ?? DEFAULT_CONCEPT), ...patch };
    setConcept(next);
    void repo.setMeta('concept', next);
  };

  async function render(target: HTMLCanvasElement) {
    await renderOnePager(target, { name, oneLiner, content });
  }

  // Live preview (debounced; stale renders are dropped).
  useEffect(() => {
    if (!concept || !captures) return;
    const t = ++token.current;
    const h = window.setTimeout(async () => {
      const off = document.createElement('canvas');
      await render(off);
      const vis = canvasRef.current;
      if (t !== token.current || !vis) return;
      vis.width = off.width; vis.height = off.height;
      vis.getContext('2d')!.drawImage(off, 0, 0);
    }, 200);
    return () => window.clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concept, captures, name, oneLiner, content]);

  async function exportAs(kind: 'pdf' | 'png') {
    setBusy(kind); setNote('');
    try {
      const off = document.createElement('canvas');
      await render(off);
      if (kind === 'pdf') {
        downloadBlob(await canvasToPdf(off), `${slug(name)}.pdf`);
        setNote('PDF saved to your downloads.');
      } else {
        const r = await shareOrDownload(await canvasToPng(off), name || 'concept');
        setNote(r === 'shared' ? 'Shared.' : 'Image saved to your downloads.');
      }
      await repo.logEvent('onepager_exported', { format: kind });
    } catch {
      setNote("Couldn't export. Try again?");
    } finally {
      setBusy(null);
    }
  }

  if (!concept || !captures) return null;
  const heroIds = new Set(content.heroes.map((h) => h.id));
  const toggleHero = (id: string) => {
    const cur = content.heroes.map((h) => h.id);
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(-MAX_HEROES);
    update({ heroIds: next });
  };

  return (
    <section className="space-y-4 py-2">
      <div>
        <h2 className="font-display text-2xl">Concept one-pager</h2>
        <p className="text-muted">Built from your strongest ideas. Edit the name and pitch, then export.</p>
      </div>

      {content.missing.length > 0 && (
        <div className="rounded-2xl bg-surface2 p-4">
          <p className="mb-2 font-semibold">Here's what's missing</p>
          <ul className="space-y-1 text-muted">
            {content.missing.map((p) => <li key={p.id}><span className="font-semibold text-ink">{p.name}:</span> {p.prompt}</li>)}
          </ul>
          <button onClick={() => onGo('capture')} className="mt-3 min-h-12 w-full rounded-xl border border-line font-semibold">Capture something</button>
        </div>
      )}

      <label className="block">
        <span className="font-semibold">Concept name</span>
        <input
          value={concept.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder={name || 'Untitled concept'}
          className="mt-1 min-h-12 w-full rounded-xl border border-line bg-surface px-3 font-display text-xl"
        />
      </label>
      {names.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {names.map((n) => <Chip key={n} selected={concept.name === n} onClick={() => update({ name: n })}>{n}</Chip>)}
        </div>
      )}

      <label className="block">
        <span className="font-semibold">One-line pitch</span>
        <textarea
          value={concept.oneLiner}
          onChange={(e) => update({ oneLiner: e.target.value })}
          placeholder={oneLiner}
          rows={2}
          className="mt-1 w-full resize-none rounded-xl border border-line bg-surface p-3"
        />
      </label>
      <div className="flex flex-col gap-2">
        {pitches.map((p) => (
          <button key={p} onClick={() => update({ oneLiner: p })} className="min-h-12 rounded-xl border border-line bg-surface px-3 py-2 text-left text-sm">{p}</button>
        ))}
      </div>

      {photos.length > 0 && (
        <div>
          <p className="mb-1 font-semibold">Hero photos <span className="font-normal text-muted">({content.heroes.length} of up to {MAX_HEROES})</span></p>
          <ul className="grid grid-cols-4 gap-2">
            {photos.map((c) => (
              <li key={c.id}>
                <button onClick={() => toggleHero(c.id)} aria-pressed={heroIds.has(c.id)} aria-label={c.text ?? 'Photo'} className={`relative block aspect-square w-full overflow-hidden rounded-lg border-4 ${heroIds.has(c.id) ? 'border-accent' : 'border-transparent opacity-60'}`}>
                  <BlobImg blob={c.thumb ?? c.blob} alt="" className="size-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
          {concept.heroIds && <button onClick={() => update({ heroIds: null })} className="mt-2 min-h-12 px-2 font-semibold text-accent">Reset to automatic</button>}
        </div>
      )}
      {content.photoShortfall && <p className="text-muted">Tip: 3 or more photos make the page feel real.</p>}

      <canvas ref={canvasRef} aria-label="One-pager preview" className="w-full rounded-lg border border-line shadow-md" style={{ aspectRatio: '1275 / 1650', background: '#faf5ec' }} />

      <div className="grid grid-cols-2 gap-3">
        <button disabled={!!busy} onClick={() => void exportAs('pdf')} className="min-h-14 rounded-xl bg-accent text-lg font-bold text-accentink disabled:opacity-50">{busy === 'pdf' ? 'Making PDF…' : 'Export PDF'}</button>
        <button disabled={!!busy} onClick={() => void exportAs('png')} className="min-h-14 rounded-xl border border-line text-lg font-bold disabled:opacity-50">{busy === 'png' ? 'Making image…' : 'Share image'}</button>
      </div>
      {note && <p role="status" className="text-center text-muted">{note}</p>}
      <p className="text-center text-sm text-muted">Nothing leaves your device until you export.</p>
    </section>
  );
}
