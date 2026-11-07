import type { CaptureRow } from '../mapping';

/**
 * In-memory stand-in for the slice of supabase-js that sync.ts uses.
 * It proves the sync LOGIC (order, last-write-wins, paths). It cannot prove real RLS or Storage policies.
 */
export interface ConceptRow { user_id: string; name: string; one_liner: string; hero_ids: string[] | null; updated_at: string; synced_at?: string; }

export function createFake() {
  const server = {
    captures: new Map<string, CaptureRow>(),
    concept: null as ConceptRow | null,
    files: new Map<string, Blob>(),
    log: [] as string[],
    failNext: null as string | null,
    clock: Date.UTC(2026, 0, 1),
  };
  const stamp = () => new Date((server.clock += 1000)).toISOString();

  /** Put a row on the "server" as if another device had pushed it. */
  const put = (row: CaptureRow) => server.captures.set(row.id, { ...row, synced_at: stamp() });

  const client = {
    from(table: string) {
      let after = '';
      let max = Infinity;
      const q = {
        select: () => q,
        order: () => q,
        gt: (_col: string, v: string) => { after = v; return q; },
        limit: (n: number) => { max = n; return q; },
        maybeSingle: () => {
          server.log.push(`select:${table}`);
          return Promise.resolve({ data: table === 'concept_meta' ? server.concept : null, error: null });
        },
        upsert: (row: Record<string, unknown>) => {
          server.log.push(`upsert:${table}`);
          if (table === 'captures') put(row as unknown as CaptureRow);
          else server.concept = { ...(row as unknown as ConceptRow), synced_at: stamp() };
          return Promise.resolve({ error: null });
        },
        // `await query` (the list select)
        then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
          server.log.push(`select:${table}`);
          if (server.failNext) {
            const message = server.failNext;
            return Promise.resolve({ data: null, error: new Error(message) }).then(ok, bad);
          }
          const rows = [...server.captures.values()]
            .filter((r) => (r.synced_at ?? '') > after)
            .sort((a, b) => (a.synced_at ?? '').localeCompare(b.synced_at ?? ''))
            .slice(0, max);
          return Promise.resolve({ data: rows, error: null }).then(ok, bad);
        },
      };
      return q;
    },
    storage: {
      from: (_bucket: string) => ({
        upload: (path: string, blob: Blob) => {
          server.log.push(`upload:${path}`);
          server.files.set(path, blob);
          return Promise.resolve({ error: null });
        },
        download: (path: string) => {
          server.log.push(`download:${path}`);
          const data = server.files.get(path);
          return Promise.resolve(data ? { data, error: null } : { data: null, error: new Error('not found') });
        },
      }),
    },
  };

  return { server, client, put };
}
