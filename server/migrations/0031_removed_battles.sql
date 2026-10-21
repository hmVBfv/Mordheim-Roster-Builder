-- A leader may take an open battle out again (Rob, 20.10.2026): a battle made
-- by mistake. Its row goes, but a device that made it offline sends its
-- "create" again – with the same id, so that sending twice is one battle
-- (ADR 0010). This list keeps the id used: the same battle does not come
-- back (409 removed), and the warbands' versions are untouched (ADR 0003).
CREATE TABLE removed_battles (
  id           TEXT PRIMARY KEY,
  campaign_id  TEXT NOT NULL REFERENCES campaigns (id),
  removed_by   TEXT NOT NULL REFERENCES users (id),
  removed_at   TEXT NOT NULL
) STRICT;
