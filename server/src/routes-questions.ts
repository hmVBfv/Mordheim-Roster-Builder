/* Questions to players (phase 4b3; docs/architecture.md "Endpunkte"): a
   leader asks, the one it is asked of answers with a note. Every member may
   read – what each sees is decided in questions.ts for the one who asks
   (ADR 0011); asking and changing is for leaders (with the authenticator),
   answering for the one it is asked of. Every route names its action, `can()`
   decides before the handler runs. */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { campaignById, roleIn, type CampaignRole, type CampaignRow } from './campaigns.ts';
import type { DB } from './db.ts';
import { oneNote } from './notes.ts';
import { can, type Action, type Actor } from './policy.ts';
import { AnswerBody, answerQuestion, listQuestions, oneQuestion, putQuestion, QuestionBody, questionsSeq } from './questions.ts';

export interface QuestionDeps { db: DB | null; now: () => Date }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const problem = (error: { issues: { path: PropertyKey[]; message: string }[] }, what: string) =>
  `not ${what} (${error.issues.slice(0, 2).map((i) => `${i.path.join('.') || '(top)'}: ${i.message}`).join('; ')})`;

export function registerQuestionRoutes(app: FastifyInstance, deps: QuestionDeps): void {
  const db = () => deps.db as DB;

  const target = (req: FastifyRequest, reply: FastifyReply, action: Action): { c: CampaignRow; role: CampaignRole } | null => {
    const c = campaignById(db(), (req.params as { id: string }).id);
    const role = c ? roleIn(db(), c.id, req.actor!.id) : null;
    if (!c || !role) {
      void reply.code(404).send({ error: 'not_found' });
      return null;
    }
    if (!can(req.actor, action, { role })) {
      void reply.code(403).send({ error: 'forbidden' });
      return null;
    }
    return { c, role };
  };
  /** Leaders see every question – with the authenticator, like everything a leader does. */
  const viewer = (a: Actor, role: CampaignRole) => ({ id: a.id, leader: can(a, 'campaign.manage', { role }) });

  app.get('/api/v1/campaigns/:id/questions', { config: { action: 'questions.read' } }, async (req, reply) => {
    const t = target(req, reply, 'questions.read');
    if (!t) return reply;
    const v = viewer(req.actor!, t.role);
    return { questions: listQuestions(db(), t.c.id, v), seq: questionsSeq(db(), t.c.id, v) };
  });

  app.put('/api/v1/campaigns/:id/questions/:qid', { config: { action: 'questions.write' }, schema: { body: { type: 'object' } } }, async (req, reply) => {
    const t = target(req, reply, 'questions.write');
    if (!t) return reply;
    const qid = (req.params as { qid: string }).qid.toLowerCase();
    if (!UUID.test(qid)) return reply.code(400).send({ error: 'invalid', problem: 'a question is named by its device id' });
    const parsed = QuestionBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid', problem: problem(parsed.error, 'a question') });
    const r = putQuestion(db(), t.c.id, qid, { ...parsed.data, battleId: parsed.data.battleId?.toLowerCase() ?? null }, { id: req.actor!.id }, deps.now());
    if (!r.ok) return reply.code(r.status).send({ error: r.error, ...(r.problem ? { problem: r.problem } : {}) });
    const v = viewer(req.actor!, t.role);
    return { question: oneQuestion(db(), qid, v), seq: questionsSeq(db(), t.c.id, v) };
  });

  /** Answers: the note is made and the question answered with it, in one step. */
  app.post('/api/v1/campaigns/:id/questions/:qid/answer', { config: { action: 'questions.answer' }, schema: { body: { type: 'object' } } }, async (req, reply) => {
    const t = target(req, reply, 'questions.answer');
    if (!t) return reply;
    const parsed = AnswerBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid', problem: problem(parsed.error, 'an answer') });
    const v = viewer(req.actor!, t.role);
    const r = answerQuestion(db(), t.c.id, (req.params as { qid: string }).qid.toLowerCase(), parsed.data, v, deps.now());
    if (!r.ok) return reply.code(r.status).send({ error: r.error, ...(r.problem ? { problem: r.problem } : {}) });
    return { question: oneQuestion(db(), r.question.id, v), note: oneNote(db(), r.noteId, v), seq: questionsSeq(db(), t.c.id, v) };
  });
}
