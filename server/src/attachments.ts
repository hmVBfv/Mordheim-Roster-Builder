/* Pictures of a campaign in the database and on disk (phase 4a3, part 2;
   concept.md 4.6, docs/security.md "Uploads"). A device announces a picture
   (its id, type, size, where it hangs, who may see it), then sends its
   bytes; both under the device's id, so a picture sent twice is one. The
   bytes are checked by their first bytes, not by what the sender claims,
   and kept under a path made only from the campaign's and the picture's
   ids. What the one who asks may see is decided here: a leaders' picture
   never reaches a player or a viewer, not even its row (ADR 0011). */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { audit } from './accounts.ts';
import { battleById } from './battles.ts';
import type { DB } from './db.ts';

const iso = (d: Date) => d.toISOString();

/** docs/security.md: PNG, JPEG or WebP, at most 5 MB. */
export const MIMES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as const;
export type Mime = keyof typeof MIMES;
export const MAX_BYTES = 5 * 1024 * 1024;
/** What one campaign may keep in pictures, all of them together. */
export const CAMPAIGN_QUOTA = 1024 * 1024 * 1024;

export const AttachmentBody = z.object({
  battleId: z.string().max(64).nullable().default(null),
  turn: z.number().int().min(1).max(99).nullable().default(null),
  mime: z.enum(Object.keys(MIMES) as [Mime, ...Mime[]]),
  bytes: z.number().int().min(1).max(MAX_BYTES),
  width: z.number().int().min(1).max(10_000),
  height: z.number().int().min(1).max(10_000),
  caption: z.string().trim().max(500).default(''),
  visibility: z.enum(['public', 'leader']).default('public'),
}).strict();
export type AttachmentInput = z.infer<typeof AttachmentBody>;

export interface AttachmentRow {
  id: string; campaign_id: string; battle_id: string | null; turn: number | null; uploader_id: string; mime: Mime; bytes: number; width: number; height: number;
  sha256: string | null; caption: string; visibility: 'public' | 'leader'; created_at: string; updated_at: string; stored_at: string | null; deleted_at: string | null; seq: number;
}

/** A picture as its viewers get it: no path, no checksum. */
export interface Attachment {
  id: string; battleId: string | null; turn: number | null; uploaderId: string; uploader: string; mime: Mime; bytes: number; width: number; height: number;
  caption: string; visibility: 'public' | 'leader'; stored: boolean; createdAt: string; updatedAt: string;
}

export interface Viewer { id: string; leader: boolean }

export const attachmentById = (db: DB, id: string) => db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as AttachmentRow | undefined;

/** May this one see it: not taken out; a leaders' picture only for leaders (and whoever sent it). */
export function visibleTo(a: AttachmentRow, v: Viewer): boolean {
  if (a.deleted_at) return false;
  return a.visibility !== 'leader' || v.leader || a.uploader_id === v.id;
}

const SELECT = 'SELECT a.*, u.display_name AS uploader FROM attachments a JOIN users u ON u.id = a.uploader_id';

const view = (a: AttachmentRow & { uploader: string }): Attachment => ({
  id: a.id, battleId: a.battle_id, turn: a.turn, uploaderId: a.uploader_id, uploader: a.uploader, mime: a.mime, bytes: a.bytes, width: a.width, height: a.height,
  caption: a.caption, visibility: a.visibility, stored: !!a.stored_at, createdAt: a.created_at, updatedAt: a.updated_at,
});

/** Every picture of the campaign the viewer may see: those stored, and the viewer's own still waiting for their bytes. */
export function listAttachments(db: DB, campaignId: string, v: Viewer): Attachment[] {
  const rows = db.prepare(`${SELECT} WHERE a.campaign_id = ? AND a.deleted_at IS NULL ORDER BY a.created_at`).all(campaignId) as (AttachmentRow & { uploader: string })[];
  return rows.filter((a) => visibleTo(a, v) && (a.stored_at || a.uploader_id === v.id)).map(view);
}

export function oneAttachment(db: DB, id: string): Attachment | null {
  const a = db.prepare(`${SELECT} WHERE a.id = ?`).get(id) as (AttachmentRow & { uploader: string }) | undefined;
  return a ? view(a) : null;
}

/** The newest change to any picture of the campaign. */
export const attachmentsSeq = (db: DB, campaignId: string) => (db.prepare('SELECT coalesce(max(seq), 0) AS n FROM attachments WHERE campaign_id = ?').get(campaignId) as { n: number }).n;

/** Where its bytes are kept: made from ids only (both checked as UUIDs on the way in). */
export const fileOf = (uploadDir: string, a: Pick<AttachmentRow, 'campaign_id' | 'id' | 'mime'>) => join(uploadDir, a.campaign_id, `${a.id}.${MIMES[a.mime]}`);

export type Put = { ok: true; row: AttachmentRow } | { ok: false; status: 400 | 403 | 409 | 413; error: string; problem?: string };

