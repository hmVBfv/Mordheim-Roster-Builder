# 0006 – Gemeinsamer Kern `core/`
Status: angenommen · Datum: 2026-09-27

## Kontext
Die geprüften Regeldaten und die Logik (Goldbuchhaltung, Verletzungen,
Post-Battle, Worth) sind der eigentliche Wert der bestehenden App. Sie steckt
zum großen Teil in `js/app.js` (über 4.000 Zeilen), vermischt mit der
Darstellung. Browser und Server brauchen dieselbe Logik (Vorschau und
verbindlicher Vergleich, Validierung).

## Entscheidung
- Logik wandert in `core/` (TypeScript, ohne DOM, ohne globale Zustände,
  Uhr und Zufall werden hineingereicht).
- Die Reihenfolge und die Abnahme stehen in `docs/roadmap.md` (Phase 1).
- Die 32 Legacy-Testdateien werden portiert; ein Paritätstest vergleicht alte
  und neue Logik über alle Warbands.
- `data/` bleibt während der Übergangszeit die einzige Quelle für beide Apps.

## Folgen
- Das Herauslösen ist die größte Einzelarbeit des Projekts.
- Die alte App bleibt bis zur vollständigen Parität des neuen Builders live.

## Verworfen
- Neuschreiben der Logik ohne Parität: würde die mühsam geprüften Regeln
  gefährden.
