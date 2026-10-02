/* Editing a warband: every change is an action of core, taken on the state
   the screen shows and saved on this device at once (docs/ui.md §1.6:
   "Undo" instead of "Are you sure?"). Until the server joins (phase 3h)
   the only copy is the one in this device's store. */
import * as core from '@mordheim/core';
import type { GameData, WarbandState } from '@mordheim/core';
import { useCallback, useMemo, useRef, useState } from 'react';
import { db, type StoredWarband } from '../db/db.ts';
import { editableState } from './view.ts';

/** A change that can be taken back once, from its notice. */
export interface Notice { id: number; text: string; before: WarbandState }

export interface Editor {
  /** The state the screen shows, tidied as on load. */
  state: WarbandState;
  /** Applies an action of core. With `text` the change gets a notice with
      "Undo"; without (a step of the experience stepper) it is just made. */
  edit: (action: (ctx: core.Ctx) => WarbandState, text?: string) => void;
  notice: Notice | null;
  undo: () => void;
  dismiss: () => void;
}

/** A save stamp later than `prev` (two edits may fall in one millisecond). */
export function nextStamp(prev: string, now: Date): string {
  const t = Math.max(now.getTime(), Date.parse(prev) + 1 || 0);
  return new Date(t).toISOString();
}

/** What the store keeps of an edited state. */
export function savedFields(data: GameData, s: WarbandState, stamp: string): Pick<StoredWarband, 'state' | 'name' | 'updatedAt'> {
  return { state: s, name: s.name || data.WARBANDS[s.wb as string]?.name || 'Warband', updatedAt: stamp };
}

const systemNow = () => new Date();

export function useEditor(data: GameData, rec: StoredWarband, now: () => Date = systemNow): Editor {
  // the state of the store, read once per version of the record
  const stored = useMemo(() => editableState(data, rec.state), [data, rec.state]);
  // the newest state this screen made; the store catches up a moment later
  const [local, setLocal] = useState<{ s: WarbandState; stamp: string } | null>(null);
  const latest = useRef<{ s: WarbandState; stamp: string } | null>(null);
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const [notice, setNotice] = useState<Notice | null>(null);
  const seq = useRef(0);

  // a change made elsewhere (another tab) is newer than ours: it wins
  const state = local && local.stamp >= rec.updatedAt ? local.s : stored;

  const commit = useCallback((next: WarbandState) => {
    const base = latest.current && latest.current.stamp >= rec.updatedAt ? latest.current.stamp : rec.updatedAt;
    const stamp = nextStamp(base, now());
    latest.current = { s: next, stamp };
    setLocal(latest.current);
    const fields = savedFields(data, next, stamp);
    writes.current = writes.current.then(() => db.warbands.update(rec.id, fields)).catch((e: unknown) => { console.error('saving the warband failed', e); });
  }, [data, rec.id, rec.updatedAt, now]);

  const edit = useCallback((action: (ctx: core.Ctx) => WarbandState, text?: string) => {
    const before = latest.current && latest.current.stamp >= rec.updatedAt ? latest.current.s : stored;
    const next = action(core.ctxOf(data, before));
    if (next === before) return;
    commit(next);
    // a notice undoes its own change only: a later change takes it away
    setNotice(text ? { id: ++seq.current, text, before } : null);
  }, [data, stored, rec.updatedAt, commit]);

  const undo = useCallback(() => {
    if (!notice) return;
    commit(notice.before);
    setNotice(null);
  }, [notice, commit]);

  const dismiss = useCallback(() => setNotice(null), []);

  return { state, edit, notice, undo, dismiss };
}
