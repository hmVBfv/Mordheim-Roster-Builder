-- The Library (ADR 0023, Rob, 21.10.2026): what a person writes without a
-- campaign – ideas first, later factions, NPCs, groups and scenarios – kept
-- with the account on the server, so it is on every device. Private: only
-- the owner reads and writes it; not another player, not a leader, not the
-- admin (ADR 0011). Loading an entry into a campaign makes a copy there.
--
-- id comes from the device, so an entry sent twice is one. seq counts the
-- owner's changes (1, 2, 3 …), tombstones included, so a device that has an
-- older state asks only for what is newer and learns about a removal. An edit
-- names the seq it was made from (409 stale otherwise). A taken-out entry
-- keeps its row (deleted_at); its id is not written again.
CREATE TABLE library_items (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL REFERENCES users (id),
  kind        TEXT NOT NULL CHECK (kind IN ('idea', 'faction', 'npc', 'group', 'scenario')),
  name        TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT,
  seq         INTEGER NOT NULL
) STRICT;
CREATE INDEX library_items_owner ON library_items (owner_id, seq);
