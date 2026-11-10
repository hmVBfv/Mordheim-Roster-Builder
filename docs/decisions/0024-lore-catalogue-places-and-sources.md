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

## Nachtrag vom 07.11.2026: die Beschreibung der Einheiten wörtlich
Rob, 07.11.2026 (wish #231): Die Beschreibung, die eine Einheit auf ihrer Seite bei mordheimer.net hat,
steht **wörtlich** als Voreinstellung ihrer Story („A few lines about him“); der eigene Text der Spieler ersetzt
sie. Das ist eine Ausnahme von „mit eigenen Worten“ **nur für diesen Zweck**: `data/unitlore.json`, gelesen mit
curl, mit Kopfzeile, die das sagt; Test `core/test/unitlore.test.ts`. Alles andere (der Lore-Katalog, die
Eröffnung einer Warband in `data/warbandintro.json`) bleibt in eigenen Worten.

## Nachtrag vom 08.11.2026: die Lore-Zeile der Zauber wörtlich
Rob, 08.11.2026 (wish #233): Die Zeile, die jeder Zauber auf den Magie-Seiten von mordheimer.net vor seinem Regeltext hat
(„The Shaman’s howling invigorates the ladz …“), steht **wörtlich** bei dem Zauber, in `data/spells.json` (`lore`, nach dem Namen
ohne Schwierigkeit). Dieselbe Ausnahme wie bei den Einheiten-Beschreibungen, nur für diesen Zweck; gelesen mit curl,
geprüft von `core/test/spellbook.test.ts`. Zauber, deren Seite keine Zeile hat (Lady’s Prayers, Lizardman Magic), und Listen, die es
auf mordheimer.net nicht gibt (Dwarf Minor Runes, Woodland Incantations), bleiben ohne.

## Nachtrag vom 10.11.2026: der Standard-Prolog einer Warband wörtlich
Rob, 10.11.2026 (Wunsch #247): Der Vorschlag für den Prolog einer Warband (`intro` in `data/warbands/<grade>/<key>.json`,
`data/warbandintro.json`) ist der **Lore-Abschnitt ihrer Seite bei mordheimer.net, vollständig und wörtlich**; ein Satz, der nur
in die Regeln überleitet („…the following special rules:“), gehört nicht dazu. Bei den Mercenaries und Ostermark, deren Seite keinen
eigenen Lore-Abschnitt hat, ist es der Einleitungsabsatz beziehungsweise der Absatz zu Ostermark. Dieselbe Ausnahme wie bei den
Beschreibungen der Einheiten und den Lore-Zeilen der Zauber; `core/test/warbandintro.test.ts` prüft Quelle, Länge und Ende.
