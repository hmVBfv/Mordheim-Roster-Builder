/* Names that stand for one thing are not given twice (report #65, Rob, 24.10.2026): a campaign's name among one's own campaigns,
   and inside a campaign its battles, scenarios, factions, NPCs and background entries. The same thing written again under its own
   id is no clash. */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { startAccounts } from './accounts-helpers.ts';

const SAVE = JSON.parse(readFileSync(new URL('../../app/e2e/fixtures/silver-caravan.json', import.meta.url), 'utf8')) as Record<string, unknown>;

async function table() {
  const s = await startAccounts();
  const anna = await s.user('anna', { totp: true });
  const ben = await s.user('ben', { totp: true });
  const as = (x: { session: () => string }) => {
    const token = x.session();
    return (method: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE', url: string, body?: unknown) => s.call({ method, url: `/api/v1${url}`, body: body ?? (method === 'GET' ? undefined : {}), token });
  };
  const a = as(anna), b = as(ben);
  const id = ((await a('POST', '/campaigns', { name: 'The Hel Fenn Campaign' })).json() as { campaign: { id: string } }).campaign.id;
  const w = randomUUID();
  await a('POST', `/campaigns/${id}/enrolments`, { warbandId: w, data: SAVE });
  return { a, b, id, w };
}
const clash = (r: { statusCode: number; json: () => unknown }, word: RegExp) => {
  expect(r.statusCode).toBeGreaterThanOrEqual(400);
  expect(r.json()).toMatchObject({ error: 'invalid', problem: expect.stringMatching(word) });
};

describe('names that are not given twice (#65)', () => {
  it('a campaign of one’s own is not named like another – however it is written; someone else may use the name', async () => {
    const { a, b, id } = await table();
    clash(await a('POST', '/campaigns', { name: '  the hel   FENN campaign ' }), /campaign/);
    // renaming to the name of another campaign of one's own
    const other = ((await a('POST', '/campaigns', { name: 'Ferry Feud' })).json() as { campaign: { id: string } }).campaign.id;
    clash(await a('PATCH', `/campaigns/${other}`, { name: 'The Hel Fenn Campaign' }), /campaign/);
    expect((await a('PATCH', `/campaigns/${other}`, { name: 'Ferry Feud' })).statusCode).toBe(200);
    expect((await b('POST', '/campaigns', { name: 'The Hel Fenn Campaign' })).statusCode).toBe(201);
    expect(id).toBeTruthy();
  });

  it('two battles of a campaign do not carry one name; a title tells them apart', async () => {
    const { a, id, w } = await table();
    const first = await a('POST', `/campaigns/${id}/battles`, { id: randomUUID(), round: 1, warbandIds: [w] });
    expect(first.statusCode).toBe(201);
    clash(await a('POST', `/campaigns/${id}/battles`, { id: randomUUID(), round: 1, warbandIds: [w] }), /Battle 1/);
    const second = await a('POST', `/campaigns/${id}/battles`, { id: randomUUID(), round: 1, title: 'The ferry', warbandIds: [w] });
    expect(second.statusCode).toBe(201);
    clash(await a('POST', `/campaigns/${id}/battles`, { id: randomUUID(), round: 1, title: ' the FERRY ', warbandIds: [w] }), /Battle 1/);
    // a title cannot be changed into the name of another
    const bid = (second.json() as { battle: { id: string } }).battle.id;
    const third = await a('POST', `/campaigns/${id}/battles`, { id: randomUUID(), round: 2, title: 'The ferry', warbandIds: [w] });
    expect(third.statusCode).toBe(201);
    clash(await a('PATCH', `/campaigns/${id}/battles/${bid}`, { title: '' }), /Battle 1/);
    expect((await a('PATCH', `/campaigns/${id}/battles/${bid}`, { title: 'The ferry' })).statusCode).toBe(200);
  });

  it('two scenarios, factions, NPCs or background entries of a campaign do not share a name', async () => {
    const { a, id } = await table();
    const put = (path: string, body: Record<string, unknown>) => a('PUT', `/campaigns/${id}/${path}/${randomUUID()}`, body);
    expect((await put('scenarios', { title: 'Ambush at the ford' })).statusCode).toBe(200);
    clash(await put('scenarios', { title: 'ambush at the FORD' }), /scenario/);
    expect((await put('world/factions', { nameEn: 'The Ferrymen', nameDe: 'Die Fährleute', publicStatus: '' })).statusCode).toBe(200);
    clash(await put('world/factions', { nameEn: 'the ferrymen', nameDe: 'Andere', publicStatus: '' }), /faction/);
    clash(await put('world/factions', { nameEn: 'Other', nameDe: 'die fährleute', publicStatus: '' }), /faction/);
    expect((await put('world/npcs', { nameEn: 'Old Marek', publicStatus: 'alive', statlineTts: '' })).statusCode).toBe(200);
    clash(await put('world/npcs', { nameEn: 'old marek', publicStatus: 'alive', statlineTts: '' }), /NPC/);
    expect((await put('background', { kind: 'thread', title: 'Who pays the ferryman?' })).statusCode).toBe(200);
    clash(await put('background', { kind: 'figure', title: 'who pays the ferryman?' }), /entry|background/);
  });

  it('the same thing sent again under its own id is no clash', async () => {
    const { a, id } = await table();
    const sid = randomUUID();
    expect((await a('PUT', `/campaigns/${id}/scenarios/${sid}`, { title: 'Ambush at the ford' })).statusCode).toBe(200);
    expect((await a('PUT', `/campaigns/${id}/scenarios/${sid}`, { title: 'Ambush at the ford' })).statusCode).toBe(200);
  });
});
