/* The campaign's backstory in the database (concept.md 4.10): what happened
   before the campaign came into the app, in sections a leader brought in
   from the group's old chronicle. Every member reads it – it is the story the
   players lived, not a secret; hidden things belong in the background, with
   a rule. A leader with the authenticator replaces it as a whole, from the
   stand the device saw. The log says that it changed and how many sections
   it has, never what it says. */
import { z } from 'zod';
import { audit } from './accounts.ts';
import type { DB } from './db.ts';

export const MAX_SECTIONS = 200;
export const MAX_SECTION_TEXT = 60_000;
export const MAX_BACKSTORY = 400_000;

const Section = z.object({
  heading: z.string().trim().min(1).max(160),
  /** The battle it tells of; empty: the time before the first one (a prologue, the founding). */
  battleNo: z.number().int().min(1).max(999).nullable(),
  text: z.string().max(MAX_SECTION_TEXT),
}).strict();

export const BackstoryBody = z.object({
  sections: z.array(Section).max(MAX_SECTIONS).refine((s) => s.reduce((n, x) => n + x.text.length, 0) <= MAX_BACKSTORY, { message: `more than ${MAX_BACKSTORY} characters` }),
  /** The `seq` the device read; 0 while there is no backstory yet. Another leader got in first: 409 `stale`. */
  baseSeq: z.number().int().min(0).default(0),
}).strict();
export type BackstoryInput = z.infer<typeof BackstoryBody>;

export interface Backstory { sections: z.infer<typeof Section>[]; updatedBy: string | null; updatedAt: string | null; seq: number }
const EMPTY: Backstory = { sections: [], updatedBy: null, updatedAt: null, seq: 0 };

export function getBackstory(db: DB, campaignId: string): Backstory {
  const r = db.prepare('SELECT b.sections, b.updated_at, b.seq, u.display_name AS by FROM backstory b JOIN users u ON u.id = b.updated_by WHERE b.campaign_id = ?')
    .get(campaignId) as { sections: string; updated_at: string; seq: number; by: string } | undefined;
  return r ? { sections: JSON.parse(r.sections) as Backstory['sections'], updatedBy: r.by, updatedAt: r.updated_at, seq: r.seq } : EMPTY;
}

export type Put = { ok: true; backstory: Backstory } | { ok: false; status: 409; error: 'stale'; current: Backstory };

/** Replaces the backstory: made on the first write, replaced after – from the stand the device saw. Writing what is there already changes nothing. */
export function putBackstory(db: DB, campaignId: string, input: BackstoryInput, by: string, now: Date): Put {
  return db.transaction((): Put => {
    const cur = getBackstory(db, campaignId);
    if (cur.seq !== 0 && JSON.stringify(cur.sections) === JSON.stringify(input.sections)) return { ok: true, backstory: cur };
    if (cur.seq !== input.baseSeq) return { ok: false, status: 409, error: 'stale', current: cur };
    const seq = audit(db, { actorId: by, action: 'backstory.edit', targetType: 'campaign', targetId: campaignId, campaignId, visibility: 'public', payload: { sections: input.sections.length } }, now);
    db.prepare(`INSERT INTO backstory (campaign_id, sections, updated_by, updated_at, seq) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (campaign_id) DO UPDATE SET sections = excluded.sections, updated_by = excluded.updated_by, updated_at = excluded.updated_at, seq = excluded.seq`)
      .run(campaignId, JSON.stringify(input.sections), by, now.toISOString(), seq);
    return { ok: true, backstory: getBackstory(db, campaignId) };
  })();
}
