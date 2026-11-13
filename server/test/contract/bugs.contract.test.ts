/* Contract, area 8: problem reports – sending one, reading one's own with its status, and the admin's list, reading and sorting
   (server/src/routes-bugs.ts). The signed-in user is the admin with the authenticator and also the reporter. Plan P5. */
import { describe, expect, it } from 'vitest';
import { startAccounts } from '../accounts-helpers.ts';
import { compare, fakeSide, serverSide, type Step } from './driver.ts';

const B1 = '10101010-1010-4010-8010-101010101010';
const B2 = '20202020-2020-4020-8020-202020202020';
const GONE = '99999999-9999-4999-8999-999999999999';
const REPORT = { id: B1, kind: 'bug', title: 'The roster does not scroll', text: 'It stops at the third hero.' };

export const BUG_STEPS: Step[] = [
  { name: 'mine of nothing', url: '/bugs/mine' },
  { name: 'send a report', url: '/bugs', body: REPORT, capture: { b: 'bug.id' } },
  { name: 'send it again', url: '/bugs', body: REPORT },
  { name: 'send another under the same id', url: '/bugs', body: { ...REPORT, text: 'Something else.' } },
  { name: 'send a wish', url: '/bugs', body: { id: B2, kind: 'wish', title: 'A chart', text: 'I would like a chart.' } },
  { name: 'send a kind there is not', url: '/bugs', body: { id: GONE, kind: 'nonsense', title: 'x', text: 'x' } },
  { name: 'send without text', url: '/bugs', body: { id: GONE, kind: 'bug', title: 'x', text: ' ' } },
  { name: 'mine', url: '/bugs/mine' },
  { name: 'the open reports', url: '/bugs' },
  { name: 'all reports', url: '/bugs?status=all' },
  { name: 'read one', url: '/bugs/{b}' },
  { name: 'read one there is not', url: `/bugs/${GONE}` },
  { name: 'sort one', method: 'PATCH', url: '/bugs/{b}', body: { status: 'confirmed', severity: 'S3', area: 'roster', headline: 'The roster stops scrolling' } },
  { name: 'sort one with a severity there is not', method: 'PATCH', url: '/bugs/{b}', body: { severity: 'S9' } },
  { name: 'sort one with a status there is not', method: 'PATCH', url: '/bugs/{b}', body: { status: 'nonsense' } },
  { name: 'call one fixed without a version', method: 'PATCH', url: '/bugs/{b}', body: { status: 'fixed' } },
  { name: 'call one fixed', method: 'PATCH', url: '/bugs/{b}', body: { status: 'fixed', fixedIn: 'abc1234' } },
  { name: 'sort one there is not', method: 'PATCH', url: `/bugs/${GONE}`, body: { status: 'closed' } },
  { name: 'the fixed reports', url: '/bugs?status=fixed' },
  { name: 'mine after sorting', url: '/bugs/mine' },
];

describe('contract: problem reports', () => {
  it('the fake answers as the server does', async () => {
    const s = await startAccounts();
    const kai = await s.user('kai', { admin: true, totp: true });
    s.db.prepare('UPDATE users SET display_name = ? WHERE username = ?').run('Kai', 'kai');
    const server = serverSide((r) => s.call(r), kai.session(), { me: kai.id }, () => s.clock.advance(1000));
    const fake = fakeSide({ me: { id: 'u1', username: 'kai', displayName: 'Kai' } }, { me: 'u1' });
    const { found, unused } = await compare(BUG_STEPS, server, fake);
    expect(found).toEqual([]);
    expect(unused).toEqual([]);
  });
});
