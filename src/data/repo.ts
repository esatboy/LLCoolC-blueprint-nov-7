import { db } from '../db';
import type { AppEvent, Capture } from '../types';

/**
 * Persistence seam. Screens depend on THIS interface, not on Dexie.
 * A Supabase/sync implementation can replace `localRepo` later (the app is local-only today).
 */
export interface Repo {
  listCaptures(): Promise<Capture[]>;
  getCapture(id: string): Promise<Capture | undefined>;
  addCapture(c: Capture): Promise<void>;
  addCaptures(cs: Capture[]): Promise<void>;
  updateCapture(id: string, patch: Partial<Capture>): Promise<void>;
  deleteCaptures(ids: string[]): Promise<void>;
  getMeta<T>(key: string, fallback: T): Promise<T>;
  setMeta<T>(key: string, value: T): Promise<void>;
  logEvent(type: string, data?: Record<string, unknown>): Promise<void>;
  listEvents(): Promise<AppEvent[]>;
}

export const localRepo: Repo = {
  listCaptures: () => db.captures.orderBy('createdAt').reverse().toArray(),
  getCapture: (id) => db.captures.get(id),
  addCapture: async (c) => void (await db.captures.put(c)),
  addCaptures: async (cs) => void (await db.captures.bulkPut(cs)),
  updateCapture: async (id, patch) => void (await db.captures.update(id, patch)),
  deleteCaptures: (ids) => db.captures.bulkDelete(ids),
  getMeta: async (key, fallback) => ((await db.meta.get(key))?.value as never) ?? fallback,
  setMeta: async (key, value) => void (await db.meta.put({ key, value })),
  logEvent: async (type, data) => void (await db.events.add({ at: Date.now(), type, data })),
  listEvents: () => db.events.orderBy('at').toArray(),
};

export const repo: Repo = localRepo;
