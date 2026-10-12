-- The campaign world (phase 4b3b; concept.md 4.9, ADR 0002, ADR 0011;
-- docs/data-model.md "Welt"): factions, the NPCs that belong to them, and
-- the reputation each warband earns with a faction as a log of events.
--
-- This is mechanics, and mechanics are open to every member of the campaign
-- (ADR 0002): what a leader puts here, everybody in the campaign reads. The
-- truth behind an NPC stays in the background (leaders only); a leader adds
-- an NPC here when the players may know it exists, with a status they may
-- read. Only the campaign's leaders (with the authenticator) write.
--
-- id comes from the device, so a faction, NPC or event sent twice is one.
-- seq: the audit_log seq of the last change (tombstones included, so a
-- device that has the older state learns about a removal). Removing is a
-- tombstone (deleted_at): a reputation event is never edited – a mistake is
-- taken out, and the log keeps who did it.
CREATE TABLE factions (
  id             TEXT PRIMARY KEY,
  campaign_id    TEXT NOT NULL REFERENCES campaigns (id),
  name_de        TEXT NOT NULL,
  name_en        TEXT NOT NULL,
  public_status  TEXT NOT NULL DEFAULT '',
  created_by     TEXT NOT NULL REFERENCES users (id),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  deleted_at     TEXT,
  seq            INTEGER NOT NULL
) STRICT;
CREATE INDEX factions_campaign ON factions (campaign_id, seq);

CREATE TABLE npcs (
  id             TEXT PRIMARY KEY,
  campaign_id    TEXT NOT NULL REFERENCES campaigns (id),
  faction_id     TEXT REFERENCES factions (id),
  name_de        TEXT NOT NULL,
  name_en        TEXT NOT NULL,
  public_status  TEXT NOT NULL DEFAULT '',
  statline_tts   TEXT NOT NULL DEFAULT '',
  created_by     TEXT NOT NULL REFERENCES users (id),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  deleted_at     TEXT,
  seq            INTEGER NOT NULL
) STRICT;
CREATE INDEX npcs_campaign ON npcs (campaign_id, seq);

CREATE TABLE reputation_events (
  id           TEXT PRIMARY KEY,
  campaign_id  TEXT NOT NULL REFERENCES campaigns (id),
  warband_id   TEXT NOT NULL REFERENCES warbands (id),
  faction_id   TEXT NOT NULL REFERENCES factions (id),
  delta        INTEGER NOT NULL CHECK (delta != 0),
  reason       TEXT NOT NULL,
  battle_id    TEXT REFERENCES battles (id),
  actor_id     TEXT NOT NULL REFERENCES users (id),
  created_at   TEXT NOT NULL,
  deleted_at   TEXT,
  seq          INTEGER NOT NULL
) STRICT;
CREATE INDEX reputation_campaign ON reputation_events (campaign_id, seq);
