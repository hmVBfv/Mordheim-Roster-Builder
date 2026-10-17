-- A number for every problem report (phase 4c2; ADR 0012: the fix's commit
-- says "Fix #N"). The id comes from the device, a number is what people say
-- ("bug 7"): the next free one, given when the server takes the report.
-- Reports that exist already are numbered by the order they came in.
ALTER TABLE bugs ADD COLUMN number INTEGER;
UPDATE bugs SET number = (
  SELECT count(*) FROM bugs b WHERE b.created_at < bugs.created_at OR (b.created_at = bugs.created_at AND b.rowid <= bugs.rowid)
);
CREATE UNIQUE INDEX bugs_number ON bugs (number);
