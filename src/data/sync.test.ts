import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFake } from './testing/fakeSupabase';
import type { Capture } from '../types';

const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock('./supabase', () => ({
  BUCKET: 'captures',
  get supabase() { return holder.client; },
}));

import { db } from '../db';
import { toRow } from './mapping';
import { resetSyncState, syncNow } from './sync';

const UID = 'user-1';
let fake: ReturnType<typeof createFake>;

const mk = (o: Partial<Capture> = {}): Capture => ({
  id: crypto.randomUUID(), type: 'text', text: 'idea', tags: [], createdAt: 1000, updatedAt: 1000, origin: 'vision',
  pillar: 'food', suggestedPillar: 'food', strength: 1, status: 'active', nextResurfaceAt: null, resonanceHistory: [], ...o,
});
const meta = async <T>(k: string) => (await db.meta.get(k))?.value as T | undefined;

beforeEach(async () => {
  await db.delete();
  await db.open();
  fake = createFake();
  holder.client = fake.client;
});

describe('push', () => {
  it('uploads media under <user>/<id> and upserts a row that points at it', async () => {
    const c = mk({ type: 'photo', blob: new Blob(['abc'], { type: 'image/jpeg' }), thumb: new Blob(['a']), mime: 'image/jpeg' });
    await db.captures.put(c);
    const res = await syncNow(UID);
    expect(res.pushed).toBe(1);
    expect([...fake.server.files.keys()].sort()).toEqual([`${UID}/${c.id}`, `${UID}/${c.id}.thumb`]);
    const row = fake.server.captures.get(c.id)!;
    expect(row.user_id).toBe(UID);
    expect(row.blob_path).toBe(`${UID}/${c.id}`);
    expect((await db.captures.get(c.id))!.blobPath).toBe(`${UID}/${c.id}`);
  });

  it('never uploads sample data', async () => {
    await db.captures.bulkPut([mk({ sample: true }), mk({ sample: true, type: 'photo', blob: new Blob(['x']) }), mk()]);
    const res = await syncNow(UID);
    expect(res.pushed).toBe(1);
    expect(fake.server.captures.size).toBe(1);
    expect(fake.server.files.size).toBe(0);
  });

  it('only pushes what changed since the last sync, and pushes later edits', async () => {
    const c = mk();
    await db.captures.put(c);
    expect((await syncNow(UID)).pushed).toBe(1);
    expect((await syncNow(UID)).pushed).toBe(0);
    await db.captures.update(c.id, { text: 'edited', updatedAt: Date.now() + 5000 });
    expect((await syncNow(UID)).pushed).toBe(1);
    expect(fake.server.captures.get(c.id)!.text).toBe('edited');
  });

  it('does not re-upload media that is already in the cloud', async () => {
    const c = mk({ type: 'photo', blob: new Blob(['abc']), thumb: new Blob(['a']) });
    await db.captures.put(c);
    await syncNow(UID);
    fake.server.log.length = 0;
    await db.captures.update(c.id, { pillar: 'space', updatedAt: Date.now() + 5000 });
    await syncNow(UID);
    expect(fake.server.log.filter((l) => l.startsWith('upload:'))).toEqual([]);
  });
});

