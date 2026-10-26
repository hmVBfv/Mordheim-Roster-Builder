-- Hidden NPC warbands (wish #79, Rob, 26.10.2026; docs/data-model.md "NPC-Warbands"): a leader puts warbands into the campaign
-- that serve as reference and Tabletop Simulator data for the game master – and that no other member ever sees: no player,
-- no viewer, no admin outside the campaign. Like the background (phase 4b1) they are the leaders' own, read and written with
-- the authenticator. The warband is a planner (no gold limit; what it owns, the experience its advances need and its rating
-- are tracked), kept as the save the app writes (`save`); `summary` carries the three figures so a list needs no save. The id
-- comes from the device, so a warband sent twice is one. seq: the audit_log seq of its last change; a taken-out one keeps its
-- row (deleted_at) but lets go of its words.
CREATE TABLE npc_warbands (
  id          TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns (id),
  name        TEXT NOT NULL,
  save        TEXT NOT NULL,
  summary     TEXT NOT NULL DEFAULT '{}',
  created_by  TEXT NOT NULL REFERENCES users (id),
  updated_by  TEXT NOT NULL REFERENCES users (id),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT,
  seq         INTEGER NOT NULL
) STRICT;
CREATE INDEX npc_warbands_campaign ON npc_warbands (campaign_id, seq);
