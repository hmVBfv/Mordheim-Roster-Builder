-- The balance of a post-battle round (N13, docs/plan-postbattle.md, ADR 0003): frozen with the mark "after battle N", as core computes it from
-- the marked version – injuries, experience, the exploration, wyrdstone, gold made and spent by source, what the steps found. JSON; NULL for a
-- tag marked before this migration, and for the start and the rounds sat out.
ALTER TABLE tags ADD COLUMN summary TEXT;
