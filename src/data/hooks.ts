import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { dueCaptures } from '../lib/scheduler';
import type { Capture } from '../types';

// The one place (besides repo.ts) that touches Dexie directly: reactive reads.
export function useCaptures(): Capture[] | undefined {
  return useLiveQuery(() => db.captures.orderBy('createdAt').reverse().toArray(), []);
}

export function useMeta<T>(key: string, fallback: T): T {
  const row = useLiveQuery(() => db.meta.get(key), [key]);
  return (row?.value as T | undefined) ?? fallback;
}

/** "Still you?" stack: max 5, empty while snoozed by "Dismiss all". */
export function useDueCaptures(): Capture[] {
  const captures = useCaptures();
  const snoozedUntil = useMeta<number>('stackSnoozedUntil', 0);
  return useMemo(() => {
    const now = Date.now();
    return now < snoozedUntil ? [] : dueCaptures(captures ?? [], now);
  }, [captures, snoozedUntil]);
}
