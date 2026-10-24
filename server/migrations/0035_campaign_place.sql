-- The place of a campaign (wish #66, Rob, 24.10.2026): optionally a region or city of the lore (data/lore.json, e.g.
-- 'mordheim'), chosen when the campaign starts. The key only; the name comes from the lore on the device. Open to every
-- member like the rest of a campaign's mechanics (ADR 0002). '' = none.
ALTER TABLE campaigns ADD COLUMN place TEXT NOT NULL DEFAULT '';
