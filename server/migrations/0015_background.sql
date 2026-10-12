-- The background (phase 4b1; concept.md 4.8, ADR 0002, ADR 0011;
-- docs/data-model.md "Hintergrund"): the leaders' side of the story – threads
-- with the truth behind them, people, places, planned scenarios, notes for
-- the game master. It is read and written by the campaign's leaders alone
-- (with the authenticator); no player, no viewer and no admin outside the
-- campaign ever receives a word of it, and it appears in no export and no
-- repository.
--
-- reveal: how much of the truth the story may show – hidden (nothing), hint
-- (traces, within hint_limits), revealed (public, from reveal_from_battle on).
-- players_know is what the players have learned so far. refs: what the entry
-- hangs on ([{ kind: battle|entry|warrior|note|text, id, label }]). battle_id
-- puts a game master's note (or a planned scenario) to a battle. The id comes
-- from the device, so an entry sent twice is one entry. seq: the audit_log seq
-- of its last change, so a device asks only for what is newer; a taken-out
-- entry keeps its row (deleted_at) and its seq moves.
CREATE TABLE background_entries (
  id                  TEXT PRIMARY KEY,
  campaign_id         TEXT NOT NULL REFERENCES campaigns (id),
  kind                TEXT NOT NULL CHECK (kind IN ('thread', 'figure', 'place', 'scenario', 'gm_note')),
  title               TEXT NOT NULL,
  truth               TEXT NOT NULL DEFAULT '',
  players_know        TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'resolved')),
  reveal              TEXT NOT NULL DEFAULT 'hidden' CHECK (reveal IN ('hidden', 'hint', 'revealed')),
  hint_limits         TEXT NOT NULL DEFAULT '',
  reveal_from_battle  TEXT REFERENCES battles (id),
  refs                TEXT NOT NULL DEFAULT '[]',
  battle_id           TEXT REFERENCES battles (id),
  created_by          TEXT NOT NULL REFERENCES users (id),
  updated_by          TEXT NOT NULL REFERENCES users (id),
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  deleted_at          TEXT,
  seq                 INTEGER NOT NULL
) STRICT;
CREATE INDEX background_campaign ON background_entries (campaign_id, seq);

-- The wording before each change (the last fifty are kept per entry).
CREATE TABLE background_revisions (
  entry_id   TEXT NOT NULL REFERENCES background_entries (id),
  snapshot   TEXT NOT NULL,
  edited_by  TEXT NOT NULL REFERENCES users (id),
  edited_at  TEXT NOT NULL
) STRICT;
CREATE INDEX background_revisions_entry ON background_revisions (entry_id);

-- Every reveal: the public note it made (the one thing that left the
-- background), where it stands, and the level the entry stood at afterwards.
CREATE TABLE background_reveals (
  note_id      TEXT PRIMARY KEY REFERENCES notes (id),
  entry_id     TEXT NOT NULL REFERENCES background_entries (id),
  battle_id    TEXT REFERENCES battles (id),
  level        TEXT NOT NULL CHECK (level IN ('hint', 'revealed')),
  revealed_by  TEXT NOT NULL REFERENCES users (id),
  revealed_at  TEXT NOT NULL
) STRICT;
CREATE INDEX background_reveals_entry ON background_reveals (entry_id);
