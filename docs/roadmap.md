# Fahrplan

Stand: 2. Oktober 2026

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
- [x] 1b, sechster Teil: Kampagnendatei (Warbands importieren und
  zusammenführen, Schlachten anderer, Statistik), Kontrolle über Bezirke
  über alle Warbands, Schlacht- und Verlustformular samt Entwürfen. Eigene
  Paritäts-Wanderung über Warband, Kampagnendatei und offene Formulare,
  dazu Szenarien für seltene Zweige.
- [x] 1b, siebter Teil: Exporte – lesbarer Text mit eingebettetem Stand,
  Tabletop-Simulator-Karten, Chronik-Text, Kampagnen-Text, Dateinamen, das
  offizielle Rostersheet als PDF (pdf-lib und Vorlage werden hineingereicht)
  sowie die englischen Regel- und Ausrüstungstexte. Das PDF wird verglichen,
  indem beide Seiten denselben aufzeichnenden Ersatz für pdf-lib bekommen;
  ein Test füllt zusätzlich die echte Vorlage mit dem echten pdf-lib.
- [x] 1b, achter Teil: Laden und Schreiben von Speicherständen – jede Datei
  der alten App lädt wie dort (Parität auch mit zufällig fehlenden
  Schlüsseln und dem eingefrorenen Altstand aus `test/compat.mjs`), der
  eingefügte Text-Export ebenso; Formatnummer 1, Zod-Schemas für Warband und
  Kampagnendatei.
- [x] 1b, neunter Teil: Regeln, die die alte App nur beim Zeichnen
  berechnete – Warnungen der Seitenleiste (Legalität der Warband), Liste der
  Einheiten, Grenzen im Anwerbe-Menü, Fähigkeiten eines Kriegers, Filter der
  Hired-Sword-Listen, Reihenfolge der Warband-Auswahl. Verglichen, indem das
  HTML der alten App zurückgelesen wird; die Wanderung prüft sie alle fünf
  Schritte. Erst damit ist die Logik der alten App vollständig in `core/`.
- [x] 1b, Abschluss: V1 und V2 entschieden (28.09.2026) – beide im neuen
  Builder; V1 als Ablauf mit allen Folgeentscheidungen spezifiziert. V3
  (Augur) entschieden: RAW, weil mordheimer.net keine RAI-Ausnahme nennt.
  V4–V7 (Umverteilen, Sperre nach dem ersten Kampf mit Trading Post,
  Kaufansicht, Gold als Kassenbuch) spezifiziert und am 29.09.2026
  entschieden; die Gründungspreise laufen schon in beiden Apps.
- [x] Abgleich aller 49 Warbands mit mordheimer.net
  ([rules-audit.md](rules-audit.md)): Tooltips suchen im Zusammenhang
  (beide Apps), 30 Datenfehler korrigiert, Fragen C1–C10 an Rob – am
  29.09.2026 entschieden und umgesetzt; von den 10 offenen Punkten 7
  nachgezogen, 3 bleiben offen.
- [ ] Nach 1d: gewünschte Änderungen am Roster Builder einbauen, einzeln und
  mit Tests, gesammelt in [behaviour-changes.md](behaviour-changes.md).
- [x] 1c Neue Logik: `core/changes` (Vergleich zweier Stände mit stabilen
  Änderungsschlüsseln, Abgleich mit Ereignissen und Schlachtprotokoll,
  fehlende Erklärungen) und `core/narrative` (Briefing je Schlacht als
  Markdown). Die Eingaben, die erst der Server liefert (Notizen, Protokoll
  über alle Warbands), sind als Datenstruktur festgelegt.
- [x] 1d, erster Teil: Alle 35 Legacy-Testdateien laufen gegen `core/`. Sie
  laufen unverändert gegen die alte App; jeder ihrer rund 1500 Aufrufe (davon
  gut 400 Aktionen) wird in `core/` vom selben Stand aus wiederholt und muss
  dasselbe ergeben (`core/test/mirror/`). Ergebnis: keine Abweichung in der
  Logik; zwei Lücken geschlossen (die Reihenfolge der Tooltip-Suche lag noch
  in `info.js`; ein Zähler-Stand der alten App, den `core/` nicht darstellen
  konnte).
