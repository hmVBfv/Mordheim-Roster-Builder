/* Questions to players in the database (phase 4b3; concept.md 4.6, ADR 0011):
   a leader asks one player of the campaign a pointed question; the answer
   becomes a note of that player's, with the visibility they choose.

   Who sees a question is decided here, for the one who asks: the campaign's
   leaders see all of them, the one it is asked of sees their own (not one a
   leader has withdrawn), nobody else sees any. The question's words never go
   into the answer's note – only the player's own words do – and the log
   carries only that something happened (visibility "leader"). Filtered on the
   server only. */
import { z } from 'zod';
import { audit } from './accounts.ts';
import { battleById } from './battles.ts';
import { roleIn } from './campaigns.ts';
import type { DB } from './db.ts';
import { KINDS, putNote, VISIBILITIES } from './notes.ts';

const iso = (d: Date) => d.toISOString();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** More than a campaign needs; a ceiling against a runaway client. */
export const MAX_QUESTIONS = 500;
export const MAX_QUESTION_TEXT = 2_000;

export const QuestionBody = z.object({
  /** The user it is asked of: a leader or player of the campaign. */
  to: z.string().max(64),
  text: z.string().trim().min(1).max(MAX_QUESTION_TEXT),
  battleId: z.string().max(64).nullable().default(null),
  /** Withdrawing is a change of status; an answered question stays as it is. */
  status: z.enum(['open', 'withdrawn']).default('open'),
}).strict();
export type QuestionInput = z.infer<typeof QuestionBody>;

/** The answer: a note of the answering player's, under the device's id. */
export const AnswerBody = z.object({
  noteId: z.string().regex(UUID),
  text: z.string().trim().min(1).max(20_000),
  lang: z.enum(['', 'de', 'en']).default(''),
  kind: z.enum(KINDS).default('general'),
  visibility: z.enum(VISIBILITIES).default('public'),
}).strict();
export type AnswerInput = z.infer<typeof AnswerBody>;

export interface QuestionRow {
  id: string; campaign_id: string; battle_id: string | null; asked_by: string; to_user_id: string; text: string;
  status: 'open' | 'answered' | 'withdrawn'; answer_note_id: string | null; created_at: string; updated_at: string; answered_at: string | null; seq: number;
}

export interface Question {
  id: string; battleId: string | null; askedBy: string; askedByName: string; to: string; toName: string; text: string;
  status: QuestionRow['status']; answerNoteId: string | null; createdAt: string; updatedAt: string; answeredAt: string | null; seq: number;
}

export interface Viewer { id: string; leader: boolean }

export const questionById = (db: DB, id: string) => db.prepare('SELECT * FROM questions WHERE id = ?').get(id) as QuestionRow | undefined;

const SELECT = `SELECT q.*, a.display_name AS asked_by_name, t.display_name AS to_name
  FROM questions q JOIN users a ON a.id = q.asked_by JOIN users t ON t.id = q.to_user_id`;
type Joined = QuestionRow & { asked_by_name: string; to_name: string };

/** A question as the one who asks may see it: a leader sees every one, the one it is asked of their own – a withdrawn one no more. */
function shown(q: Joined, v: Viewer): Question | null {
  if (!v.leader && (q.to_user_id !== v.id || q.status === 'withdrawn')) return null;
  return {
    id: q.id, battleId: q.battle_id, askedBy: q.asked_by, askedByName: q.asked_by_name, to: q.to_user_id, toName: q.to_name, text: q.text,
    status: q.status, answerNoteId: q.answer_note_id, createdAt: q.created_at, updatedAt: q.updated_at, answeredAt: q.answered_at, seq: q.seq,
  };
}

/** The questions the viewer may see, the open ones first, the newest first within each kind. */
export function listQuestions(db: DB, campaignId: string, v: Viewer): Question[] {
  const rows = db.prepare(`${SELECT} WHERE q.campaign_id = ? AND (? = 1 OR (q.to_user_id = ? AND q.status != 'withdrawn')) ORDER BY q.created_at DESC`)
    .all(campaignId, v.leader ? 1 : 0, v.id) as Joined[];
  const out = rows.map((q) => shown(q, v)).filter((q): q is Question => q !== null);
  const rank = { open: 0, answered: 1, withdrawn: 2 } as const;
  return out.map((q, i) => ({ q, i })).sort((a, b) => rank[a.q.status] - rank[b.q.status] || a.i - b.i).map((x) => x.q);
}

export function oneQuestion(db: DB, id: string, v: Viewer): Question | null {
  const q = db.prepare(`${SELECT} WHERE q.id = ?`).get(id) as Joined | undefined;
  return q ? shown(q, v) : null;
}

/** The newest change among the questions this viewer may see: a leader's number moves with all of them, a player's with their own only. */
export const questionsSeq = (db: DB, campaignId: string, v: Viewer) => (db.prepare(
  "SELECT coalesce(max(seq), 0) AS n FROM questions WHERE campaign_id = ? AND (? = 1 OR (to_user_id = ? AND status != 'withdrawn'))",
).get(campaignId, v.leader ? 1 : 0, v.id) as { n: number }).n;

