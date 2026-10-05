-- Battles and the game night (phase 4a2; concept.md 4.5, ADR 0010;
-- docs/data-model.md "Kampagne").

-- A battle of a campaign. round: the battle round it belongs to (battle N
-- of the campaign is round N; round 0 is the setup). turn: the game turn
-- the leader is at, for the protocol. status: open while played, closed
-- once its aftermath is done (phase 4a4). seq: the audit_log seq of the
-- last change to it, its protocol or its proposals – a device that has
-- seen it asks only for what is newer.
CREATE TABLE battles (
  id           TEXT PRIMARY KEY,
  campaign_id  TEXT NOT NULL REFERENCES campaigns (id),
  round        INTEGER NOT NULL,
  title        TEXT NOT NULL DEFAULT '',
  scenario_id  TEXT NOT NULL DEFAULT '',
  district     TEXT NOT NULL DEFAULT '',
  played_at    TEXT,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  turn         INTEGER NOT NULL DEFAULT 1,
  result       TEXT NOT NULL DEFAULT '{}',
  created_by   TEXT NOT NULL REFERENCES users (id),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  closed_at    TEXT,
  seq          INTEGER NOT NULL
) STRICT;
CREATE INDEX battles_campaign ON battles (campaign_id, round);

-- The warbands that fought it. rev_before: the warband's version when the
-- battle was set up; rev_after: the one marked after it (phase 4a4).
-- outcome as the Roster Builder names it.
CREATE TABLE battle_participants (
  battle_id   TEXT NOT NULL REFERENCES battles (id),
  warband_id  TEXT NOT NULL REFERENCES warbands (id),
  rev_before  INTEGER,
  rev_after   INTEGER,
  outcome     TEXT NOT NULL DEFAULT '' CHECK (outcome IN ('', 'victory', 'defeat', 'draw', 'routed')),
  PRIMARY KEY (battle_id, warband_id)
) STRICT;

-- The protocol: written by a leader only (ADR 0010). The id comes from the
-- device, so an entry made offline and sent twice is one entry. kind:
-- casualty (payload: victim, attacker, note) or event (payload: text).
-- deleted_at: taken out (the row stays, for the log).
CREATE TABLE protocol_entries (
  id          TEXT PRIMARY KEY,
  battle_id   TEXT NOT NULL REFERENCES battles (id),
  turn        INTEGER NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('casualty', 'event')),
  payload     TEXT NOT NULL,
  author_id   TEXT NOT NULL REFERENCES users (id),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  deleted_at  TEXT
) STRICT;
CREATE INDEX protocol_battle ON protocol_entries (battle_id, created_at);

-- A player's correction of the protocol: a text, about one entry or the
-- battle, and the change it asks for. A leader accepts (the change is
-- applied) or rejects it. The id comes from the device, like an entry's.
CREATE TABLE proposals (
  id           TEXT PRIMARY KEY,
  campaign_id  TEXT NOT NULL REFERENCES campaigns (id),
  battle_id    TEXT NOT NULL REFERENCES battles (id),
  target_type  TEXT NOT NULL CHECK (target_type IN ('battle', 'protocol_entry')),
  target_id    TEXT NOT NULL,
  author_id    TEXT NOT NULL REFERENCES users (id),
  payload      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'rejected')),
  decided_by   TEXT REFERENCES users (id),
  decided_at   TEXT,
  created_at   TEXT NOT NULL
) STRICT;
CREATE INDEX proposals_battle ON proposals (battle_id, status);
