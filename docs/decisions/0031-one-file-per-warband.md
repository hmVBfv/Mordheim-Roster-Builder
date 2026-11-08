# 0031 – Die Daten einer Warband in einer Datei, nach Grade geordnet
Status: angenommen (Rob, 08.11.2026) · Datum: 2026-11-08

## Kontext
Was zu einer Warband gehört, lag in neun Dateien: Einheiten und Regeln in `warbands.json`, ihre Ausrüstungslisten in
`equipment.json`, ihre Fertigkeitsmengen in `skills.json`, die Regel für Hired Swords in `hiredswords.json`, die Eröffnung in
`warbandintro.json`, die Beschreibung der Einheiten in `unitlore.json`. Wer eine Warband pflegt, musste an allen Stellen suchen
und sie in der Reihenfolge prüfen, in der sie zusammenwirken.

## Entscheidung
- Die Quelle einer Warband ist **eine Datei**: `data/warbands/<grade>/<key>.json` (`core`, `1a`, `1b`, `1c`, `2a`). Darin:
  `warband` (Regeln, Einheiten, Profile, Varianten), `extra`, `race`, `unitRace`, `hire`, `lists` und `skillSets`, die nur diese
  Warband nutzt, `intro`, `unitLore`.
- Was mehrere Warbands nutzen, steht in `data/warbands/_shared.json` (Ausrüstungslisten, Fertigkeitsmengen). Die Reihenfolge der
  Warbands steht in `data/warbands/_index.json`; eine neue Warband wird dort eingetragen.
- Die Dateien, die das Spiel liest (`data/warbands.json`, `warbandintro.json`, `unitlore.json`), werden daraus **gemacht**:
  `npm run data` (`core/scripts/warband-data.ts`). Legacy-App, Kern, App und Server lesen weiter dieselben Dateien und Schlüssel;
  die Daten werden dort wie bisher zu einem Objekt zusammengeführt. Von Hand ändert man nur die Quelle.
- Ein Test (`core/test/warband-files.test.ts`) schlägt fehl, wenn eine gemachte Datei nicht der Quelle entspricht – eine Änderung in
  der falschen Datei geht also nie still verloren.
- Geteilt bleiben der Katalog der Gegenstände (`equipment.json`), die Fertigkeiten, Zauber, Verletzungen, Fähigkeiten und die
  Hired Swords selbst: sie gehören keiner Warband.

## Folgen
- Ladegröße und Daten ändern sich nicht: das Zusammengeführte ist Schlüssel für Schlüssel dasselbe wie vorher (einmal geprüft, bevor
  die alten Dateien gekürzt wurden); nur die Reihenfolge der Schlüssel in den Maps `LISTS`, `SKILLSETS`, `WBHIRE`, `WBRACE`,
  `WBEXTRA`, `UNITRACE` folgt jetzt den Warbands.
- Die Beschreibungen der Einheiten bleiben in einer eigenen Datei, die die App erst bei Bedarf lädt (ADR 0024, Nachtrag).
- Fähigkeiten mit `wb: […]` (`abilities.json`) und Gegenstände mit `only.wb` (`equipment.json`) hängen an Warbands, stehen aber
  weiter zentral: ihre Reihenfolge entscheidet, welcher Treffer gilt, und das Umziehen würde sie verschieben. Ein späterer Schritt.
