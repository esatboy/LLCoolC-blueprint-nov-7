import { db } from '../db';
import type { Capture } from '../types';
import type { ConceptMeta } from '../lib/onepager';
import { fromRow, localUpdatedAt, remoteIsNewer, toRow, type CaptureRow } from './mapping';
import { BUCKET, supabase } from './supabase';

/**
 * Opt-in cloud backup. The app stays offline-first: Dexie is always the source the UI reads.
 * Sync = pull newer remote rows, then push newer local rows (last-write-wins by `updatedAt`).
 * Sample data and the usage event log never leave the device.
 */
export interface SyncResult { pulled: number; pushed: number; }

const meta = {
  get: async <T>(k: string, d: T): Promise<T> => ((await db.meta.get(k))?.value as T | undefined) ?? d,
  set: (k: string, v: unknown) => db.meta.put({ key: k, value: v }),
};

async function upload(path: string, blob: Blob, contentType: string) {
  const { error } = await supabase!.storage.from(BUCKET).upload(path, blob, { contentType, upsert: true });
  if (error) throw error;
}

async function download(path: string): Promise<Blob | undefined> {
  const { data, error } = await supabase!.storage.from(BUCKET).download(path);
  return error ? undefined : data;
}

async function pull(): Promise<number> {
  let cursor = await meta.get<string>('syncPullCursor', '1970-01-01T00:00:00Z');
  let applied = 0;
  for (;;) {
    const { data, error } = await supabase!.from('captures').select('*').gt('synced_at', cursor).order('synced_at').limit(200);
    if (error) throw error;
    const rows = (data ?? []) as CaptureRow[];
    for (const row of rows) {
      const local = await db.captures.get(row.id);
      if (remoteIsNewer(row, local)) {
        const next: Capture = { ...fromRow(row), blob: local?.blob, thumb: local?.thumb };
        if (row.blob_path && !next.blob) next.blob = await download(row.blob_path);
        if (row.thumb_path && !next.thumb) next.thumb = await download(row.thumb_path);
        await db.captures.put(next);
        applied++;
      }
      cursor = row.synced_at ?? cursor;
    }
    if (rows.length < 200) break;
  }
  await meta.set('syncPullCursor', cursor);
  return applied;
}

async function push(userId: string, since: number): Promise<number> {
  const dirty = (await db.captures.toArray()).filter((c) => !c.sample && localUpdatedAt(c) > since);
  for (const c of dirty) {
    // Upload media once; paths are <user>/<id> so storage policies can scope by folder.
    if (c.blob && !c.blobPath) {
      await upload(`${userId}/${c.id}`, c.blob, c.mime ?? c.blob.type ?? 'application/octet-stream');
      c.blobPath = `${userId}/${c.id}`;
    }
    if (c.thumb && !c.thumbPath) {
      await upload(`${userId}/${c.id}.thumb`, c.thumb, 'image/jpeg');
      c.thumbPath = `${userId}/${c.id}.thumb`;
    }
    const { error } = await supabase!.from('captures').upsert(toRow(c, userId), { onConflict: 'id' });
    if (error) throw error;
    // Record paths locally without touching updatedAt (this is bookkeeping, not an edit).
    await db.captures.update(c.id, { blobPath: c.blobPath, thumbPath: c.thumbPath });
  }
  return dirty.length;
}

async function syncConcept(userId: string): Promise<void> {
  const { data, error } = await supabase!.from('concept_meta').select('*').maybeSingle();
  if (error) throw error;
  const localAt = await meta.get<number>('conceptUpdatedAt', 0);
  const remoteAt = data ? Date.parse(data.updated_at as string) : 0;
  if (data && remoteAt > localAt) {
    const c: ConceptMeta = { name: data.name, oneLiner: data.one_liner, heroIds: data.hero_ids ?? null };
    await meta.set('concept', c);
    await meta.set('conceptUpdatedAt', remoteAt);
  } else if (localAt > remoteAt) {
    const c = await meta.get<ConceptMeta | null>('concept', null);
    if (!c) return;
    const { error: e } = await supabase!.from('concept_meta').upsert({
      user_id: userId, name: c.name, one_liner: c.oneLiner, hero_ids: c.heroIds, updated_at: new Date(localAt).toISOString(),
    });
    if (e) throw e;
  }
}

let running: Promise<SyncResult> | null = null;

/** Safe to call from anywhere, any time: overlapping calls share one run; failures are recorded, not thrown. */
export function syncNow(userId: string): Promise<SyncResult> {
  if (!supabase) return Promise.reject(new Error('Cloud backup is not configured'));
  running ??= (async () => {
    const startedAt = Date.now();
    try {
      const pulled = await pull();
      const pushed = await push(userId, await meta.get<number>('syncPushAt', 0));
      await syncConcept(userId);
      await meta.set('syncPushAt', startedAt);
      await meta.set('lastSyncedAt', Date.now());
      await meta.set('syncError', '');
      return { pulled, pushed };
    } catch (e) {
      const message = typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : 'Sync failed';
      await meta.set('syncError', message);
      throw e;
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Signing out keeps all local data, but resets cursors so the next account starts clean. */
export async function resetSyncState(): Promise<void> {
  await Promise.all(['syncPullCursor', 'syncPushAt', 'lastSyncedAt', 'syncError'].map((k) => db.meta.delete(k)));
  await db.captures.toCollection().modify((c) => { delete c.blobPath; delete c.thumbPath; });
}
