import { useEffect, useState } from 'react';
import { APP_NAME } from './config';
import { repo } from './data/repo';
import { useMeta } from './data/hooks';
import { DEFAULT_SETTINGS, type Settings, type Tab } from './types';
import CaptureScreen from './screens/CaptureScreen';
import SettingsScreen from './screens/SettingsScreen';
import Placeholder from './screens/Placeholder';


const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: 'capture', label: 'Capture', icon: '✚' },
  { id: 'blueprint', label: 'Blueprint', icon: '▦' },
  { id: 'still', label: 'Still you?', icon: '🔥' },
  { id: 'week', label: 'Week', icon: '☀' },
  { id: 'pager', label: 'One-pager', icon: '▤' },
];

function useTheme(): Settings {
  const settings = { ...DEFAULT_SETTINGS, ...useMeta<Partial<Settings>>('settings', {}) };
  useEffect(() => {
    const el = document.documentElement;
    if (settings.theme === 'system') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);
  return settings;
}

export default function App() {
  const [tab, setTab] = useState<Tab>('capture'); // opens straight to capture
  useTheme();

  useEffect(() => {
    void (async () => {
      if (!(await repo.getMeta<number | null>('installedAt', null))) {
        await repo.setMeta('installedAt', Date.now());
        await repo.logEvent('install');
      }
      await repo.logEvent('app_open');
    })();
  }, []);

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col bg-bg">
      <header className="flex min-h-14 items-center justify-between px-4 pt-[env(safe-area-inset-top)]">
        <h1 className="font-display text-2xl font-semibold">{APP_NAME}</h1>
        <button
          aria-label="Settings"
          onClick={() => setTab('settings')}
          className="grid size-12 place-items-center rounded-full text-2xl"
        >
          ⚙
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-6">
        {tab === 'settings' ? (
          <SettingsScreen />
        ) : tab === 'capture' ? (
          <CaptureScreen onGo={setTab} />
        ) : (
          <Placeholder title={NAV.find((n) => n.id === tab)!.label} />
        )}
      </main>

      <nav
        aria-label="Main"
        className="grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => setTab(n.id)}
            aria-current={tab === n.id ? 'page' : undefined}
            className={`flex min-h-16 flex-col items-center justify-center gap-0.5 whitespace-nowrap text-[11px] font-medium ${
              tab === n.id ? 'text-accent' : 'text-muted'
            }`}
          >
            <span aria-hidden className="text-xl leading-none">{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
