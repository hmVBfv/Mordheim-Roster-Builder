/* Contract, area 6: the world of a campaign – factions, NPCs, reputation (server/src/routes-world.ts). The signed-in user leads it, one warband entered. Plan P5. */
import { describe, expect, it } from 'vitest';
import { startAccounts } from '../accounts-helpers.ts';
import { gameData, totalsOf } from '../../src/rules.ts';
import { compare, fakeSide, serverSide, type Step } from './driver.ts';

const SAVE = { wb: 'merc', name: 'The Probes', models: [], format: 2 };
const W1 = '11111111-1111-4111-8111-111111111111';
const F1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const F2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const N1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const R1 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const R2 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const GONE = '99999999-9999-4999-8999-999999999999';

export const WORLD_STEPS: Step[] = [
  { name: 'start a campaign', url: '/campaigns', body: { name: 'The Hel Fenn Campaign' }, capture: { c: 'campaign.id' } },
  { name: 'enter a warband', url: '/campaigns/{c}/enrolments', body: { warbandId: W1, data: SAVE }, capture: { e: 'enrolmentId' } },
  { name: 'the world of nothing', url: '/campaigns/{c}/world' },
  { name: 'a faction', method: 'PUT', url: `/campaigns/{c}/world/factions/${F1}`, body: { nameEn: 'The Watch', nameDe: 'Die Wache', publicStatus: 'holds the docks' } },
  { name: 'the same faction again', method: 'PUT', url: `/campaigns/{c}/world/factions/${F1}`, body: { nameEn: 'The Watch', nameDe: 'Die Wache', publicStatus: 'holds the docks' } },
  { name: 'a second faction of the same name', method: 'PUT', url: `/campaigns/{c}/world/factions/${F2}`, body: { nameEn: ' the watch ', nameDe: '' } },
  { name: 'a faction without a name', method: 'PUT', url: `/campaigns/{c}/world/factions/${F2}`, body: { nameEn: '', nameDe: '' } },
  { name: 'a faction with a name that is no id', method: 'PUT', url: '/campaigns/{c}/world/factions/nope', body: { nameEn: 'X', nameDe: '' } },
  { name: 'a faction with a field there is not', method: 'PUT', url: `/campaigns/{c}/world/factions/${F2}`, body: { nameEn: 'X', nameDe: '', nonsense: 1 } },
  { name: 'a second faction', method: 'PUT', url: `/campaigns/{c}/world/factions/${F2}`, body: { nameEn: 'The Ferrymen', nameDe: '' } },
  { name: 'an NPC', method: 'PUT', url: `/campaigns/{c}/world/npcs/${N1}`, body: { factionId: F1, nameEn: 'Captain Brandt', nameDe: '', publicStatus: 'alive', named: true } },
  { name: 'an NPC of a faction there is not', method: 'PUT', url: `/campaigns/{c}/world/npcs/${GONE}`, body: { factionId: GONE, nameEn: 'Nobody', nameDe: '' } },
  { name: 'an NPC without a name', method: 'PUT', url: `/campaigns/{c}/world/npcs/${GONE}`, body: { nameEn: '', nameDe: '' } },
  { name: 'reputation gained', method: 'PUT', url: `/campaigns/{c}/world/reputation/${R1}`, body: { warbandId: W1, factionId: F1, delta: 2, reason: 'Paid the toll.' } },
  { name: 'reputation lost', method: 'PUT', url: `/campaigns/{c}/world/reputation/${R2}`, body: { warbandId: W1, factionId: F2, delta: -1, reason: 'Sank a boat.' } },
  { name: 'reputation of nothing', method: 'PUT', url: `/campaigns/{c}/world/reputation/${GONE}`, body: { warbandId: W1, factionId: F1, delta: 0, reason: 'x' } },
  { name: 'reputation without a reason', method: 'PUT', url: `/campaigns/{c}/world/reputation/${GONE}`, body: { warbandId: W1, factionId: F1, delta: 1, reason: ' ' } },
  { name: 'reputation for a warband that is not in it', method: 'PUT', url: `/campaigns/{c}/world/reputation/${GONE}`, body: { warbandId: GONE, factionId: F1, delta: 1, reason: 'x' } },
  { name: 'reputation with a faction there is not', method: 'PUT', url: `/campaigns/{c}/world/reputation/${GONE}`, body: { warbandId: W1, factionId: GONE, delta: 1, reason: 'x' } },
  { name: 'the world', url: '/campaigns/{c}/world' },
  { name: 'take a reputation event out', method: 'DELETE', url: `/campaigns/{c}/world/reputation/${R2}` },
  { name: 'take it out again', method: 'DELETE', url: `/campaigns/{c}/world/reputation/${R2}` },
  { name: 'take the NPC out', method: 'DELETE', url: `/campaigns/{c}/world/npcs/${N1}` },
  { name: 'take out an NPC there is not', method: 'DELETE', url: `/campaigns/{c}/world/npcs/${GONE}` },
  { name: 'take a faction out', method: 'DELETE', url: `/campaigns/{c}/world/factions/${F2}` },
  { name: 'take out a faction there is not', method: 'DELETE', url: `/campaigns/{c}/world/factions/${GONE}` },
  { name: 'the world at the end', url: '/campaigns/{c}/world' },
];

describe('contract: the world', () => {
  it('the fake answers as the server does', async () => {
    const s = await startAccounts();
    const kai = await s.user('kai');
    s.db.prepare('UPDATE users SET display_name = ? WHERE username = ?').run('Kai', 'kai');
    const server = serverSide((r) => s.call(r), kai.session(), { me: kai.id }, () => s.clock.advance(1000));
    const fake = fakeSide({
      me: { id: 'u1', username: 'kai', displayName: 'Kai' },
      totals: (save) => { const t = totalsOf(save); return { rating: t?.rating ?? 0, spent: t?.spent ?? 0, models: t?.models ?? 0, heroes: t?.heroes ?? 0, gold: t?.gold ?? 0, fallen: t?.fallen ?? 0 }; },
      wbName: (wb) => (gameData().WARBANDS as Record<string, { name?: string }>)[wb]?.name ?? wb,
    }, { me: 'u1' });
    const { found, unused } = await compare(WORLD_STEPS, server, fake);
    expect(found).toEqual([]);
    expect(unused).toEqual([]);
  });
});
