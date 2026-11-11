-- A report may carry the structure of the campaign it was sent from (wish #253, Rob, 11.11.2026): members, warbands, battles,
-- round, house rules – built by the server at the moment it is sent, only for a leader of that campaign, never a word of the
-- story. Like the warband copy it is dropped when the report is closed or called a duplicate.
ALTER TABLE bugs ADD COLUMN campaign_id TEXT;
ALTER TABLE bugs ADD COLUMN campaign_attachment TEXT;
