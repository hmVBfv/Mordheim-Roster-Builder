-- Sharing a warband (Rob, 05.10.2026; docs/data-model.md "Teilen"): always
-- as a copy – the recipient gets a warband of their own, the sender's stays
-- private. Either straight to a user (to_user) or as a short code anyone
-- signed in can enter (code_hash; only the hash is stored). data is the
-- warband as it was when shared (a save, at most 2 MB); emptied ('') once
-- the share can no longer be taken (answered, taken back, past its end).
CREATE TABLE warband_shares (
  id           TEXT PRIMARY KEY,
  from_user    TEXT NOT NULL REFERENCES users (id),
  to_user      TEXT REFERENCES users (id),
  code_hash    TEXT UNIQUE,
  warband_id   TEXT,
  name         TEXT NOT NULL,
  wb_type      TEXT NOT NULL,
  data         TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  answered_at  TEXT,
  accepted     INTEGER CHECK (accepted IN (0, 1)),
  uses         INTEGER NOT NULL DEFAULT 0,
  revoked_at   TEXT,
  CHECK ((to_user IS NULL) <> (code_hash IS NULL))
) STRICT;
CREATE INDEX warband_shares_to ON warband_shares (to_user, answered_at);
CREATE INDEX warband_shares_from ON warband_shares (from_user, created_at);

-- Wrong share codes, for the brake (a code is short: guessing must be slow).
CREATE TABLE code_attempts (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  TEXT NOT NULL,
  ip       TEXT NOT NULL,
  at       TEXT NOT NULL
) STRICT;
CREATE INDEX code_attempts_user ON code_attempts (user_id, at);
