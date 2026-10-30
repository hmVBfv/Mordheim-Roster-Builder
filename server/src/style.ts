/* The campaign's style guide in the database (phase 4b4a; concept.md 4.10):
   one text the AI pack hands to whoever writes the chapter. Leaders' own –
   read and written by the campaign's leaders; for
   everyone else it does not exist. The log says that it changed, never what
   it says. */
import { z } from 'zod';
import { audit } from './accounts.ts';
import type { DB } from './db.ts';

export const MAX_STYLE = 10_000;

export const StyleBody = z.object({
  text: z.string().max(MAX_STYLE),
  /** The `seq` the device edited from; 0 while there is no style yet. Another leader got in first: 409 `stale`. */
  baseSeq: z.number().int().min(0).default(0),
}).strict();
export type StyleInput = z.infer<typeof StyleBody>;

interface Row { text: string; updated_by: string; updated_at: string; seq: number }
export interface Style { text: string; updatedBy: string | null; updatedAt: string | null; seq: number }

const EMPTY: Style = { text: '', updatedBy: null, updatedAt: null, seq: 0 };

export function getStyle(db: DB, campaignId: string): Style {
  const r = db.prepare("SELECT d.text, d.updated_at, d.seq, u.display_name AS by FROM campaign_docs d JOIN users u ON u.id = d.updated_by WHERE d.campaign_id = ? AND d.kind = 'style'")
    .get(campaignId) as (Omit<Row, 'updated_by'> & { by: string }) | undefined;
  return r ? { text: r.text, updatedBy: r.by, updatedAt: r.updated_at, seq: r.seq } : EMPTY;
}

export type Put = { ok: true; style: Style } | { ok: false; status: 409; error: 'stale'; current: Style };

/** Writes the style guide: made on the first write, changed after – from the stand the device saw. Writing what is there already changes nothing. */
export function putStyle(db: DB, campaignId: string, input: StyleInput, by: string, now: Date): Put {
  return db.transaction((): Put => {
    const cur = getStyle(db, campaignId);
    if (cur.text === input.text && cur.seq !== 0) return { ok: true, style: cur };
    if (cur.seq !== input.baseSeq) return { ok: false, status: 409, error: 'stale', current: cur };
    const seq = audit(db, { actorId: by, action: 'style.edit', targetType: 'campaign', targetId: campaignId, campaignId, visibility: 'leader' }, now);
    db.prepare(`INSERT INTO campaign_docs (campaign_id, kind, text, updated_by, updated_at, seq) VALUES (?, 'style', ?, ?, ?, ?)
      ON CONFLICT (campaign_id, kind) DO UPDATE SET text = excluded.text, updated_by = excluded.updated_by, updated_at = excluded.updated_at, seq = excluded.seq`)
      .run(campaignId, input.text, by, now.toISOString(), seq);
    return { ok: true, style: getStyle(db, campaignId) };
  })();
}
