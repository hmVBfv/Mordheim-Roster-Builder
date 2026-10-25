-- Places of the world (wish #73, Rob, 25.10.2026): regions, towns and the like are one more kind of the Library
-- (ADR 0023) – private to the owner, written under the device's id, readable offline – so the kind list of the
-- check grows by `location`. SQLite cannot change a CHECK, so the table is made again and its rows copied; nothing
-- else references it. (Links between entries, wish #74, live in the body of each entry and need no column.)
CREATE TABLE library_items_new (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL REFERENCES users (id),
  kind        TEXT NOT NULL CHECK (kind IN ('idea', 'faction', 'npc', 'group', 'scenario', 'warband_group', 'location')),
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
