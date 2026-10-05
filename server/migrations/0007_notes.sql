-- Notes (phase 4a3; concept.md 4.6, ADR 0010, ADR 0011; docs/data-model.md
-- "Erzählung"). Every note has exactly one author; nobody edits another's
-- text but a leader (logged). The id comes from the device, so a note
-- written offline and sent twice is one note.
--
-- visibility: public (every member), sealed (the author alone until the
-- battle sealed_until_battle is closed – not the leader, not the admin),
-- leader (leaders only). Filtered on the server only (ADR 0011).
-- kind: general, scene, quote, dice (a dice moment), hook (an open thread).
-- mentions: the warriors named, picked from the rosters ([{ warbandId, uid,
-- name }]); for a quote the first one is the speaker. seq: the audit_log seq
-- of its last change, so a device asks only for what is newer.
CREATE TABLE notes (
  id                   TEXT PRIMARY KEY,
  campaign_id          TEXT NOT NULL REFERENCES campaigns (id),
  battle_id            TEXT REFERENCES battles (id),
  turn                 INTEGER,
  author_id            TEXT NOT NULL REFERENCES users (id),
  kind                 TEXT NOT NULL DEFAULT 'general' CHECK (kind IN ('general', 'scene', 'quote', 'dice', 'hook')),
  text                 TEXT NOT NULL,
  lang                 TEXT NOT NULL DEFAULT '',
  visibility           TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'sealed', 'leader')),
  sealed_until_battle  TEXT REFERENCES battles (id),
  mentions             TEXT NOT NULL DEFAULT '[]',
  protocol_entry_id    TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  deleted_at           TEXT,
  seq                  INTEGER NOT NULL,
  CHECK ((visibility = 'sealed') = (sealed_until_battle IS NOT NULL))
) STRICT;
CREATE INDEX notes_campaign ON notes (campaign_id, seq);
CREATE INDEX notes_battle ON notes (battle_id);

-- The earlier wordings of a note: written on every change of its text.
CREATE TABLE note_revisions (
  note_id    TEXT NOT NULL REFERENCES notes (id),
  text       TEXT NOT NULL,
  edited_by  TEXT NOT NULL REFERENCES users (id),
  edited_at  TEXT NOT NULL
) STRICT;
CREATE INDEX note_revisions_note ON note_revisions (note_id);