describe('pull and conflicts', () => {
  it('pulls before it pushes', async () => {
    await db.captures.put(mk());
    await syncNow(UID);
    const first = fake.server.log.findIndex((l) => l === 'select:captures');
    const firstUpsert = fake.server.log.findIndex((l) => l === 'upsert:captures');
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(firstUpsert);
  });

  it('creates local ideas from remote rows and downloads their media', async () => {
    const remote = mk({ type: 'photo', blobPath: `${UID}/r1`, thumbPath: `${UID}/r1.thumb`, text: 'from phone' });
    fake.server.files.set(`${UID}/r1`, new Blob(['xyz']));
    fake.server.files.set(`${UID}/r1.thumb`, new Blob(['x']));
    fake.put(toRow(remote, UID));
    const res = await syncNow(UID);
    expect(res.pulled).toBe(1);
    const local = (await db.captures.get(remote.id))!;
    expect(local.text).toBe('from phone');
    expect(local.blob?.size).toBe(3);
    expect(local.thumb?.size).toBe(1);
  });

  it('newer remote edit wins and is not pushed back', async () => {
    const c = mk({ text: 'old', updatedAt: 1000 });
    await db.captures.put(c);
    await syncNow(UID); // baseline: everything pushed, push cursor set
    fake.put(toRow({ ...c, text: 'from other device', updatedAt: 3000 }, UID));
    // local copy is older than 3000, so the remote edit should win
    const res = await syncNow(UID);
    expect(res.pulled).toBe(1);
    expect(res.pushed).toBe(0);
    expect((await db.captures.get(c.id))!.text).toBe('from other device');
  });

  it('newer local edit survives an older remote row and then overwrites it', async () => {
    const c = mk({ text: 'base', updatedAt: 1000 });
    await db.captures.put(c);
    await syncNow(UID);
    const stale = { ...c, text: 'stale remote', updatedAt: 1500 };
    fake.put(toRow(stale, UID));
    await db.captures.update(c.id, { text: 'newest local', updatedAt: Date.now() + 5000 });
    const res = await syncNow(UID);
    expect(res.pulled).toBe(0);
    expect((await db.captures.get(c.id))!.text).toBe('newest local');
    expect(fake.server.captures.get(c.id)!.text).toBe('newest local');
  });

  it('pulls everything across multiple pages', async () => {
    for (let i = 0; i < 250; i++) fake.put(toRow(mk({ text: `idea ${i}` }), UID));
    const res = await syncNow(UID);
    expect(res.pulled).toBe(250);
    expect(await db.captures.count()).toBe(250);
  });
});

describe('one-pager concept', () => {
  it('pushes a newer local concept', async () => {
    await db.meta.bulkPut([
      { key: 'concept', value: { name: 'Mine', oneLiner: 'pitch', heroIds: null } },
      { key: 'conceptUpdatedAt', value: 5000 },
    ]);
    await syncNow(UID);
    expect(fake.server.concept).toMatchObject({ user_id: UID, name: 'Mine', one_liner: 'pitch' });
  });

  it('takes a newer remote concept', async () => {
    await db.meta.bulkPut([
      { key: 'concept', value: { name: 'Mine', oneLiner: '', heroIds: null } },
      { key: 'conceptUpdatedAt', value: 5000 },
    ]);
    fake.server.concept = { user_id: UID, name: 'Theirs', one_liner: 'x', hero_ids: ['a'], updated_at: new Date(9000).toISOString() };
    await syncNow(UID);
    expect(await meta('concept')).toEqual({ name: 'Theirs', oneLiner: 'x', heroIds: ['a'] });
    expect(await meta('conceptUpdatedAt')).toBe(9000);
  });
});

describe('reliability', () => {
  it('records a failure, keeps local data, and clears the error on the next success', async () => {
    const c = mk();
    await db.captures.put(c);
    fake.server.failNext = 'boom';
    await expect(syncNow(UID)).rejects.toThrow('boom');
    expect(await meta('syncError')).toBe('boom');
    expect(await db.captures.get(c.id)).toBeDefined();
    fake.server.failNext = null;
    await syncNow(UID);
    expect(await meta('syncError')).toBe('');
    expect(fake.server.captures.has(c.id)).toBe(true);
  });

  it('shares one run between overlapping calls', async () => {
    await db.captures.put(mk());
    const a = syncNow(UID);
    const b = syncNow(UID);
    expect(a).toBe(b);
    await a;
    expect(fake.server.log.filter((l) => l === 'upsert:captures')).toHaveLength(1);
  });

  it('refuses to run when cloud is not configured', async () => {
    holder.client = null;
    await expect(syncNow(UID)).rejects.toThrow(/not configured/i);
  });

  it('signing out resets cursors and cloud paths but keeps every idea', async () => {
    const c = mk({ type: 'photo', blob: new Blob(['abc']), thumb: new Blob(['a']) });
    await db.captures.put(c);
    await syncNow(UID);
    await resetSyncState();
    expect(await meta('syncPullCursor')).toBeUndefined();
    expect(await meta('syncPushAt')).toBeUndefined();
    const local = (await db.captures.get(c.id))!;
    expect(local.blobPath).toBeUndefined();
    expect(local.blob?.size).toBe(3);
  });
});
