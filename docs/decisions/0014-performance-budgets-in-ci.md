# 0014 – Leistungsgrenzen in der CI
Status: angenommen · Datum: 2026-09-27

## Kontext
„Leicht und flüssig“ soll nicht nur ein Vorsatz sein, besonders wenn ein
großer Teil des Codes von einem Agenten geschrieben wird.

## Entscheidung
- Grenzen für Bundle-Größe, Reaktionszeit, Startzeit und Bildgröße stehen in
  `docs/ui.md` und werden in der CI geprüft (`size-limit`, Playwright).
- Der Server-Container hat ein Speicherlimit von 256 MB.
- Playwright läuft nur in der CI, nicht auf dem Pi.

## Folgen
- Eine Überschreitung lässt den Build fehlschlagen; Grenzen werden nur per
  bewusster Änderung in `docs/ui.md` angepasst.
