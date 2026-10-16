/* Chapters as drafts (phase 4b5b; concept.md 4.10, ADR 0002, ADR 0011): a
   chapter written from the AI pack comes in as text and stays a draft that
   only the campaign's leaders (with the authenticator) read – for everyone
   else it does not exist, not even as a number. A leader publishes it: its
   language goes into the chapter of the same `ref_key` (a new chapter needs
   its place in the story), and from then on every member reads it. The log
   carries ids and the ref, never the words of a draft. Filtered on the
   server only. */
import { z } from 'zod';
import { audit } from './accounts.ts';
import { chapterById, KINDS, MAX_TEXT, putChapter, type ChapterLang } from './chapters.ts';
import type { DB } from './db.ts';

const iso = (d: Date) => d.toISOString();

/** More than a campaign needs; a ceiling against a runaway client. */
export const MAX_DRAFTS = 100;

export const DraftBody = z.object({
  refKey: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  kind: z.enum(KINDS),
  lang: z.enum(['de', 'en']),
  title: z.string().trim().min(1).max(200),
  label: z.string().max(80).default(''),
  icDate: z.string().max(80).default(''),
  place: z.string().max(200).default(''),
  victor: z.string().max(4000).default(''),
  text: z.string().min(1).max(MAX_TEXT),
  /** The `seq` the device edited from; 0 for a new draft. Another leader got in first: 409 `stale`. */
  baseSeq: z.number().int().min(0).default(0),
}).strict();
export type DraftInput = z.infer<typeof DraftBody>;

export const PublishBody = z.object({
  /** Where a new chapter stands in the story; not needed when the chapter of this ref is there already. */
  at: z.object({ segment: z.string().max(64), pos: z.string().max(64) }).strict().optional(),
  publishedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
}).strict();
export type PublishInput = z.infer<typeof PublishBody>;

interface Row {
  id: string; campaign_id: string; ref_key: string; kind: (typeof KINDS)[number]; lang: 'de' | 'en'; title: string; label: string; ic_date: string; place: string; victor: string;
  text: string; status: 'draft' | 'published'; chapter_id: string | null; created_by: string; updated_by: string; created_at: string; updated_at: string;
  published_at: string | null; deleted_at: string | null; seq: number;
}

export interface Draft {
  id: string; refKey: string; kind: string; lang: 'de' | 'en'; title: string; label: string; icDate: string; place: string; victor: string; text: string;
  createdBy: string; createdAt: string; updatedAt: string; seq: number;
}

export const draftById = (db: DB, id: string) => db.prepare('SELECT * FROM chapter_drafts WHERE id = ?').get(id) as Row | undefined;

const draftOf = (r: Row & { by_name: string }): Draft => ({
  id: r.id, refKey: r.ref_key, kind: r.kind, lang: r.lang, title: r.title, label: r.label, icDate: r.ic_date, place: r.place, victor: r.victor, text: r.text,
  createdBy: r.by_name, createdAt: r.created_at, updatedAt: r.updated_at, seq: r.seq,
});

const SELECT = 'SELECT d.*, u.display_name AS by_name FROM chapter_drafts d JOIN users u ON u.id = d.created_by';

/** The open drafts of the campaign, the latest changed first. Leaders only: the route lets nobody else ask. */
export function listDrafts(db: DB, campaignId: string): Draft[] {
  return (db.prepare(`${SELECT} WHERE d.campaign_id = ? AND d.status = 'draft' AND d.deleted_at IS NULL ORDER BY d.updated_at DESC, d.seq DESC`).all(campaignId) as (Row & { by_name: string })[]).map(draftOf);
}

export function oneDraft(db: DB, id: string): Draft | null {
  const r = db.prepare(`${SELECT} WHERE d.id = ?`).get(id) as (Row & { by_name: string }) | undefined;
  return r && !r.deleted_at && r.status === 'draft' ? draftOf(r) : null;
}

/** The newest change among the campaign's drafts, a removal and a publication included. */
export const draftsSeq = (db: DB, campaignId: string) => (db.prepare('SELECT coalesce(max(seq), 0) AS n FROM chapter_drafts WHERE campaign_id = ?').get(campaignId) as { n: number }).n;

export type Put = { ok: true; row: Row } | { ok: false; status: 400 | 404 | 409; error: string; problem?: string };

const same = (r: Row, i: DraftInput) => r.ref_key === i.refKey && r.kind === i.kind && r.lang === i.lang && r.title === i.title && r.label === i.label
  && r.ic_date === i.icDate && r.place === i.place && r.victor === i.victor && r.text === i.text;

