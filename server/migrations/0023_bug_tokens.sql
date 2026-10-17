-- The bug token (phase 4c2; ADR 0019, docs/security.md section 7): a credential
-- that lets a cloud session read and sort the problem reports – GET and PATCH
-- /bugs and nothing else. It is not a session: it is made only by roster-cli
-- (printed once, never shown again), it runs out, and it can be revoked.
-- Only the hash is kept, like for sessions and links. The staging copy of the
-- database loses every token (roster-cli test-accounts).
CREATE TABLE bug_tokens (
  id            TEXT PRIMARY KEY,
  label         TEXT NOT NULL DEFAULT '',
  token_hash    TEXT NOT NULL UNIQUE,
  created_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  revoked_at    TEXT,
  last_used_at  TEXT
) STRICT;
