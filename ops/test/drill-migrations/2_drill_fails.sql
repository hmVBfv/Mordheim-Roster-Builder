-- … followed by one that fails: the schema has moved on, health says 503,
-- and roster-deploy must put the pre-deploy snapshot back.
INSERT INTO no_such_table VALUES (1);
