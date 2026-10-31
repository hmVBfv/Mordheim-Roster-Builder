/* Questions to players (phase 4b3): a leader (with the authenticator) asks
   one player; the answer becomes a note of that player's. A question is seen
   by the leaders and by the one it is asked of – nobody else – and its
   words never go into the answer or the log. */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { startAccounts } from './accounts-helpers.ts';

const SAVE = JSON.parse(readFileSync(new URL('../../app/e2e/fixtures/silver-caravan.json', import.meta.url), 'utf8')) as Record<string, unknown>;
const WORDS = 'ZEBRA-QUESTION: what did Robba do the night after the ferry?';
type Question = { id: string; battleId: string | null; askedByName: string; to: string; toName: string; text: string; status: string; answerNoteId: string | null; seq: number };
type Note = { id: string; text?: string; authorId: string; battleId: string | null; visibility: string; sealed?: true };

/** Anna leads (authenticator), Ben leads without one, Kai and Lea play, Vic watches, Rob (admin) is outside; one open battle. */
async function world() {
  const s = await startAccounts();
  const u = { rob: await s.user('rob', { admin: true, totp: true }), anna: await s.user('anna', { totp: true }), ben: await s.user('ben'), kai: await s.user('kai'), lea: await s.user('lea'), vic: await s.user('vic') };
  const as = (x: { session: () => string }) => {
    const token = x.session();
    return (method: 'GET' | 'PUT' | 'POST' | 'DELETE', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'GET' ? undefined : {}), token });
  };
  const anna = as(u.anna), ben = as(u.ben), kai = as(u.kai), lea = as(u.lea), vic = as(u.vic), rob = as(u.rob);
  const id = ((await anna('POST', '/campaigns', { name: 'The Hel Fenn Campaign' })).json() as { campaign: { id: string } }).campaign.id;
  await anna('PUT', `/campaigns/${id}/members/${u.ben.id}`, { role: 'leader' });
  await anna('PUT', `/campaigns/${id}/members/${u.kai.id}`, { role: 'player' });
  await anna('PUT', `/campaigns/${id}/members/${u.lea.id}`, { role: 'player' });
  await anna('PUT', `/campaigns/${id}/members/${u.vic.id}`, { role: 'viewer' });
  const w = randomUUID();
  await anna('POST', `/campaigns/${id}/enrolments`, { warbandId: w, data: SAVE });
  const bid = randomUUID();
  await anna('POST', `/campaigns/${id}/battles`, { id: bid, title: 'Hel Fenn ferry', warbandIds: [w] });
  const qs = `/campaigns/${id}/questions`;
  /** Anna asks Kai; `over` changes the body. */
  const ask = async (over: Record<string, unknown> = {}) => {
    const qid = randomUUID();
    const r = await anna('PUT', `${qs}/${qid}`, { to: u.kai.id, text: WORDS, battleId: bid, ...over });
    return { qid, r, question: (r.json() as { question: Question }).question };
  };
  const list = async (who: typeof anna) => ((await who('GET', qs)).json() as { questions: Question[] }).questions;
  const notes = async (who: typeof anna) => ((await who('GET', `/campaigns/${id}/notes`)).json() as { notes: Note[] }).notes;
  return { s, u, id, bid, anna, ben, kai, lea, vic, rob, qs, ask, list, notes };
}

describe('asking', () => {
  it('only a leader asks; an outsider does not even know the campaign; sent twice, it is one question', async () => {
    const { s, u, anna, kai, lea, vic, rob, qs, ask } = await world();
    const { qid, r, question } = await ask();
    expect(r.statusCode).toBe(200);
    expect(question).toMatchObject({ id: qid, status: 'open', text: WORDS, askedByName: 'anna', toName: 'kai', answerNoteId: null });
    // sent twice (the device could not tell it had arrived): still one
    expect((await anna('PUT', `${qs}/${qid}`, { to: u.kai.id, text: WORDS, battleId: question.battleId })).statusCode).toBe(200);
    expect(s.db.prepare('SELECT count(*) AS n FROM questions').get()).toEqual({ n: 1 });
    for (const who of [kai, lea, vic]) expect((await who('PUT', `${qs}/${randomUUID()}`, { to: u.kai.id, text: 'Me too' })).statusCode).toBe(403);
    expect((await rob('PUT', `${qs}/${randomUUID()}`, { to: u.kai.id, text: 'Me too' })).statusCode).toBe(404);
    expect((await rob('GET', qs)).statusCode).toBe(404);
  });

  it('is asked of a leader or a player of the campaign, about a battle of it; a question is at most 2,000 characters', async () => {
    const { u, id, anna, ask } = await world();
    expect((await ask({ to: u.vic.id })).r.json()).toMatchObject({ error: 'invalid', problem: expect.stringMatching(/leader or a player/) });
    expect((await ask({ to: u.rob.id })).r.statusCode).toBe(400);
    expect((await ask({ to: randomUUID() })).r.statusCode).toBe(400);
    expect((await ask({ battleId: randomUUID() })).r.json()).toMatchObject({ problem: 'no such battle in this campaign' });
    expect((await ask({ text: 'x'.repeat(2_001) })).r.statusCode).toBe(400);
    expect((await ask({ text: '   ' })).r.statusCode).toBe(400);
    expect((await ask({ status: 'answered' })).r.statusCode).toBe(400);
    // a leader may be asked too, and a question needs no battle
    const none = await ask({ to: u.anna.id, battleId: null });
    expect(none.r.statusCode).toBe(200);
    expect(none.question.battleId).toBeNull();
    expect((await anna('GET', `/campaigns/${id}/questions`)).statusCode).toBe(200);
  });
});

