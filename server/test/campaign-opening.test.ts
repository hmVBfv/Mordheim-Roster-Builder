/* Wish #169 (Rob, 30.10.2026): the opening scene of a campaign's place. A leader writes it, or leaves it empty so that the app shows the
   Lore's description of the place; every member of the campaign reads what is written. */
import { describe, expect, it } from 'vitest';
import { startAccounts } from './accounts-helpers.ts';

type View = { campaign: { id: string; opening: string } };

async function world() {
  const s = await startAccounts();
  const u = { anna: await s.user('anna', { totp: true }), kai: await s.user('kai'), vic: await s.user('vic'), out: await s.user('out') };
  const as = (x: { session: () => string }) => {
    const token = x.session();
    return (method: 'GET' | 'PUT' | 'POST', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'GET' ? undefined : {}), token });
  };
  const anna = as(u.anna), kai = as(u.kai), vic = as(u.vic), out = as(u.out);
  const id = ((await anna('POST', '/campaigns', { name: 'The Hel Fenn Campaign' })).json() as View).campaign.id;
  await anna('PUT', `/campaigns/${id}/members/${u.kai.id}`, { role: 'player' });
  await anna('PUT', `/campaigns/${id}/members/${u.vic.id}`, { role: 'viewer' });
  return { s, id, anna, kai, vic, out };
}

describe('the opening scene of a campaign', () => {
  it('is empty at first; a leader writes it and every member reads it, an outsider does not even know the campaign', async () => {
    const { id, anna, kai, vic, out } = await world();
    expect(((await anna('GET', `/campaigns/${id}`)).json() as View).campaign.opening).toBe('');
    const w = await anna('PUT', `/campaigns/${id}/opening`, { text: '  Rain over the Stir.  ' });
    expect(w.statusCode).toBe(200);
    expect((w.json() as View).campaign.opening).toBe('Rain over the Stir.');
    for (const who of [anna, kai, vic]) expect(((await who('GET', `/campaigns/${id}`)).json() as View).campaign.opening).toBe('Rain over the Stir.');
    expect((await out('GET', `/campaigns/${id}`)).statusCode).toBe(404);
  });

  it('is written by a leader only: a player and a viewer get a 403, an outsider a 404', async () => {
    const { id, kai, vic, out, anna } = await world();
    for (const who of [kai, vic]) expect((await who('PUT', `/campaigns/${id}/opening`, { text: 'Me too' })).statusCode).toBe(403);
    expect((await out('PUT', `/campaigns/${id}/opening`, { text: 'Me too' })).statusCode).toBe(404);
    expect(((await anna('GET', `/campaigns/${id}`)).json() as View).campaign.opening).toBe('');
  });

  it('can be emptied again, which brings back the Lore\'s text; and is no longer than a page', async () => {
    const { id, anna } = await world();
    await anna('PUT', `/campaigns/${id}/opening`, { text: 'Rain over the Stir.' });
    expect(((await anna('PUT', `/campaigns/${id}/opening`, { text: '   ' })).json() as View).campaign.opening).toBe('');
    expect((await anna('PUT', `/campaigns/${id}/opening`, { text: 'x'.repeat(4001) })).statusCode).toBe(400);
    expect((await anna('PUT', `/campaigns/${id}/opening`, { text: 'x'.repeat(4000) })).statusCode).toBe(200);
  });
});
