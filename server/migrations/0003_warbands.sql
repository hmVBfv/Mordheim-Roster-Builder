-- Warbands on the server (phase 3h; ADR 0003, docs/data-model.md
-- "Warbands", docs/architecture.md section 6).

-- A warband belongs to one user. Without a campaign it is "free" (a draft, a
-- blueprint for a campaign start, concept.md 4.1) and only its owner sees it;
-- campaigns and enrolments join in phase 4a. The id comes from the device
-- (UUID), so a warband made offline keeps its id. copied_from/copied_rev: the
-- warband and version it was copied from. seq: the audit_log seq of the last
-- change, for GET /sync. archived_at: removed (a tombstone, never deleted).
CREATE TABLE warbands (
  id           TEXT PRIMARY KEY,
  owner_id     TEXT NOT NULL REFERENCES users (id),
  name         TEXT NOT NULL,
  wb_type      TEXT NOT NULL,
  head_rev     INTEGER NOT NULL,
  copied_from  TEXT,
  copied_rev   INTEGER,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  archived_at  TEXT,
  seq          INTEGER NOT NULL
) STRICT;
CREATE INDEX warbands_owner ON warbands (owner_id, seq);

-- Every version, append only. data is the save as core/format writes it
-- (JSON, at most 2 MB). source: how it came about.
CREATE TABLE warband_versions (
  warband_id   TEXT NOT NULL REFERENCES warbands (id),
  rev          INTEGER NOT NULL,
  data         TEXT NOT NULL,
  format       INTEGER NOT NULL,
  app_version  TEXT NOT NULL DEFAULT '',
  source       TEXT NOT NULL CHECK (source IN ('save', 'import', 'copy', 'restore', 'migration')),
  created_by   TEXT NOT NULL REFERENCES users (id),
  created_at   TEXT NOT NULL,
  note         TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (warband_id, rev)
) STRICT;

-- The work since the last version, one place per user and warband: saved
-- every few seconds while editing, so nothing is lost when the phone closes
-- the tab. A new version by the same user empties it.
CREATE TABLE warband_autosaves (
  warband_id   TEXT NOT NULL REFERENCES warbands (id),
  user_id      TEXT NOT NULL REFERENCES users (id),
  base_rev     INTEGER NOT NULL,
  data         TEXT NOT NULL,
  device       TEXT NOT NULL DEFAULT '',
  updated_at   TEXT NOT NULL,
  seq          INTEGER NOT NULL,
  PRIMARY KEY (warband_id, user_id)
) STRICT;
