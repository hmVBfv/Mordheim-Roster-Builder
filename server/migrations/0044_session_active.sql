-- When somebody was really at the app (Rob, 31.10.2026): the app says so with a request header when a person works in it, not when a tab
-- only syncs in the background. "Last seen" of a user and "Last used" of a device read this; `last_seen_at` stays what keeps a session alive.
ALTER TABLE sessions ADD COLUMN active_at TEXT;
UPDATE sessions SET active_at = last_seen_at;
