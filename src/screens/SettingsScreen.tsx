import { useState } from 'react';
import { repo } from '../data/repo';
import { useCaptures, useMeta } from '../data/hooks';
import { Chip } from '../components/ui';
import CloudCard from '../components/CloudCard';
import { APP_NAME } from '../config';
import { usageExport } from '../lib/events';
import { downloadBlob } from '../lib/onepagerRender';
import { clearSampleData, loadSampleData } from '../lib/seed';
import { DEFAULT_SETTINGS, type Settings } from '../types';

const VERSION = '0.1.0';

export default function SettingsScreen() {
  const captures = useCaptures() ?? [];
  const settings: Settings = { ...DEFAULT_SETTINGS, ...useMeta<Partial<Settings>>('settings', {}) };
  const sampleCount = captures.filter((c) => c.sample).length;
  const [busy, setBusy] = useState(false);
  const [taps, setTaps] = useState(0);

  const save = (patch: Partial<Settings>) => void repo.setMeta('settings', { ...settings, ...patch });
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };

  function toggleLlm() {
    if (settings.llmOptIn) return save({ llmOptIn: false });
    const ok = window.confirm(
      'Turn on cloud pillar suggestions?\n\nThe TEXT of each new idea (never photos or audio) will be sent to the endpoint you enter. Without this, everything stays on your device.',
    );
    if (ok) save({ llmOptIn: true });
  }

  return (
    <section className="space-y-4 py-2">
      <h2 className="font-display text-2xl">Settings</h2>

      <div className="rounded-2xl border border-line bg-surface p-4">
        <h3 className="mb-2 font-semibold">Look</h3>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Theme">
          {(['system', 'light', 'dark'] as const).map((t) => (
            <Chip key={t} selected={settings.theme === t} onClick={() => save({ theme: t })}>{t === 'system' ? 'Match phone' : t === 'light' ? 'Light' : 'Dark (late nights)'}</Chip>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4">
        <h3 className="font-semibold">Sample data</h3>
        <p className="mb-3 text-muted">
          {sampleCount > 0
            ? `${sampleCount} sample captures (West African x Southern counter spot) are loaded. Clearing removes only these.`
            : 'Load a made-up West African x Southern counter-service concept to see how it all fits together.'}
        </p>
        {sampleCount > 0 ? (
          <button disabled={busy} onClick={() => run(clearSampleData)} className="min-h-12 w-full rounded-xl border border-line px-4 font-semibold">Clear sample data</button>
        ) : (
          <button disabled={busy} onClick={() => run(loadSampleData)} className="min-h-12 w-full rounded-xl bg-accent px-4 font-semibold text-accentink">Load sample data</button>
        )}
      </div>

      <CloudCard />

      <div className="rounded-2xl border border-line bg-surface p-4">
        <h3 className="font-semibold">Privacy</h3>
        <p className="mb-3 text-muted">Everything lives on this device unless you turn on cloud backup. No analytics are sent anywhere, and usage data stays local. Nothing is shared unless you export a one-pager.</p>
        <details>
          <summary className="min-h-12 cursor-pointer py-3 font-semibold">Optional: cloud pillar suggestions (off)</summary>
          <p className="mb-3 text-muted">Sends the text of new ideas to an endpoint you provide, to suggest a pillar. Photos and audio are never sent. Leave off to keep everything local.</p>
          <input
            value={settings.llmEndpoint}
            onChange={(e) => save({ llmEndpoint: e.target.value })}
            placeholder="https://your-endpoint.example/suggest"
            inputMode="url"
            aria-label="Suggestion endpoint URL"
            className="mb-3 min-h-12 w-full rounded-xl border border-line bg-bg px-3"
          />
          <button onClick={toggleLlm} aria-pressed={settings.llmOptIn} className="min-h-12 w-full rounded-xl border border-line font-semibold">
            {settings.llmOptIn ? 'On. Tap to turn off' : 'Off. Tap to opt in'}
          </button>
        </details>
      </div>

      {taps >= 7 && (
        <div className="rounded-2xl border border-line bg-surface p-4">
          <h3 className="font-semibold">Export my usage data</h3>
          <p className="mb-3 text-muted">A JSON file with counts and timings only. No idea text, photos or audio.</p>
          <button
            onClick={async () => downloadBlob(new Blob([JSON.stringify(usageExport(await repo.listEvents(), captures), null, 2)], { type: 'application/json' }), 'usage-data.json')}
            className="min-h-12 w-full rounded-xl bg-accent font-semibold text-accentink"
          >
            Download usage data
          </button>
        </div>
      )}

      <p className="text-center text-sm text-muted">{captures.length} captures stored on this device.</p>
      <button onClick={() => setTaps((n) => n + 1)} className="mx-auto block min-h-12 px-6 text-sm text-muted" aria-label={`${APP_NAME} version ${VERSION}`}>
        {APP_NAME} v{VERSION}
      </button>
    </section>
  );
}
