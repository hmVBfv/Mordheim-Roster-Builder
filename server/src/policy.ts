/* The one place that decides who may do what (docs/security.md, section 4;
   ADR 0011): `can(actor, action, target)`. Every route names its action, a
   hook in app.ts asks `can()` before the handler runs, and a route without an
   action refuses to register – so no endpoint can check rights on its own or
   forget to. Every action also has its row in the leak-test matrix
   (server/test/leak-matrix.ts); the test fails for an action without one.

   Phase 2 has no accounts yet: the actor is always null (not signed in), and
   the only actions are public. Roles and targets arrive in phase 3. */

/** A signed-in user (phase 3); null: nobody is signed in. */
export type Actor = null;

export const ACTIONS = {
  /** GET /api/v1/health – for roster-deploy, the container healthcheck and roster-alive. */
  'health.read': { public: true },
  /** The static files of the app's campaign build – the same for everyone, no data in them. */
  'app.files': { public: true },
} as const satisfies Record<string, { public: boolean }>;

export type Action = keyof typeof ACTIONS;

export const isAction = (a: unknown): a is Action => typeof a === 'string' && Object.hasOwn(ACTIONS, a);

/** can(actor, action, target) – the target (a warband, a note, …) joins in phase 3. */
export function can(_actor: Actor, action: Action): boolean {
  switch (action) {
    case 'health.read':
    case 'app.files':
      return true;
  }
}
