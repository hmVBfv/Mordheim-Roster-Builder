/* The canonical form in which a legacy state and a core state are compared
 * (parity suites and the mirror of the legacy tests). Equal up to:
 *   - core-only bookkeeping (uidSeq, campaign.logSeq),
 *   - ids that legacy draws from a clock or a module-wide counter (Hired
 *     Sword/Dramatis record uids, chronicle ids), compared by position,
 *   - the canonical form legacy reached as a side effect of rendering, which
 *     core produces with normalizeState(). */
import * as core from '../../src/index.ts';
import type { WarbandState } from '../../src/index.ts';
import { loadGameData } from '../../src/node.ts';

export const data = loadGameData();

type Rec = Record<string, unknown>;
type IdRef = [holder: Rec, key: string];

/* Every place a chronicle id (log entry, battle, casualty, experience entry
   — one shared sequence) is stored or referenced. */
function idRefs(c: Rec): IdRef[] {
  const out: IdRef[] = [];
  const camp = c.campaign as Rec | undefined;
  const list = (x: unknown) => (Array.isArray(x) ? x as Rec[] : []);
  const add = (h: unknown, k: string) => { if (h && typeof h === 'object' && typeof (h as Rec)[k] === 'number') out.push([h as Rec, k]); };
  if (camp) {
    for (const e of list(camp.log)) { add(e, 'id'); add(e.data, 'casualtyId'); add(e.data, 'battleId'); }
    for (const b of list(camp.battles)) add(b, 'id');
    for (const r of list(camp.casualties)) { add(r, 'id'); add(r, 'xpId'); add(r, 'battleId'); }
    for (const x of list(camp.xp)) add(x, 'id');
  }
  for (const f of list(c.fallen)) add(f, 'casualtyId');
  return out;
}

function canon(s: unknown): unknown {
  const c = JSON.parse(JSON.stringify(s)) as Rec & { campaign?: Rec; hired?: { uid: string }[]; dp?: { uid: string }[] };
  const camp = c.campaign;
  // Stage snapshots hold a whole earlier state: brought to the same canonical
  // form, and stamped with a date legacy took from the clock.
  const snaps = (camp?.snapshots ?? {}) as Record<string, Rec>;
  for (const k of Object.keys(snaps)) {
    const sn = snaps[k] as Rec;
    if (sn && typeof sn === 'object' && !Array.isArray(sn)) {
      sn.at = 'DATE';
      if (sn.state) sn.state = canonCommon(JSON.parse(JSON.stringify(core.normalizeState(core.ctxOf(data, sn.state as WarbandState)))) as Rec);
    }
  }
  // Chronicle ids by rank: legacy draws them from a module-wide counter,
  // core from the state; both hand them out in the same order.
  const refs = [...idRefs(c), ...Object.values(snaps).flatMap((sn) => (sn && typeof sn === 'object' && sn.state ? idRefs(sn.state as Rec) : []))];
  const rank = new Map([...new Set(refs.map(([h, k]) => h[k] as number))].sort((x, y) => x - y).map((id, i) => [id, i + 1]));
  for (const [h, k] of refs) h[k] = rank.get(h[k] as number);
  return canonCommon(c);
}

/* Everything but the chronicle ids. */
function canonCommon(c: Rec & { campaign?: Rec; hired?: { uid: string }[]; dp?: { uid: string }[] }): Rec {
  delete c.uidSeq;
  const camp = c.campaign;
  if (camp) {
    delete camp.logSeq;
    // half-filled forms and open panels (legacy kept them in the save)
    for (const k of Object.keys(camp)) if (k.startsWith('_')) delete camp[k];
    // A post-battle round nobody has touched, and an empty snapshot list, are
    // what legacy's panels leave behind when they merely look.
    const pb = camp.postbattle as Record<string, Rec> | undefined;
    if (pb) {
      for (const k of Object.keys(pb)) {
        const st = pb[k] as Rec;
        if (st && Object.keys(st).every((x) => x === 'done' || x === 'wyrd') && !Object.keys((st.done as Rec) ?? {}).length && st.wyrd == null) delete pb[k];
      }
      if (!Object.keys(pb).length) delete camp.postbattle;
    }
    if (camp.snapshots && typeof camp.snapshots === 'object' && !Object.keys(camp.snapshots).length) delete camp.snapshots;
  }
  (c.hired ?? []).forEach((h, i) => { h.uid = `H${i}`; });
  (c.dp ?? []).forEach((h, i) => { h.uid = `D${i}`; });
  // Open/closed panels are screen state that legacy kept in the save; core
  // does not model them.
  const fallenModels = ((c.fallen as { m?: Rec }[] | undefined) ?? []).map((f) => f.m).filter(Boolean) as Rec[];
  for (const x of [...((c.models as Rec[] | undefined) ?? []), ...(c.hired ?? []), ...(c.dp ?? []), ...fallenModels] as Rec[]) {
    for (const k of Object.keys(x)) if (/^_.*Open$/.test(k)) delete x[k];
  }
  return c;
}
/* Both sides go through normalizeState: when legacy reached the canonical
   form depended on what it happened to render (e.g. the campaign lists only
   appear once the campaign section or a log entry touched them). */
export const canonOf = (s: unknown) => canon(core.normalizeState(core.ctxOf(data, JSON.parse(JSON.stringify(s)) as WarbandState)));

/* The open campaign file: import dates come from legacy's clock. */
export function cfCanon(cf: unknown): unknown {
  if (!cf) return null;
  const c = JSON.parse(JSON.stringify(cf)) as { warbands?: Rec[] };
  for (const w of c.warbands ?? []) {
    w.updated = 'DATE';
    const r = w.roster as WarbandState | undefined;
    if (r && r.wb && data.WARBANDS[r.wb]) w.roster = canonOf(r);
  }
  return c;
}

/* Draft references to battles and casualties by position (their ids come
   from different counters). */
export function draftCanon(dr: unknown, s: WarbandState): unknown {
  if (!dr) return null;
  const d = JSON.parse(JSON.stringify(dr)) as Rec & { cas?: Rec[] };
  if (d.editId != null) d.editId = (s.campaign?.battles ?? []).findIndex((b) => b.id === d.editId);
  for (const c of d.cas ?? []) if (c.id != null) c.id = (s.campaign?.casualties ?? []).findIndex((x) => x.id === c.id);
  return d;
}
