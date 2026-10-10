/* The save format as Zod schemas: a warband save and a campaign file.

   They describe the format as the app writes it, and are deliberately
   tolerant — unknown keys pass through, numbers the legacy app stored as
   text are accepted — because saves are the players' data and every file
   ever written must keep loading (test/compat.mjs). Loading reports what
   does not match as notes instead of refusing; the server (phase 2) checks
   what it stores against the same schemas. */
import { z } from 'zod';

/** A number, or one the legacy app kept as typed text ("7"). */
const num = z.union([z.number(), z.string()]);

/** How many of one thing a warband can hold: a group's size, gear, an advance.
    The rules count these one by one (worth, the names of a group, matching
    advances with their events), so a crafted 1e9 made the server loop or run
    out of memory (security review INPUT-1). Text that is no number passes as
    before – it counts as nothing. */
export const MAX_COUNT = 1000;
const count = num.refine((v) => !(Math.abs(Number(v)) > MAX_COUNT), { message: `at most ${MAX_COUNT}` });
const stats = z.record(z.string(), count);

export const injurySchema = z.looseObject({
  code: z.string().optional(),
  name: z.string().optional(),
  text: z.string().optional(),
  mod: z.record(z.string(), z.number()).nullable().optional(),
});

export const spellSchema = z.looseObject({ name: z.string(), red: z.number().optional() });

export const modelSchema = z.looseObject({
  uid: z.number(),
  uid_def: z.string(),
  name: z.string().optional(),
  names: z.array(z.string().nullable()).optional(),
  qty: count.optional(),
  exp: num.optional(),
  eq: z.record(z.string(), count).optional(),
  rare: z.record(z.string(), z.looseObject({ q: count, paid: num.optional(), on: z.string().optional() })).optional(),
  mut: z.array(z.string()).optional(),
  adv: stats.optional(),
  skills: z.array(z.string()).optional(),
  spells: z.array(spellSchema).optional(),
  inj: z.array(injurySchema).optional(),
  promoted: z.boolean().optional(),
  promoCats: z.array(z.string()).optional(),
  caster: z.boolean().optional(),
  lore: z.string().optional(),
  magic: z.string().optional(),
  miss: num.optional(),
  missWhy: z.string().optional(),
  joined: num.optional(),
  captive: z.looseObject({ by: z.string(), round: z.number(), casualtyId: z.number().nullable().optional() }).optional(),
  xpPaid: num.optional(),
  heirloom: z.string().nullable().optional(),
});

/** A key or id that is written into markup by older readers (the Roster Builder's inline handlers): letters, digits, `_` and `-`
    only (security review CLIENT-3). The Roster Builder makes `hs…`/`dp…` ids, the data's keys are such keys. */
const plainKey = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, 'letters, digits, _ and - only');

export const hireRecordSchema = z.looseObject({
  key: plainKey,
  uid: plainKey,
  name: z.string().optional(),
  exp: num.optional(),
  skills: z.array(z.string()).optional(),
  spells: z.array(spellSchema).optional(),
  adv: stats.optional(),
  opt: z.string().optional(),
  eq: z.record(z.string(), count).optional(),
});

export const logEntrySchema = z.looseObject({
  id: z.number(),
  round: z.number(),
  type: z.string(),
  text: z.string(),
  auto: z.boolean().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

const side = z.looseObject({ uid: z.number().nullable().optional(), name: z.string().optional(), wb: z.string().nullable().optional() });

export const casualtySchema = z.looseObject({
  id: z.number(), round: z.number(), battleId: z.number().nullable().optional(),
  victim: side, attacker: side, result: z.string(), detail: z.string().optional(),
  fallenId: z.number().nullable().optional(), fallenRef: z.number().nullable().optional(), note: z.string().optional(),
  /** The roll it was resolved with and its follow-ups (V1, core injure). */
  injury: z.union([z.looseObject({ hero: z.looseObject({ code: z.string() }) }), z.looseObject({ d6: z.number() })]).optional(),
});

export const campaignSchema = z.looseObject({
  on: z.boolean().optional(),
  round: z.number().optional(),
  districts: z.record(z.string(), z.string()).optional(),
  log: z.array(logEntrySchema).optional(),
  // serverId: the campaign server's battle it was taken over from; xpAwarded: its experience granted once (phase 4a4, ADR 0016)
  battles: z.array(z.looseObject({ id: z.number(), serverId: z.string().optional(), xpAwarded: z.boolean().optional() })).optional(),
  casualties: z.array(casualtySchema).optional(),
  xp: z.array(z.looseObject({ id: z.number(), uid: z.number(), amount: z.number() })).optional(),
  snapshots: z.record(z.string(), z.unknown()).optional(),
  postbattle: z.record(z.string(), z.unknown()).optional(),
  logSeq: z.number().optional(),
});

export const warbandSaveSchema = z.looseObject({
  /** Format number; saves without one are format 0 (the legacy app). */
  format: z.number().optional(),
  appVersion: z.string().optional(),
  wb: z.string(),
  subtype: z.string().nullable().optional(),
  name: z.string().optional(),
  budget: z.number().optional(),
  models: z.array(modelSchema),
  hired: z.array(hireRecordSchema).optional(),
  dp: z.array(hireRecordSchema).optional(),
  stash: z.looseObject({ wyrd: num.optional(), gold: num.nullable().optional(), items: z.array(z.looseObject({ name: z.string(), qty: count, key: z.string().optional(), rare: z.boolean().optional(), paid: num.optional() })).optional() }).optional(),
  house: z.record(z.string(), z.unknown()).optional(),
  campaign: campaignSchema.optional(),
  leaderUid: z.number().nullable().optional(),
  mark: z.string().nullable().optional(),
  fallen: z.array(z.looseObject({ id: z.number().optional(), kind: z.string(), m: modelSchema })).optional(),
  uidSeq: z.number().optional(),
  goldNow: z.number().optional(),
  /** The gold ledger (V7), from the warband's first battle on. */
  ledger: z.array(z.looseObject({ id: z.number(), kind: z.enum(['open', 'roster', 'buy', 'sell', 'search', 'adjust']), amount: z.number(), text: z.string(), round: z.number().optional(), uid: z.union([z.number(), z.string()]).optional(), item: z.string().optional(), qty: z.number().optional(), found: z.boolean().optional() })).optional(),
});

export const campaignFileSchema = z.looseObject({
  type: z.literal('mordheim-campaign-file'),
  version: z.number(),
  name: z.string(),
  round: z.number(),
  warbands: z.array(z.looseObject({ id: z.number(), player: z.string(), name: z.string(), wb: z.string(), updated: z.string(), roster: z.looseObject({ wb: z.string() }) })),
  battles: z.array(z.looseObject({ id: z.number() })),
  log: z.array(logEntrySchema),
});

/** Where a value departs from the schema, as short readable notes. */
export function schemaNotes(schema: z.ZodType, value: unknown): string[] {
  const r = schema.safeParse(value);
  if (r.success) return [];
  return r.error.issues.slice(0, 20).map((i) => `${i.path.join('.') || '(top)'}: ${i.message}`);
}
