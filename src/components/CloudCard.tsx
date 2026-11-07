import { useState } from 'react';
import { cloudConfigured, MIN_PASSWORD, signIn, signOut, signUp, useSession } from '../data/auth';
import { useMeta } from '../data/hooks';
import { resetSyncState, syncNow } from '../data/sync';

/** Optional cloud backup. Off until she signs in; local data is untouched by signing in or out. */
export default function CloudCard() {
  const session = useSession();
  const lastSyncedAt = useMeta<number>('lastSyncedAt', 0);
  const syncError = useMeta<string>('syncError', '');
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setMsg(''); setInfo('');
    try { await fn(); } catch (e) { setMsg(e instanceof Error ? e.message : 'Something went wrong'); } finally { setBusy(false); }
  };

  async function submit() {
    const out = mode === 'signup' ? await signUp(email.trim(), password) : await signIn(email.trim(), password);
    if (out.error) throw new Error(out.error);
    if (out.needsConfirm) setInfo(`Check ${email.trim()} for a confirmation link, then come back and sign in.`);
    else setPassword('');
  }

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
        <form
          className="space-y-3"
          onSubmit={(e) => { e.preventDefault(); void run(submit); }}
        >
          <p className="text-muted">Off by default. {mode === 'signup' ? 'Create an account' : 'Sign in'} to copy your ideas, photos and voice notes to your private account so you can recover or sync them. Without it, nothing leaves this device.</p>
          <input type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email" className="min-h-12 w-full rounded-xl border border-line bg-bg px-3" />
          <input
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={`Password (${MIN_PASSWORD}+ characters)`}
            aria-label="Password"
            className="min-h-12 w-full rounded-xl border border-line bg-bg px-3"
          />
          <button
            type="submit"
            disabled={busy || !email.includes('@') || password.length < MIN_PASSWORD}
            className="min-h-12 w-full rounded-xl bg-accent font-semibold text-accentink disabled:opacity-50"
          >
            {busy ? 'Working…' : mode === 'signup' ? 'Create account and turn on backup' : 'Sign in and turn on backup'}
          </button>
          <button type="button" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setMsg(''); setInfo(''); }} className="min-h-12 w-full rounded-xl border border-line">
            {mode === 'signup' ? 'I already have an account' : 'Create a new account instead'}
          </button>
        </form>
      )}
      {info && <p role="status" className="mt-3 text-ok">{info}</p>}
      {msg && <p role="alert" className="mt-3 text-fire">{msg}</p>}
    </div>
  );
}
