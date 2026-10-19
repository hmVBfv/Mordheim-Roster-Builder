-- Opponents (docs/data-model.md "Gegner"): the men and beasts a leader sets
-- against the warbands, kept in groups – each group with its profiles
-- (characteristics, save, skills, equipment, special rules) as one JSON body –
-- and the campaign's own skills, each with the text its tooltip shows. Read
-- and written only by the campaign's leaders with the authenticator; nothing
-- of it reaches a player, a viewer or an admin outside the campaign.
--
-- The id comes from the device, so a group or skill sent twice is one. seq:
-- the audit_log seq of its last change; an edit names the seq it was made
-- from (409 stale otherwise); a taken-out row keeps its place (deleted_at).
CREATE TABLE opponent_groups (
  id          TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns (id),
  name        TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_by  TEXT NOT NULL REFERENCES users (id),
  updated_by  TEXT NOT NULL REFERENCES users (id),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT,
  seq         INTEGER NOT NULL
) STRICT;
CREATE INDEX opponent_groups_campaign ON opponent_groups (campaign_id, seq);

CREATE TABLE opponent_skills (
  id          TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns (id),
  name        TEXT NOT NULL,
  text        TEXT NOT NULL,
  created_by  TEXT NOT NULL REFERENCES users (id),
  updated_by  TEXT NOT NULL REFERENCES users (id),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT,
  seq         INTEGER NOT NULL
) STRICT;
CREATE INDEX opponent_skills_campaign ON opponent_skills (campaign_id, seq);