describe('who sees a question', () => {
  it('the leaders see every one, the one it is asked of their own, nobody else any', async () => {
    const { u, anna, ben, kai, lea, vic, ask, list } = await world();
    const mine = await ask();
    const leas = await ask({ to: u.lea.id, text: 'Lea’s own question.' });
    expect((await list(anna)).map((q) => q.id).sort()).toEqual([mine.qid, leas.qid].sort());
    expect((await list(kai)).map((q) => q.id)).toEqual([mine.qid]);
    expect((await list(lea)).map((q) => q.id)).toEqual([leas.qid]);
    // a leader without the authenticator is a leader (ADR 0030): he sees every question, as Anna does; a viewer sees none
    expect((await list(ben)).map((q) => q.id)).toEqual((await list(anna)).map((q) => q.id));
    expect(await list(vic)).toEqual([]);
    // the words are in nobody's answer but theirs
    expect(JSON.stringify(await list(lea))).not.toContain('ZEBRA-QUESTION');
  });

  it('a withdrawn question disappears for the one it was asked of, stays for the leaders, and can be asked again', async () => {
    const { u, anna, kai, qs, ask, list } = await world();
    const { qid } = await ask();
    const body = { to: u.kai.id, text: WORDS };
    const back = (await anna('PUT', `${qs}/${qid}`, { ...body, status: 'withdrawn' })).json() as { question: Question };
    expect(back.question.status).toBe('withdrawn');
    expect(await list(kai)).toEqual([]);
    expect((await list(anna)).map((q) => q.status)).toEqual(['withdrawn']);
    // nothing to answer any more
    expect((await kai('POST', `${qs}/${qid}/answer`, { noteId: randomUUID(), text: 'Too late.' })).json()).toEqual({ error: 'withdrawn' });
    expect((await anna('PUT', `${qs}/${qid}`, { ...body, status: 'open' })).statusCode).toBe(200);
    expect((await list(kai)).map((q) => q.status)).toEqual(['open']);
  });

  it('while open its words can change, but it keeps the one it is asked of', async () => {
    const { u, anna, qs, ask, list } = await world();
    const { qid } = await ask();
    const r = await anna('PUT', `${qs}/${qid}`, { to: u.kai.id, text: 'A better question.', battleId: null });
    expect(r.statusCode).toBe(200);
    expect((await list(anna))[0]).toMatchObject({ text: 'A better question.', battleId: null });
    expect((await anna('PUT', `${qs}/${qid}`, { to: u.lea.id, text: 'A better question.' })).json()).toMatchObject({ error: 'invalid', problem: expect.stringMatching(/withdraw it and ask again/) });
  });

  it('the log says that a question was asked – never what it said – and only the leaders’ level', async () => {
    const { s, ask } = await world();
    await ask();
    const rows = s.db.prepare("SELECT action, visibility, payload FROM audit_log WHERE action LIKE 'question.%'").all() as { action: string; visibility: string; payload: string }[];
    expect(rows.map((r) => [r.action, r.visibility])).toEqual([['question.ask', 'leader']]);
    expect(JSON.stringify(rows)).not.toContain('ZEBRA-QUESTION');
  });
});