/** Writes a draft under the device's id: made on the first write, changed after – from the stand the device saw. */
export function putDraft(db: DB, campaignId: string, id: string, input: DraftInput, by: string, now: Date): Put {
  return db.transaction((): Put => {
    const cur = draftById(db, id);
    if (cur && cur.campaign_id !== campaignId) return { ok: false, status: 409, error: 'exists' };
    if (cur && (cur.deleted_at || cur.status === 'published')) return { ok: false, status: 409, error: cur.deleted_at ? 'removed' : 'published' };
    if (!cur) {
      const n = (db.prepare("SELECT count(*) AS n FROM chapter_drafts WHERE campaign_id = ? AND status = 'draft' AND deleted_at IS NULL").get(campaignId) as { n: number }).n;
      if (n >= MAX_DRAFTS) return { ok: false, status: 409, error: 'full', problem: `a campaign holds at most ${MAX_DRAFTS} drafts` };
      const seq = audit(db, { actorId: by, action: 'chapter_draft.create', targetType: 'chapter_draft', targetId: id, campaignId, visibility: 'leader', payload: { ref: input.refKey, lang: input.lang } }, now);
      db.prepare(`INSERT INTO chapter_drafts (id, campaign_id, ref_key, kind, lang, title, label, ic_date, place, victor, text, created_by, updated_by, created_at, updated_at, seq)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, campaignId, input.refKey, input.kind, input.lang, input.title, input.label, input.icDate, input.place, input.victor, input.text, by, by, iso(now), iso(now), seq);
      return { ok: true, row: draftById(db, id)! };
    }
    if (same(cur, input)) return { ok: true, row: cur };
    if (cur.seq !== input.baseSeq) return { ok: false, status: 409, error: 'stale' };
    const seq = audit(db, { actorId: by, action: 'chapter_draft.edit', targetType: 'chapter_draft', targetId: id, campaignId, visibility: 'leader', payload: { ref: input.refKey, lang: input.lang } }, now);
    db.prepare('UPDATE chapter_drafts SET ref_key = ?, kind = ?, lang = ?, title = ?, label = ?, ic_date = ?, place = ?, victor = ?, text = ?, updated_by = ?, updated_at = ?, seq = ? WHERE id = ?')
      .run(input.refKey, input.kind, input.lang, input.title, input.label, input.icDate, input.place, input.victor, input.text, by, iso(now), seq, id);
    return { ok: true, row: draftById(db, id)! };
  })();
}

export type Published = { ok: true; chapterId: string } | { ok: false; status: 400 | 404 | 409; error: string; problem?: string };

/** Publishes a draft: its language goes into the chapter of the same ref – the other language stays as it is – or into a new chapter, which needs its place in the story. Published once; the row stays for the log. */
export function publishDraft(db: DB, campaignId: string, id: string, input: PublishInput, by: string, now: Date): Published {
  return db.transaction((): Published => {
    const d = draftById(db, id);
    if (!d || d.campaign_id !== campaignId || d.deleted_at) return { ok: false, status: 404, error: 'not_found' };
    if (d.status === 'published') return { ok: true, chapterId: d.chapter_id! };
    const there = db.prepare('SELECT id FROM chapters WHERE campaign_id = ? AND ref_key = ? AND deleted_at IS NULL').get(campaignId, d.ref_key) as { id: string } | undefined;
    const fields: ChapterLang = { label: d.label, title: d.title, icDate: d.ic_date, place: d.place, victor: d.victor, text: d.text };
    let chapterId: string;
    if (there) {
      const row = chapterById(db, there.id)!;
      const keep = (raw: string | null) => (raw ? JSON.parse(raw) as ChapterLang : null);
      const de = d.lang === 'de' ? fields : keep(row.de);
      const en = d.lang === 'en' ? fields : keep(row.en);
      const r = putChapter(db, campaignId, there.id, { refKey: row.ref_key, kind: row.kind, publishedOn: row.published_on, de, en, ...(input.at ? { place: input.at } : {}) }, by, now);
      if (!r.ok) return { ok: false, status: r.status, error: r.error, ...(r.problem ? { problem: r.problem } : {}) };
      chapterId = there.id;
    } else {
      if (!input.at) return { ok: false, status: 400, error: 'invalid', problem: 'a new chapter needs its place in the story' };
      const r = putChapter(db, campaignId, id, { refKey: d.ref_key, kind: d.kind, publishedOn: input.publishedOn ?? iso(now).slice(0, 10), de: d.lang === 'de' ? fields : null, en: d.lang === 'en' ? fields : null, place: input.at }, by, now);
      if (!r.ok) return { ok: false, status: r.status, error: r.error, ...(r.problem ? { problem: r.problem } : {}) };
      chapterId = id;
    }
    const seq = audit(db, { actorId: by, action: 'chapter_draft.publish', targetType: 'chapter_draft', targetId: id, campaignId, visibility: 'leader', payload: { ref: d.ref_key, lang: d.lang, chapter: chapterId } }, now);
    db.prepare("UPDATE chapter_drafts SET status = 'published', chapter_id = ?, published_at = ?, updated_at = ?, seq = ? WHERE id = ?").run(chapterId, iso(now), iso(now), seq, id);
    return { ok: true, chapterId };
  })();
}

/** Throws a draft away (a tombstone). A published one is part of the story and stays. */
export function discardDraft(db: DB, campaignId: string, id: string, by: string, now: Date): 'ok' | 'gone' | 'unknown' | 'published' {
  return db.transaction(() => {
    const d = draftById(db, id);
    if (!d || d.campaign_id !== campaignId) return 'unknown';
    if (d.status === 'published') return 'published';
    if (d.deleted_at) return 'gone';
    const seq = audit(db, { actorId: by, action: 'chapter_draft.discard', targetType: 'chapter_draft', targetId: id, campaignId, visibility: 'leader' }, now);
    db.prepare('UPDATE chapter_drafts SET deleted_at = ?, updated_at = ?, seq = ? WHERE id = ?').run(iso(now), iso(now), seq, id);
    return 'ok';
  })();
}
