-- What the server keeps about itself (docs/data-model.md, Betrieb):
--   epoch          changes whenever the database is restored (sync starts anew)
--   created_at     when this database was first created
--   restored_from  only in snapshot copies: the snapshot's label and time;
--                  removed, with a new epoch, when a server starts on the copy
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;
