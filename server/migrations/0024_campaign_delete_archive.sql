-- Deleting and archiving campaigns (Rob, 19.10.2026).
--
-- A leader deletes a campaign: a tombstone, not a physical delete
-- (docs/data-model.md, "Grundsätze"). The campaign is gone for every member
-- – every route answers 404 – and the warbands entered in it go back to
-- their owners as free warbands with all their versions; the enrolments stay,
-- so the admin can bring the campaign back (roster-cli campaign restore).
-- archived_at of campaigns (migration 5) stays unused.
ALTER TABLE campaigns ADD COLUMN deleted_at TEXT;
ALTER TABLE campaigns ADD COLUMN deleted_by TEXT REFERENCES users (id);

-- Each member files a campaign away for themselves: it moves to the section
-- "Archived" of their own list. Nothing else changes, for anyone.
ALTER TABLE members ADD COLUMN archived_at TEXT;
