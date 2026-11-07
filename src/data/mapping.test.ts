import { describe, expect, it } from 'vitest';
import { fromRow, remoteIsNewer, toRow } from './mapping';
import type { Capture } from '../types';

const cap: Capture = {
  id: '5b8f3f9e-0000-4000-8000-000000000001', type: 'photo', text: 'Warm wood', tags: ['decor'], createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_500_000, origin: 'inspiration', pillar: 'space', suggestedPillar: 'space', strength: 3, status: 'active',
  nextResurfaceAt: 1_700_600_000_000, resonanceHistory: [{ at: 1_700_100_000_000, answer: 'fire', source: 'prompt' }],
  mime: 'image/jpeg', blobPath: 'u/1', thumbPath: 'u/1.thumb', blob: new Blob(['x']),
};

describe('supabase row mapping', () => {
  it('round-trips everything except blobs', () => {
    const back = fromRow(toRow(cap, 'user-1'));
    const { blob, ...expected } = cap;
    expect(blob).toBeDefined();
    expect(back).toEqual(expected);
  });
  it('never puts blobs or sample flags in the row', () => {
    const row = toRow({ ...cap, sample: true }, 'user-1');
    expect(Object.keys(row)).not.toContain('blob');
    expect(Object.keys(row)).not.toContain('sample');
    expect(row.user_id).toBe('user-1');
  });
  it('maps nulls both ways', () => {
    const c = { ...cap, nextResurfaceAt: null, pillar: null, text: undefined, mime: undefined, blobPath: undefined, thumbPath: undefined };
    const back = fromRow(toRow(c, 'u'));
    expect(back.nextResurfaceAt).toBeNull();
    expect(back.pillar).toBeNull();
    expect(back.text).toBeUndefined();
  });
  it('falls back to createdAt when a capture was never edited', () => {
    const { updatedAt, ...fresh } = cap;
    expect(updatedAt).toBeDefined();
    expect(toRow(fresh, 'u').updated_at).toBe(new Date(cap.createdAt).toISOString());
  });
  it('last-write-wins only when the remote is strictly newer', () => {
    const row = toRow(cap, 'u');
    expect(remoteIsNewer(row, undefined)).toBe(true);
    expect(remoteIsNewer(row, cap)).toBe(false);
    expect(remoteIsNewer(row, { ...cap, updatedAt: cap.updatedAt! - 1 })).toBe(true);
    expect(remoteIsNewer(row, { ...cap, updatedAt: cap.updatedAt! + 1 })).toBe(false);
  });
});
