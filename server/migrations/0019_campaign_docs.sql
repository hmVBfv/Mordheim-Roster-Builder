-- The campaign's own writing instructions (phase 4b4a; concept.md 4.10,
-- docs/data-model.md "Kampagne"): the style guide the AI pack hands to
-- whoever writes the chapter – language, tense, voice, what stays out of the
-- prose. One text per kind and campaign; only the campaign's leaders (with
-- the authenticator) read and write it. `canon_extra` is reserved for
-- spellings that belong to no warrior (phase 4b4b, the canon export).
--
-- seq: the audit_log seq of the last change; an edit names the seq it was
-- made from, so two leaders do not overwrite each other.
CREATE TABLE campaign_docs (
  campaign_id TEXT NOT NULL REFERENCES campaigns (id),
  kind        TEXT NOT NULL CHECK (kind IN ('style', 'canon_extra')),
  text        TEXT NOT NULL DEFAULT '',
  updated_by  TEXT NOT NULL REFERENCES users (id),
  updated_at  TEXT NOT NULL,
  seq         INTEGER NOT NULL,
  PRIMARY KEY (campaign_id, kind)
) STRICT;
