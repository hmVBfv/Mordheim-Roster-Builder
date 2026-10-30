/* Wish #168 (Rob, 30.10.2026): the authenticator is for the admin's things only. Everybody can start and lead a campaign, and use all of it
   – the hidden background included – without one (ADR 0030, which replaces what ADR 0008, 0022 and 0027 said of "leaders with the authenticator"). */
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { startAccounts } from './accounts-helpers.ts';

async function world() {
  const s = await startAccounts();
  const u = { kai: await s.user('kai'), ben: await s.user('ben'), vic: await s.user('vic') };
  const as = (x: { session: () => string }) => {
    const token = x.session();
    return (method: 'GET' | 'PUT' | 'POST' | 'DELETE' | 'PATCH', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'GET' || method === 'DELETE' ? undefined : {}), token });
  };
  return { s, u, kai: as(u.kai), ben: as(u.ben), vic: as(u.vic) };
}

describe('leading without the authenticator', () => {
  it('somebody without one starts a campaign, leads it, adds the others and sets its rules', async () => {
    const { kai, u } = await world();
    const made = await kai('POST', '/campaigns', { name: 'The Hel Fenn Campaign' });
    expect(made.statusCode).toBe(201);
    const id = (made.json() as { campaign: { id: string } }).campaign.id;
    expect((await kai('PUT', `/campaigns/${id}/members/${u.ben.id}`, { role: 'player' })).statusCode).toBe(200);
    expect((await kai('PUT', `/campaigns/${id}/house-rules`, { rules: { freeDagger: true } })).statusCode).toBe(200);
    expect((await kai('PATCH', `/campaigns/${id}`, { name: 'The Hel Fenn' }).then((r) => r.statusCode))).toBe(200);
    const view = (await kai('GET', `/campaigns/${id}`)).json() as { role: string; members: Record<string, unknown>[] };
    expect(view.role).toBe('leader');
    // no member carries a note about the authenticator any more
    expect(JSON.stringify(view)).not.toContain('canLead');
  });

  it('reads and writes the hidden background of the campaign, which a player still cannot', async () => {
    const { kai, ben, u } = await world();
    const id = ((await kai('POST', '/campaigns', { name: 'The Hel Fenn Campaign' })).json() as { campaign: { id: string } }).campaign.id;
    await kai('PUT', `/campaigns/${id}/members/${u.ben.id}`, { role: 'player' });
    const eid = randomUUID();
    const made = await kai('PUT', `/campaigns/${id}/background/${eid}`, { kind: 'thread', title: 'Who pays the ferryman?', truth: 'The widow does.', status: 'active', reveal: 'hint', hintLimits: 'No name.' });
    expect(made.statusCode).toBe(200);
    expect(((await kai('GET', `/campaigns/${id}/background`)).json() as { entries: { truth: string }[] }).entries[0]!.truth).toBe('The widow does.');
    expect((await ben('GET', `/campaigns/${id}/background`)).statusCode).toBe(403);
  });

  it('still keeps the admin\'s things for the admin: the account\'s reports are not a leader\'s', async () => {
    const { kai } = await world();
    expect((await kai('GET', '/bugs')).statusCode).toBe(403);
    expect((await kai('GET', '/admin/users')).statusCode).toBe(403);
  });
});
