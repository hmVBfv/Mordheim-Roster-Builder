-- Vanilla Mordheim (wish #167, Rob, 30.10.2026): a campaign can play only the rulebook. It is chosen when the campaign starts and is off
-- otherwise; a running campaign is never turned to Vanilla, a leader can turn it off for good. Only the warbands of the rulebook enter one.
ALTER TABLE campaigns ADD COLUMN vanilla INTEGER NOT NULL DEFAULT 0 CHECK (vanilla IN (0, 1));
