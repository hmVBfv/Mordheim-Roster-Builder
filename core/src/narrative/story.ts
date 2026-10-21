/* What a player writes about their warband (phase 4b2; concept.md 4.6,
   data-model.md "Speicherstand"): the prologue, an interlude after each
   round, the explanation of a change, a profile for every warrior and the
   warband's names in both languages. All of it lives in the player's own
   save (ADR 0016) – `story`, `canon` and `profile` – so a save exported or
   opened elsewhere carries its story along.

   Every action returns the state it was given when nothing changed (the
   editor relies on that) and never keeps an empty text: an emptied field
   leaves no trace in the save. The limits are the schema's (format/
   schema.ts) – the server refuses a save beyond them. */
import type { HireRecord, Model, WarbandState } from '../state/types.ts';
import type { Ctx } from '../rules/context.ts';
import { update, type WarbandDraft } from '../warband/update.ts';

/** The most a save may hold of what players write. */
export const STORY_LIMITS = {
  prologue: 20_000,
  interlude: 20_000,
  /** how many rounds an interlude may be written for */
  interludes: 200,
  explanation: 2_000,
  /** how many changes may carry an explanation */
  explanations: 2_000,
  /** a change key is `<round>:<uid|wb>:<kind>:<detail>`; a detail may be a long item name */
  key: 200,
  name: 120,
  title: 120,
  voice: 1_000,
  origin: 1_000,
  text: 5_000,
} as const;

export interface Story { prologue: string; interludes: Record<string, string>; explain: Record<string, string> }

/** A warrior's profile: the source of the canon (names are fixed once and used everywhere). */
export interface WarriorProfile {
  name_de?: string; name_en?: string; title_de?: string; title_en?: string; voice?: string; origin?: string; text?: string;
  /** The faction he belongs to (ADR 0023): its name as written down, readable by anyone the warband is shared with, and the id of its entry in the owner's Library. */
  faction?: string; faction_id?: string;
}
export const PROFILE_FIELDS = ['name_de', 'name_en', 'title_de', 'title_en', 'voice', 'origin', 'text', 'faction', 'faction_id'] as const satisfies readonly (keyof WarriorProfile)[];
const PROFILE_MAX: Record<keyof WarriorProfile, number> = {
  name_de: STORY_LIMITS.name, name_en: STORY_LIMITS.name, title_de: STORY_LIMITS.title, title_en: STORY_LIMITS.title,
  voice: STORY_LIMITS.voice, origin: STORY_LIMITS.origin, text: STORY_LIMITS.text, faction: STORY_LIMITS.name, faction_id: 64,
};

/** The warband's name in both languages (data-model: `canon`). */
export interface Canon { name_de?: string; name_en?: string }
export const CANON_FIELDS = ['name_de', 'name_en'] as const satisfies readonly (keyof Canon)[];

const isRec = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** What a player typed, ready to keep: line endings unified, the ends trimmed, cut at the limit. */
export function tidyText(v: unknown, max: number): string {
  return String(v ?? '').replace(/\r\n?/g, '\n').trim().slice(0, max).trim();
}

/** The texts of a record, the empty ones left out. */
const texts = (x: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (!isRec(x)) return out;
  for (const [k, v] of Object.entries(x)) if (typeof v === 'string' && v.trim()) out[k] = v;
  return out;
};

/** The story of a state, whatever junk a hand-edited file may carry in its place. */
export function storyOf(s: WarbandState): Story {
  const raw = s.story;
  const st = isRec(raw) ? raw : {};
  return {
    prologue: typeof st.prologue === 'string' ? st.prologue : '',
    interludes: texts(st.interludes),
    explain: texts(st.explain),
  };
}

/** The story kept the way it is saved: nothing at all while it is empty. */
function keepStory(d: WarbandDraft, st: Story): void {
  if (!st.prologue && !Object.keys(st.interludes).length && !Object.keys(st.explain).length) { delete d.story; return; }
  d.story = {
    prologue: st.prologue,
    interludes: st.interludes,
    explain: st.explain,
  };
}

/** The prologue, before the campaign. */
export function setPrologue(ctx: Ctx, text: string): WarbandState {
  const v = tidyText(text, STORY_LIMITS.prologue);
  const cur = storyOf(ctx.s);
  if (cur.prologue === v) return ctx.s;
  return update(ctx, (d) => { keepStory(d, { ...cur, prologue: v }); });
}

