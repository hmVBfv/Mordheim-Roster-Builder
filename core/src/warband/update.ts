/* How warband actions change state: every action takes the current state and
   returns a new one (Immer), so the input is never modified and unchanged
   parts are shared. Inside an action the code may read and write the draft
   the way the legacy app wrote its global S — which keeps ports one to one. */
import { produce, type Draft } from 'immer';
import type { GameData } from '../data/types.ts';
import type { Model, WarbandState } from '../state/types.ts';
import { ctxOf, type Ctx } from '../rules/context.ts';

export type WarbandDraft = Draft<WarbandState>;

/** Applies `recipe` to a draft of ctx.s; the recipe gets a Ctx over the draft
    so rules read the state as it is being changed. */
export function update(ctx: Ctx, recipe: (d: WarbandDraft, dctx: Ctx) => void): WarbandState {
  return produce(ctx.s, (d) => { recipe(d, ctxOf(ctx.data, d as WarbandState)); });
}

export function findModel(d: WarbandDraft | WarbandState, uid: number): Model | undefined {
  return (d.models as Model[]).find((x) => x.uid === uid);
}

function knownUids(d: WarbandDraft | WarbandState): number[] {
  const known: number[] = [];
  for (const m of d.models) if (Number.isFinite(Number(m.uid))) known.push(Number(m.uid));
  for (const f of (d.fallen as unknown[] | undefined) ?? []) {
    const e = f as { uid?: unknown; m?: { uid?: unknown } };
    const u = Number(e?.uid ?? e?.m?.uid);
    if (Number.isFinite(u)) known.push(u);
  }
  return known;
}

/** Makes the state remember its uid counter, so a uid freed by a removal is
    never handed out again. A save without it continues after the highest uid
    in use, as legacy resyncUid() did on load. */
export function rememberUids(d: WarbandDraft): void {
  const floor = Math.max(1, ...knownUids(d)) + 1;
  if (!(Number(d.uidSeq) >= floor)) d.uidSeq = floor;
}

/** Next model uid; never reuses one. */
export function nextModelUid(d: WarbandDraft): number {
  rememberUids(d);
  const next = Number(d.uidSeq);
  d.uidSeq = next + 1;
  return next;
}

/** A fresh roster of the given warband type (legacy chooseWb). */
export function newWarband(data: GameData, key: string): WarbandState {
  const wb = data.WARBANDS[key];
  if (!wb) throw new Error(`Unknown warband: ${key}`);
  return {
    wb: key,
    subtype: wb.subtypes ? (wb.subtypes[0]?.key ?? null) : null,
    name: wb.name,
    budget: wb.gold,
    models: [], hired: [], dp: [], leaderUid: null,
    campaign: { on: false, districts: {} },
    stash: { wyrd: 0, gold: null, items: [] },
    fallen: [],
  } as WarbandState;
}
