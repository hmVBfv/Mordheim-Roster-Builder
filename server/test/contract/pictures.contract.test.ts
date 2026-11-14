/* Contract, area 9: pictures of a campaign – the entry, its bytes, the list, the file, taking one out (server/src/routes-attachments.ts). The signed-in
   user leads the campaign with one battle. Plan P5. */
import { describe, expect, it } from 'vitest';
import { startAccounts } from '../accounts-helpers.ts';
import { gameData, totalsOf } from '../../src/rules.ts';
import { PNG } from '../leak-matrix.ts';
import { compare, fakeSide, serverSide, type Step } from './driver.ts';

const SAVE = { wb: 'merc', name: 'The Probes', models: [], format: 2 };
const W1 = '11111111-1111-4111-8111-111111111111';
const BATTLE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const A1 = '10101010-1010-4010-8010-101010101010';
const A2 = '20202020-2020-4020-8020-202020202020';
const GONE = '99999999-9999-4999-8999-999999999999';
const ENTRY = { battleId: BATTLE, turn: 1, mime: 'image/png', bytes: PNG.length, width: 1, height: 1, caption: 'The ferry burns.', visibility: 'public' };

export const PICTURE_STEPS: Step[] = [
  { name: 'start a campaign', url: '/campaigns', body: { name: 'The Hel Fenn Campaign' }, capture: { c: 'campaign.id' } },
  { name: 'enter a warband', url: '/campaigns/{c}/enrolments', body: { warbandId: W1, data: SAVE }, capture: { e: 'enrolmentId' } },
  { name: 'set up a battle', url: '/campaigns/{c}/battles', body: { id: BATTLE, title: 'The ferry', warbandIds: [W1] } },
  { name: 'pictures of nothing', url: '/campaigns/{c}/attachments' },
  { name: 'a picture', method: 'PUT', url: `/campaigns/{c}/attachments/${A1}`, body: ENTRY },
  { name: 'the same picture again', method: 'PUT', url: `/campaigns/{c}/attachments/${A1}`, body: ENTRY },
  { name: 'its bytes', method: 'PUT', url: `/campaigns/{c}/attachments/${A1}/file`, raw: { type: 'image/png', bytes: PNG } },
  { name: 'its bytes again', method: 'PUT', url: `/campaigns/{c}/attachments/${A1}/file`, raw: { type: 'image/png', bytes: PNG } },
  { name: 'bytes of a type there is not', method: 'PUT', url: `/campaigns/{c}/attachments/${A1}/file`, raw: { type: 'text/plain', bytes: new Uint8Array([1, 2, 3]) } },
  { name: 'bytes for a picture there is not', method: 'PUT', url: `/campaigns/{c}/attachments/${GONE}/file`, raw: { type: 'image/png', bytes: PNG } },
  { name: 'a picture with a name that is no id', method: 'PUT', url: '/campaigns/{c}/attachments/nope', body: ENTRY },
  { name: 'a picture of a type there is not', method: 'PUT', url: `/campaigns/{c}/attachments/${A2}`, body: { ...ENTRY, mime: 'text/html' } },
  { name: 'a picture in a battle there is not', method: 'PUT', url: `/campaigns/{c}/attachments/${A2}`, body: { ...ENTRY, battleId: GONE } },
  { name: 'a picture for leaders', method: 'PUT', url: `/campaigns/{c}/attachments/${A2}`, body: { ...ENTRY, visibility: 'leader', caption: 'The seal.' } },
  { name: 'the pictures', url: '/campaigns/{c}/attachments' },
  { name: 'the pictures as the players read them', url: '/campaigns/{c}/attachments?as=player' },
  { name: 'the file', url: `/campaigns/{c}/attachments/${A1}/file` },
  { name: 'a file there is not', url: `/campaigns/{c}/attachments/${GONE}/file` },
  { name: 'the file of a picture without bytes', url: `/campaigns/{c}/attachments/${A2}/file` },
  { name: 'take a picture out', method: 'DELETE', url: `/campaigns/{c}/attachments/${A2}` },
  { name: 'take it out again', method: 'DELETE', url: `/campaigns/{c}/attachments/${A2}` },
  { name: 'the pictures at the end', url: '/campaigns/{c}/attachments' },
];

describe('contract: pictures', () => {
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
    const { found, unused } = await compare(PICTURE_STEPS, server, fake);
    expect(found).toEqual([]);
    expect(unused).toEqual([]);
  });
});
