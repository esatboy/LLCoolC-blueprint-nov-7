import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export const cloudConfigured = !!supabase;

/** Current Supabase session, or null when signed out, offline-without-session or not configured. */
export function useSession(): Session | null {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

/** Step 1: email a 6-digit code. Creates the account on first use. */
export async function sendCode(email: string): Promise<string | null> {
  const { error } = await supabase!.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  return error?.message ?? null;
}

/** Step 2: verify the code (works inside an installed PWA, no redirect needed). */
export async function verifyCode(email: string, token: string): Promise<string | null> {
  const { error } = await supabase!.auth.verifyOtp({ email, token, type: 'email' });
  return error?.message ?? null;
}

export const signOut = () => supabase!.auth.signOut();
