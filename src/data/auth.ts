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

export const MIN_PASSWORD = 8;

export interface AuthOutcome { error: string | null; needsConfirm?: boolean; }

/** Create an account. If the project still requires email confirmation, no session is returned yet. */
export async function signUp(email: string, password: string): Promise<AuthOutcome> {
  const { data, error } = await supabase!.auth.signUp({ email, password });
  if (error) return { error: error.message };
  return { error: null, needsConfirm: !data.session };
}

export async function signIn(email: string, password: string): Promise<AuthOutcome> {
  const { error } = await supabase!.auth.signInWithPassword({ email, password });
  return { error: error?.message ?? null };
}

export const signOut = () => supabase!.auth.signOut();
