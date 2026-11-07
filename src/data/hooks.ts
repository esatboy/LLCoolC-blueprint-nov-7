import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { Capture } from '../types';

// The one place (besides repo.ts) that touches Dexie directly: reactive reads.
export function useCaptures(): Capture[] | undefined {
  return useLiveQuery(() => db.captures.orderBy('createdAt').reverse().toArray(), []);
}

export function useMeta<T>(key: string, fallback: T): T {
  const row = useLiveQuery(() => db.meta.get(key), [key]);
  return (row?.value as T | undefined) ?? fallback;
}
