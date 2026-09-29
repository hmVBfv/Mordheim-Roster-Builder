/* What changed between two states of a warband (concept 4.3, data model
   section 4). Warriors are matched by their fixed uid. The result is a list
   of change records, complete whichever way a change came about; why it
   changed is the job of reconcile.ts.

   Every change has a stable key, `<round>:<uid|wb>:<kind>:<detail>`, so a
   player's explanation (`story.explain[changeKey]`) stays attached to the
   right change even when the marked state is corrected later. The key is
   built from content, never from positions. */
import type { GameData } from '../data/types.ts';
import type { FallenRecord, HireRecord, Model, WarbandState } from '../state/types.ts';
import { houseDefaults, houseRules } from '../state/house.ts';
import { ctxOf, type Ctx } from '../rules/context.ts';
import { goldCurrent, isHeroModel, totalRating } from '../rules/costs.ts';
import { unitDef } from '../rules/lookup.ts';
import { warbandWorth } from '../rules/worth.ts';

export type ChangeKind =
  | 'recruited' | 'died' | 'released' | 'promoted' | 'renamed' | 'group_size' | 'experience'
  | 'stat' | 'skill' | 'spell' | 'injury' | 'gear_added' | 'gear_removed' | 'rare_added' | 'rare_removed'
  | 'hired' | 'district' | 'house_rules' | 'gold' | 'rating' | 'worth';

export interface Change {
  kind: ChangeKind;
  /** The warrior's uid; null for the warband as a whole. */
  uid: number | null;
  /** A Hired Sword's or Dramatis Persona's record uid. */
  hireUid?: string;
  /** Who, as the player reads it. */
  name: string;
  payload: Record<string, unknown>;
  changeKey: string;
}

const STATS = ['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld'] as const;

/** Occurrences of each value, for lists that may repeat (skills, injuries). */
function counts(xs: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
}

function nameOf(c: Ctx, m: Model): string {
  return m.name || unitDef(c, m.uid_def)?.name || m.uid_def;
}

/** Compares two states of the same warband. `round` is the stage the
    change belongs to (the battle it followed). */
