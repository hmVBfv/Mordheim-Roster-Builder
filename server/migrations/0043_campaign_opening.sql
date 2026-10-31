-- The opening scene of a campaign (wish #169, Rob, 30.10.2026): what a leader wrote of the place and the story the campaign starts from.
-- Empty: the app shows the Lore's description of the campaign's place instead. Every member of the campaign reads it.
ALTER TABLE campaigns ADD COLUMN opening TEXT NOT NULL DEFAULT '';
