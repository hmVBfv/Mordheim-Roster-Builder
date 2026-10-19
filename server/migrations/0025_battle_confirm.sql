-- The version of a warband that goes into a battle is confirmed before it
-- is fought: by its player, or for them by a leader. rev_before is then that
-- version (until then it is only the head at the time the battle was set
-- up), before_totals freezes rating, gold and models as they stood, and
-- before_confirmed_at / _by say when and who. Nothing here blocks a battle:
-- an unconfirmed warband shows as not confirmed. The marks after the battle
-- are compared with these frozen numbers (docs/data-model.md).
ALTER TABLE battle_participants ADD COLUMN before_confirmed_at TEXT;
ALTER TABLE battle_participants ADD COLUMN before_confirmed_by TEXT REFERENCES users (id);
ALTER TABLE battle_participants ADD COLUMN before_totals TEXT;
