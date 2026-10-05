/* The device's own store (IndexedDB through Dexie). It is the source the
   screens read from; in the campaign app the sync (src/sync/, phase 3h)
   writes into it as well and reads what is still to be sent from it – what
   waits for the server is marked on the record itself, so nothing is lost
   when the tab closes. */
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

  /* ---- the campaign server (phase 3h); absent in the Quick Build ---- */
  /** The account it belongs to; absent: only on this device. */
  ownerId?: string;
  /** The server's version the state builds on; absent: not on the server yet. */
  serverRev?: number;
  /** `updatedAt` of the state the server has (version or draft): newer edits still wait. */
  syncedAt?: string;
  /** The seq of the server's draft this device last wrote or took; null: none. */
  draftSeq?: number | null;
  /** How it first reaches the server. */
  origin?: 'save' | 'import' | 'copy';
  copiedFrom?: { id: string; rev: number };
  /** Removed here; the server learns it once Undo has had its time. */
  removedAt?: string;
  /** The server was restored to an older version: this state goes back as a new version. */
  restore?: boolean;
  /** Changed on another device as well: the player decides (src/sync/conflict.ts). */
  conflict?: SyncConflict;
  /** The campaign it is entered in (phase 4a), as the server says; absent or null: free. */
  campaignId?: string | null;
}

export type SyncConflict =
  /** Another device of the same account drafted meanwhile. */
  | { kind: 'draft'; draft: { data: unknown; device: string; updatedAt: string; seq: number; baseRev: number } }
  /** A newer version was saved elsewhere while this device had changes. */
  | { kind: 'behind'; headRev: number; data: unknown }
  /** Removed on another device while this one had changes. */
  | { kind: 'removed' };

/** Small facts of this device: the sync's cursor, the server's epoch, whose they are. */
export interface MetaRow { key: string; value: unknown }

export class MordheimDb extends Dexie {
  warbands!: EntityTable<StoredWarband, 'id'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor(name = 'mordheim') {
    super(name);
    this.version(1).stores({ warbands: 'id, updatedAt, name' });
    // phase 3h: the sync's own facts; the new fields of a warband need no index
    this.version(2).stores({ warbands: 'id, updatedAt, name', meta: 'key' });
  }
}

export const db = new MordheimDb();
