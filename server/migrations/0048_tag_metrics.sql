-- The numbers a statistics chart plots for one warband at one mark (plan P14, ADR 0003): worth, wealth, stash, experience, losses, wyrdstone,
-- income by source, spending, items – as core `stageMetrics` computes them from the marked version. JSON, NULL until the first read: a tag
-- points at one version of the warband and versions are append-only, so freezing at the first read gives the numbers freezing at the mark would.
ALTER TABLE tags ADD COLUMN metrics TEXT;
