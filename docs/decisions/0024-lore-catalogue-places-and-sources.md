# 0024 – Der Lore-Katalog: Orte ineinander, Herkunft der Gruppen, auch Quellen außerhalb von mordheimer.net
Status: angenommen (Rob, 22.10.2026, Berichte #37 bis #39) · Datum: 2026-10-22 · ergänzt [0023](0023-library-per-account.md), Punkt 7

## Kontext
Der Lore-Katalog (`data/lore.json`) hatte zwölf Regionen, sechs Fraktionen und fünf
Gruppen, alle rund um Mordheim und alle von mordheimer.net. Rob will eine lebendigere
Welt: mehr Gruppen (etwa die Stämme der Marauders of Chaos), mehr Regionen der
Warhammer-Welt – ausdrücklich auch weit weg von Mordheim und, wo mordheimer.net
nichts sagt, auch von anderen Seiten –, und Orte, die ineinander liegen (die Grube
in Mordheim, Mordheim in Ostermark, Ostermark im Imperium). Denn nicht alle
Warbands kommen aus Mordheim, viele reisen von weither an, und ihre Herkunft soll
im Hintergrund sichtbar werden.

## Entscheidung
1. **Orte liegen ineinander.** Eine Region hat optional `parent`, die ID der
   Region, die sie enthält (keine für ein Reich wie die Alte Welt). Ketten dürfen
   nicht kreisen; ein Test prüft das.
2. **Gruppen und Fraktionen kommen von Orten.** Sie haben optional `regions`, die
   IDs der Regionen, aus denen sie stammen oder in denen sie sitzen. Die Liste
   lässt sich nach einem Ort filtern; der Filter nimmt, was in dem Ort liegt, mit.
3. **Quellen:** zuerst mordheimer.net. Wo die Seite zu einem Ort oder einer Gruppe
   nur einen Nebensatz sagt, bleibt der Eintrag weg, wie bisher. Zusätzlich sind
   öffentliche Warhammer-Wikis (whfb.lexicanum.com, warhammerfantasy.fandom.com)
   als Quelle erlaubt, wenn der Text **mit eigenen Worten** geschrieben ist und
   die Seite wirklich gelesen wurde; jeder Eintrag nennt seine Quelle. Das ersetzt
   „nur mordheimer.net“ aus 0023, Punkt 7. Lore ist nie Regelwerk: nichts davon
   wird spielbar.
4. **Einträge in `data/` ändern sich nur mit Robs OK und Beleg** (0023) – unverändert.

## Folgen
- `app/src/library/lore.ts` (`ancestors`, `placeOptions`, `inPlace`), der Reiter Lore
  zeigt den Weg eines Ortes („In Ostermark › Mordheim“), die Herkunft einer Gruppe
  („From …“) und hat die Auswahl „Place“.
- `core/test/lore-audit.test.ts` prüft den Katalog: jede Quelle gelesen und
  benannt, Eltern und Herkunftsorte vorhanden, keine Schleifen.
- Beim Schreiben dieser Runde waren die Wikis aus der Cloud-Sitzung nicht
  erreichbar (DNS, Proxy); alle Einträge stammen deshalb von mordheimer.net.
  Orte und Gruppen, zu denen mordheimer.net schweigt (Badlands, Troll Country,
  Nordland, Wissenland, Ind, Südlande, Ogerreiche u. a.), fehlen noch.
