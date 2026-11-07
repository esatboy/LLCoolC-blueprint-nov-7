import Dexie, { type Table } from 'dexie';
import { DB_NAME } from './config';
import type { AppEvent, Capture } from './types';

/** Dexie (IndexedDB) store. Only src/data/* should import this; screens go through the repo/hooks seam. */
export class AppDB extends Dexie {
  captures!: Table<Capture, string>;
  meta!: Table<{ key: string; value: unknown }, string>;
  events!: Table<AppEvent, number>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      captures: 'id, status, pillar, createdAt, nextResurfaceAt, sample',
      meta: 'key',
      events: '++id, type, at',
    });
  }
}

export const db = new AppDB();
