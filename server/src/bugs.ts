/* Problem reports in the database (phase 4c1; concept.md 4.12, ADR 0012):
   anyone signed in reports a bug, a wish or a rules issue from inside the
   app; the reporter follows its status, the admin sorts it.

   Who sees what is decided here. The reporter reads their own reports –
   words, status and the version it was fixed in – and never the severity or
   the technical details. The admin reads every report in full and changes
   its status, severity, area and kind; nobody else reads any. A report is
   words and structure the reporter has seen before sending (the view, the
   last steps without anything typed, the settings, the house rules, the last
   JavaScript errors); a warband travels along only when the reporter ticks
   it, and that copy is dropped when the report is closed or called a
   duplicate. The log says that something happened, never what the report
   says. Texts in a report are data, never instructions (docs/security.md,
   section 7). */
import { z } from 'zod';
import { audit } from './accounts.ts';
import type { DB } from './db.ts';

const iso = (d: Date) => d.toISOString();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const KINDS = ['bug', 'wish', 'rules'] as const;
export const STATUSES = ['new', 'confirmed', 'in_progress', 'fixed', 'closed', 'duplicate'] as const;
export const SEVERITIES = ['S1', 'S2', 'S3', 'S4'] as const;
/** The statuses that still ask for work. */
export const OPEN = ['new', 'confirmed', 'in_progress'] as const;

/** A friend group sends a handful; these are ceilings against a runaway client. The admin uses the reports as a tool and has none. */
export const MAX_PER_DAY = 20;
export const MAX_PER_USER = 300;
export const MAX_TEXT = 4_000;
/** The copy of a warband that may travel along (its save as JSON text). */
export const MAX_ATTACHMENT = 1_000_000;

const word = (n: number) => z.string().max(n);
const Rules = z.record(z.string().max(48), z.union([z.string().max(80), z.number(), z.boolean()])).refine((o) => Object.keys(o).length <= 80, 'too many house rules');

/** What goes along without the reporter typing it: structure and fixed words (docs/data-model.md "Betrieb"). */
export const ContextBody = z.object({
  /** The screen as a pattern (`/warbands/:id/trade`), never the address with its ids. */
  screen: word(160),
  /** The last steps before, oldest first: where the reporter went, what failed, never what they typed. */
  steps: z.array(z.object({
    at: word(40),
    kind: z.enum(['screen', 'sheet', 'edit', 'sync', 'online', 'api', 'error']),
    what: word(160),
    n: z.number().int().min(1).max(999).default(1),
  }).strict()).max(30).default([]),
  settings: z.object({
    theme: word(24),
    flavour: word(24),
    online: z.boolean(),
    sync: word(100),
    role: word(24).nullable().default(null),
    viewport: word(24),
    installed: z.boolean(),
  }).strict(),
  houseRules: z.object({ warband: Rules.nullable().default(null), campaign: Rules.nullable().default(null) }).strict().default({ warband: null, campaign: null }),
}).strict();
export type Context = z.infer<typeof ContextBody>;

export const JsErrorBody = z.object({ at: word(40), message: word(300), where: word(200).default('') }).strict();

export const ReportBody = z.object({
  /** From the device: a report sent twice is one report. */
  id: z.string().regex(UUID),
  kind: z.enum(KINDS),
  title: z.string().trim().min(1).max(120),
  text: z.string().trim().min(1).max(MAX_TEXT),
  /** A rules issue says where the rule stands (a Mordheimer link, an FAQ page). */
  sourceRef: z.string().trim().max(300).default(''),
  appVersion: word(80).default(''),
  device: word(120).default(''),
  /** The screen as a pattern, for the list. */
  view: word(160).default(''),
  context: ContextBody.nullable().default(null),
  jsErrors: z.array(JsErrorBody).max(5).default([]),
  /** Present only when the reporter ticked it: the warband as it is on their device, and the version it builds on. */
  attach: z.object({
    warbandId: z.string().regex(UUID),
    rev: z.number().int().min(0).nullable().default(null),
    save: z.record(z.string(), z.unknown()),
  }).strict().nullable().default(null),
}).strict();
export type ReportInput = z.infer<typeof ReportBody>;

export const PatchBody = z.object({
  status: z.enum(STATUSES),
  severity: z.enum(SEVERITIES).nullable(),
  area: word(60),
  /** The admin's short heading over the report. */
  headline: word(120),
  kind: z.enum(KINDS),
  /** The version the fix is in (the app's version string). */
  fixedIn: word(80),
}).partial().strict().refine((o) => Object.keys(o).length > 0, 'nothing to change');
export type PatchInput = z.infer<typeof PatchBody>;

