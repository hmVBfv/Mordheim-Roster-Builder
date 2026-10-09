/* Pictures of a campaign (phase 4a3, part 2; docs/security.md "Uploads"):
   announced, then sent; checked by their first bytes; kept under a path of
   ids; served with a fixed type to who may see them – a leaders' picture
   never to a player, not even its row (ADR 0011). */
import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { startAccounts } from './accounts-helpers.ts';

const SAVE = JSON.parse(readFileSync(new URL('../../app/e2e/fixtures/silver-caravan.json', import.meta.url), 'utf8')) as Record<string, unknown>;
/** A real 1×1 PNG. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const meta = (o: Record<string, unknown> = {}) => ({ mime: 'image/png', bytes: PNG.length, width: 1, height: 1, ...o });

/** Anna leads (authenticator), Kai plays, Vic watches, Rob (admin) is outside; one battle. */
async function world() {
  const s = await startAccounts();
  const u = { rob: await s.user('rob', { admin: true, totp: true }), anna: await s.user('anna', { totp: true }), kai: await s.user('kai'), vic: await s.user('vic') };
  const as = (x: { session: () => string }) => {
    const token = x.session();
    return (method: 'GET' | 'PUT' | 'POST' | 'DELETE', url: string, body?: unknown, headers?: Record<string, string>) =>
      s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'GET' || method === 'DELETE' ? undefined : {}), token, ...(headers ? { headers } : {}) });
  };
  const anna = as(u.anna), kai = as(u.kai), vic = as(u.vic), rob = as(u.rob);
  const id = ((await anna('POST', '/campaigns', { name: 'The Hel Fenn Campaign' })).json() as { campaign: { id: string } }).campaign.id;
  await anna('PUT', `/campaigns/${id}/members/${u.kai.id}`, { role: 'player' });
  await anna('PUT', `/campaigns/${id}/members/${u.vic.id}`, { role: 'viewer' });
  const w = randomUUID();
  await anna('POST', `/campaigns/${id}/enrolments`, { warbandId: w, data: SAVE });
  const bid = randomUUID();
  await anna('POST', `/campaigns/${id}/battles`, { id: bid, title: 'Hel Fenn ferry', warbandIds: [w] });
  const url = (aid: string) => `/campaigns/${id}/attachments/${aid}`;
  const send = (who: typeof kai, aid: string, bytes: Buffer = PNG, type = 'image/png') => who('PUT', `${url(aid)}/file`, bytes, { 'content-type': type });
  const list = async (who: typeof kai) => ((await who('GET', `/campaigns/${id}/attachments`)).json() as { attachments: { id: string; caption: string; stored: boolean; visibility: string }[] }).attachments;
  return { s, id, bid, anna, kai, vic, rob, url, send, list };
}

