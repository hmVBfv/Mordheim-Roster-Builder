-- A short headline for a problem report (wish #28, Rob, 21.10.2026): the words the admin puts over a report in
-- Admin -> Reports, written by whoever sorts it (the /bugs command writes one in its own words), so the list reads
-- as a list of what is wrong and the reporter's text sits under it. Not shown to the reporter, never in the log.
ALTER TABLE bugs ADD COLUMN headline TEXT NOT NULL DEFAULT '';
