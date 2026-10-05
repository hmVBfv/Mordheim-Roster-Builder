-- Campaigns, their members and the warbands entered in them (phase 4a;
-- concept.md 3, 4.1, 4.2 and 4.4; docs/data-model.md "Kampagne").

-- A campaign. round: 0 is the setup, then one per battle round.
-- house_rules: the campaign's switches (JSON), the same for every warband.
CREATE TABLE campaigns (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  round        INTEGER NOT NULL DEFAULT 0,
  house_rules  TEXT NOT NULL DEFAULT '{}',
  created_by   TEXT NOT NULL REFERENCES users (id),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  archived_at  TEXT
) STRICT;

-- Who belongs to a campaign, and as what. A leader needs the authenticator
-- to act as one (ADR 0008); every campaign keeps at least one. left_at:
-- no longer a member (the row stays, for the log and the history).
CREATE TABLE members (
  campaign_id  TEXT NOT NULL REFERENCES campaigns (id),
  user_id      TEXT NOT NULL REFERENCES users (id),
  role         TEXT NOT NULL CHECK (role IN ('leader', 'player', 'viewer')),
  joined_at    TEXT NOT NULL,
  left_at      TEXT,
  added_by     TEXT REFERENCES users (id),
  PRIMARY KEY (campaign_id, user_id)
) STRICT;
CREATE INDEX members_user ON members (user_id, left_at);

-- A warband entered in a campaign: always a copy of the player's own
-- (concept.md 4.1), waiting for a leader (pending) until confirmed (active),
-- or declined, or left. One open enrolment per warband.
CREATE TABLE enrolments (
  id            TEXT PRIMARY KEY,
  campaign_id   TEXT NOT NULL REFERENCES campaigns (id),
  warband_id    TEXT NOT NULL REFERENCES warbands (id),
  player_id     TEXT NOT NULL REFERENCES users (id),
  status        TEXT NOT NULL CHECK (status IN ('pending', 'active', 'declined', 'left')),
  from_round    INTEGER,
  created_at    TEXT NOT NULL,
  confirmed_by  TEXT REFERENCES users (id),
  confirmed_at  TEXT,
  ended_by      TEXT REFERENCES users (id),
  ended_at      TEXT
) STRICT;
CREATE UNIQUE INDEX enrolments_open ON enrolments (warband_id) WHERE status IN ('pending', 'active');
CREATE INDEX enrolments_campaign ON enrolments (campaign_id, status);

-- The campaign a warband is entered in while its enrolment is open; free
-- (no campaign) otherwise. Kept on the warband so its owner's sync carries it.
ALTER TABLE warbands ADD COLUMN campaign_id TEXT REFERENCES campaigns (id);

-- Marked versions (ADR 0003, concept.md 4.2): start (entered in a campaign),
-- after_battle, sat_out. totals: frozen as the server computed them then,
-- never recomputed. A correction is a new tag; the old one gets superseded_by.
CREATE TABLE tags (
  id             TEXT PRIMARY KEY,
  warband_id     TEXT NOT NULL REFERENCES warbands (id),
  rev            INTEGER NOT NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('start', 'after_battle', 'sat_out')),
  campaign_id    TEXT NOT NULL REFERENCES campaigns (id),
  battle_id      TEXT,
  round          INTEGER NOT NULL,
  totals         TEXT NOT NULL,
  created_by     TEXT NOT NULL REFERENCES users (id),
  created_at     TEXT NOT NULL,
  superseded_by  TEXT REFERENCES tags (id)
) STRICT;
CREATE INDEX tags_warband ON tags (warband_id, campaign_id);
