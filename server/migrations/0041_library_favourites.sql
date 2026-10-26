-- Favourite warbands (wish #95, Rob, 26.10.2026): the warbands a person marks as favourites are one more kind of the
-- Library (ADR 0023) – private to the owner, written under the device's id, readable offline – so the kind list of the
-- check grows by `warband_favourites`. SQLite cannot change a CHECK, so the table is made again and its rows copied;
-- nothing else references it.
CREATE TABLE library_items_new (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL REFERENCES users (id),
  kind        TEXT NOT NULL CHECK (kind IN ('idea', 'faction', 'npc', 'group', 'scenario', 'warband_group', 'location', 'warband_favourites')),
  name        TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT,
  seq         INTEGER NOT NULL
) STRICT;
INSERT INTO library_items_new SELECT id, owner_id, kind, name, body, created_at, updated_at, deleted_at, seq FROM library_items;
DROP TABLE library_items;
ALTER TABLE library_items_new RENAME TO library_items;
CREATE INDEX library_items_owner ON library_items (owner_id, seq);
