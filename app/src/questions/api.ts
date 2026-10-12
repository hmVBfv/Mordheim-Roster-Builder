/* A campaign's questions to players on the server (phase 4b3a; server/src/
   routes-questions.ts): a leader asks one player, who answers with a note.
   The last list is kept on the device (under the account's own key, like the
   notes), so what is open still shows without a connection; asking and
   answering need the connection. What the server sends is already filtered:
   a leader gets every question, anyone else only those asked of them. */
import { api } from '../account/api.ts';
import { asker, ownKey } from '../account/owner.ts';
import { db } from '../db/db.ts';

export type Status = 'open' | 'answered' | 'withdrawn';
export interface Question {
  id: string; battleId: string | null; askedBy: string; askedByName: string; to: string; toName: string; text: string;
  status: Status; answerNoteId: string | null; createdAt: string; updatedAt: string; answeredAt: string | null; seq: number;
}
export interface Kept { questions: Question[]; seq: number }
export const MAX_QUESTION = 2000;
export const STATUS_NAMES: Record<Status, string> = { open: 'Open', answered: 'Answered', withdrawn: 'Withdrawn' };

const key = (cid: string) => ownKey('questions:', cid);

export async function cachedQuestions(cid: string): Promise<Kept | null> {
  return ((await db.meta.get(key(cid)))?.value as Kept | undefined) ?? null;
}

export async function getQuestions(cid: string): Promise<Kept> {
  const who = asker();
  const r = await api<Kept>(`/campaigns/${cid}/questions`);
  await who.keep('questions:', cid, r);
  return r;
}

export interface QuestionBody { to: string; text: string; battleId: string | null; status: 'open' | 'withdrawn' }
export const putQuestion = (cid: string, id: string, body: QuestionBody) =>
  api<{ question: Question; seq: number }>(`/campaigns/${cid}/questions/${id}`, { method: 'PUT', body });

export interface AnswerBody { noteId: string; text: string; visibility: 'public' | 'sealed' | 'leader' }
export const answerQuestion = (cid: string, id: string, body: AnswerBody) =>
  api<{ question: Question; note: unknown; seq: number }>(`/campaigns/${cid}/questions/${id}/answer`, { body });

/** The questions asked of this user that are still waiting. */
export const openFor = (qs: Question[], me: string) => qs.filter((q) => q.to === me && q.status === 'open');
