import type { Capture, PillarId, Resonance } from '../types';

/** Pure mapping between a local Capture and its Supabase row. Blobs travel via Storage, never in the row. */
export interface CaptureRow {
  id: string;
  user_id: string;
  type: Capture['type'];
  text: string | null;
  tags: string[];
  origin: Capture['origin'];
  pillar: PillarId | null;
  suggested_pillar: PillarId | null;
  strength: number;
  status: Capture['status'];
  next_resurface_at: string | null;
  resonance_history: Resonance[];
  mime: string | null;
  duration_ms: number | null;
  blob_path: string | null;
  thumb_path: string | null;
  created_at: string;
  updated_at: string;
  synced_at?: string;
}

const iso = (ms: number) => new Date(ms).toISOString();

export const localUpdatedAt = (c: Pick<Capture, 'updatedAt' | 'createdAt'>): number => c.updatedAt ?? c.createdAt;

export function toRow(c: Capture, userId: string): CaptureRow {
  return {
    id: c.id,
    user_id: userId,
    type: c.type,
    text: c.text ?? null,
    tags: c.tags,
    origin: c.origin,
    pillar: c.pillar,
    suggested_pillar: c.suggestedPillar,
    strength: c.strength,
    status: c.status,
    next_resurface_at: c.nextResurfaceAt === null ? null : iso(c.nextResurfaceAt),
    resonance_history: c.resonanceHistory,
    mime: c.mime ?? null,
    duration_ms: c.durationMs ?? null,
    blob_path: c.blobPath ?? null,
    thumb_path: c.thumbPath ?? null,
    created_at: iso(c.createdAt),
    updated_at: iso(localUpdatedAt(c)),
  };
}

/** Everything except the blobs, which are downloaded separately. */
export function fromRow(r: CaptureRow): Omit<Capture, 'blob' | 'thumb'> {
  return {
    id: r.id,
    type: r.type,
    text: r.text ?? undefined,
    tags: r.tags ?? [],
    origin: r.origin,
    pillar: r.pillar,
    suggestedPillar: r.suggested_pillar,
    strength: r.strength,
    status: r.status,
    nextResurfaceAt: r.next_resurface_at === null ? null : Date.parse(r.next_resurface_at),
    resonanceHistory: r.resonance_history ?? [],
    mime: r.mime ?? undefined,
    durationMs: r.duration_ms ?? undefined,
    blobPath: r.blob_path ?? undefined,
    thumbPath: r.thumb_path ?? undefined,
    createdAt: Date.parse(r.created_at),
    updatedAt: Date.parse(r.updated_at),
  };
}

/** Last-write-wins: take the remote row only if it is strictly newer than what we have. */
export const remoteIsNewer = (remote: CaptureRow, local: Capture | undefined): boolean =>
  !local || Date.parse(remote.updated_at) > localUpdatedAt(local);