/** Announces a picture under the device's id, or changes what it says (caption, who may see it, its turn) – its sender only. */
export function putAttachment(db: DB, campaignId: string, id: string, input: AttachmentInput, by: Viewer, now: Date, quota = CAMPAIGN_QUOTA): Put {
  return db.transaction((): Put => {
    const cur = attachmentById(db, id);
    if (cur && (cur.campaign_id !== campaignId || cur.deleted_at)) return { ok: false, status: 409, error: cur.deleted_at ? 'removed' : 'exists' };
    if (input.battleId) {
      const b = battleById(db, input.battleId);
      if (!b || b.campaign_id !== campaignId) return { ok: false, status: 400, error: 'invalid', problem: 'no such battle in this campaign' };
    }
    if (input.visibility === 'leader' && !by.leader) return { ok: false, status: 403, error: 'forbidden' };
    if (!cur) {
      const used = (db.prepare('SELECT coalesce(sum(bytes), 0) AS n FROM attachments WHERE campaign_id = ? AND deleted_at IS NULL').get(campaignId) as { n: number }).n;
      if (used + input.bytes > quota) return { ok: false, status: 413, error: 'quota', problem: 'the campaign has no room for more pictures' };
      const seq = audit(db, { actorId: by.id, action: 'attachment.create', targetType: 'attachment', targetId: id, campaignId, visibility: input.visibility, payload: { battle: input.battleId, mime: input.mime, bytes: input.bytes } }, now);
      db.prepare(`INSERT INTO attachments (id, campaign_id, battle_id, turn, uploader_id, mime, bytes, width, height, caption, visibility, created_at, updated_at, seq)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, campaignId, input.battleId, input.turn, by.id, input.mime, input.bytes, input.width, input.height, input.caption, input.visibility, iso(now), iso(now), seq);
      return { ok: true, row: attachmentById(db, id)! };
    }
    if (cur.uploader_id !== by.id) return { ok: false, status: 403, error: 'forbidden' };
    // the picture itself does not change under its id
    if (cur.mime !== input.mime || cur.bytes !== input.bytes) return { ok: false, status: 409, error: 'exists', problem: 'another picture under this id' };
    const same = cur.caption === input.caption && cur.visibility === input.visibility && cur.battle_id === input.battleId && cur.turn === input.turn;
    if (same) return { ok: true, row: cur };
    const seq = audit(db, { actorId: by.id, action: 'attachment.edit', targetType: 'attachment', targetId: id, campaignId, visibility: input.visibility, payload: { battle: input.battleId } }, now);
    db.prepare('UPDATE attachments SET battle_id = ?, turn = ?, caption = ?, visibility = ?, updated_at = ?, seq = ? WHERE id = ?')
      .run(input.battleId, input.turn, input.caption, input.visibility, iso(now), seq, id);
    return { ok: true, row: attachmentById(db, id)! };
  })();
}

/** The type a file's first bytes show, whatever its sender says. */
export function sniff(b: Buffer): Mime | null {
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export type Stored = { ok: true; row: AttachmentRow } | { ok: false; status: 400 | 403 | 409 | 503; error: string; problem?: string };

/** Keeps the bytes of an announced picture – its sender only; checked against what was announced. Sent again, the same bytes change nothing. */
export function storeFile(db: DB, uploadDir: string, a: AttachmentRow, body: Buffer, contentType: string, by: string, now: Date): Stored {
  if (a.uploader_id !== by) return { ok: false, status: 403, error: 'forbidden' };
  if (a.deleted_at) return { ok: false, status: 409, error: 'removed' };
  const kind = sniff(body);
  if (kind !== a.mime || contentType !== a.mime) return { ok: false, status: 400, error: 'invalid', problem: `not a ${MIMES[a.mime]} picture` };
  if (body.length !== a.bytes && !a.stored_at) return { ok: false, status: 400, error: 'invalid', problem: `${body.length} bytes arrived, ${a.bytes} were announced` };
  const sha = createHash('sha256').update(body).digest('hex');
  if (a.stored_at) return a.sha256 === sha ? { ok: true, row: a } : { ok: false, status: 409, error: 'exists', problem: 'another picture under this id' };
  const file = fileOf(uploadDir, a);
  try {
    mkdirSync(join(uploadDir, a.campaign_id), { recursive: true });
    // written aside first: a half-written file never stands under its name
    writeFileSync(`${file}.part`, body, { mode: 0o640 });
    renameSync(`${file}.part`, file);
  } catch {
    return { ok: false, status: 503, error: 'unavailable', problem: 'the pictures cannot be kept right now' };
  }
  db.transaction(() => {
    const seq = audit(db, { actorId: by, action: 'attachment.store', targetType: 'attachment', targetId: a.id, campaignId: a.campaign_id, visibility: a.visibility, payload: { bytes: body.length } }, now);
    db.prepare('UPDATE attachments SET sha256 = ?, stored_at = ?, updated_at = ?, seq = ? WHERE id = ?').run(sha, iso(now), iso(now), seq, a.id);
  })();
  return { ok: true, row: attachmentById(db, a.id)! };
}

/** Takes a picture out – its sender, or a leader: the row stays as a tombstone, the bytes go. */
export function deleteAttachment(db: DB, uploadDir: string, a: AttachmentRow, by: Viewer, now: Date): 'ok' | 'forbidden' | 'gone' {
  if (a.deleted_at) return 'gone';
  if (a.uploader_id !== by.id && !by.leader) return 'forbidden';
  db.transaction(() => {
    const seq = audit(db, { actorId: by.id, action: a.uploader_id === by.id ? 'attachment.remove' : 'attachment.remove_other', targetType: 'attachment', targetId: a.id, campaignId: a.campaign_id, visibility: a.visibility, payload: { uploader: a.uploader_id } }, now);
    db.prepare('UPDATE attachments SET deleted_at = ?, seq = ? WHERE id = ?').run(iso(now), seq, a.id);
  })();
  const file = fileOf(uploadDir, a);
  if (existsSync(file)) rmSync(file, { force: true });
  return 'ok';
}
