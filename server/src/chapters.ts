/* The published chapters of the chronicle (phase 4a5, part 2; roadmap 4a5):
   a running campaign brings the chapters already written about it, and
   they stand in the timeline at the head of the part of the story they
   tell. Both languages of a chapter live in one row, as the chronicle links
   them by its `ref` (ADR 0013). What is published is public to every
   member (ADR 0002): everyone reads them, a leader imports, places and
   takes them out. A chapter's place is a timeline position like a note's
   (timeline.ts, item type "chapter"). */
import { z } from 'zod';
import { audit } from './accounts.ts';
import type { DB } from './db.ts';
import { checkPlace } from './timeline.ts';

const iso = (d: Date) => d.toISOString();

export const KINDS = ['prologue', 'battle', 'interlude', 'chapter'] as const;
export const MAX_TEXT = 200_000;

const Lang = z.object({
  label: z.string().max(80).default(''),
  title: z.string().trim().min(1).max(200),
  icDate: z.string().max(80).default(''),
  place: z.string().max(200).default(''),
  victor: z.string().max(4000).default(''),
  text: z.string().max(MAX_TEXT),
}).strict();
export type ChapterLang = z.infer<typeof Lang>;

export const ChapterBody = z.object({
  refKey: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  kind: z.enum(KINDS),
  publishedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  de: Lang.nullable().default(null),
  en: Lang.nullable().default(null),
  /** Where it stands in the story; given at the import, kept when it is imported again without one. */
  place: z.object({ segment: z.string().max(64), pos: z.string().max(64) }).strict().optional(),
}).strict().refine((c) => c.de || c.en, { message: 'a chapter needs a language' });
export type ChapterInput = z.infer<typeof ChapterBody>;

interface ChapterRow { id: string; campaign_id: string; ref_key: string; kind: (typeof KINDS)[number]; published_on: string | null; de: string | null; en: string | null; created_at: string; updated_at: string; deleted_at: string | null; seq: number }

/** What the timeline lists of a chapter: everything but its text (that comes when it is read). */
export interface ChapterSummary {
  id: string; refKey: string; kind: string; publishedOn: string | null; createdAt: string; updatedAt: string;
  de: Omit<ChapterLang, 'text'> & { length: number } | null;
  en: Omit<ChapterLang, 'text'> & { length: number } | null;
}
export interface Chapter extends Omit<ChapterSummary, 'de' | 'en'> { de: ChapterLang | null; en: ChapterLang | null }

const lang = (raw: string | null): ChapterLang | null => (raw ? JSON.parse(raw) as ChapterLang : null);
const short = (l: ChapterLang | null) => {
  if (!l) return null;
  const { text, ...rest } = l;
  return { ...rest, length: text.length };
};

export const chapterById = (db: DB, id: string) => db.prepare('SELECT * FROM chapters WHERE id = ?').get(id) as ChapterRow | undefined;

export function chapterOf(r: ChapterRow): Chapter {
  return { id: r.id, refKey: r.ref_key, kind: r.kind, publishedOn: r.published_on, createdAt: r.created_at, updatedAt: r.updated_at, de: lang(r.de), en: lang(r.en) };
}

/** A chapter without its texts (their lengths instead). */
export const summaryOf = (c: Chapter): ChapterSummary => ({ ...c, de: short(c.de), en: short(c.en) });

/** The campaign's chapters, without their texts, in the order they were published. */
export function listChapters(db: DB, campaignId: string): ChapterSummary[] {
  return (db.prepare('SELECT * FROM chapters WHERE campaign_id = ? AND deleted_at IS NULL ORDER BY published_on, created_at').all(campaignId) as ChapterRow[])
    .map((r) => summaryOf(chapterOf(r)));
}

export type PutChapter = { ok: true; chapter: Chapter } | { ok: false; status: 400 | 409; error: string; problem?: string };

/** Imports a chapter, or imports it anew (the same id): its languages, its place in the story. */
export function putChapter(db: DB, campaignId: string, id: string, c: ChapterInput, by: string, now: Date): PutChapter {
  return db.transaction((): PutChapter => {
    const there = chapterById(db, id);
    if (there && (there.campaign_id !== campaignId || there.deleted_at)) return { ok: false, status: 409, error: 'exists' };
    const same = db.prepare('SELECT id FROM chapters WHERE campaign_id = ? AND ref_key = ? AND deleted_at IS NULL').get(campaignId, c.refKey) as { id: string } | undefined;
    if (same && same.id !== id) return { ok: false, status: 409, error: 'exists', problem: `the chapter "${c.refKey}" is there already` };
    if (!there && !c.place) return { ok: false, status: 400, error: 'invalid', problem: 'a new chapter needs its place in the story' };
    if (c.place) {
      const bad = checkPlace(db, campaignId, c.place);
      if (bad) return { ok: false, status: 400, error: 'invalid', problem: bad };
    }
    const de = c.de ? JSON.stringify(c.de) : null, en = c.en ? JSON.stringify(c.en) : null;
    const seq = audit(db, { actorId: by, action: there ? 'chapter.update' : 'chapter.import', targetType: 'chapter', targetId: id, campaignId, visibility: 'public', payload: { ref: c.refKey, kind: c.kind, de: c.de?.title ?? null, en: c.en?.title ?? null } }, now);
    if (there) {
      db.prepare('UPDATE chapters SET ref_key = ?, kind = ?, published_on = ?, de = ?, en = ?, updated_at = ?, seq = ? WHERE id = ?').run(c.refKey, c.kind, c.publishedOn, de, en, iso(now), seq, id);
    } else {
      db.prepare('INSERT INTO chapters (id, campaign_id, ref_key, kind, published_on, de, en, created_by, created_at, updated_at, seq) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, campaignId, c.refKey, c.kind, c.publishedOn, de, en, by, iso(now), iso(now), seq);
    }
    if (c.place) {
      db.prepare(`INSERT INTO timeline_positions (campaign_id, item_type, item_id, segment, pos, moved_by, moved_at, seq) VALUES (?, 'chapter', ?, ?, ?, ?, ?, ?)
        ON CONFLICT (item_type, item_id) DO UPDATE SET segment = excluded.segment, pos = excluded.pos, moved_by = excluded.moved_by, moved_at = excluded.moved_at, seq = excluded.seq`)
        .run(campaignId, id, c.place.segment, c.place.pos, by, iso(now), seq);
    }
    return { ok: true, chapter: chapterOf(chapterById(db, id)!) };
  })();
}

/** Takes a chapter out of the timeline: the row stays for the log, its ref is free for a new import. */
export function removeChapter(db: DB, campaignId: string, id: string, by: string, now: Date): boolean {
  return db.transaction(() => {
    const there = chapterById(db, id);
    if (!there || there.campaign_id !== campaignId || there.deleted_at) return false;
    const seq = audit(db, { actorId: by, action: 'chapter.remove', targetType: 'chapter', targetId: id, campaignId, visibility: 'public', payload: { ref: there.ref_key } }, now);
    db.prepare('UPDATE chapters SET deleted_at = ?, updated_at = ?, seq = ? WHERE id = ?').run(iso(now), iso(now), seq, id);
    db.prepare("DELETE FROM timeline_positions WHERE item_type = 'chapter' AND item_id = ?").run(id);
    return true;
  })();
}
