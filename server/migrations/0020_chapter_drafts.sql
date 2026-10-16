-- Chapters as drafts (phase 4b5b; concept.md 4.10, docs/data-model.md
-- "chapter_drafts"): a chapter written from the AI pack comes in as text
-- and stays a draft only the campaign's leaders (with the authenticator)
-- read, until a leader publishes it: its language then goes into the
-- chapter of the same `ref_key` (made if there is none), and everybody
-- reads it. A draft is one language of a chapter. Nothing in the log says
-- what a draft says.
--
-- seq: the audit_log seq of the last change; an edit names the seq it was
-- made from, so two leaders do not overwrite each other.
CREATE TABLE chapter_drafts (
  id           TEXT PRIMARY KEY,
  campaign_id  TEXT NOT NULL REFERENCES campaigns (id),
  ref_key      TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('prologue', 'battle', 'interlude', 'chapter')),
  lang         TEXT NOT NULL CHECK (lang IN ('de', 'en')),
  title        TEXT NOT NULL,
  label        TEXT NOT NULL DEFAULT '',
  ic_date      TEXT NOT NULL DEFAULT '',
  place        TEXT NOT NULL DEFAULT '',
  victor       TEXT NOT NULL DEFAULT '',
  text         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  chapter_id   TEXT REFERENCES chapters (id),
  created_by   TEXT NOT NULL REFERENCES users (id),
  updated_by   TEXT NOT NULL REFERENCES users (id),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  published_at TEXT,
  deleted_at   TEXT,
  seq          INTEGER NOT NULL
) STRICT;

CREATE INDEX chapter_drafts_campaign ON chapter_drafts (campaign_id, status);
