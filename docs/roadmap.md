# Fahrplan

Stand: 27. September 2026

Jede Phase endet mit einer Abnahme durch Rob. Eine Phase beginnt erst, wenn die
vorige abgenommen ist; Ausnahmen werden hier vermerkt.

## Phase 0 – Doku und Entscheidungen

- Dieses Doku-Paket, ADRs, `CLAUDE.md`.
- **Abnahme:** Rob hat gelesen und korrigiert; die Entscheidungen A und B
  sind getroffen (27.09.2026).

## Phase 1 – `core/` und Grundgerüst der App

| Schritt | Inhalt |
| --- | --- |
| 1a Werkzeuge | Cloud-Umgebung für Claude Code (Setup-Skript `npm ci`); npm-Workspaces `core`, `app`, `server`; TypeScript `strict`; Vitest; ESLint. Die CI führt Legacy-Tests und neue Tests nebeneinander aus. |
| 1b Logik herauslösen | In dieser Reihenfolge nach `core/`: Regeln (`engine.js`) → Warband-Operationen (Kosten, Ausrüstung, Gold und Gefallene, Erfahrung und Aufstiege, Verletzungen, Beförderungen, Hired Swords, Dramatis Personae) → Kampagne (Post-Battle, Einkommen, Wyrdstone, Unterhalt, Bezirke, Snapshots) → Exporte (TTS, Text, PDF) → Format (Schemas, Migration aller bisherigen Speicherstände). |
| 1c Neue Logik | `core/changes` (Vergleich, Abgleich, Änderungsschlüssel), `core/narrative` (Briefing). |
| 1d Parität | Die 32 Legacy-Testdateien laufen gegen `core/`. Ein Paritätstest vergleicht alte und neue Logik über alle 49 Warbands und bereinigte Speicherstände der laufenden Kampagne. |
| 1e App-Grundgerüst | Vite + React als PWA, beide Varianten, Design-Variablen mit beiden Themes, Navigation, Dexie, Update-Banner; Roster zunächst nur lesend. |
| 1f Mockups | Die Bildschirme aus [ui.md](ui.md#3-bildschirme-die-zuerst-als-mockup-entstehen) als statische Seiten unter `docs/mockups/`. |

**Stand:**

- [x] 1a Werkzeuge: npm-Workspaces (`core`), TypeScript 6.0 `strict`,
  Vitest, ESLint mit Regeln gegen DOM, Node-APIs, `Math.random` und
  `Date.now` in `core/src`, CI-Workflow `ci.yml`. (TypeScript 7 wird noch
  nicht von typescript-eslint unterstützt.)
- [x] 1b, erster Teil: Spieldaten, Speicherformat, Hausregeln und die
  komplette Regel-/Kostenrechnung aus `engine.js` samt Hired Swords,
  Dramatis Personae, Bezirkseffekten, Worth und Rüstungswurf – Parität über
  348 erzeugte Warbands, Reinheitstest auf eingefrorenen Ständen.
- [x] 1b, zweiter Teil: Rosterbau als reine Aktionen (Einheiten, Ausrüstung,
  Rare Items, Mutationen, Gold und Truhe, Subtyp, Bezirke, Hired Swords und
  Dramatis Personae, Hausregeln) – Parität über zufällige Aktionsfolgen
  (je 80 Schritte, alle 49 Warbands frisch mit und ohne Kampagne, dazu
  erzeugte Stände); jede Aktion muss dabei mindestens 15-mal gegriffen haben.
- [x] 1b, dritter Teil: Profile und Rassenmaxima, Erfahrung und Aufstiege,
  Fertigkeiten und Zauber, Male der Marauder, Beförderungen, Namen einzelner
  Henchmen, Anführer, Aufstiege von Hired Swords. Die Paritäts-Wanderung
  läuft jetzt auf vier Dateien parallel; ihre Abdeckung prüft ein schneller
  Nachlauf nur mit `core/`. Zwei Fehler der alten App gefunden und in beiden
  behoben (siehe [behaviour-changes.md](behaviour-changes.md)).
- [x] 1b, vierter Teil: Verletzungen (die ganze D66-Tabelle samt Robbed,
  Sold to the Pits, Captured, Deep Wound), Tod und Gefallene mit Rücknahme,
  Verlusteinträge und ihre Würfe, gehaltene Erfahrung und das Anwenden der
  Schlachtergebnisse. Neben der Wanderung (jetzt 100 Schritte, 87 Aktionen,
  Regelvergleich nach jedem Schritt) prüft `injuries.parity.test.ts` jedes
  Ergebnis der Tabelle mit jeder Antwort an vorbereiteten Warbands. Ein
  weiterer Fehler der alten App behoben, zwei Ungereimtheiten als Vorschlag
  notiert (siehe [behaviour-changes.md](behaviour-changes.md)).
- [x] 1b, fünfter Teil: die Kampagne einer Warband – Chronik, Stufen mit
  Snapshots und ausgesessenen Spielen, Schlachten, Footholds, die
  Post-Battle-Sequenz mit Wyrdstone-Verkauf, Stufenvergleich und Auswertung
  je Krieger. Die Wanderung (110 Schritte, 100 Aktionen) vergleicht auch diese
  Auswertungen nach jedem Schritt.
- [ ] 1b, weiter: Kampagnendatei (mehrere Warbands, Schlachtformular,
  Kontrolle über Bezirke), Exporte (Chronik-Text, TTS, Text, PDF), Format.
- [ ] Danach: gewünschte Änderungen am Roster Builder einbauen, einzeln und
  mit Tests, gesammelt in [behaviour-changes.md](behaviour-changes.md).
- [ ] 1c, 1d, 1e, 1f

**Abnahme:** Legacy-Tests grün; `core/`-Tests grün, Parität für alle Warbands;
App lässt sich auf Android installieren und startet offline; `size-limit` in
der CI; Mockups auf dem Handy geprüft und freigegeben.

Die alte App bleibt in dieser Phase unverändert live.

## Phase 2 – Infrastruktur auf dem Pi

- Einmalige Einrichtung nach [operations.md](operations.md#2-einmalige-einrichtung).
- `Dockerfile` (arm64 + amd64), CI schiebt Images nach `ghcr.io`.
- `server/`-Grundgerüst: Health, Migrationsrahmen, `roster-cli backup`,
  Epoche, Markerdatei-Prüfung.
- `compose.yaml`, `Caddyfile`, `roster-deploy`, Backup- und
  Wiederherstellungstest-Timer, healthchecks.io, Fail2Ban-Regel.
- Alle Betriebsdateien unter `ops/` im Repo, eingespielt mit `sudo ops/install.sh`.

**Abnahme:**
- Die App ist unter dem Hostnamen mit gültigem Zertifikat erreichbar.
- Deploy und **Rollback-Übung** (absichtlich kaputtes Image) funktionieren.
- **SSD-Übung:** Ohne Markerdatei startet die App nicht.
- Der Wiederherstellungstest ist drei Nächte in Folge grün.
- `roster-alive` pingt.

## Phase 3 – Nutzer, Warbands, neuer Builder

- Anmeldung: Einladung, Login, Sitzungen, TOTP für Admin und Leiter,
  Reset-Links, Bremse, CSRF-Schutz.
- Warbands, Versionen, Autosave, Sync mit Outbox und Epoche.
- **Neuer Builder mit vollem Funktionsumfang** der alten App: Warband anlegen,
  Ausrüstung, Rare Items, Hired Swords, Dramatis Personae, Hausregeln,
  Exporte (TTS, PDF, Text). Eine Paritäts-Checkliste listet jede Funktion.
- Quick-Build-Variante; Pages wird auf sie umgestellt, sobald die
  Checkliste vollständig ist.
- „Send to campaign server“ (Fragment-Link), Datei- und Text-Import.
- Leak-Test-Grundgerüst; Test „jede Tabelle steht in `data-model.md`“.

**Abnahme:** Die Mitspieler melden sich an und übernehmen ihre Warbands;
Paritäts-Checkliste 100 %; Pages zeigt den Quick Build.

## Phase 4a – Kampagne im Kern

- Kampagnen, Mitglieder, Einschreibungen, Übersicht mit Status.
- Schlachten, Schlachtprotokoll, Korrekturvorschläge, **Spielabend-Modus**.
- Notizen (auch versiegelt), Anhänge, Zeitleiste mit Verschieben.
- Post-Battle-Sequenz in der neuen Oberfläche; Markieren mit eingefrorenen
  Änderungen; Öffnen versiegelter Notizen; Sofort-Backup.
- **Übernahme der laufenden Kampagne:** Speicherstände importieren, Tags aus
  vorhandenen Snapshots rekonstruieren, veröffentlichte Kapitel als
  Abschnitte der Zeitleiste, Ereignisse übernehmen.

**Abnahme:** Der nächste echte Spielabend läuft vollständig im neuen System.

## Phase 4b – Erzählung und Leitung

- Erzählung der Warband (Prolog, Zwischenspiele, Erklärungen), Profile mit
  zweisprachigem Kanon, Lebenslauf, Fragen an Spieler, „Offen für dich“.
- Hintergrund mit Enthüllungsstufen, „Als Spieler ansehen“.
- Welt: Fraktionen, NPCs, Ruf, Bezirke, Szenarien.
- Briefing, KI-Paket, Ablage in `eingang/chronik/`, Kanon-Export für den
  Chronik-Linter.

**Abnahme:** Das Kapitel zur nächsten Schlacht entsteht mit `chronik N` aus
dem KI-Paket.

## Phase 4c – Bug-Tracker

- „Report a problem“ mit Kontext; Status für den Meldenden.
- `roster-cli`/API-Zugang mit Bug-Token; Bereiniger für Testvorlagen.
- `.claude/commands/bugs.md` (Ablauf `/bugs`) und
  `.claude/agents/reviewer.md`.

**Abnahme:** Ein echter Bug ist von der Meldung bis „fixed in <version>“
durchgelaufen.

## Phase 5 – Extras

- Volltextsuche (SQLite FTS5) über Notizen, Zeitleiste, Lebensläufe.
- Push-Hinweise (Web Push).
- TTS-Skript, das Beschreibungskarten vom Pi abruft.
- Connector (MCP) für Claude; Commit freigegebener Kapitel ins Chronik-Repo.
- Kampagnenvorlagen.

## Voraussetzungen aus der Agenten-Basis

Diese offenen Punkte des Pi müssen vor Phase 2 erledigt sein:

- cgroup-Speicher aktivieren (sonst greifen keine Container-Limits).
- Chronik-Eingang nach `eingang/chronik/` umziehen.
- WireGuard: prüfen, aus welchem Netz VPN-Geräte kommen (betrifft den
  Zugriff auf die Testinstanz von unterwegs).

## Offene Entscheidungen

| | Frage | Vorschlag | Bis |
| --- | --- | --- | --- |
| ~~A~~ | ~~Optik~~ – entschieden: beide Themes wählbar, Standard „Chronicle“ (dunkel), siehe [ui.md](ui.md#4-themes-und-gestaltung) | – | – |
| ~~B~~ | ~~Git im Agenten-Container~~ – entschieden: Entwicklung in Cloud-Sitzungen, Betrieb auf dem Pi (ADR 0015); kein Agent auf dem Pi für dieses Projekt | – | – |
| ~~C~~ | ~~Immer~~ – entschieden: ja, für alle Aktionen in `core/warband` (die Portierung bleibt 1:1 lesbar, Ergebnisse sind unveränderlich) | – | – |
| **D** | Alte App nach der Umstellung: `dist/mordheim-roster.html` noch eine Kampagnenrunde lang als Download behalten? | ja, danach entfernen | Phase 3 |
| **E** | Für welche der bisherigen Schlachten gibt es Snapshots? Wo keine sind, beginnt der Vergleich erst ab dem ersten Snapshot. | beim Import prüfen und festhalten | Phase 4a |
| **F** | Push-Hinweise | später entscheiden | Phase 5 |

## Getroffene Entscheidungen

Siehe [decisions/](decisions/). Kurzfassung:

| ADR | Entscheidung |
| --- | --- |
| 0001 | Pi liefert App und API unter einer eigenen Hostname; Pages bleibt als Quick Build |
| 0002 | Mechanik offen, Erzählung darf verborgen sein |
| 0003 | Versionen statt Überschreiben; markierte Stände; eingefrorene Kennzahlen |
| 0004 | KI ohne API; Anbindung an die Chronik-Pipeline über `eingang/chronik/` |
| 0005 | React 19 + TypeScript als PWA, kein Rendern auf dem Server; Client rechnet, Server verwahrt |
| 0006 | Gemeinsamer Kern `core/`, herausgelöst mit Paritätstests |
| 0007 | SQLite auf der SSD; Backups auf dem Pi, Kopie auf dem Desktop, nichts außer Haus |
| 0008 | Anmeldung nur auf Einladung; TOTP für Admin und Leiter |
| 0009 | Deploy bewusst per Skript; Images aus der CI für arm64 und amd64 |
| 0010 | Schlachtprotokoll hat einen Schreiber; Notizen sind Einträge je Autor; Versiegeltes auch für Leiter gesperrt |
| 0011 | Verborgenes verlässt nie den Server Richtung Spieler und landet nie in einem Repo |
| 0012 | Bug-Tracker in der App; Bearbeitung nur auf Zuruf |
| 0013 | Oberfläche englisch; Kanon und Epos zweisprachig |
| 0014 | Leistungsgrenzen werden in der CI geprüft |
| 0015 | Entwicklung in Cloud-Sitzungen, Betrieb auf dem Pi; Pi-Konfiguration als `ops/` im Repo |
| – | Themes: „Chronicle“ (dunkel, Standard) und „Parchment“ (hell) wählbar; Druck immer hell ([ui.md](ui.md#4-themes-und-gestaltung)) |
