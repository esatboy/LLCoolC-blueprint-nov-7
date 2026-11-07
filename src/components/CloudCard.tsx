import { useState } from 'react';
import { cloudConfigured, sendCode, signOut, useSession, verifyCode } from '../data/auth';
import { useMeta } from '../data/hooks';
import { resetSyncState, syncNow } from '../data/sync';

/** Optional cloud backup. Off until she signs in; local data is untouched by signing in or out. */
export default function CloudCard() {
  const session = useSession();
  const lastSyncedAt = useMeta<number>('lastSyncedAt', 0);
  const syncError = useMeta<string>('syncError', '');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setMsg('');
    try { await fn(); } catch (e) { setMsg(e instanceof Error ? e.message : 'Something went wrong'); } finally { setBusy(false); }
  };

  if (!cloudConfigured) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-4">
        <h3 className="font-semibold">Cloud backup</h3>
        <p className="text-muted">Not configured. Everything stays on this device.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <h3 className="font-semibold">Cloud backup (optional)</h3>
      {session ? (
        <div className="space-y-3">
          <p className="text-muted">Signed in as {session.user.email}. Your ideas, photos and voice notes back up to your private account and sync across your devices. Sample data never syncs.</p>
          <p className="text-sm text-muted">
            {syncError ? `Last sync failed: ${syncError}` : lastSyncedAt ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}` : 'Not synced yet.'}
          </p>
          <button disabled={busy} onClick={() => run(async () => void (await syncNow(session.user.id)))} className="min-h-12 w-full rounded-xl bg-accent font-semibold text-accentink disabled:opacity-50">
            {busy ? 'Syncing…' : 'Sync now'}
          </button>
          <button
            disabled={busy}
            onClick={() => run(async () => { await signOut(); await resetSyncState(); })}
            className="min-h-12 w-full rounded-xl border border-line font-semibold"
          >
            Sign out (keeps everything on this device)
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-muted">Off by default. Signing in copies your ideas, photos and voice notes to your private account so you can recover or sync them. Without it, nothing leaves this device.</p>
          {!sent ? (
            <>
              <input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email" className="min-h-12 w-full rounded-xl border border-line bg-bg px-3" />
              <button disabled={busy || !email.includes('@')} onClick={() => run(async () => { const err = await sendCode(email.trim()); if (err) throw new Error(err); setSent(true); })} className="min-h-12 w-full rounded-xl bg-accent font-semibold text-accentink disabled:opacity-50">
                Email me a code
              </button>
            </>
          ) : (
            <>
              <p className="text-muted">Enter the code we sent to {email}.</p>
              <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.trim())} placeholder="Code" aria-label="Code from email" className="min-h-12 w-full rounded-xl border border-line bg-bg px-3 text-center text-2xl tracking-widest" />
              <button disabled={busy || code.length < 6} onClick={() => run(async () => { const err = await verifyCode(email.trim(), code); if (err) throw new Error(err); setSent(false); setCode(''); })} className="min-h-12 w-full rounded-xl bg-accent font-semibold text-accentink disabled:opacity-50">
                Verify and turn on backup
              </button>
              <button onClick={() => { setSent(false); setCode(''); }} className="min-h-12 w-full rounded-xl border border-line">Use a different email</button>
            </>
          )}
        </div>
      )}
      {msg && <p role="alert" className="mt-3 text-fire">{msg}</p>}
    </div>
  );
}
