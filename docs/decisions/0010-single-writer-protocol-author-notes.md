# 0010 – Protokoll mit einem Schreiber, Notizen je Autor
Status: angenommen · Datum: 2026-09-27

## Kontext
Am Spielabend trägt Rob als Leiter ein; die Mitspieler sollen gleichzeitig
Notizen beitragen. Gemeinsames Bearbeiten eines Textes würde Konflikte und
aufwendige Technik (CRDT) erfordern.

## Entscheidung
- Das **Schlachtprotokoll** schreibt nur der Leiter. Spieler sehen es live und
  schicken Korrekturvorschläge.
- **Notizen** sind eigene Einträge mit genau einem Autor. Alle schreiben
  parallel, niemand bearbeitet fremden Text (außer der Leiter beim Bündeln,
  geloggt).
- **Versiegelte Notizen** sind für alle außer dem Autor gesperrt – auch für
  Leiter und Admin – und öffnen sich beim Abschluss der Schlacht.
- Einträge bekommen ihre UUID auf dem Gerät; offline gesammelt, später
  gesendet, ohne Duplikate.

## Folgen
- Mehrere Notizen zum selben Moment sind gewollt: verschiedene Perspektiven.
- Datenbank- oder Backup-Zugriff könnte Versiegeltes technisch lesen; das ist
  dokumentiert.

## Verworfen
- Ein gemeinsames Live-Dokument pro Schlacht.