describe('a picture', () => {
  it('announced, then its bytes: every member sees it; it comes back as it went, with a fixed type', async () => {
    const { s, id, bid, kai, vic, rob, url, send, list } = await world();
    const aid = randomUUID();
    expect((await kai('PUT', url(aid), meta({ battleId: bid, turn: 3, caption: 'The ferry burns.' }))).json()).toMatchObject({ attachment: { id: aid, stored: false, uploader: 'kai', caption: 'The ferry burns.' } });
    // waiting for its bytes: only its sender sees it
    expect(await list(vic)).toEqual([]);
    expect((await send(kai, aid)).json()).toMatchObject({ attachment: { stored: true } });
    // sent twice: one picture
    expect((await send(kai, aid)).statusCode).toBe(200);
    await kai('PUT', url(aid), meta({ battleId: bid, turn: 3, caption: 'The ferry burns.' }));
    expect(await list(vic)).toMatchObject([{ id: aid, stored: true, caption: 'The ferry burns.', visibility: 'public' }]);
    const file = await vic('GET', `${url(aid)}/file`);
    expect(file.statusCode).toBe(200);
    expect(file.rawPayload.equals(PNG)).toBe(true);
    expect(file.headers).toMatchObject({ 'content-type': 'image/png', 'x-content-type-options': 'nosniff', 'cache-control': 'private, max-age=31536000, immutable' });
    expect(String(file.headers['content-security-policy'])).toContain('sandbox');
    // kept under ids only
    expect(readdirSync(join(s.data, 'uploads', id))).toEqual([`${aid}.png`]);
    // a viewer sends none; outside the campaign there is none
    expect((await vic('PUT', url(randomUUID()), meta())).json()).toEqual({ error: 'forbidden' });
    expect((await rob('GET', `${url(aid)}/file`)).statusCode).toBe(404);
    expect((await rob('GET', `/campaigns/${id}/attachments`)).statusCode).toBe(404);
  });

  it('its bytes are checked: the type by the first bytes, the size as announced, 5 MB at most; another’s picture takes none', async () => {
    const { anna, kai, url, send } = await world();
    const aid = randomUUID();
    await kai('PUT', url(aid), meta());
    expect((await send(kai, aid, Buffer.from('<svg onload=alert(1)>…'), 'image/png')).json()).toMatchObject({ error: 'invalid' });
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(PNG.length - 4)]);
    expect((await send(kai, aid, jpeg, 'image/jpeg')).json()).toMatchObject({ error: 'invalid' });
    expect((await send(kai, aid, Buffer.concat([PNG, Buffer.from([0])]))).json()).toMatchObject({ error: 'invalid', problem: expect.stringMatching(/announced/) });
    expect((await send(anna, aid)).statusCode).toBe(403);
    expect((await send(kai, aid, Buffer.alloc(5 * 1024 * 1024 + 1))).statusCode).toBe(413);
    expect((await send(kai, aid, PNG, 'text/html')).statusCode).toBe(415);
    for (const bad of [meta({ mime: 'image/svg+xml' }), meta({ bytes: 5 * 1024 * 1024 + 1 }), meta({ path: '../../etc' }), meta({ caption: 'x'.repeat(501) })]) {
      expect((await kai('PUT', url(randomUUID()), bad)).statusCode).toBe(400);
    }
    expect((await kai('PUT', url('not-a-device-id'), meta())).statusCode).toBe(400);
    expect((await kai('PUT', url('..%2F..%2Fescape'), meta())).statusCode).toBe(400);
    // the picture under an id does not change
    expect((await send(kai, aid)).statusCode).toBe(200);
    expect((await kai('PUT', url(aid), meta({ bytes: 99 }))).json()).toMatchObject({ error: 'exists' });
  });

  it('a leaders’ picture: neither its row nor its bytes reach a player or a viewer', async () => {
    const { anna, kai, vic, url, send, list } = await world();
    const aid = randomUUID();
    await anna('PUT', url(aid), meta({ caption: 'LEADER-SECRET: the Countess’s seal.', visibility: 'leader' }));
    await send(anna, aid);
    expect(await list(anna)).toMatchObject([{ id: aid, visibility: 'leader' }]);
    for (const who of [kai, vic]) {
      expect(await list(who)).toEqual([]);
      expect((await who('GET', `${url(aid)}/file`)).statusCode).toBe(404);
    }
    expect((await kai('PUT', url(randomUUID()), meta({ visibility: 'leader' }))).json()).toEqual({ error: 'forbidden' });
  });

  it('taken out by its sender or a leader: the bytes go; nobody else takes it out', async () => {
    const { s, id, anna, kai, url, send, list } = await world();
    const mine = randomUUID(), theirs = randomUUID();
    for (const [who, aid] of [[kai, mine], [anna, theirs]] as const) { await who('PUT', url(aid), meta()); await send(who, aid); }
    expect((await kai('DELETE', url(theirs))).json()).toEqual({ error: 'forbidden' });
    expect((await kai('DELETE', url(mine))).json()).toMatchObject({ removed: true });
    expect(existsSync(join(s.data, 'uploads', id, `${mine}.png`))).toBe(false);
    expect((await kai('GET', `${url(mine)}/file`)).statusCode).toBe(404);
    expect((await kai('PUT', url(mine), meta())).json()).toEqual({ error: 'removed' });
    expect((await anna('DELETE', url(theirs))).statusCode).toBe(200);
    expect(await list(anna)).toEqual([]);
  });

  it('a device that has seen them asks only for news', async () => {
    const { kai, vic, id, url, send } = await world();
    const { seq } = (await vic('GET', `/campaigns/${id}/attachments`)).json() as { seq: number };
    expect((await vic('GET', `/campaigns/${id}/attachments?since=${seq}`)).json()).toEqual({ unchanged: true, seq });
    const aid = randomUUID();
    await kai('PUT', url(aid), meta());
    await send(kai, aid);
    expect((await vic('GET', `/campaigns/${id}/attachments?since=${seq}`)).json()).toMatchObject({ attachments: [{ id: aid }] });
  });
});
