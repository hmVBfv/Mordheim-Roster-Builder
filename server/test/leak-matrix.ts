/* The leak-test matrix (ADR 0011, docs/security.md): for every action, what
   each role may see. Phase 2 has no accounts, so only "anonymous" exists and
   only public actions; the full matrix (role × endpoint × visibility, with
   hidden fields checked in every answer) grows with phase 3. A route whose
   action has no row here fails leak-matrix.test.ts. */
import type { Action } from '../src/policy.ts';

export type Role = 'anonymous';

export interface MatrixRow {
  /** The routes that carry this action. */
  routes: string[];
  /** Who may call it at all. */
  allowed: Role[];
  /** Top-level fields of a JSON answer a role may see; anything else is a leak. */
  fields?: Partial<Record<Role, string[]>>;
}

export const MATRIX: Record<Action, MatrixRow> = {
  'health.read': {
    routes: ['GET /api/v1/health'],
    allowed: ['anonymous'],
    fields: { anonymous: ['status', 'version', 'startedAt', 'epoch', 'db', 'migrations'] },
  },
  'app.files': {
    routes: ['GET /*', 'HEAD /*'],
    allowed: ['anonymous'],
  },
};
