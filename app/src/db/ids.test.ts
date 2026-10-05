/* Ids for new warbands work where the browser has no crypto.randomUUID: it
   exists only in a secure context (https or localhost), and the test
   instance is served over http in the home network (Rob, 05.10.2026:
   "crypto.randomUUID is not a function" on import, nothing on "Start the
   warband"). */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { data, sampleSave } from '../test/data.ts';
import { db } from './db.ts';
import { newId } from './ids.ts';
import { importText } from './warbands.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
let saved: PropertyDescriptor | undefined;

beforeEach(async () => {
  await db.warbands.clear();
  // as on http://<pi-lan-ip>:8081: no randomUUID, getRandomValues still there
  saved = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(crypto), 'randomUUID');
  Object.defineProperty(Object.getPrototypeOf(crypto), 'randomUUID', { value: undefined, configurable: true });
});
afterEach(async () => {
  if (saved) Object.defineProperty(Object.getPrototypeOf(crypto), 'randomUUID', saved);
  await db.warbands.clear();
});

describe('ids outside a secure context', () => {
  it('a version 4 UUID from getRandomValues, a new one each time', () => {
    expect(typeof crypto.randomUUID).not.toBe('function');
    const a = newId();
    expect(a).toMatch(UUID);
    expect(newId()).not.toBe(a);
  });

  it('importing a warband works', async () => {
    const r = await importText(data, JSON.stringify(sampleSave()));
    expect(r.ok).toBe(true);
    expect((await db.warbands.toArray())[0]!.id).toMatch(UUID);
  });
});
