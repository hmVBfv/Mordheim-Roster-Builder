-- Problem reports (phase 4c1; concept.md 4.12, ADR 0012, docs/data-model.md
-- "Betrieb"): anyone signed in reports a bug, a wish or a rules issue from
-- inside the app; the reporter follows its status, the admin sorts it.
--
-- Who sees a report: its reporter (kind, words, status, "fixed in") and the
-- admin with the authenticator – nobody else. What goes along without the
-- reporter writing it (view, steps, settings, house rules, the last
-- JavaScript errors) is structure and fixed words, never typed text, and is
-- shown to the reporter before sending. A warband travels along only when
-- the reporter ticks it (consent_attach); the copy is dropped when the
-- report is closed or marked a duplicate, the fact that it was attached
-- stays.
--
-- id comes from the device, so a report sent twice is one report.
-- warband_id/rev name what the copy is of; no foreign key, a report does
-- not depend on the warband staying. context, js_errors and attachment are
-- JSON text. updated_at moves with every change of status, severity or area.
CREATE TABLE bugs (
  id              TEXT PRIMARY KEY,
  reporter_id     TEXT NOT NULL REFERENCES users (id),
  kind            TEXT NOT NULL CHECK (kind IN ('bug', 'wish', 'rules')),
  title           TEXT NOT NULL,
  text            TEXT NOT NULL,
  source_ref      TEXT NOT NULL DEFAULT '',
  severity        TEXT CHECK (severity IN ('S1', 'S2', 'S3', 'S4')),
  area            TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'confirmed', 'in_progress', 'fixed', 'closed', 'duplicate')),
  app_version     TEXT NOT NULL DEFAULT '',
  device          TEXT NOT NULL DEFAULT '',
  view            TEXT NOT NULL DEFAULT '',
  js_errors       TEXT NOT NULL DEFAULT '[]',
  context         TEXT,
  warband_id      TEXT,
  rev             INTEGER,
  consent_attach  INTEGER NOT NULL DEFAULT 0 CHECK (consent_attach IN (0, 1)),
  attachment      TEXT,
  fixed_in        TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
) STRICT;
CREATE INDEX bugs_reporter ON bugs (reporter_id, created_at);
CREATE INDEX bugs_status ON bugs (status, created_at);
