# Entscheidungsnotizen (ADRs)

Jede Notiz hält eine Grundsatzentscheidung fest: Kontext, Entscheidung,
Folgen, verworfene Alternativen. Sie wird nicht nachträglich umgeschrieben;
ändert sich eine Entscheidung, kommt eine neue Notiz, und die alte bekommt
„Ersetzt durch …“.

Vorlage:

```
# NNNN – Titel
Status: angenommen · Datum: JJJJ-MM-TT

## Kontext
## Entscheidung
## Folgen
## Verworfen
```

| Nr. | Titel |
| --- | --- |
| [0001](0001-pi-hosts-app-and-api.md) | Pi liefert App und API; Pages bleibt als Quick Build |
| [0002](0002-mechanics-open-narrative-hidden.md) | Mechanik offen, Erzählung darf verborgen sein |
| [0003](0003-append-only-versions.md) | Versionen statt Überschreiben |
| [0004](0004-ai-without-api.md) | KI ohne API |
| [0005](0005-react-pwa-client-computes.md) | React-PWA; Client rechnet, Server verwahrt |
| [0006](0006-shared-core.md) | Gemeinsamer Kern `core/` |
| [0007](0007-sqlite-and-backups.md) | SQLite und Backups |
| [0008](0008-invite-only-auth-totp.md) | Anmeldung nur auf Einladung, TOTP |
| [0009](0009-deliberate-deploys.md) | Bewusste Deploys |
| [0010](0010-single-writer-protocol-author-notes.md) | Protokoll mit einem Schreiber, Notizen je Autor |
| [0011](0011-hidden-data-never-leaves.md) | Verborgenes verlässt nie den Server |
| [0012](0012-in-app-bug-tracker.md) | Bug-Tracker in der App, Bearbeitung auf Zuruf |
| [0013](0013-english-ui-bilingual-canon.md) | Englische Oberfläche, zweisprachiger Kanon |
| [0014](0014-performance-budgets-in-ci.md) | Leistungsgrenzen in der CI |
| [0015](0015-develop-in-cloud-operate-on-pi.md) | Entwicklung in Cloud-Sitzungen, Betrieb auf dem Pi |
| [0016](0016-campaign-state-stays-in-the-save.md) | Die Kampagnenmechanik einer Warband bleibt in ihrem Speicherstand (vorgeschlagen) |
| [0017](0017-signed-images-from-master.md) | In die Produktion nur signierte Images von master |
| [0018](0018-ai-pack-by-hand.md) | KI-Paket von Hand weitergeben; keine Ablage in `eingang/chronik/` (ersetzt Teile von 0004) |
| [0019](0019-bug-token.md) | Bug-Token: ein eigener Zugang für Cloud-Sitzungen, nur `GET/PATCH /bugs` (ergänzt 0012) |
| [0020](0020-live-updates-signal-stream.md) | Live-Aktualisierung: ein Strom von Signalen je offener App, die App holt über die gewohnten Endpunkte nach (ergänzt 0005, 0010, 0011) |
| [0021](0021-first-load-budget-per-flavour.md) | Erste-Laden-Grenze je Ausgabe: Kampagne 250 KB, Quick Build 200 KB (angenommen, ergänzt 0014; die 200 KB ersetzt durch 0025) |
| [0022](0022-hidden-npc-values-in-scenarios.md) | Verborgene Teile bei den NPCs eines Szenarios: der Server schwärzt mit „?“, nach der Freigabe nur noch aufdecken (vorgeschlagen, ergänzt 0002, 0011) |
| [0023](0023-library-per-account.md) | Die Library: Ideen und Vorlagen (Fraktionen, NPCs, Gruppen, Szenarien) privat beim Konto, immer als Kopie in die Kampagne (vorgeschlagen, ergänzt 0002, 0005, 0011, 0022) |
| [0024](0024-lore-catalogue-places-and-sources.md) | Der Lore-Katalog: Orte ineinander, Gruppen mit Herkunftsorten, Quellen auch außerhalb von mordheimer.net, mit eigenen Worten (angenommen, ergänzt 0023) |
| [0025](0025-quick-build-first-load-250-kb.md) | Erste-Laden-Grenze des Quick Builds: 250 KB wie die Kampagne (angenommen, ersetzt einen Teil von 0021) |
| [0026](0026-planner-and-catch-up.md) | Der Planner und das Catch-up: eine Art Warband ohne Goldgrenze zum Planen, und der späte Einstieg in eine Kampagne nach dem Median (angenommen, ergänzt 0002, 0003) |
