# 0018 – KI-Paket von Hand weitergeben, keine Anbindung an die Chronik-Pipeline
Status: angenommen · Datum: 2026-10-12 · ersetzt Teile von [0004](0004-ai-without-api.md)

## Kontext
ADR 0004 sah vor, dass der Server das KI-Paket in `/mnt/ssd/agent/eingang/chronik/`
ablegt und `chronik N` es dort abholt. Rob (12.10.2026): Vorerst keine direkte
Anbindung an automatisiertes Schreiben. Er will sauber zusammengestellte Notizen,
Vorgänge, Ausrüstung und Warband-Änderungen, die er von Hand weitergibt. Seit 4b4a
liefert „AI pack…“ in der Zeitleiste genau das als einen Prompt.

## Entscheidung
- Das KI-Paket wird auf dem Gerät des Leiters gebaut und von Hand weitergegeben
  (kopieren oder als `.md`). Der Server legt nichts in `eingang/chronik/` ab; es
  gibt keine Route `…/ai-pack/:battleId` und keine Änderung an `ops/`.
- Die Pipeline (`chronik N`) bekommt aus der Roster-App nichts automatisch. Was
  Rob ihr weitergibt, entscheidet er.
- Der Kanon-Export für den Chronik-Linter bleibt als Download von Hand
  (Schreibweisenliste), nicht als Ablage.
- Der Connector (MCP) aus ADR 0004 ist weiter „später, optional“ (Phase 5) und
  wird erst gebaut, wenn Rob es will.
- Alles andere aus ADR 0004 gilt: keine KI-API, jeder KI-Text ist ein Entwurf,
  das Format des Pakets ist versioniert (`PACK_FORMAT`).

## Folgen
- Verborgener Hintergrund verlässt den Server nur, wenn ein Leiter das Paket
  bewusst kopiert oder lädt. Was er danach damit tut (insbesondere ob etwas in
  ein öffentliches Repo gelangt), liegt bei ihm; das Paket kennzeichnet jedes
  Hintergrund-Stück mit seiner Regel.
- Der Pi bindet keinen Chronik-Eingang ein; der auskommentierte Mount in
  `ops/compose.yaml` entfällt.

## Verworfen
- Ablage in `eingang/chronik/` mit Abholen durch `chronik N` (ADR 0004, jetzt
  zurückgestellt).
