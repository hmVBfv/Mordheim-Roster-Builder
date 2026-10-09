-- Pictures of a campaign (phase 4a3, part 2; concept.md 4.6, docs/security.md
-- "Uploads"): a screenshot from Tabletop Simulator or a photo of the table,
-- hung on a battle (at a turn) or on the campaign in general. The device
-- names it (UUID), shrinks it and encodes it anew (no EXIF, no GPS) before
-- it is sent; first what it is (this row, pending), then its bytes. The
-- server keeps the bytes under <UPLOAD_DIR>/<campaign_id>/<id>.<png|jpg|webp>
-- – never a name from outside – and serves them only to who may see them.
--
-- visibility: public (every member) or leader (leaders only; players and
-- viewers never receive it, not even its row). bytes: announced, then the
-- size stored; sha256 of the stored file, null while pending. seq: the
-- audit_log seq of its last change, so a device asks only for what is newer.
CREATE TABLE attachments (
  id           TEXT PRIMARY KEY,
  campaign_id  TEXT NOT NULL REFERENCES campaigns (id),
  battle_id    TEXT REFERENCES battles (id),
  turn         INTEGER,
  uploader_id  TEXT NOT NULL REFERENCES users (id),
  mime         TEXT NOT NULL CHECK (mime IN ('image/png', 'image/jpeg', 'image/webp')),
  bytes        INTEGER NOT NULL CHECK (bytes > 0),
  width        INTEGER NOT NULL,
  height       INTEGER NOT NULL,
  sha256       TEXT,
  caption      TEXT NOT NULL DEFAULT '',
  visibility   TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'leader')),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  stored_at    TEXT,
  deleted_at   TEXT,
  seq          INTEGER NOT NULL
) STRICT;
CREATE INDEX attachments_campaign ON attachments (campaign_id, seq);
CREATE INDEX attachments_battle ON attachments (battle_id);