- [ ] 1d, Rest: Parität mit bereinigten Speicherständen der laufenden
  Kampagne. Werkzeug und Testlauf stehen: `npm run sanitize-save` bereinigt
  einen Stand (Warband, Kampagnendatei oder Text-Export) nach
  [security.md](security.md#6-öffentliche-repos), legt ihn unter
  `core/test/saves/` ab, und `saves.parity.test.ts` lädt ihn in beiden Apps
  und wandert von dort weiter; zwei erfundene Beispiele halten den Lauf bis
  dahin in Gang. **Es fehlen die echten Dateien.**
- [x] 1e App-Grundgerüst: Workspace `app/` (Vite 8, React 19 mit React
  Compiler, React Router, Dexie), beide Varianten aus einem Code
  (`campaign` mit fünf Navigationszielen, `quickbuild` mit drei; der Quick
  Build führt die Route nach „#“, weil Pages keine Tiefen-Links kennt),
  Themes Chronicle und Parchment samt „wie System“ mit selbst ausgelieferten
  Schriften (Kontrast WCAG AA per Test), PWA mit Manifest, Icons, Service
  Worker, Update-Banner und strenger CSP, Import von Speicherständen und
  Text-Export in den Gerätespeicher, Roster nur lesend. Die Regeldaten
  kommen erst beim ersten Öffnen eines Rosters (JavaScript beim Start
  119 KB komprimiert). Playwright prüft bei 360 px beide Varianten und
  Themes, 44-px-Tippflächen, Offline-Start und die Startzeit-Grenzen.
  Die Roster-Ansicht ist nur die technische Grundlage; ihr Aussehen kommt
  aus dem Mockup (1f).
- [x] 1f Mockups: die sechs Bildschirme aus [ui.md](ui.md#3-bildschirme-die-zuerst-als-mockup-entstehen)
  als klickbare statische Seiten unter [`docs/mockups/`](mockups/) –
  Spielabend (Offline-Warteschlange, drei Tipps für einen Verlust),
  Zeitleiste (langes Drücken und Ziehen, ↑/↓, „Move to…“, Leiter-Ebene),
  Änderungsansicht (vorher → nachher, Anlass, ⚠ ohne Anlass,
  Erklärungsfelder), Sichtbarkeit (öffentlich, versiegelt, nur Leiter, „View
  as player“), Hintergrund (Stränge mit Enthüllungsstufe) und das neue
  Roster (mit dem Verletzungsablauf aus V1). Geprüft bei 360 px in beiden
  Themes; **offen: Robs Prüfung auf dem Handy.** Nach Robs erstem Blick
  (29.09.2026: tote Knöpfe, Erfahrung nur als Zahl) reagiert jede Bedienung –
  Playwright klickt sie alle einzeln an –, jede Karte zeigt die
  Erfahrungsschwellen, und der Trading Post (V6) ist als siebte Seite dazu.
  Nach dem zweiten Blick (29.09.2026: ← träge, aus „Notes“ kein Weg zurück,
  Reiter ohne Ziel, Henchmen ohne „+ Man“ und Namen) führt jedes Ziel der
  Leiste und jeder Reiter auf eine eigene Seite (Home, Warbands, Campaign,
  World, Manage, Story, More), und die Henchmen-Gruppen können wachsen, ihre
  Männer heißen und einen Helden hervorbringen.

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

**Ausnahme:** Phase 2 beginnt, bevor Phase 1 abgenommen ist (Rob,
30.09.2026). Offen sind dort die echten Speicherstände (1d), Robs Prüfung der
Mockups auf dem Handy und die Installation der App auf Android – die lässt
sich mit Phase 2 am echten Hostnamen prüfen, weil der Server die App schon
ausliefert.

**Stand:**

- [x] `server/`: Fastify und SQLite, Markerdatei, Migrationsrahmen (Snapshot
  vor jeder Migration), Epoche (wechselt bei jedem Start auf einer
  Snapshot-Kopie), `GET /api/v1/health`, `roster-cli` (`backup`,
  `schema-version`, `info`, `epoch renew`), die App als statische Dateien,
  `can()` für jede Route und der Anfang der Leak-Matrix, Logs mit fester Form
  für Fail2Ban. 51 Tests.
- [x] `Dockerfile` (Node 24, gebaut ohne Emulation für arm64 und amd64) und
  CI: Rauchtest des Images, Ende-zu-Ende-Test von `ops/` auf dem Runner
  (`install.sh`, Deploy, Rollback mit und ohne Rücksicherung, Backup und
  Wiederherstellungstest mit restic, `roster-restore`, SSD-Übung, Fail2Ban),
  dann Push nach `ghcr.io`.
- [x] `ops/`: `compose.yaml`, `Caddyfile`, `roster-deploy`, `roster-restore`,
  Timer für Backup, Wiederherstellungstest und `roster-alive`, Fail2Ban,
  `install.sh`.
- [ ] Einrichtung auf dem Pi – Stufen 1 bis 3 in
  [operations.md](operations.md#2-einmalige-einrichtung) (Rob). Stufe 1
  und 2 erledigt (02.10.2026): die App läuft unter dem Hostnamen mit
  gültigem Zertifikat, Backup samt Kopie auf dem Desktop, `roster-alive`
  pingt; der SD-Klon ist zurückgestellt. Die App ließ sich vom Hostnamen aus
  auf Android installieren (offen aus Phase 1). Offen: Stufe 3 (Rollback-
  und SSD-Übung, drei grüne Nächte).

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
  Exporte (TTS, PDF, Text). Die [Paritäts-Checkliste](parity-checklist.md)
  listet jede Funktion.
- Quick-Build-Variante; Pages wird auf sie umgestellt, sobald die
  Checkliste vollständig ist.
- Vor dem Abschalten der alten App: die Szenarien der Legacy-Tests als eigene
  `core/`-Tests übernehmen (Spiegel und Paritätstests fallen mit ihr weg).
- „Send to campaign server“ (Fragment-Link), Datei- und Text-Import.
- Leak-Test-Grundgerüst; Test „jede Tabelle steht in `data-model.md`“.

**Abnahme:** Die Mitspieler melden sich an und übernehmen ihre Warbands;
Paritäts-Checkliste 100 %; Pages zeigt den Quick Build.

**Ausnahme:** Phase 3 beginnt, bevor Phase 1 und 2 abgenommen sind (Rob,
02.10.2026). Offen bleiben dort die echten Speicherstände (1d), Robs Prüfung
der Mockups auf dem Handy und die Übungen der Stufe 3 (Rollback, SSD, drei
grüne Nächte), die Rob bei Gelegenheit selbst macht.

**Reihenfolge (Rob, 02.10.2026): erst der Builder, dann Anmeldung und Sync.**
Der Builder rechnet ganz auf dem Gerät und braucht den Server nicht; die
Anmeldung geht erst live, wenn Daten hinter ihr liegen.

| Schritt | Inhalt |
| --- | --- |
| 3a Roster bearbeiten | Grundlage: jede Änderung eine Aktion aus `core/`, sofort auf dem Gerät gespeichert, einmal rückgängig über den Hinweis. Warband anlegen (Auswahl nach Grad, Variante, Name), Namen, Anwerben und Entlassen, Henchmen-Gruppen (+ Man, Namen der Männer, einen Mann entlassen), Erfahrung per Stepper, Anführer, Worth. |
| 3b Ausrüstung und Handel | erst die neue Logik in `core/` (V4–V7: Suchwurf, Verkaufen, Umverteilen, Kassenbuch), dann der Trading Post nach Mockup: Kaufen, Seltenes, Suchen, Verkaufen, Geben, Lager, Regeltexte. **Stand 02.10.2026:** Logik (PR #16) und Oberfläche umgesetzt; offen: bezahlten Preis von Hand ändern, Wyrdstone verkaufen (mit 4a). |
| 3c Entwicklung | Aufstiege mit Fertigkeiten und Zaubern, Beförderung, Verletzungen mit Folgeentscheidungen (V1), Tod und Gefallene, Veteranenwurf bei „+ Man“; Mutationen und Male (Mockup fehlt). **Stand 02.10.2026:** Aufstiege, Beförderung, Verletzungen (V1) mit Gefangenschaft und feste IDs für Gefallene (V2, Format 2) umgesetzt; Veteranenwurf bei „+ Man“, Mutationen, Segnungen des Nurgle und Male der Marauder umgesetzt (die App ist hier das Mockup: Liste und Auswahl aus bestehenden Mustern; Robs Prüfung auf der Testinstanz). 3c ist damit vollständig. |
| 3d Hired Swords und Dramatis Personae | Listen mit Filtern, Anheuern, Optionen, Aufstiege (Mockup fehlt). |
| 3e Hausregeln und Exporte | Hausregeln einer Warband (Mockup fehlt), Text und Datei, TTS-Karten, Rostersheet als PDF, Drucken. |
| 3f Quick Build auf Pages | Checkliste vollständig, Szenarien der Legacy-Tests als eigene `core/`-Tests, Entscheidung D, Umstellung. |
| 3g Anmeldung | Einladung, Login, Sitzungen, TOTP, Reset-Links, Bremse, CSRF, Leak-Tests. |
| 3h Warbands auf dem Server | Versionen, Autosave, Sync mit Outbox und Epoche, „Send to campaign server“. |

Wo ein Mockup fehlt, entsteht es vor dem Code. Für kleine Bildschirme, die
nur bestehende Muster verwenden (Liste, Sheet, Stepper), ist die App selbst
das Mockup: Rob prüft sie auf der Testinstanz (`roster-deploy --staging`).

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
- Chronik-Eingang nach `eingang/chronik/` umziehen (gebraucht erst ab
  Phase 4b; bis dahin bindet die App ihn nicht ein).
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
