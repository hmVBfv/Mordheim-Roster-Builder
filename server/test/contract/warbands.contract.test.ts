/* Contract, area 1: one's own warbands and the sync (server/src/routes-warbands.ts ↔ app/src/sync/fakeSync.ts). Plan P5. */
import { describe, expect, it } from 'vitest';
import { startAccounts } from '../accounts-helpers.ts';
import { compare, fakeSide, serverSide, type Step } from './driver.ts';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const SAVE = { wb: 'merc', name: 'The Probes', models: [], format: 2 };
const SAVE2 = { ...SAVE, name: 'The Probes, again' };

export const WARBAND_STEPS: Step[] = [
  { name: 'sync of nothing', url: '/sync?cursor=0' },
  { name: 'list of nothing', url: '/warbands' },
  { name: 'create', url: '/warbands', body: { id: A, data: SAVE, source: 'save' } },
  { name: 'create again, the same', url: '/warbands', body: { id: A, data: SAVE, source: 'save' } },
  { name: 'create again, another save', url: '/warbands', body: { id: A, data: SAVE2, source: 'save' } },
  { name: 'read', url: `/warbands/${A}` },
  { name: 'read a warband there is not', url: `/warbands/${B}` },
  { name: 'versions', url: `/warbands/${A}/versions` },
  { name: 'version 1', url: `/warbands/${A}/versions/1` },
  { name: 'version 9', url: `/warbands/${A}/versions/9` },
  { name: 'new version', url: `/warbands/${A}/versions`, body: { baseRev: 1, data: SAVE2, source: 'save', note: 'second' } },
  { name: 'new version on a stale base', url: `/warbands/${A}/versions`, body: { baseRev: 1, data: SAVE2, source: 'save' } },
  { name: 'versions after two', url: `/warbands/${A}/versions` },
  { name: 'autosave', method: 'PUT', url: `/warbands/${A}/autosave`, body: { baseRev: 2, data: SAVE, device: 'phone' } },
  { name: 'autosave from another device', method: 'PUT', url: `/warbands/${A}/autosave`, body: { baseRev: 2, data: SAVE2, device: 'laptop', afterSeq: 0 } },
  { name: 'autosave forced', method: 'PUT', url: `/warbands/${A}/autosave`, body: { baseRev: 2, data: SAVE2, device: 'laptop', force: true } },
  { name: 'autosave on a version there is not', method: 'PUT', url: `/warbands/${A}/autosave`, body: { baseRev: 9, data: SAVE } },
  { name: 'read with a draft', url: `/warbands/${A}` },
  { name: 'sync with a draft', url: '/sync?cursor=0' },
  { name: 'drop the draft', method: 'DELETE', url: `/warbands/${A}/autosave` },
  { name: 'read without it', url: `/warbands/${A}` },
  { name: 'create a second', url: '/warbands', body: { id: B, data: SAVE, source: 'import', note: 'from a file' } },
  { name: 'create a copy', url: '/warbands', body: { id: '33333333-3333-4333-8333-333333333333', data: SAVE, source: 'copy', copiedFrom: { id: A, rev: 1 } } },
  { name: 'create a copy of a version there is not', url: '/warbands', body: { id: '44444444-4444-4444-8444-444444444444', data: SAVE, source: 'copy', copiedFrom: { id: A, rev: 9 } } },
  { name: 'create without data', url: '/warbands', body: { id: '55555555-5555-4555-8555-555555555555', source: 'save' } },
  { name: 'remove', method: 'DELETE', url: `/warbands/${A}` },
  { name: 'remove again', method: 'DELETE', url: `/warbands/${A}` },
  { name: 'new version of a removed one', url: `/warbands/${A}/versions`, body: { baseRev: 2, data: SAVE } },
  { name: 'autosave of a removed one', method: 'PUT', url: `/warbands/${A}/autosave`, body: { baseRev: 2, data: SAVE } },
  { name: 'list without the removed', url: '/warbands' },
  { name: 'list of the removed', url: '/warbands?archived=1' },
  { name: 'sync after removing', url: '/sync?cursor=0' },
  { name: 'bring back', url: `/warbands/${A}/unarchive`, body: {} },
  { name: 'bring back again', url: `/warbands/${A}/unarchive`, body: {} },
  { name: 'sync from far ahead', url: '/sync?cursor=9999' },
];

describe('contract: warbands and sync', () => {
  it('the fake answers as the server does', async () => {
    const s = await startAccounts();
    const me = await s.user('kai');
    const token = me.session();
    // a second between requests: the server orders by the time of the last change, the fake by its counter
    const server = serverSide((r) => s.call(r), token, {}, () => s.clock.advance(1000));
    const { found, unused } = await compare(WARBAND_STEPS, server, fakeSide());
    expect(found).toEqual([]);
    expect(unused).toEqual([]);
  });
});
