-- Questions to players (phase 4b3; concept.md 4.6 "Fragen des Leiters",
-- ADR 0011; docs/data-model.md "Erzählung"): a leader asks one player a
-- pointed question ("How did Robba spend the night after the battle?"); the
-- answer becomes a note of that player's, with the visibility they choose.
--
-- Who sees a question: the leaders of the campaign, and the one it is asked
-- of – nobody else, and not even the one it is asked of once a leader has
-- withdrawn it. The question's words never reach the answer's note or the
-- timeline; only the player's own words do. Filtered on the server only.
--
-- id comes from the device, so a question sent twice is one question. seq:
-- the audit_log seq of its last change. answer_note_id: the note that is the
-- answer, set once, with the status.
CREATE TABLE questions (
  id              TEXT PRIMARY KEY,
  campaign_id     TEXT NOT NULL REFERENCES campaigns (id),
  battle_id       TEXT REFERENCES battles (id),
  asked_by        TEXT NOT NULL REFERENCES users (id),
  to_user_id      TEXT NOT NULL REFERENCES users (id),
  text            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'withdrawn')),
  answer_note_id  TEXT REFERENCES notes (id),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  answered_at     TEXT,
  seq             INTEGER NOT NULL
) STRICT;
CREATE INDEX questions_campaign ON questions (campaign_id, seq);
CREATE INDEX questions_to ON questions (to_user_id, status);