export function diffWarbands(data: GameData, before: WarbandState, after: WarbandState, round: number): Change[] {
  const cb = ctxOf(data, before), ca = ctxOf(data, after);
  const out: Change[] = [];
  const key = (who: number | string | null, kind: ChangeKind, detail: string) => `${round}:${who ?? 'wb'}:${kind}:${detail}`;
  const push = (kind: ChangeKind, uid: number | null, name: string, detail: string, payload: Record<string, unknown>, hireUid?: string) => {
    const ch: Change = { kind, uid, name, payload, changeKey: key(hireUid ?? uid, kind, detail) };
    if (hireUid) ch.hireUid = hireUid;
    out.push(ch);
  };
  const beforeById = new Map(before.models.map((m) => [m.uid, m]));
  const afterById = new Map(after.models.map((m) => [m.uid, m]));

  /* ---- warriors present afterwards ---- */
  for (const m of after.models) {
    const p = beforeById.get(m.uid);
    const name = nameOf(ca, m);
    const def = unitDef(ca, m.uid_def);
    if (!p) {
      // a Hero made from a group (The Lad's Got Talent) is a promotion, not a recruit
      const from = m.promoted ? before.models.find((g) => g.uid_def === m.uid_def && !g.promoted && !isHeroModel(cb, g)
        && (Number(afterById.get(g.uid)?.qty ?? 0) < Number(g.qty ?? 1) || !afterById.has(g.uid))) : undefined;
      if (from) push('promoted', m.uid, name, 'hero', { uid_def: m.uid_def, fromUid: from.uid });
      else push('recruited', m.uid, name, m.uid_def, { uid_def: m.uid_def, unit: def?.name ?? m.uid_def, qty: Number(m.qty) || 1, grade: isHeroModel(ca, m) ? 'hero' : 'hench', exp: Number(m.exp) || 0 });
      continue;
    }
    if (!p.promoted && m.promoted) push('promoted', m.uid, name, 'hero', { uid_def: m.uid_def, fromUid: m.uid });
    if ((p.name || '') !== (m.name || '')) push('renamed', m.uid, name, 'name', { before: p.name || '', after: m.name || '' });
    if ((Number(p.qty) || 1) !== (Number(m.qty) || 1)) push('group_size', m.uid, name, 'qty', { before: Number(p.qty) || 1, after: Number(m.qty) || 1 });
    const xb = Number(p.exp) || 0, xa = Number(m.exp) || 0;
    if (xb !== xa) push('experience', m.uid, name, 'exp', { before: xb, after: xa, gained: xa - xb });
    for (const st of STATS) {
      const b = Number((p.adv ?? {})[st]) || 0, a = Number((m.adv ?? {})[st]) || 0;
      if (b !== a) push('stat', m.uid, name, st, { stat: st, before: b, after: a });
    }
    diffList(push, 'skill', m.uid, name, p.skills ?? [], m.skills ?? [], (x) => ({ skill: x }));
    diffList(push, 'spell', m.uid, name, (p.spells ?? []).map((x) => x.name), (m.spells ?? []).map((x) => x.name), (x) => ({ spell: x }));
    diffList(push, 'injury', m.uid, name, (p.inj ?? []).map((j) => (j.code || j.name) as string), (m.inj ?? []).map((j) => (j.code || j.name) as string),
      (x) => { const j = (m.inj ?? []).concat(p.inj ?? []).find((y) => (y.code || y.name) === x); return { code: j?.code ?? null, injury: data.INJEN[x] || j?.name || x }; });
    diffQty(push, 'gear', m.uid, name, p.eq ?? {}, m.eq ?? {}, (de) => ({ item: de }));
    const rq = (r: Model['rare']) => Object.fromEntries(Object.entries(r ?? {}).map(([k, v]) => [k, Number(v.q) || 1]));
    diffQty(push, 'rare', m.uid, name, rq(p.rare), rq(m.rare), (de) => ({ item: de, itemEn: data.CATALOG.find((x) => x.de === de)?.en ?? de }));
  }

  /* ---- deaths: every Fallen record added since ---- */
  const nb = (before.fallen ?? []).length;
  const deaths = new Map<number, number>();
  (after.fallen ?? []).slice(nb).forEach((f: FallenRecord) => {
    const uid = f.m.uid;
    const n = (deaths.get(uid) ?? 0) + 1;
    deaths.set(uid, n);
    push('died', uid, (f.memberName as string) || nameOf(ca, f.m), String(n), {
      uid_def: f.m.uid_def, unit: unitDef(ca, f.m.uid_def)?.name ?? f.m.uid_def, hero: f.kind === 'hero',
      memberIdx: f.memberIdx ?? null, memberName: f.memberName ?? null, exp: Number(f.m.exp) || 0, lostValue: Number(f.lostValue) || 0,
    });
  });

  /* ---- warriors gone without dying ---- */
  for (const p of before.models) {
    if (afterById.has(p.uid) || deaths.has(p.uid)) continue;
    // a group whose last man was promoted in place keeps its uid; one whose
    // men all left for a new Hero is accounted for by the promotion
    push('released', p.uid, nameOf(cb, p), p.uid_def, { uid_def: p.uid_def, unit: unitDef(cb, p.uid_def)?.name ?? p.uid_def, qty: Number(p.qty) || 1 });
  }

  /* ---- Hired Swords and Dramatis Personae ---- */
  const hires = (s: WarbandState) => [...(s.hired ?? []).map((h) => ({ h, dp: false })), ...(s.dp ?? []).map((h) => ({ h, dp: true }))];
  const hb = hires(before), ha = hires(after);
  const hireName = (c: Ctx, h: HireRecord, dp: boolean) => h.name || (dp ? c.data.DRAMATIS[h.key]?.name : c.data.HIREDSWORDS[h.key]?.name) || h.key;
  for (const { h, dp } of ha) if (!hb.some((x) => x.h.uid === h.uid)) push('hired', null, hireName(ca, h, dp), h.key, { key: h.key, dramatis: dp }, h.uid);
  for (const { h, dp } of hb) if (!ha.some((x) => x.h.uid === h.uid)) push('released', null, hireName(cb, h, dp), h.key, { key: h.key, dramatis: dp, hire: true }, h.uid);

  /* ---- the warband ---- */
  const db = before.campaign?.districts ?? {}, da = after.campaign?.districts ?? {};
  for (const id of [...new Set([...Object.keys(db), ...Object.keys(da)])]) {
    const b = db[id] || 'none', a = da[id] || 'none';
    if (b !== a) push('district', null, data.DISTRICTS.find((d) => d.id === id)?.name ?? id, id, { district: id, before: b, after: a });
  }
  const hrb = houseRules(before) as unknown as Record<string, unknown>, hra = houseRules(after) as unknown as Record<string, unknown>;
  for (const k of Object.keys(houseDefaults())) {
    if (JSON.stringify(hrb[k]) !== JSON.stringify(hra[k])) push('house_rules', null, data.HR_LABELS[k] || k, k, { rule: k, label: data.HR_LABELS[k] || k, before: hrb[k], after: hra[k] });
  }
  if ((before.name || '') !== (after.name || '')) push('renamed', null, after.name || '', 'name', { before: before.name || '', after: after.name || '' });
  const totals: [ChangeKind, (c: Ctx) => number][] = [['gold', goldCurrent], ['rating', totalRating], ['worth', warbandWorth]];
  for (const [kind, f] of totals) {
    const b = f(cb), a = f(ca);
    if (b !== a) push(kind, null, after.name || '', kind, { before: b, after: a });
  }
  return out;
}

/* Added and removed entries of a list, with repeats numbered (#2, #3). */
function diffList(
  push: (kind: ChangeKind, uid: number | null, name: string, detail: string, payload: Record<string, unknown>) => void,
  kind: 'skill' | 'spell' | 'injury', uid: number, name: string, before: string[], after: string[],
  payload: (x: string) => Record<string, unknown>,
): void {
  const cb = counts(before), ca = counts(after);
  for (const [x, n] of ca) for (let i = (cb.get(x) ?? 0) + 1; i <= n; i++) push(kind, uid, name, i > 1 ? `${x}#${i}` : x, { ...payload(x), added: true });
  for (const [x, n] of cb) for (let i = (ca.get(x) ?? 0) + 1; i <= n; i++) push(kind, uid, name, `-${i > 1 ? `${x}#${i}` : x}`, { ...payload(x), added: false });
}

/* Items whose count went up or down. */
function diffQty(
  push: (kind: ChangeKind, uid: number | null, name: string, detail: string, payload: Record<string, unknown>) => void,
  family: 'gear' | 'rare', uid: number, name: string, before: Record<string, unknown>, after: Record<string, unknown>,
  payload: (de: string) => Record<string, unknown>,
): void {
  for (const de of [...new Set([...Object.keys(before), ...Object.keys(after)])]) {
    const b = Number(before[de]) || 0, a = Number(after[de]) || 0;
    if (a > b) push(`${family}_added`, uid, name, de, { ...payload(de), before: b, after: a });
    if (a < b) push(`${family}_removed`, uid, name, de, { ...payload(de), before: b, after: a });
  }
}