/** The interlude after a round's battles (1, 2, …); an empty text takes it away. */
export function setInterlude(ctx: Ctx, round: number, text: string): WarbandState {
  const n = Math.trunc(Number(round));
  if (!(n >= 1 && n <= STORY_LIMITS.interludes)) return ctx.s;
  const v = tidyText(text, STORY_LIMITS.interlude);
  const cur = storyOf(ctx.s);
  if ((cur.interludes[String(n)] ?? '') === v) return ctx.s;
  const interludes = { ...cur.interludes };
  if (v) interludes[String(n)] = v; else delete interludes[String(n)];
  return update(ctx, (d) => { keepStory(d, { ...cur, interludes }); });
}

/** What happened behind a change (`change_key` of the changes list); an empty text takes it away. */
export function setExplanation(ctx: Ctx, changeKey: string, text: string): WarbandState {
  const k = String(changeKey);
  if (!k || k.length > STORY_LIMITS.key) return ctx.s;
  const v = tidyText(text, STORY_LIMITS.explanation);
  const cur = storyOf(ctx.s);
  if ((cur.explain[k] ?? '') === v) return ctx.s;
  const explain = { ...cur.explain };
  if (v) {
    if (!(k in explain) && Object.keys(explain).length >= STORY_LIMITS.explanations) return ctx.s;
    explain[k] = v;
  } else delete explain[k];
  return update(ctx, (d) => { keepStory(d, { ...cur, explain }); });
}

/** A warrior's profile, only the fields it has. */
export function profileOf(who: object | null | undefined): WarriorProfile {
  const raw = (who as Record<string, unknown> | null | undefined)?.profile;
  const p = isRec(raw) ? raw : {};
  const out: WarriorProfile = {};
  for (const f of PROFILE_FIELDS) if (typeof p[f] === 'string' && p[f]) out[f] = p[f];
  return out;
}

/** The roster entry a profile belongs to: a hero or henchmen group by its `uid` (a number), a Hired Sword or Dramatis Persona by its (text) `uid`. */
type Holder = Model | HireRecord;
function holderOf(s: WarbandState, who: number | string): { list: 'models' | 'hired' | 'dp'; index: number } | null {
  if (typeof who === 'number') {
    const i = s.models.findIndex((m) => m.uid === who);
    return i < 0 ? null : { list: 'models', index: i };
  }
  for (const list of ['hired', 'dp'] as const) {
    const i = (s[list] ?? []).findIndex((h) => h.uid === who);
    if (i >= 0) return { list, index: i };
  }
  return null;
}

/** Changes some fields of a warrior's profile; an empty text takes a field away, a profile with nothing left goes. */
export function setProfile(ctx: Ctx, who: number | string, patch: WarriorProfile): WarbandState {
  const at = holderOf(ctx.s, who);
  if (!at) return ctx.s;
  const was = (ctx.s[at.list] as Holder[])[at.index];
  const cur = profileOf(was);
  const next: WarriorProfile = { ...cur };
  for (const f of PROFILE_FIELDS) {
    if (!(f in patch)) continue;
    const v = tidyText(patch[f], PROFILE_MAX[f]);
    if (v) next[f] = v; else delete next[f];
  }
  if (PROFILE_FIELDS.every((f) => (next[f] ?? '') === (cur[f] ?? ''))) return ctx.s;
  return update(ctx, (d) => {
    const m = (d[at.list] as Holder[])[at.index] as Holder & { profile?: WarriorProfile };
    if (Object.keys(next).length) m.profile = next; else delete m.profile;
  });
}

/** The warband's names in both languages. */
export function canonOf(s: WarbandState): Canon {
  const c = isRec(s.canon) ? s.canon : {};
  const out: Canon = {};
  for (const f of CANON_FIELDS) if (typeof c[f] === 'string' && c[f]) out[f] = c[f];
  return out;
}

/** Changes the warband's names in German and English; an empty text takes one away. */
export function setCanon(ctx: Ctx, patch: Canon): WarbandState {
  const cur = canonOf(ctx.s);
  const next: Canon = { ...cur };
  for (const f of CANON_FIELDS) {
    if (!(f in patch)) continue;
    const v = tidyText(patch[f], STORY_LIMITS.name);
    if (v) next[f] = v; else delete next[f];
  }
  if (CANON_FIELDS.every((f) => (next[f] ?? '') === (cur[f] ?? ''))) return ctx.s;
  return update(ctx, (d) => { if (Object.keys(next).length) d.canon = next; else delete d.canon; });
}