interface Row {
  id: string; number: number; reporter_id: string; kind: (typeof KINDS)[number]; title: string; text: string; source_ref: string; severity: (typeof SEVERITIES)[number] | null; area: string; headline: string;
  status: (typeof STATUSES)[number]; app_version: string; device: string; view: string; js_errors: string; context: string | null; warband_id: string | null; rev: number | null;
  consent_attach: 0 | 1; attachment: string | null; fixed_in: string; created_at: string; updated_at: string;
}

/** What the reporter reads of their own report. */
export interface MyBug {
  id: string; kind: Row['kind']; title: string; text: string; sourceRef: string; status: Row['status']; fixedIn: string; createdAt: string; updatedAt: string;
}

/** One line of the admin's list. */
export interface BugSummary {
  id: string; number: number; reporterId: string; reporterName: string; kind: Row['kind']; title: string; status: Row['status']; severity: Row['severity']; area: string; headline: string;
  appVersion: string; view: string; fixedIn: string; consent: boolean; attached: boolean; createdAt: string; updatedAt: string;
}

/** The admin's whole report. */
export interface BugDetail extends BugSummary {
  text: string; sourceRef: string; device: string; jsErrors: unknown[]; context: unknown; warbandId: string | null; rev: number | null; attachment: unknown;
}

export const bugById = (db: DB, id: string) => db.prepare('SELECT * FROM bugs WHERE id = ?').get(id) as Row | undefined;

/** A report by what people say: its number ("7"), or its id from the device. */
export const bugByRef = (db: DB, ref: string): Row | undefined =>
  /^[1-9]\d{0,8}$/.test(ref) ? (db.prepare('SELECT * FROM bugs WHERE number = ?').get(Number(ref)) as Row | undefined) : UUID.test(ref) ? bugById(db, ref.toLowerCase()) : undefined;

const mine = (r: Row): MyBug => ({ id: r.id, kind: r.kind, title: r.title, text: r.text, sourceRef: r.source_ref, status: r.status, fixedIn: r.fixed_in, createdAt: r.created_at, updatedAt: r.updated_at });

const summary = (r: Row, name: string): BugSummary => ({
  id: r.id, number: r.number, reporterId: r.reporter_id, reporterName: name, kind: r.kind, title: r.title, status: r.status, severity: r.severity, area: r.area, headline: r.headline, appVersion: r.app_version, view: r.view,
  fixedIn: r.fixed_in, consent: r.consent_attach === 1, attached: r.attachment !== null, createdAt: r.created_at, updatedAt: r.updated_at,
});

const nameOf = (db: DB, id: string) => (db.prepare('SELECT display_name AS n FROM users WHERE id = ?').get(id) as { n: string } | undefined)?.n ?? '';

const parsed = (text: string | null): unknown => {
  if (text === null) return null;
  try { return JSON.parse(text) as unknown; } catch { return null; }
};

function detail(db: DB, r: Row): BugDetail {
  return {
    ...summary(r, nameOf(db, r.reporter_id)),
    text: r.text, sourceRef: r.source_ref, device: r.device, jsErrors: (parsed(r.js_errors) as unknown[] | null) ?? [], context: parsed(r.context), warbandId: r.warband_id, rev: r.rev,
    attachment: parsed(r.attachment),
  };
}

/** The reporter's own reports, the newest first. */
export function myBugs(db: DB, userId: string): MyBug[] {
  return (db.prepare('SELECT * FROM bugs WHERE reporter_id = ? ORDER BY created_at DESC, id LIMIT 200').all(userId) as Row[]).map(mine);
}

export const oneOfMine = (r: Row): MyBug => mine(r);

export type Report = { ok: true; bug: Row; created: boolean } | { ok: false; status: 400 | 409 | 429; error: string; problem?: string };

