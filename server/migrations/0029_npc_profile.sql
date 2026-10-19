-- The values of an NPC in the world (Rob, 19.10.2026): until now an NPC had
-- a line of text in the Tabletop Simulator form, typed by hand; a leader now
-- fills the usual characteristics, save, skills, equipment and rules in a
-- form (or copies them from any model of the game), and says whether the NPC
-- is a named, unique person. The text stays – written from the values by the
-- app, or typed by hand as the fallback – so every older NPC and every older
-- device keeps working.
--
-- profile: the values as JSON (server/src/opponents.ts NpcProfileBody), or ''
-- for an NPC that has only its text. named: 1 for a named, unique person.
-- Still mechanics, still open to every member (ADR 0002).
ALTER TABLE npcs ADD COLUMN named INTEGER NOT NULL DEFAULT 0 CHECK (named IN (0, 1));
ALTER TABLE npcs ADD COLUMN profile TEXT NOT NULL DEFAULT '';
