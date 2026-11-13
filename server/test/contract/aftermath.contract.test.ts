/* Contract, area 11: after a battle – confirming the version that fights, closing, marking the warband with what changed, correcting the mark
   (server/src/aftermath.ts through routes-battles.ts). The fake takes the changes from core as the server does. The signed-in user leads the
   campaign; the warband's second version changes its name. Plan P5. */
import { battleEvidence, diffWarbands, loadSave, reconcile } from '@mordheim/core';
import { describe, expect, it } from 'vitest';
import { startAccounts } from '../accounts-helpers.ts';
import { gameData, totalsOf } from '../../src/rules.ts';
import { compare, fakeSide, serverSide, type Step } from './driver.ts';

const save = (name: string, gold?: number) => ({ wb: 'merc', name, models: [], format: 2, ...(gold === undefined ? {} : { gold }) });
const W1 = '11111111-1111-4111-8111-111111111111';
const B1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const B2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const GONE = '99999999-9999-4999-8999-999999999999';

export const AFTERMATH_STEPS: Step[] = [
  { name: 'start a campaign', url: '/campaigns', body: { name: 'The Hel Fenn Campaign' }, capture: { c: 'campaign.id' } },
  { name: 'enter a warband', url: '/campaigns/{c}/enrolments', body: { warbandId: W1, data: save('The Probes') }, capture: { e: 'enrolmentId' } },
  { name: 'set up a battle', url: '/campaigns/{c}/battles', body: { id: B1, title: 'The ferry', warbandIds: [W1] } },
  { name: 'mark before it is closed', url: `/campaigns/{c}/battles/${B1}/marks`, body: { warbandId: W1, rev: 1 } },
  { name: 'confirm the version', url: `/campaigns/{c}/battles/${B1}/confirm`, body: { warbandId: W1, rev: 1 } },
  { name: 'close the battle', url: `/campaigns/{c}/battles/${B1}/close`, body: {} },
  { name: 'mark the warband', url: `/campaigns/{c}/battles/${B1}/marks`, body: { warbandId: W1, rev: 1 } },
  { name: 'the battle with its mark', url: `/campaigns/{c}/battles/${B1}` },
  { name: 'a second version', url: `/warbands/${W1}/versions`, body: { baseRev: 1, data: save('The Probes, changed', 40), source: 'save' } },
  { name: 'correct the mark with it', url: `/campaigns/{c}/battles/${B1}/marks`, body: { warbandId: W1, rev: 2 } },
  { name: 'mark with a version there is not', url: `/campaigns/{c}/battles/${B1}/marks`, body: { warbandId: W1, rev: 9 } },
  { name: 'mark a warband that is not mine', url: `/campaigns/{c}/battles/${B1}/marks`, body: { warbandId: GONE, rev: 1 } },
  { name: 'the battle with the corrected mark', url: `/campaigns/{c}/battles/${B1}` },
  { name: 'the warband in the campaign', url: `/campaigns/{c}/warbands/${W1}` },
  { name: 'the timeline with marks', url: '/campaigns/{c}/timeline' },
  { name: 'a second battle', url: '/campaigns/{c}/battles', body: { id: B2, title: 'The mill', warbandIds: [W1] } },
  { name: 'close it', url: `/campaigns/{c}/battles/${B2}/close`, body: {} },
  { name: 'mark with a version older than the one before', url: `/campaigns/{c}/battles/${B2}/marks`, body: { warbandId: W1, rev: 1 } },
  { name: 'mark it', url: `/campaigns/{c}/battles/${B2}/marks`, body: { warbandId: W1, rev: 2 } },
  { name: 'catch up', url: '/campaigns/{c}/catchup' },
];

describe('contract: after a battle', () => {
  it('the fake answers as the server does', async () => {
    const s = await startAccounts();
    const kai = await s.user('kai');
    s.db.prepare('UPDATE users SET display_name = ? WHERE username = ?').run('Kai', 'kai');
    const server = serverSide((r) => s.call(r), kai.session(), { me: kai.id }, () => s.clock.advance(1000));
    const read = (raw: unknown) => { const r = loadSave(gameData(), raw); return r.ok ? r.state : null; };
    const fake = fakeSide({
      me: { id: 'u1', username: 'kai', displayName: 'Kai' },
      totals: (save) => { const t = totalsOf(save); return { rating: t?.rating ?? 0, spent: t?.spent ?? 0, models: t?.models ?? 0, heroes: t?.heroes ?? 0, gold: t?.gold ?? 0, fallen: t?.fallen ?? 0 }; },
      wbName: (wb) => (gameData().WARBANDS as Record<string, { name?: string }>)[wb]?.name ?? wb,
      changes: (before, after, battle) => {
        const sb = read(before), sa = read(after);
        if (!sb || !sa) return [];
        return reconcile(diffWarbands(gameData(), sb, sa, battle.round), battleEvidence(sa, battle.id, battle.round)).map((ch) => ({
          kind: ch.kind, uid: ch.hireUid ?? ch.uid ?? null, name: ch.name ?? '', changeKey: ch.changeKey, payload: ch.payload, eventRef: ch.eventRef, unexplained: !!ch.unexplained,
        })) as never;
      },
    }, { me: 'u1' });
    const { found, unused } = await compare(AFTERMATH_STEPS, server, fake);
    expect(found).toEqual([]);
    expect(unused).toEqual([]);
  });
});