export type PutQuestion = { ok: true; question: QuestionRow } | { ok: false; status: 400 | 409; error: string; problem?: string };

/** Asks a question under the device's id, or changes it while it is open (its words, its battle, withdrawing it – or asking it again). */
export function putQuestion(db: DB, campaignId: string, id: string, input: QuestionInput, by: { id: string }, now: Date): PutQuestion {
  return db.transaction((): PutQuestion => {
    const cur = questionById(db, id);
    if (cur && cur.campaign_id !== campaignId) return { ok: false, status: 409, error: 'exists' };
    const role = roleIn(db, campaignId, input.to);
    if (role !== 'leader' && role !== 'player') return { ok: false, status: 400, error: 'invalid', problem: 'a question is asked of a leader or a player of this campaign' };
    const battle = input.battleId ? battleById(db, input.battleId) : undefined;
    if (input.battleId && (!battle || battle.campaign_id !== campaignId)) return { ok: false, status: 400, error: 'invalid', problem: 'no such battle in this campaign' };
    if (!cur) {
      if (input.status !== 'open') return { ok: false, status: 400, error: 'invalid', problem: 'a question is asked open' };
      const n = db.prepare('SELECT count(*) AS n FROM questions WHERE campaign_id = ?').get(campaignId) as { n: number };
      if (n.n >= MAX_QUESTIONS) return { ok: false, status: 400, error: 'invalid', problem: `a campaign holds at most ${MAX_QUESTIONS} questions` };
      const seq = audit(db, { actorId: by.id, action: 'question.ask', targetType: 'question', targetId: id, campaignId, visibility: 'leader', payload: { to: input.to, battle: input.battleId } }, now);
      db.prepare(`INSERT INTO questions (id, campaign_id, battle_id, asked_by, to_user_id, text, status, created_at, updated_at, seq) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`)
        .run(id, campaignId, input.battleId, by.id, input.to, input.text, iso(now), iso(now), seq);
      return { ok: true, question: questionById(db, id)! };
    }
    if (cur.status === 'answered') return { ok: false, status: 409, error: 'answered' };
    if (input.to !== cur.to_user_id) return { ok: false, status: 400, error: 'invalid', problem: 'a question keeps the one it is asked of: withdraw it and ask again' };
    if (cur.text === input.text && cur.battle_id === input.battleId && cur.status === input.status) return { ok: true, question: cur };
    const action = input.status === cur.status ? 'question.edit' : input.status === 'withdrawn' ? 'question.withdraw' : 'question.reopen';
    const seq = audit(db, { actorId: by.id, action, targetType: 'question', targetId: id, campaignId, visibility: 'leader', payload: { to: cur.to_user_id } }, now);
    db.prepare('UPDATE questions SET battle_id = ?, text = ?, status = ?, updated_at = ?, seq = ? WHERE id = ?').run(input.battleId, input.text, input.status, iso(now), seq, id);
    return { ok: true, question: questionById(db, id)! };
  })();
}

export type Answer = { ok: true; question: QuestionRow; noteId: string } | { ok: false; status: 400 | 403 | 404 | 409; error: string; problem?: string };

/** The one it is asked of answers: the note is made (their words, their visibility, hung on the question's battle) and the question is answered with it – in one step, or not at all. */
export function answerQuestion(db: DB, campaignId: string, id: string, input: AnswerInput, by: { id: string; leader: boolean }, now: Date): Answer {
  return db.transaction((): Answer => {
    const q = questionById(db, id);
    if (!q || q.campaign_id !== campaignId) return { ok: false, status: 404, error: 'not_found' };
    // a leader sees every question, but only the one it is asked of may answer; for anyone else it does not exist
    if (q.to_user_id !== by.id) return by.leader ? { ok: false, status: 403, error: 'forbidden' } : { ok: false, status: 404, error: 'not_found' };
    if (q.status === 'withdrawn') return { ok: false, status: 409, error: 'withdrawn' };
    const noteId = input.noteId.toLowerCase();
    if (q.status === 'answered') return q.answer_note_id === noteId ? { ok: true, question: q, noteId } : { ok: false, status: 409, error: 'answered' };
    const r = putNote(db, campaignId, noteId, {
      battleId: q.battle_id, turn: null, kind: input.kind, text: input.text, lang: input.lang, visibility: input.visibility, mentions: [], protocolEntryId: null,
    }, by, now);
    if (!r.ok) return { ok: false, status: r.status === 403 ? 403 : r.status === 409 ? 409 : 400, error: r.error, ...(r.problem ? { problem: r.problem } : {}) };
    const seq = audit(db, { actorId: by.id, action: 'question.answer', targetType: 'question', targetId: id, campaignId, visibility: 'leader', payload: { note: noteId } }, now);
    db.prepare("UPDATE questions SET status = 'answered', answer_note_id = ?, answered_at = ?, updated_at = ?, seq = ? WHERE id = ?").run(noteId, iso(now), iso(now), seq, id);
    return { ok: true, question: questionById(db, id)!, noteId };
  })();
}
