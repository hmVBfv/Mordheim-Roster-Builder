-- Scenarios (phase 4b3c; concept.md 4.9, ADR 0002, ADR 0011;
-- docs/data-model.md "Welt"): a scenario of the leaders' own – its rules and
-- the values of the NPCs in it, in the text form of the Tabletop Simulator
-- export. It is the playable package; the Background keeps the plans and
-- ideas around it.
--
-- Hidden until played: a draft (visibility 'leader') is read by the
-- campaign's leaders alone, with the authenticator – for everyone else it
-- does not exist, not even as a line. A leader releases it by assigning it
-- to a battle of the campaign; from then on (visibility 'public') every
-- member reads it, and that is not undone. Released, it is part of the
-- story: it may still be corrected, with the earlier wording kept, and it
-- cannot be taken out. A draft can.
--
-- id comes from the device, so a scenario sent twice is one. seq: the
-- audit_log seq of the last change, a removal included.
CREATE TABLE scenarios (
  id               TEXT PRIMARY KEY,
  campaign_id      TEXT NOT NULL REFERENCES campaigns (id),
  title            TEXT NOT NULL,
  body             TEXT NOT NULL DEFAULT '',
  npc_statlines    TEXT NOT NULL DEFAULT '',
  visibility       TEXT NOT NULL DEFAULT 'leader' CHECK (visibility IN ('leader', 'public')),
  played_in_battle TEXT REFERENCES battles (id),
  released_at      TEXT,
  released_by      TEXT REFERENCES users (id),
  created_by       TEXT NOT NULL REFERENCES users (id),
  updated_by       TEXT NOT NULL REFERENCES users (id),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  deleted_at       TEXT,
  seq              INTEGER NOT NULL
) STRICT;
CREATE INDEX scenarios_campaign ON scenarios (campaign_id, seq);

-- the wording before each change of a scenario, the last 50
CREATE TABLE scenario_revisions (
  scenario_id  TEXT NOT NULL REFERENCES scenarios (id),
  snapshot     TEXT NOT NULL,
  edited_by    TEXT NOT NULL REFERENCES users (id),
  edited_at    TEXT NOT NULL
) STRICT;
CREATE INDEX scenario_revisions_scenario ON scenario_revisions (scenario_id);
