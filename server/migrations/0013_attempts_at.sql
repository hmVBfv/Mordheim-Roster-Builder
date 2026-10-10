-- The clean-up of old sign-in attempts (security review AUTH-7): every
-- attempt deletes the ones older than half a year, which scanned the whole
-- table without an index on the time.
CREATE INDEX login_attempts_at ON login_attempts (at);
