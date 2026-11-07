import { useEffect, useState, type ReactNode } from 'react';

export function useBlobUrl(blob?: Blob): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return setUrl(undefined);
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

export function BlobImg({ blob, alt, className }: { blob?: Blob; alt: string; className?: string }) {
  const url = useBlobUrl(blob);
  return url ? <img src={url} alt={alt} className={className} /> : <div className={className} />;
}

/** Selectable pill. min-h-12 = 48px touch target. */
export function Chip({ selected, onClick, children }: { selected?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-12 rounded-full border px-4 text-base font-medium ${
        selected ? 'border-accent bg-accent text-accentink' : 'border-line bg-surface text-ink'
      }`}
    >
      {children}
    </button>
  );
}

export function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
