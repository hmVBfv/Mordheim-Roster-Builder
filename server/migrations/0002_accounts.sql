-- Accounts and sign-in (phase 3g; ADR 0008, docs/security.md section 3,
-- docs/data-model.md "Nutzer und Anmeldung" and "Betrieb").

-- A player, leader or the admin. Usernames compare without case. The TOTP
-- secret is encrypted with TOTP_KEY from app.env; a secret being set up
-- waits in totp_pending_enc until its first code is confirmed. The recovery
-- codes are kept only as hashes (JSON array; a used code is removed);
-- totp_last_step is the time step of the last code used, so a code works once.
CREATE TABLE users (
  id               TEXT PRIMARY KEY,
  username         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name     TEXT NOT NULL,
  pw_hash          TEXT NOT NULL,
  is_admin         INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
  totp_secret_enc  TEXT,
  totp_pending_enc TEXT,
  totp_enabled_at  TEXT,
  totp_last_step   INTEGER NOT NULL DEFAULT 0,
  totp_recovery    TEXT,
  created_at       TEXT NOT NULL,
  disabled_at      TEXT
) STRICT;

-- One signed-in device. Only the token's hash is stored. stage 'totp': the
-- password was right, the code from the authenticator is still due (a few
-- minutes at most); 'full': signed in.
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users (id),
  token_hash    TEXT NOT NULL UNIQUE,
  stage         TEXT NOT NULL CHECK (stage IN ('totp', 'full')),
  device_label  TEXT NOT NULL,
  ip            TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  revoked_at    TEXT
) STRICT;
CREATE INDEX sessions_user ON sessions (user_id);

-- One-time links: 'register' (7 days) makes an account, 'reset' (24 hours)
-- sets a new password for for_user_id. created_by is null when roster-cli
-- made the link on the Pi; is_admin only from roster-cli.
CREATE TABLE invites (
  id           TEXT PRIMARY KEY,
  token_hash   TEXT NOT NULL UNIQUE,
  kind         TEXT NOT NULL CHECK (kind IN ('register', 'reset')),
  created_by   TEXT REFERENCES users (id),
  for_user_id  TEXT REFERENCES users (id),
  campaign_id  TEXT,
  is_admin     INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
  note         TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  used_at      TEXT,
  revoked_at   TEXT
) STRICT;

-- Every attempt to sign in, for the brake, Fail2Ban's log lines and the
-- admin's view of who signed in when (Rob, 03.10.2026). Kept 180 days.
CREATE TABLE login_attempts (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  username  TEXT NOT NULL,
  ip        TEXT NOT NULL,
  at        TEXT NOT NULL,
  ok        INTEGER NOT NULL CHECK (ok IN (0, 1)),
  reason    TEXT NOT NULL DEFAULT ''
) STRICT;
CREATE INDEX login_attempts_user ON login_attempts (username, at);
CREATE INDEX login_attempts_ip ON login_attempts (ip, at);

-- Every write action, in order; seq is the order (and later drives sync).
CREATE TABLE audit_log (
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  at           TEXT NOT NULL,
  actor_id     TEXT,
  action       TEXT NOT NULL,
  target_type  TEXT,
  target_id    TEXT,
  campaign_id  TEXT,
  visibility   TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'sealed', 'leader', 'admin')),
  payload      TEXT
) STRICT;
