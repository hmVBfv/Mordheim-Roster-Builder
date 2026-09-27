# Dokumentation – Mordheim Campaign

Diese Dokumente beschreiben, wie aus dem Roster Builder ein gemeinsamer
Kampagnenbegleiter auf dem Raspberry Pi wird. Sie sind zugleich Arbeitsgrundlage
für die Entwicklung mit Claude Code: Was hier steht, gilt; was hier nicht steht,
wird vor der Umsetzung ergänzt.

**Leseregel:** Konzept und Betrieb sind auf Deutsch, Bezeichner im Code und
`CLAUDE.md` auf Englisch. Die Zuordnung steht im [Glossar](glossary.md).

**Wichtig:** Dieses Repo ist öffentlich. Hier stehen keine Geheimnisse, keine
Zugangsdaten und keine verborgenen Kampagneninhalte. Hostnamen und Adressen
sind Platzhalter (`<name>`, `<pi-lan-ip>`).

| Dokument | Inhalt | Für wen |
| --- | --- | --- |
| [concept.md](concept.md) | Was gebaut wird und warum: Funktionen, Rollen, Abläufe | Überblick, zuerst lesen |
| [architecture.md](architecture.md) | Aufbau aus `core/`, `app/`, `server/`, Datenfluss, Synchronisation, Auslieferung | Entwicklung |
| [data-model.md](data-model.md) | Tabellen, Speicherformat, Versionen, Änderungsdatensätze | Entwicklung |
| [security.md](security.md) | Anmeldung, Rechte, Sichtbarkeit, Bedrohungen, Regeln für Agenten | Entwicklung, Betrieb |
| [operations.md](operations.md) | Pi-Einrichtung, Deploy, Backup, Wiederherstellung, Ausfall-Handbuch | Betrieb |
| [ui.md](ui.md) | UI-Grundsätze, Navigation, Bildschirme, Themes, Leistungsgrenzen | Entwicklung |
| [glossary.md](glossary.md) | Deutsch ↔ Englisch ↔ Code | alle |
| [roadmap.md](roadmap.md) | Phasen, Abnahmekriterien, offene Entscheidungen | Planung |
| [decisions/](decisions/) | Entscheidungsnotizen (ADRs): was entschieden wurde und warum | alle, vor Änderungen an Grundsätzen |

Die bestehende App (`index.html`, `js/`, `data/`, `test/`) ist in der
[README](../README.md) beschrieben; ihre Entstehung in [HISTORY.md](../HISTORY.md).

## Wie diese Doku gepflegt wird

- Eine Entscheidung, die einen Grundsatz ändert, bekommt eine neue ADR. Alte
  ADRs werden nicht umgeschrieben, sondern als „ersetzt durch“ markiert.
- Jede Änderung an Tabellen, Endpunkten oder am Speicherformat aktualisiert
  `data-model.md` im selben Commit. Ab Phase 3 prüft die CI das
  (siehe [roadmap.md](roadmap.md)).
- `HISTORY.md` bleibt das Entwicklungstagebuch: dort steht, wie es dazu kam;
  hier steht, was gilt.
