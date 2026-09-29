# 0003 – Versionen statt Überschreiben
Status: angenommen · Datum: 2026-09-27

## Kontext
Das Epos braucht den Stand jeder Warband nach jeder Schlacht, und Fehler
(Bug, Bedienfehler, Konflikt zwischen zwei Geräten) dürfen nichts zerstören.
Die App friert Kennzahlen in Snapshots bereits ein, statt sie neu zu
berechnen.

## Entscheidung
- Jedes Speichern erzeugt eine Version; Versionen werden nie geändert.
- Bestimmte Versionen tragen Markierungen (`start`, `after_battle`,
  `sat_out`) mit eingefrorenen Kennzahlen. Korrekturen erzeugen eine neue
  Markierung; die alte bleibt als „korrigiert“ sichtbar.
- Änderungen zwischen Markierungen werden beim Markieren als Datensätze
  eingefroren.
- Gleichzeitiges Speichern wird über `baseRev` erkannt (409), nie still
  überschrieben.

## Folgen
- Speicherbedarf wächst linear; bei drei Spielern einige zehn MB – unkritisch.
- Löschen ist ein Grabstein; endgültiges Löschen nur durch den Admin, geloggt.

## Verworfen
- Nur Differenzen speichern: spart Platz, macht Wiederherstellen und Prüfen
  aufwendig.
