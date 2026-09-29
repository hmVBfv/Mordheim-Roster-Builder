# 0004 – KI ohne API
Status: angenommen · Datum: 2026-09-27

## Kontext
Das Epos wird mit Claude geschrieben, inzwischen über eine Chronik-Pipeline
mit Claude Code auf dem Pi (`chronik N`). Ein API-Schlüssel würde laufende
Kosten und ein weiteres Geheimnis auf dem Pi bedeuten.

## Entscheidung
- Die App ruft keine KI-API auf.
- Sie erzeugt Briefing und KI-Paket (nur Leiter) und legt das KI-Paket in
  `/mnt/ssd/agent/eingang/chronik/` ab, wo `chronik N` es abholt.
- Später optional: ein Connector (MCP), über den Claude direkt liest und
  Entwürfe zurücklegt.
- Jeder KI-Text ist ein Entwurf, den der Leiter prüft.

## Folgen
- Die Pipeline darf den Hintergrund nie in `notes/` des öffentlichen
  Chronik-Repos schreiben.
- Das Format des KI-Pakets ist versioniert, damit Chat, Pipeline und
  Connector dasselbe bekommen.

## Verworfen
- Knopf „Entwurf erzeugen“ mit API-Schlüssel auf dem Pi.
