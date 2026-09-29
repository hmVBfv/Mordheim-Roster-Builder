/* The device's own store (IndexedDB through Dexie). It is the source the
   screens read from; in the campaign flavour the server sync (phase 2 on)
   will write into it as well. */
import Dexie, { type EntityTable } from 'dexie';
import type { WarbandState } from '@mordheim/core';

/** A warband kept on this device. `state` is the save as core reads it. */
export interface StoredWarband {
  id: string;
  /** Shown in lists without loading the rules data. */
  name: string;
  wb: string;
  wbName: string;
  state: WarbandState;
  /** Save format the state was written in (core/format). */
  format: number;
  createdAt: string;
  updatedAt: string;
}

export class MordheimDb extends Dexie {
  warbands!: EntityTable<StoredWarband, 'id'>;

  constructor(name = 'mordheim') {
    super(name);
    this.version(1).stores({ warbands: 'id, updatedAt, name' });
  }
}

export const db = new MordheimDb();
