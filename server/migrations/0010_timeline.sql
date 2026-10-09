-- The timeline's order (phase 4a3, part 2; concept.md 4.7, docs/data-model.md
-- section 5): where a block stands in the story, apart from when it was
-- recorded. Only a block that was moved has a row; the others stand where
-- their battle and time put them (the app works that out). Moving changes
-- one row, nothing is renumbered.
--
-- item_type: note, picture or entry (a protocol entry). segment: pre (before
-- the campaign), b<battle id>:before, b<battle id>:battle, b<battle id>:after,
-- i<round> (the interlude after that round). pos: a fractional key of
-- digits, read as 0.<pos> – between two keys there is always another.
-- seq: the audit_log seq of the move.
CREATE TABLE timeline_positions (
  campaign_id  TEXT NOT NULL REFERENCES campaigns (id),
  item_type    TEXT NOT NULL CHECK (item_type IN ('note', 'picture', 'entry')),
  item_id      TEXT NOT NULL,
  segment      TEXT NOT NULL,
  pos          TEXT NOT NULL CHECK (pos GLOB '[0-9]*' AND length(pos) BETWEEN 1 AND 64),
  turn         INTEGER,
  moved_by     TEXT NOT NULL REFERENCES users (id),
  moved_at     TEXT NOT NULL,
  seq          INTEGER NOT NULL,
  PRIMARY KEY (item_type, item_id)
) STRICT;
CREATE INDEX timeline_positions_campaign ON timeline_positions (campaign_id);
