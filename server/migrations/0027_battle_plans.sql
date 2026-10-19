-- The leaders' plan for a battle (docs/data-model.md "Kampagne"): the red
-- thread a leader wants the battle and its chapter to follow – the goal, the
-- turning points, where the story should end up. Keyed by the battle's number,
-- so it can be written before the battle is set up. Read and written only by
-- the campaign's leaders with the authenticator; the AI pack hands it to the
-- writer as direction. The log says that it changed, never what it says.
--
-- seq: the audit_log seq of the last change; a change names the seq it was
-- made from, so two leaders do not overwrite each other.
CREATE TABLE battle_plans (
  campaign_id TEXT NOT NULL REFERENCES campaigns (id),
  round       INTEGER NOT NULL CHECK (round BETWEEN 1 AND 999),
  text        TEXT NOT NULL,
  updated_by  TEXT NOT NULL REFERENCES users (id),
  updated_at  TEXT NOT NULL,
  seq         INTEGER NOT NULL,
  PRIMARY KEY (campaign_id, round)
) STRICT;