/** Takes a report under the device's id; the same id with the same words again is the same report. */
export function reportBug(db: DB, by: string, input: ReportInput, now: Date, unlimited = false): Report {
  return db.transaction((): Report => {
    const id = input.id.toLowerCase();
    const cur = bugById(db, id);
    if (cur) {
      const same = cur.reporter_id === by && cur.kind === input.kind && cur.title === input.title && cur.text === input.text;
      return same ? { ok: true, bug: cur, created: false } : { ok: false, status: 409, error: 'exists' };
    }
    const attachment = input.attach ? JSON.stringify(input.attach.save) : null;
    if (attachment !== null && attachment.length > MAX_ATTACHMENT) return { ok: false, status: 400, error: 'invalid', problem: 'the warband is too large to attach' };
    const since = iso(new Date(now.getTime() - 24 * 3_600_000));
    const day = db.prepare('SELECT count(*) AS n FROM bugs WHERE reporter_id = ? AND created_at > ?').get(by, since) as { n: number };
    const all = db.prepare('SELECT count(*) AS n FROM bugs WHERE reporter_id = ?').get(by) as { n: number };
    if (!unlimited && (day.n >= MAX_PER_DAY || all.n >= MAX_PER_USER)) return { ok: false, status: 429, error: 'too_many' };
    // the next free number: one process writes, and this runs inside the transaction
    db.prepare(`INSERT INTO bugs (id, number, reporter_id, kind, title, text, source_ref, app_version, device, view, js_errors, context, warband_id, rev, consent_attach, attachment, created_at, updated_at)
      VALUES (?, (SELECT COALESCE(MAX(number), 0) + 1 FROM bugs), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, by, input.kind, input.title, input.text, input.sourceRef, input.appVersion, input.device, input.view, JSON.stringify(input.jsErrors),
      input.context ? JSON.stringify(input.context) : null, input.attach?.warbandId.toLowerCase() ?? null, input.attach?.rev ?? null, input.attach ? 1 : 0, attachment, iso(now), iso(now),
    );
    audit(db, { actorId: by, action: 'bug.report', targetType: 'bug', targetId: id, visibility: 'admin', payload: { kind: input.kind, attached: input.attach !== null } }, now);
    return { ok: true, bug: bugById(db, id)!, created: true };
  })();
}

/** The admin's list: the open ones by default, the newest first. */
export function listBugs(db: DB, q: { status: 'open' | 'all' | (typeof STATUSES)[number]; limit: number }): BugSummary[] {
  const where = q.status === 'all' ? '' : q.status === 'open' ? `WHERE b.status IN (${OPEN.map((s) => `'${s}'`).join(', ')})` : `WHERE b.status = '${q.status}'`;
  const rows = db.prepare(`SELECT b.*, u.display_name AS reporter_name FROM bugs b JOIN users u ON u.id = b.reporter_id ${where} ORDER BY b.created_at DESC, b.id LIMIT ?`).all(q.limit) as (Row & { reporter_name: string })[];
  return rows.map((r) => summary(r, r.reporter_name));
}

export function oneBug(db: DB, id: string): BugDetail | null {
  const r = bugById(db, id);
  return r ? detail(db, r) : null;
}

export type Patch = { ok: true; bug: BugDetail } | { ok: false; status: 400 | 404; error: string; problem?: string };

/** The admin sorts a report. A fixed one names its version; one back in work forgets it; a closed one or a duplicate lets go of the warband copy. */
export function patchBug(db: DB, id: string, input: PatchInput, by: string, now: Date, via: 'bug-token' | null = null): Patch {
  return db.transaction((): Patch => {
    const cur = bugById(db, id);
    if (!cur) return { ok: false, status: 404, error: 'not_found' };
    const status = input.status ?? cur.status;
    let fixedIn = input.fixedIn ?? cur.fixed_in;
    if ((OPEN as readonly string[]).includes(status)) fixedIn = '';
    if (status === 'fixed' && !fixedIn.trim()) return { ok: false, status: 400, error: 'invalid', problem: 'a fixed report names the version it is fixed in' };
    const next = {
      status,
      severity: input.severity !== undefined ? input.severity : cur.severity,
      area: input.area ?? cur.area,
      headline: (input.headline ?? cur.headline).trim(),
      kind: input.kind ?? cur.kind,
      fixedIn: fixedIn.trim(),
    };
    const letGo = status === 'closed' || status === 'duplicate';
    const same = next.status === cur.status && next.severity === cur.severity && next.area === cur.area && next.headline === cur.headline && next.kind === cur.kind && next.fixedIn === cur.fixed_in && !(letGo && cur.attachment !== null);
    if (!same) {
      audit(db, { actorId: by, action: 'bug.update', targetType: 'bug', targetId: id, visibility: 'admin', payload: { from: cur.status, status: next.status, severity: next.severity, ...(via ? { via } : {}) } }, now);
      db.prepare('UPDATE bugs SET status = ?, severity = ?, area = ?, headline = ?, kind = ?, fixed_in = ?, attachment = CASE WHEN ? THEN NULL ELSE attachment END, updated_at = ? WHERE id = ?')
        .run(next.status, next.severity, next.area, next.headline, next.kind, next.fixedIn, letGo ? 1 : 0, iso(now), id);
    }
    return { ok: true, bug: detail(db, bugById(db, id)!) };
  })();
}
