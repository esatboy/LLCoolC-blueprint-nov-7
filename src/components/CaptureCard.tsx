import { PILLAR_BY_ID } from '../lib/pillars';
import { fireCount, isStrong } from '../lib/strength';
import type { Capture, Origin } from '../types';
import { BlobImg, fmtDuration, useBlobUrl } from './ui';

export const ORIGIN_LABEL: Record<Origin, string> = { vision: 'My vision', lesson: 'Lesson', inspiration: 'Inspiration' };

export function Flames({ capture }: { capture: Capture }) {
  const n = fireCount(capture.resonanceHistory);
  if (!n && !isStrong(capture.strength)) return null;
  return <span aria-label={`${n} fire`} title={`${n} fire`}>{'🔥'.repeat(Math.min(n, 3))}</span>;
}

function Audio({ blob }: { blob?: Blob }) {
  const url = useBlobUrl(blob);
  return url ? <audio controls src={url} className="h-12 w-full" /> : null;
}

/** One idea, any type. Used in pillar lists, the sort inbox and the archive. */
export function CaptureCard({ c, onClick, showPillar }: { c: Capture; onClick?: () => void; showPillar?: boolean }) {
  const pillar = c.pillar ?? c.suggestedPillar;
  const body = (
    <>
      {c.type === 'photo' && <BlobImg blob={c.thumb ?? c.blob} alt={c.text ?? 'Photo'} className="mb-2 aspect-[4/3] w-full rounded-xl object-cover" />}
      {c.type === 'voice' && (
        <p className="mb-1 font-medium">🎙️ Voice note · {fmtDuration(c.durationMs ?? 0)}</p>
      )}
      {c.text && <p className="line-clamp-4 text-lg">{c.text}</p>}
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <Flames capture={c} />
        <span>{ORIGIN_LABEL[c.origin]}</span>
        {showPillar && pillar && <span>{PILLAR_BY_ID[pillar].emoji} {PILLAR_BY_ID[pillar].name}</span>}
        {c.sample && <span className="rounded bg-surface2 px-1.5 text-xs font-semibold uppercase">Sample</span>}
      </p>
    </>
  );
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      {onClick ? <button onClick={onClick} className="block min-h-12 w-full text-left">{body}</button> : body}
      {c.type === 'voice' && <Audio blob={c.blob} />}
    </div>
  );
}
