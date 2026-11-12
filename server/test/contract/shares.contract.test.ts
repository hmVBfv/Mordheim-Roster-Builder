/* Contract, area 2: the people one can send a copy to, sharing a warband, and one's own Library (server/src/routes-shares.ts, routes-library.ts).
   Somebody else's part – a copy sent to the signed-in user – is done by each side its own way: through the API as that person on the server,
   with `shareFrom` on the fake. Plan P5. */
import { describe, expect, it } from 'vitest';
import { startAccounts } from '../accounts-helpers.ts';
import { compare, fakeSide, serverSide, type Refs, type Step } from './driver.ts';

const SAVE = { wb: 'merc', name: 'The Probes', models: [], format: 2 };
const W = (n: number) => `${n}${n}${n}${n}${n}${n}${n}${n}-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${String(n).repeat(12)}`;
const L1 = '99999999-9999-4999-8999-999999999999';
/** Every field the server would otherwise fill in itself: what a body holds is checked and completed there, not in the fake. */
const IDEA = { text: 'Smugglers on the Stir.', topic: 'warband', folder: '' };

export const SHARE_STEPS: Step[] = [
  { name: 'people', url: '/people' },
  { name: 'shares of nobody', url: '/shares' },
  { name: 'send a copy to a player', url: '/shares', body: { data: SAVE, to: '{ben}' }, capture: { out1: 'id' } },
  { name: 'send a copy to nobody there is', url: '/shares', body: { data: SAVE, to: '{nobody}' } },
  { name: 'send without a save', url: '/shares', body: {} },
  { name: 'send something that is no save', url: '/shares', body: { data: { nonsense: 1 } } },
  { name: 'make a code', url: '/shares', body: { data: SAVE }, capture: { code: 'code', codeShare: 'id' } },
  { name: 'shares sent', url: '/shares' },
  { name: 'look up the code', url: '/shares/peek', body: { code: '{code}' } },
  { name: 'look up a code there is not', url: '/shares/peek', body: { code: 'ZZZZ-ZZZZ' } },
  { name: 'take the code', url: '/shares/redeem', body: { code: '{code}', warbandId: W(1) } },
  { name: 'take the code onto an id that is there', url: '/shares/redeem', body: { code: '{code}', warbandId: W(1) } },
  { name: 'take the code again', url: '/shares/redeem', body: { code: '{code}', warbandId: W(2) } },
  { name: 'take a code there is not', url: '/shares/redeem', body: { code: 'ZZZZ-ZZZZ', warbandId: W(3) } },
  { name: 'the warband taken by code', url: `/warbands/${W(1)}` },
  { name: 'shares after taking', url: '/shares' },
  { name: 'take back a copy sent', method: 'DELETE', url: '/shares/{out1}' },
  { name: 'take back again', method: 'DELETE', url: '/shares/{out1}' },
  { name: 'take back a share there is not', method: 'DELETE', url: `/shares/${W(7)}` },
  { name: 'somebody sends me a copy', url: '', elsewhere: true },
  { name: 'somebody sends me another', url: '', elsewhere: true },
  { name: 'shares with copies waiting', url: '/shares' },
  { name: 'accept a copy', url: '/shares/{in1}/accept', body: { warbandId: W(4) } },
  { name: 'accept it again', url: '/shares/{in1}/accept', body: { warbandId: W(5) } },
  { name: 'the warband accepted', url: `/warbands/${W(4)}` },
  { name: 'decline a copy', url: '/shares/{in2}/decline', body: {} },
  { name: 'decline it again', url: '/shares/{in2}/decline', body: {} },
  { name: 'answer a share there is not', url: `/shares/${W(7)}/accept`, body: { warbandId: W(6) } },
  { name: 'answer my own copy', url: '/shares/{out2}/accept', body: { warbandId: W(6) } },
  { name: 'shares after answering', url: '/shares' },
  { name: 'warbands after sharing', url: '/warbands' },

  { name: 'library of nothing', url: '/library' },
  { name: 'a first idea', method: 'PUT', url: `/library/${L1}`, body: { kind: 'idea', name: 'The ferrymen', body: IDEA } },
  { name: 'the same idea again', method: 'PUT', url: `/library/${L1}`, body: { kind: 'idea', name: 'The ferrymen', body: IDEA } },
  { name: 'a changed idea on a stale base', method: 'PUT', url: `/library/${L1}`, body: { kind: 'idea', name: 'The ferrymen', body: { ...IDEA, text: 'Changed.' }, baseSeq: 0 } },
  { name: 'a kind there is not', method: 'PUT', url: `/library/${W(8)}`, body: { kind: 'nonsense', name: 'X', body: {} } },
  { name: 'an idea without a name', method: 'PUT', url: `/library/${W(8)}`, body: { kind: 'idea', name: '  ', body: IDEA } },
  { name: 'library with an idea', url: '/library' },
  { name: 'library since the newest', url: '/library?since=9999' },
  { name: 'take the idea out', method: 'DELETE', url: `/library/${L1}` },
  { name: 'take it out again', method: 'DELETE', url: `/library/${L1}` },
  { name: 'take out one there is not', method: 'DELETE', url: `/library/${W(8)}` },
  { name: 'write to the removed one', method: 'PUT', url: `/library/${L1}`, body: { kind: 'idea', name: 'The ferrymen', body: IDEA } },
  { name: 'library after removing', url: '/library' },
];

describe('contract: people, shares and the library', () => {
  it('the fake answers as the server does', async () => {
    const s = await startAccounts();
    const kai = await s.user('kai');
    const ben = await s.user('ben');
    const rob = await s.user('rob');
    for (const [name, display] of [['kai', 'Kai'], ['ben', 'Ben'], ['rob', 'Rob']]) s.db.prepare('UPDATE users SET display_name = ? WHERE username = ?').run(display, name);
    const bensToken = ben.session();
    const refs: Refs = { ben: ben.id, rob: rob.id, nobody: '77777777-7777-4777-8777-777777777777' };
    const fakeRefs: Refs = { ben: 'user-ben', rob: 'user-rob', nobody: 'user-nobody' };
    let sent = 0;
    const server = serverSide((r) => s.call(r), kai.session(), refs, () => s.clock.advance(1000), async (_step, r) => {
      s.clock.advance(1000);
      const res = await s.call({ method: 'POST', url: '/api/v1/shares', body: { data: SAVE, to: kai.id }, token: bensToken });
      expect(res.statusCode).toBe(201);
      r[`in${++sent}`] = (res.json() as { id: string }).id;
    });
    let sentFake = 0;
    const fake = fakeSide({}, fakeRefs, (f, _step, r) => { r[`in${++sentFake}`] = f.shareFrom('Ben', SAVE).id; });
    // the copy the signed-in user made to a player is a share of theirs, not a copy sent to them: "answer my own copy" needs its id
    const steps = SHARE_STEPS.map((st) => (st.capture?.out1 ? { ...st, capture: { out1: 'id', out2: 'id' } } : st));
    const { found, unused } = await compare(steps, server, fake);
    expect(found).toEqual([]);
    expect(unused).toEqual([]);
  });
});