describe('answering', () => {
  it('the one it is asked of answers with a note of their own; the question is answered with it, once', async () => {
    const { u, bid, anna, kai, qs, ask, list, notes } = await world();
    const { qid } = await ask();
    const noteId = randomUUID();
    const r = await kai('POST', `${qs}/${qid}/answer`, { noteId, text: 'Robba spent it counting what the ferryman had not stolen.' });
    expect(r.statusCode).toBe(200);
    const done = r.json() as { question: Question; note: Note };
    expect(done.question).toMatchObject({ status: 'answered', answerNoteId: noteId });
    expect(done.note).toMatchObject({ id: noteId, authorId: u.kai.id, battleId: bid, visibility: 'public' });
    // the note is the player's words alone
    const note = (await notes(anna)).find((n) => n.id === noteId)!;
    expect(note.text).toBe('Robba spent it counting what the ferryman had not stolen.');
    expect(JSON.stringify(note)).not.toContain('ZEBRA-QUESTION');
    // sent twice: the same answer; another note: refused; the leader cannot change an answered question
    expect((await kai('POST', `${qs}/${qid}/answer`, { noteId, text: 'Robba spent it counting what the ferryman had not stolen.' })).statusCode).toBe(200);
    expect((await kai('POST', `${qs}/${qid}/answer`, { noteId: randomUUID(), text: 'And another thing.' })).json()).toEqual({ error: 'answered' });
    expect((await anna('PUT', `${qs}/${qid}`, { to: u.kai.id, text: 'Changed my mind.' })).json()).toEqual({ error: 'answered' });
    expect((await list(kai)).map((q) => q.status)).toEqual(['answered']);
    const count = (await notes(anna)).filter((n) => n.authorId === u.kai.id).length;
    expect(count).toBe(1);
  });

  it('only the one it is asked of answers: not another player, not a leader, not a viewer, not an outsider', async () => {
    const { anna, ben, lea, vic, rob, qs, ask, notes } = await world();
    const { qid } = await ask();
    const body = () => ({ noteId: randomUUID(), text: 'Not mine to answer.' });
    // for another player it does not exist; a leader (with or without the authenticator, ADR 0030) is told it is not theirs
    expect((await lea('POST', `${qs}/${qid}/answer`, body())).statusCode).toBe(404);
    expect((await ben('POST', `${qs}/${qid}/answer`, body())).statusCode).toBe(403);
    expect((await anna('POST', `${qs}/${qid}/answer`, body())).statusCode).toBe(403);
    expect((await vic('POST', `${qs}/${qid}/answer`, body())).statusCode).toBe(403);
    expect((await rob('POST', `${qs}/${qid}/answer`, body())).statusCode).toBe(404);
    expect((await notes(anna)).length).toBe(0);
    expect((await anna('POST', `${qs}/${randomUUID()}/answer`, body())).statusCode).toBe(404);
  });

  it('the answer may be sealed until the question’s battle is closed – never without a battle – and never leaders-only for a player', async () => {
    const { anna, kai, qs, ask, notes } = await world();
    const open = await ask();
    const sealed = randomUUID();
    const r = await kai('POST', `${qs}/${open.qid}/answer`, { noteId: sealed, text: 'SEALED-ANSWER: he never crossed.', visibility: 'sealed' });
    expect(r.statusCode).toBe(200);
    expect((r.json() as { note: Note }).note).toMatchObject({ visibility: 'sealed' });
    // for the leader it is a placeholder, until the battle is closed
    const seen = (await notes(anna)).find((n) => n.id === sealed)!;
    expect(seen.sealed).toBe(true);
    expect(JSON.stringify(seen)).not.toContain('SEALED-ANSWER');
    // no battle to wait for: refused, and the question stays open
    const bare = await ask({ battleId: null });
    const refused = await kai('POST', `${qs}/${bare.qid}/answer`, { noteId: randomUUID(), text: 'x', visibility: 'sealed' });
    expect(refused.statusCode).toBe(400);
    expect(refused.json()).toMatchObject({ error: 'invalid', problem: expect.stringMatching(/sealed until a battle that is still open/) });
    expect((await kai('POST', `${qs}/${bare.qid}/answer`, { noteId: randomUUID(), text: 'x', visibility: 'leader' })).statusCode).toBe(403);
    expect(((await kai('GET', qs)).json() as { questions: Question[] }).questions.find((q) => q.id === bare.qid)!.status).toBe('open');
  });

  it('an answer that cannot become a note changes nothing', async () => {
    const { s, kai, qs, ask } = await world();
    const { qid } = await ask();
    expect((await kai('POST', `${qs}/${qid}/answer`, { noteId: randomUUID(), text: '' })).statusCode).toBe(400);
    expect((await kai('POST', `${qs}/${qid}/answer`, { noteId: 'not-an-id', text: 'x' })).statusCode).toBe(400);
    expect((await kai('POST', `${qs}/${qid}/answer`, { noteId: randomUUID(), text: 'x', visibility: 'everyone' })).statusCode).toBe(400);
    expect(s.db.prepare("SELECT status FROM questions WHERE id = ?").get(qid)).toEqual({ status: 'open' });
    expect(s.db.prepare('SELECT count(*) AS n FROM notes').get()).toEqual({ n: 0 });
  });
});
