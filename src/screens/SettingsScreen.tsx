import { useState } from 'react';
import { useCaptures } from '../data/hooks';
import { clearSampleData, loadSampleData } from '../lib/seed';

export default function SettingsScreen() {
  const captures = useCaptures() ?? [];
  const sampleCount = captures.filter((c) => c.sample).length;
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  return (
    <section className="space-y-4 py-2">
      <h2 className="font-display text-2xl">Settings</h2>
      <div className="rounded-2xl border border-line bg-surface p-4">
        <h3 className="font-semibold">Sample data</h3>
        <p className="mb-3 text-muted">
          {sampleCount > 0
            ? `${sampleCount} sample captures (West African x Southern counter spot) are loaded.`
            : 'Load a made-up West African x Southern counter-service concept to see how it all fits together.'}
        </p>
        {sampleCount > 0 ? (
          <button disabled={busy} onClick={() => run(clearSampleData)} className="min-h-12 w-full rounded-xl border border-line px-4 font-semibold">
            Clear sample data
          </button>
        ) : (
          <button disabled={busy} onClick={() => run(loadSampleData)} className="min-h-12 w-full rounded-xl bg-accent px-4 font-semibold text-accentink">
            Load sample data
          </button>
        )}
      </div>
      <p className="text-center text-sm text-muted">{captures.length} captures stored on this device.</p>
    </section>
  );
}
