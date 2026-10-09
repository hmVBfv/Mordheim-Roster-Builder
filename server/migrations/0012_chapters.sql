-- The published chapters of the chronicle in the timeline (phase 4a5, part
-- 2; docs/data-model.md "Erzählung", roadmap 4a5): a running campaign
-- brings the chapters already written about it – the prologue, a chapter
-- per battle, the interludes – and they stand at the head of the part of
-- the story they tell. What is published is public to every member
-- (ADR 0002); a leader imports them.
--
-- One row per chapter, both languages beside each other, as the chronicle
-- links them (ADR 0013): ref_key is the chronicle's `ref` (prolog,
-- battle-1, interlude-1, …), one per campaign. de and en: JSON
-- { label, title, icDate, place, victor, text } or empty when that
-- language is missing; text is the chapter's Markdown as published.
-- deleted_at: taken out (the row stays, its ref is free again).
CREATE TABLE chapters (
  id            TEXT PRIMARY KEY,
  campaign_id   TEXT NOT NULL REFERENCES campaigns (id),
  ref_key       TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('prologue', 'battle', 'interlude', 'chapter')),
  published_on  TEXT,
  de            TEXT,
  en            TEXT,
  created_by    TEXT NOT NULL REFERENCES users (id),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  seq           INTEGER NOT NULL
) STRICT;
CREATE UNIQUE INDEX chapters_ref ON chapters (campaign_id, ref_key) WHERE deleted_at IS NULL;

-- A chapter is a block of the timeline too: its place is a position like a
-- note's (item_type 'chapter'). SQLite cannot change a CHECK, so the table
-- is built anew with the rows it had.
CREATE TABLE timeline_positions_new (
  campaign_id  TEXT NOT NULL REFERENCES campaigns (id),
  item_type    TEXT NOT NULL CHECK (item_type IN ('note', 'picture', 'entry', 'chapter')),
  item_id      TEXT NOT NULL,
  segment      TEXT NOT NULL,
  pos          TEXT NOT NULL CHECK (pos GLOB '[0-9]*' AND length(pos) BETWEEN 1 AND 64),
  turn         INTEGER,
  moved_by     TEXT NOT NULL REFERENCES users (id),
  moved_at     TEXT NOT NULL,
  seq          INTEGER NOT NULL,
  PRIMARY KEY (item_type, item_id)
) STRICT;
INSERT INTO timeline_positions_new SELECT campaign_id, item_type, item_id, segment, pos, turn, moved_by, moved_at, seq FROM timeline_positions;
DROP TABLE timeline_positions;
ALTER TABLE timeline_positions_new RENAME TO timeline_positions;
CREATE INDEX timeline_positions_campaign ON timeline_positions (campaign_id);
