-- The campaign's backstory (docs/data-model.md "Kampagne"): what happened
-- before the campaign came into the app, told in sections – "Prologue",
-- "Battle 3 – the ferry" – brought in by a leader from the group's old
-- chronicle. Every member reads it; the AI pack carries it as "the story so
-- far". One row per campaign; the sections are kept as one JSON list and
-- replaced as a whole (nothing is merged section by section).
--
-- seq: the audit_log seq of the last change; an import names the seq it was
-- made from, so two leaders do not overwrite each other.
CREATE TABLE backstory (
  campaign_id TEXT PRIMARY KEY REFERENCES campaigns (id),
  sections    TEXT NOT NULL,
  updated_by  TEXT NOT NULL REFERENCES users (id),
  updated_at  TEXT NOT NULL,
  seq         INTEGER NOT NULL
) STRICT;
