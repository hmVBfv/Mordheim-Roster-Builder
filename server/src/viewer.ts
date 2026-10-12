/* "View as player" (phase 4b1; docs/mockups/visibility.html): a leader can
   ask for the notes, pictures and the timeline as a player would get them –
   to check that nothing was left open by mistake. It is a narrowing only: the
   viewer is nobody in particular, so not even the leader's own sealed notes
   or leaders'-only items appear. Anyone else asking for it gets what they
   would get anyway. */
import type { FastifyRequest } from 'fastify';

/** Nobody: no id that owns anything, and not a leader. */
export const PLAYER_VIEW = { id: '', leader: false } as const;

export const asksAsPlayer = (req: FastifyRequest) => (req.query as { as?: string }).as === 'player';

export const AS_PLAYER = { as: { type: 'string', enum: ['player'] } } as const;
