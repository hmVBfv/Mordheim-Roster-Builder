-- What changed between two marks of a warband (phase 4a4; concept.md 4.3,
-- ADR 0003, ADR 0016; docs/data-model.md section 4): computed by the server
-- with core when a warband is marked "after battle N" – the comparison of
-- the marked version with the one of the mark before, matched with the
-- log and casualties of that battle in the save – and frozen with the tag.
-- payload carries the warrior's name and before/after; event_ref the
-- evidence (evt:<log id> or cas:<casualty id>); unexplained: none found.
CREATE TABLE changes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tag_id        TEXT NOT NULL REFERENCES tags (id),
  warband_id    TEXT NOT NULL REFERENCES warbands (id),
  battle_id     TEXT REFERENCES battles (id),
  seq_in_tag    INTEGER NOT NULL,
  kind          TEXT NOT NULL,
  uid           TEXT,
  change_key    TEXT NOT NULL,
  payload       TEXT NOT NULL,
  event_ref     TEXT,
  unexplained   INTEGER NOT NULL CHECK (unexplained IN (0, 1))
) STRICT;
CREATE INDEX changes_tag ON changes (tag_id, seq_in_tag);
