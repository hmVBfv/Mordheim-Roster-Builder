/* Every route has its row in the leak-test matrix, and answers only the
   fields the matrix allows (ADR 0011). */
import { describe, expect, it } from 'vitest';
import { ACTIONS } from '../src/policy.ts';
import { MATRIX } from './leak-matrix.ts';
import { startServer } from './helpers.ts';

describe('leak-test matrix', () => {
  it('has a row for every action, naming exactly the routes that carry it', async () => {
    const s = await startServer();
    expect(Object.keys(MATRIX).sort()).toEqual(Object.keys(ACTIONS).sort());
    const registered = s.app.registeredRoutes.map((r) => `${r.action}: ${r.method} ${r.url}`).sort();
    const listed = Object.entries(MATRIX).flatMap(([action, row]) => row.routes.map((r) => `${action}: ${r}`)).sort();
    expect(registered).toEqual(listed);
  });

  it('anonymous: health shows only its allowed fields', async () => {
    const s = await startServer();
    const body = (await (await fetch(`${s.url}/api/v1/health`)).json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([...MATRIX['health.read'].fields!.anonymous!].sort());
  });
});
