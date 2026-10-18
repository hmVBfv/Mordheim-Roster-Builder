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
| 3d Hired Swords und Dramatis Personae | Listen mit Filtern, Anheuern, Optionen, Aufstiege. **Stand 02.10.2026:** Mockup `docs/mockups/hire.html` mit den echten Regeldaten (#26); Robs erste Durchsicht umgesetzt (Hire ohne Scrollen, Liste danach wieder oben, Regeltexte als Blase, Layout am Desktop nur von Hand, „New warband“, KI-Paket und Chronicle). Bildschirm „Hire“ in der App umgesetzt (Listen, Filter, Sheet, Anheuern mit Option, Kassenbuch); Aufstiege der Hired Swords gab es schon seit 3c. 3d ist damit vollständig; Robs Prüfung auf der Testinstanz. |
| 3e Hausregeln und Exporte | Hausregeln einer Warband (Mockup fehlt), Text und Datei, TTS-Karten, Rostersheet als PDF, Drucken. **Stand 03.10.2026:** Mockup `docs/mockups/house-rules.html` (#30); Bildschirm „House rules“ in der App als erste Basis (Rob: „erstmal eine grobe Basis … Verbesserungen werden definitiv folgen“). Exporte in der App: Tabletop-Simulator-Karten, Text, Tool-Datei, offizielles Rostersheet als PDF; Drucken vorerst über das PDF. |
| 3f Quick Build auf Pages | Checkliste vollständig, Szenarien der Legacy-Tests als eigene `core/`-Tests, Entscheidung D, Umstellung. **Stand 03.10.2026:** die letzten Lücken des Builders geschlossen (Erfahrung direkt setzen, bezahlter Preis eines seltenen Gegenstands, Druckansicht). Offen für den Builder: eine spätere Rücknahme von Beförderung und Tod (heute über Undo). Die Kampagnen-Zeilen der Checkliste (4a) hält die Umstellung auf: die Gruppe spielt ihre Kampagne heute im Roster Builder. **Rob, 03.10.2026:** Pages bleibt beim Roster Builder, bis die Kampagne (4a) in der neuen App läuft; der Roster Builder ist bis dahin eingefroren und wird nicht mehr angepasst (CLAUDE.md, behaviour-changes.md). |
| 3g Anmeldung | Einladung, Login, Sitzungen, TOTP, Reset-Links, Bremse, CSRF, Leak-Tests. **Rob, 03.10.2026:** neben den Logins auch Log-Daten – der Admin sieht in der App, wer sich wann angemeldet hat (`login_attempts`, `sessions`) und was geändert wurde (`audit_log`, data-model.md); Ansicht unter Admin. **Stand 03.10.2026:** der Server: Konten (Migration 2), Anmeldung in zwei Schritten mit TOTP, Sitzungen und Geräte, Einladungs- und Reset-Links (Token im Fragment), Bremse, Origin-Prüfung, Anmelde- und Audit-Log, `roster-cli` für den ersten Admin, Leak-Matrix mit Rollen und Probe je Route, Test „jede Tabelle und Spalte steht in `data-model.md`“, Rauchtest mit dem echten Image. Die Oberfläche in der App (nur `campaign`): Anmelden mit Code oder Wiederherstellungscode, Einladungs- und Reset-Link, Konto in More (Authenticator mit QR-Code und Wiederherstellungscodes, Passwort, Geräte, Abmelden), Admin mit Nutzern, Einladungen, Anmelde- und Audit-Log; nach den Mustern der App (kleine Bildschirme, die App ist das Mockup). 3g ist damit vollständig; Robs Prüfung auf der Testinstanz. |
| 3h Warbands auf dem Server | Versionen, Autosave, Sync mit Outbox und Epoche, „Send to campaign server“. **Rob, 04.10.2026:** Warbands auch ohne Kampagne speichern und als Blaupause für einen Kampagnenstart verwenden – so vorgesehen (concept.md 4.1: freie Warbands, für eine Kampagne eine Kopie); dazu „Make a copy“. **Stand 04.10.2026:** der Server (Migration 3, nur der Besitzer, Versionen mit `baseRev`, Entwurf je Nutzer, Entfernen und Zurückholen, Kopie mit Herkunft, `GET /sync`). Der Abgleich in der App (Ausstehendes am Datensatz, Entwurf, Konflikte mit Entscheidung im Roster, Entfernen nach Undo, neue Epoche, Warbands des Geräts ins Konto). Dazu der Bildschirm „Versions“ (Version mit Notiz speichern, ältere als neueste zurückholen oder als Kopie starten), „Make a copy“ auf jedem Roster (die Blaupause; die Kopie merkt sich ihre Herkunft) und „Send to campaign server“ (Quick Build: Adresse unter More, Link mit der Warband im Fragment; Kampagnen-App: `/import` mit Vorschau, neue Warband oder nächste Version). 3h ist damit vollständig; offen bleibt aus concept.md 4.11 die Gegenrichtung „Kopie zum Planen“ (Server → Quick Build). |
| 3i Teilen | **Rob, 05.10.2026:** eine Warband an Mitspieler weitergeben, ohne Datei: als Kopie direkt an einen Nutzer (er nimmt sie unter „Open for you“ an) oder als kurzer Code, den der andere eingibt. Vor 4a. **Stand 05.10.2026:** der Server (Migration 4, `/people`, `/shares`, Code nur als Hash, 7 Tage, Bremse für falsche Codes, Warband geleert, sobald niemand sie mehr nehmen kann) und die App („Share…“ im Roster mit Kopie an einen Mitspieler oder Code, zurücknehmen; geschickte Kopien unter „Open for you“; „Enter a share code“ unter Warbands). |
| Sicherheitsprüfung | **Rob, 05.10.2026:** eine eigene Prüfung, dass sich weder von außen noch angemeldet etwas ausnutzen lässt – Endpunkte, Rechte, Eingaben, Sitzungen, Betrieb. Termin: nach 4a, vor dem ersten echten Spielabend im neuen System. **Durchgeführt 09./10.10.2026:** 47 Befunde, alle hohen und mittleren behoben ([security-review.md](security-review.md)); Entscheidungen Robs: Herkunft der Images prüfen (ADR 0017), Zugangsdaten der Testinstanz tauschen. Offen für später: AUTHZ-6, AUTHZ-7, CLIENT-5, CLIENT-8, OPS-2 (eigene UID); OPS-8 (Git-Geschichte) entscheidet Rob. |

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

**Schritte (05.10.2026):** jeder ein eigener Pull Request, in dieser
Reihenfolge, weil jeder auf dem vorigen aufbaut.

| Schritt | Inhalt |
| --- | --- |
| 4a1 Kampagnen und Einschreibung | Kampagne anlegen (wer anlegt, leitet; mit Authenticator), Mitglieder und Rollen, Warband eintragen (immer eine Kopie, ein Leiter bestätigt, Tag `start` mit eingefrorenen Kennzahlen, die der Server mit `core` rechnet), Übersicht, fremde Warbands lesen, Verwaltung, eine eingetragene Warband verlässt die Kampagne. **Stand 05.10.2026:** umgesetzt (Migration 5, `server/src/campaigns.ts`, `routes-campaigns.ts`, `app/src/campaign/`). Die Regeldaten stecken im Server-Bundle (`server/src/rules.ts`). **Rob, 05.10.2026:** eine Warband auch direkt für die Kampagne anlegen – „New warband for this campaign“ im Eintragen: sie entsteht frei unter Warbands, ihre Kopie geht sofort in die Kampagne (umgesetzt); die Liste nennt die Kampagne der Kopie. Noch nicht: Hausregeln der Kampagne, Einladungslinks mit Kampagne |
| 4a2 Schlachten und Spielabend | Schlacht anlegen (Runde, Teilnehmer, Szenario, Bezirk), Schlachtprotokoll nur vom Leiter, Korrekturvorschläge, Spielabend-Modus, offline gesammelt und ohne Duplikate gesendet. **Stand 05.10.2026:** umgesetzt (Migration 6, `server/src/battles.ts`, `routes-battles.ts`, `app/src/battle/`): „New battle“ für Leiter in der Übersicht; der Spielabend als Vollbild auf dem Handy mit Zug, Protokoll (Verluste aus den echten Rostern, Ereignisse; korrigieren, herausnehmen, „Undo last“), Ergebnis je Warband, Korrekturvorschlägen; alle sehen es nach wenigen Sekunden (`?since=seq`); offline wartet alles im Postausgang des Geräts. Notizen, Zitate und Bilder am Spielabend kommen mit 4a3, Abschließen mit 4a4 |
| 4a3 Notizen und Zeitleiste | Notizen mit Art, Erwähnungen und Versiegeln, Bilder, Zeitleiste mit Verschieben; Leak-Matrix mit Sichtbarkeit. **Stand 05.10.2026, Teil 1 (Notizen):** umgesetzt (Migration 7, `server/src/notes.ts`, `routes-notes.ts`, `app/src/notes/`): Reiter „Notes“ der Kampagne und „Notes“ unten; Art (Note, Scene, Quote mit Sprecher, Dice moment, Open thread), Krieger aus den Rostern nennen, wer es lesen darf (alle · versiegelt bis zum Schließen der Schlacht · nur Leiter), bearbeiten mit früherer Fassung, herausnehmen; am Spielabend „+ Note“ und „+ Quote“ im Protokoll nach Zug; offline im Postausgang. Leak-Matrix mit Merkwörtern in einer versiegelten und einer Leiter-Notiz. **Teil 2a, Bilder (09.10.2026):** umgesetzt (Migration 9, `server/src/attachments.ts`, `app/src/pictures/`): „New picture“ im Reiter Notes, „+ Picture“ am Spielabend (am Zug); auf dem Handy verkleinert und neu kodiert (WebP, höchstens 1600 px, nur die Pixel), offline im Postausgang; für alle oder nur Leiter; Leak-Matrix mit einem Leiterbild. **Teil 2b, Zeitleiste (09.10.2026):** umgesetzt (Migration 10, `server/src/timeline.ts`, `app/src/timeline/`): Reiter „Timeline“ mit festen Ankern (vor der Kampagne, je Schlacht vorher · Verlauf · Aftermath, Zwischenspiel je Runde), Schlachtberichten und Markierungen; Notizen, Bilder und Protokoll dort, wo Schlacht und Zeit sie hinstellen; verschieben mit ↑ ↓ und „Move to…“ (eigene Bausteine, Leiter alle, Protokoll nur Leiter), mit Undo, geloggt. Langes Drücken und Ziehen kommt mit dem Überarbeiten der Oberfläche |
| 4a4 Nach der Schlacht | Post-Battle-Sequenz in der App, Änderungsvorschau, Tag `after_battle` mit eingefrorenen Änderungen (Server rechnet mit `core`), Schlacht abschließen (versiegelte Notizen öffnen, Sofort-Backup), Runde weiterschalten, Bezirke, Hausregeln der Kampagne. **Stand 09.10.2026, Teil 1:** umgesetzt (Migration 8, `server/src/aftermath.ts`, `app/src/aftermath/`, ADR 0016 vorgeschlagen): ein Leiter schließt die Schlacht am Spielabend („Close the battle…“; Protokoll fest, versiegelte Notizen offen, Snapshot); jeder Spieler übernimmt sie in seine Warband (über das Schlachtformular des Roster Builders: Stufe, Seiten, Verluste, Bezirk) und geht die zehn Schritte durch – Verletzungen würfeln, Erfahrung der Schlacht einmal gewähren und eintragen, Erkundungswürfel, Wyrdstein verkaufen, Anwerben und Kaufen über Roster und Trading Post; daneben „What changed“ seit der letzten Markierung, erklärt wie der Server es einfriert, und „Mark after battle N“ (Version + Tag, eine zweite Markierung korrigiert). In der Übersicht „Open for you“ und je Schlacht „x/y marked“; unter Manage „Move on to After battle N“, wer nicht kämpfte, hat ausgesetzt. **Teil 2 (09.10.2026):** Hausregeln der Kampagne (Leiter setzen sie, abweichende Warbands für alle markiert, „Take the campaign’s rules“, Kopien treten unter ihnen ein) und Bezirke (Roster → Districts von Hand, „The map“ in der Übersicht). Erklärungen zu Änderungen kommen mit 4b |
| 4a5 Übernahme | die laufende Kampagne aus den Speicherständen: Tags aus den Snapshots (Entscheidung E), Kapitel als Abschnitte der Zeitleiste, Ereignisse; Probelauf auf der Testinstanz. **Stand 09.10.2026, Teil 1 (Vorgeschichte):** umgesetzt (Migration 11, `server/src/history.ts`, `app/src/campaign/History.tsx`, `stage.ts`): ein Leiter trägt unter Manage → „Before the app“ die bisherigen Schlachten ein (Nummer, Titel, Bezirk, Tag, wer kämpfte und wie es ausging) – geschlossen von Anfang an, ohne Protokoll, Nachbereitung und Markierung, korrigierbar bis zur ersten eigenen Schlacht; die Kampagne steht danach nach der letzten, die Starts der Warbands wandern dorthin. Eine Warband, die in der Vorgeschichte kämpfte, übernimmt im Roster die Stufe der Kampagne („Take the campaign’s stage“, ohne Snapshots und ohne ausgesessene Spiele dazwischen). Snapshots gibt es in den Ständen der Gruppe nicht (Entscheidung E); Ereignisse bleiben, wo sie sind: im Log des Speicherstands (ADR 0016) – die Stände der Gruppe haben keins. Ablauf: [operations.md](operations.md#die-laufende-kampagne-übernehmen-einmalig-phase-4a5). **Teil 2, Kapitel (09.10.2026):** umgesetzt (Migration 12, `server/src/chapters.ts`, `app/src/timeline/chapters.ts`, `ChapterParts.tsx`): ein Leiter importiert in der Zeitleiste die Dateien der Chronik („Import chapters…“, Markdown mit Front Matter; deutsche und englische Datei desselben `ref` werden ein Kapitel); jedes steht am Anfang des Abschnitts, von dem es erzählt (Prolog vor der Kampagne, `battle-N` bei Schlacht N, `interlude-N` im Zwischenspiel N, sonst nach der letzten Schlacht, die vor ihm erschien – im Import änderbar); alle lesen es auf Deutsch oder Englisch, ein Leiter verschiebt es oder nimmt es heraus |

**Danach (Rob, 05.10.2026):** die Oberfläche am Desktop. Dort sind es zu viele
Knöpfe, und der Kauf von Ausrüstung ist versteckt; am Desktop ist Platz für
ein zweites Fenster rechts daneben (etwa Trading Post oder Ausrüstung neben
dem Roster) – die Arbeitsfläche aus `docs/mockups/desktop.html` ist der
Vorschlag dafür. Erst wenn das generelle Setup (4a) steht: es ist keine
wesentliche Korrektur. Dazu kommt später ein Überarbeiten der ganzen
Oberfläche (Rob, 09.10.2026: „UI-Overhaul“, nicht jetzt) – die
Desktop-Arbeitsfläche ist ein Teil davon.

## Phase 4b – Erzählung und Leitung

- Erzählung der Warband (Prolog, Zwischenspiele, Erklärungen), Profile mit
  zweisprachigem Kanon, Lebenslauf, Fragen an Spieler, „Offen für dich“.
- Hintergrund mit Enthüllungsstufen, „Als Spieler ansehen“.
- Welt: Fraktionen, NPCs, Ruf, Bezirke, Szenarien.
- Briefing, KI-Paket (auch als Prompt zum Kopieren aus der Timeline),
  Kanon-Export für den Chronik-Linter als Download (keine Ablage in `eingang/chronik/`, ADR 0018).
- Reiter „Chronicle“: die ganze Geschichte, Textimport von Kapiteln als
  Entwurf mit Prüfung, Download (Mockup `chronicle.html`, 02.10.2026).

**Abnahme:** Das Kapitel zur nächsten Schlacht entsteht mit `chronik N` aus
dem KI-Paket.

**Schritte (12.10.2026):** Rob will den Roster Builder fertigstellen, sodass
danach nur noch nachgebessert wird („Chronicle“ ignorieren wir zunächst; die
Oberfläche überarbeiten und der Desktop kommen später). Jeder Schritt ein
eigener Pull Request aus `master`, in dieser Reihenfolge:

| Schritt | Inhalt |
| --- | --- |
| 4b1 Hintergrund | Hintergrund nur für Leiter (mit Authenticator): Handlungsstränge, Figuren, Orte, Szenarien, GM-Notizen; Wahrheit, „Was die Spieler wissen“, Enthüllungsstufe (verborgen · Andeutung · enthüllt) mit Grenze für Andeutungen; frühere Fassungen bleiben (die letzten 50); **Enthüllen** erzeugt eine öffentliche Notiz, setzt sie in die Zeitleiste und hebt die Stufe an, die Wahrheit bleibt unberührt; „Als Spieler ansehen“ (`?as=player`) für Notizen und Bilder. **Stand 12.10.2026:** umgesetzt (Migration 15, `server/src/background.ts`, `routes-background.ts`, `viewer.ts`, `app/src/background/`, `app/src/notes/AsPlayer.tsx`); neue Zeilen der Leak-Matrix. |
| 4b2 Story der Warband | Prolog, Zwischenspiele, Erklärungen zu jeder Änderung, Profile mit zweisprachigem Kanon, Lebenslauf. **Stand 12.10.2026:** umgesetzt, ohne Migration – alles liegt im Stand des Spielers (ADR 0016): `core/src/narrative/story.ts` (Aktionen `setPrologue`, `setInterlude`, `setExplanation`, `setProfile`, `setCanon`; Grenzen `STORY_LIMITS`), `life.ts` (`lifeOf`, abgeleitet), Schema-Grenzen im Server-Test, App `app/src/story/` (Seite `/warbands/:id/story`, Lebenslauf auch aus ⋯ → „Story so far & profile“), „Say what happened“ je Änderung in der Nachbereitung. **Entschieden:** keine versiegelten Zwischenspiele – die Story liegt im Stand und ist für die Kampagne lesbar, die Seite sagt das; Geheimes gehört in eine versiegelte Notiz. Fehlende Erklärungen sperren nichts. |
| 4b3a Fragen | Fragen an Spieler, „Offen für dich“. **Stand 12.10.2026:** umgesetzt (Migration 16, Tabelle `questions`, `server/src/questions.ts`, `routes-questions.ts`, Policy `questions.read|write|answer`, neue Zeilen der Leak-Matrix; App `app/src/questions/` mit Reiter „Questions“, `app/src/open/` mit „Offen für dich“ in der Kampagne und auf Home). Ein Leiter (mit Authenticator) fragt einen Spieler; die Antwort ist in einem Schritt eine Notiz des Gefragten mit seiner Sichtbarkeit; der Wortlaut der Frage geht in keine Notiz. „Offen für dich“ zeigt Fragen, offene Nachbereitungen und fehlende Zwischenspiele. **Entschieden:** fehlende Erklärungen stehen nicht als eigener Eintrag da – die Nachbereitung zeigt sie selbst („Not told yet“), und sie sperren nichts; ein Eintrag bräuchte je Warband einen Abruf der eingefrorenen Änderungen. Schreiben der Fragen nur online. |
| 4b3b Welt | Fraktionen, NPCs, Ruf. **Stand 12.10.2026:** umgesetzt (Migration 17, Tabellen `factions`, `npcs`, `reputation_events`, `server/src/world.ts`, `routes-world.ts`, Policy `world.read|write`, neue Zeilen der Leak-Matrix; App `app/src/world/`, Reiter „World“). Öffentliche Mechanik (ADR 0002): jedes Mitglied liest alles, Zuschauer eingeschlossen; nur Leiter mit Authenticator schreiben. Ruf ist ein Log aus Ereignissen mit Grund und optionaler Schlacht, der Stand ist die Summe; ein Ereignis wird nie geändert, nur herausgenommen. Die Wahrheit über einen NPC bleibt im Hintergrund. **Entschieden:** keine Tabelle `district_control` – Bezirke bleiben aus den Ständen der Warbands abgeleitet (ADR 0016, `campaignMap`). Schreiben nur online. |
| 4b3c Szenarien | Szenarien mit Regeln und NPC-Werten im TTS-Format. **Stand 12.10.2026:** umgesetzt (Migration 18, Tabellen `scenarios`, `scenario_revisions`, `server/src/scenarios.ts`, `routes-scenarios.ts`, Policy `scenarios.read|write`, neue Zeilen der Leak-Matrix mit Merkwort; App `app/src/scenarios/`, Abschnitt „Scenarios“ im Reiter „World“, „Copy statlines“ für den TTS-Tisch). Ein Entwurf ist nur für Leiter mit Authenticator da; **Freigeben** = einer Schlacht der Kampagne zuweisen, danach lesen alle Mitglieder, und es wird nicht zurückgenommen. Ein freigegebenes Szenario darf korrigiert werden (frühere Fassung bleibt), aber nicht herausgenommen; ein Entwurf schon. **Abgrenzung (entschieden):** das Szenario ist das spielbare Paket des Leiters; Pläne, Ideen und Notizen darum bleiben im Hintergrund (Art „Scenarios“ dort). Schreiben nur online. |
| 4b4a Briefing, KI-Paket, Stilvorgaben | **Stand 12.10.2026:** umgesetzt (Migration 19, Tabelle `campaign_docs`, `server/src/style.ts`, `routes-style.ts`, Policy `style.read|write`, neue Zeilen der Leak-Matrix mit Merkwort; `core/narrative/pack.ts` mit `buildPack`; App `app/src/pack/`, Knopf **„AI pack…“** in der Zeitleiste, Abschnitt „Style guide ⚑“ unter Manage). Das **Briefing ist der erste Teil des KI-Pakets** (Schlacht in Story-Reihenfolge, Aftermath, Aufstiege mit Erklärung und Taten); wer nur das will, wählt die anderen Teile ab. Das Paket baut das Gerät des Leiters aus dem, was die App schon liest (ADR 0005); die **eingefrorenen Änderungen der Markierung** liefern Aftermath und Aufstiege (ADR 0003: nichts wird neu gerechnet), deshalb braucht es keine Vorher-/Nachher-Stände fremder Warbands und keine neue Server-Route. **Was ein Schreibender nie bekommt (entschieden):** Notizen nur für Leiter, GM-Notizen, Szenario-Pläne des Hintergrunds, Einträge mit Status „planned“, Bilder nur für Leiter. Hintergrund geht mit Regel hinein (HIDDEN · HINT ONLY mit Grenze · REVEALED); eine Wahrheit, die erst ab einer späteren Schlacht öffentlich ist, geht als HIDDEN hinein. Die Zusammenfassung der früheren Kapitel schreibt keine KI: Liste der Kapitel, das letzte im Volltext. Fehlendes (Warband nicht markiert, nichts protokolliert) nennt das Blatt als Lücke, statt es zu verschweigen. Lesen und Schreiben der Stilvorgaben nur online und nur für Leiter mit Authenticator. |
| 4b4b Kanon-Export (klein, optional) | **Stand 17.10.2026:** umgesetzt (`core/narrative/canon.ts`, `app/src/canon/`, Abschnitt „Canon for the linter“ unter Manage, nur Leiter; keine Server-Änderung). Ein Textdownload `<kampagne>-canon.txt` von Hand (ADR 0018): die Namen der Kampagne in Deutsch und Englisch – Warbands, Krieger mit Profil (auch Gefallene, Hired Swords, Dramatis Personae), Titel, Fraktionen und Personen der Welt – als Listen für `NUR_DEUTSCH`/`NUR_ENGLISCH` des Chronik-Linters (was sich zwischen den Sprachen unterscheidet, ohne Artikel, sortiert), dazu „same“ (in beiden gleich), „incomplete“ (nur eine Sprache oder Warband ohne Kanonnamen) und alle Paare zum Lesen. Nur Namen: kein Hintergrund, keine Notizen, nichts aus Stimme, Herkunft oder Profiltext. Es wird nichts gespeichert, wenn eine Warband nicht gelesen werden konnte. Anders als das Konzept es nannte, ist es **nicht** `spielbegriffe.txt` (das sind Spielbegriffe, die nicht in die Prosa dürfen, und hängen nicht am Kanon). `campaign_docs.kind = 'canon_extra'` bleibt reserviert, bis Rob Zusatzschreibweisen in der Datei will. Keine Ablage in `eingang/chronik/`, keine Route, keine Änderung an `ops/`. Nachtrag zu 4b4a: Ausrüstung und Gold (`gear_added`, `gear_removed`, `gold`) stehen als Abschnitt „Equipment and gold“ im Paket. |
| 4b5a Chronicle: lesen und herunterladen | **Stand 16.10.2026:** umgesetzt (`app/src/chronicle/`, Reiter „Chronicle“ zwischen Timeline und World, ohne Server-Änderung): alle Mitglieder – auch Zuschauer – lesen die veröffentlichten Kapitel in der Reihenfolge der Geschichte (die der Zeitleiste, mit dem Abschnitt, in dem jedes steht), je Kapitel „Read“/„Hide“ mit dem Text an Ort und Stelle, Sprache Deutsch/English für die ganze Seite (ein Kapitel, das es nur in der anderen gibt, erscheint in dieser und sagt es), „Download all (.md)“ als eine Datei (`<kampagne>-chronicle-<de|en>.md`). Offline: das zuletzt Gesehene. |
| 4b5b Chronicle: Entwürfe | **Stand 16.10.2026:** umgesetzt (Migration 20 `chapter_drafts`, `server/src/chapter-drafts.ts`, `routes-drafts.ts`; `core/narrative/leaks.ts`; `app/src/drafts/`, Abschnitt „Drafts ⚑ Leaders only“ unten im Reiter „Chronicle“, nur für Leiter mit Authenticator). Ein Leiter bringt ein Kapitel als Text ein (eingefügt oder als .md/.txt; hat die Datei Front Matter der Chronik, füllt sie Titel, Kapitel und Sprache) mit Titel, Art (Schlacht, Zwischenspiel, Prolog, anderes Kapitel) samt Runde und Sprache. **Prüfung** (`checkLeaks`): schon beim Eintippen und noch einmal im Prüfblatt wird der Text gegen jedes Hintergrundstück gehalten, das an der Stelle des Kapitels verborgen oder nur anzudeuten ist (`ruleAtRound`: ein enthülltes Stück ist ab dem Kapitel seiner Schlacht öffentlich, im Prolog noch keines) – Titel und Namen aus der Wahrheit, die weder „players know“ noch die öffentlichen Namen (Warbands, Krieger, Welt, Bezirke) abdecken; Andeutungen zeigen ihre Grenzen („Allowed: …“). Die Prüfung findet Wörter, nicht Sinn, und warnt nur: **Freigeben** („Publish“) geht bei Funden erst nach einem bewussten Haken („Publish anyway“). Freigeben setzt die Sprache in das Kapitel desselben `ref` (die andere bleibt, dieselbe wird ersetzt – das Blatt sagt es vorher), ein neues Kapitel steht am Kopf des gewählten Abschnitts (Vorgabe: die Schlacht, die sein `ref` nennt); Verwerfen fragt nach. Der Entwurf steht in keiner Zeitleiste und keinem Download, bis er freigegeben ist. Der Einzelimport fertiger Chronik-Dateien in der Zeitleiste bleibt. |

„Als Spieler ansehen“ zeigt in 4b1 Notizen und Bilder; die ganze Zeitleiste
und die Welt kommen dazu, sobald es sie gibt.

## Phase 4c – Bug-Tracker

- „Report a problem“ mit Kontext; Status für den Meldenden. Der Kontext geht
  ohne Zutun mit (Rob, 09.10.2026: Meldende schreiben meist nur
  „funktioniert nicht“): Bildschirm und Reiter, die letzten Schritte davor,
  Einstellungen (Theme, Layout, Flavour, Online/Sync, Rolle), Hausregeln von
  Warband und Kampagne, letzte JS-Fehler – vor dem Senden lesbar angezeigt
  (concept.md 4.12).
- `roster-cli`/API-Zugang mit Bug-Token (ADR 0019); Bereiniger für
  Testvorlagen.
- `.claude/commands/bugs.md` (Ablauf `/bugs`) und
  `.claude/agents/reviewer.md`.

**Abnahme:** Ein echter Bug ist von der Meldung bis „fixed in <version>“
durchgelaufen.

**Reihenfolge (12.10.2026):** nach 4b5, ein Pull Request für Tabelle, Meldung
mit Kontext und Status, ein weiterer für Triage, Bug-Token, `/bugs` und den
Reviewer.

**Stand 17.10.2026 (4c1):** umgesetzt – Tabelle, Meldung mit Kontext, Status
für den Meldenden und die Übergabe von Hand. Migration 21 (Tabelle `bugs`,
`server/src/bugs.ts`, `routes-bugs.ts`, Policy `bugs.report|mine|read|write`,
neue Zeilen der Leak-Matrix mit Merkwort). App `app/src/bugs/`: Knopf
**„Report a problem“** im Kopf jeder Seite (Blatt mit Art, Text, bei
Regelfehlern Quelle), **More → „Your reports“** mit dem Stand, Reiter
**„Reports“** im Admin-Bereich. Der Kontext besteht nur aus Struktur und festen
Wörtern (Bildschirm als Muster ohne Kennungen, Namen der Blätter, „eine
Änderung an der Warband“, Sync- und Online-Stand, fehlgeschlagene Aufrufe als
Muster mit Status, die letzten fünf JS-Fehler, Einstellungen, Hausregeln von
Warband und Kampagne); nichts, was jemand getippt hat. Was mitgeht, steht vor
dem Senden lesbar im Formular. Die Warband geht nur mit einem eigenen Haken
mit, als Kopie zum Meldezeitpunkt, und wird beim Schließen oder als Duplikat
wieder verworfen. Grenzen: 20 Meldungen je 24 Stunden, 300 je Nutzer. Ohne
Netz oder ohne Konto (und im Quick Build) bleibt „Copy the report“ – der
Text zum Weitergeben von Hand. Der Admin sortiert (Grad, Bereich, Status,
„fixed in“) und hat „Copy for Claude“, „Download the report“ und „Download the
warband“ – die Übergabe nach ADR 0018, ohne Anbindung. **Entschieden:**
Kopie statt Verweis auf die Warband (sonst bräuchte der Admin einen Lesezugriff
auf fremde Warbands); keine Tabelle `bug_comments` – Rückfragen gehen am Tisch
oder im Chat.

**Stand 17.10.2026 (4c2):** umgesetzt – der Zugang für Cloud-Sitzungen und der
Ablauf `/bugs`. Migration 22 gibt jeder Meldung eine **Nummer** (`#7`, Commit
`Fix #7`), Migration 23 legt die Tabelle `bug_tokens` an. Das **Bug-Token**
([ADR 0019](decisions/0019-bug-token.md)) ist ein eigener Zugang: `Authorization:
Bearer rbt_…`, nur `GET/PATCH /bugs` (`token: true` in `policy.ts`, auf jeder
anderen Route 403 vor dem Handler, ein Test geht alle Routen durch), nur der
Hash gespeichert, erzeugt nur mit `roster-cli bug-token create`, 60 Tage,
höchstens fünf, widerrufbar; die Testinstanz widerruft nach jeder
Wiederherstellung alle. `roster-cli` bekam `bug-token create|list|revoke`,
`bugs` und `bugs show <n>`. In der Cloud-Umgebung liegt das Token als
„Network secret“ (der Proxy hängt es an, die Sitzung sieht es nie); die
Einrichtung steht in [operations.md](operations.md#bug-token-für-eine-cloud-sitzung-ab-phase-4c2).
`npm run bugs` (`core/scripts/bugs.ts`) liest und sortiert Meldungen, zeigt sie
als eingezäunte Daten und holt mit `fixture N` den Speicherstand einer Meldung
durch den Bereiniger nach `core/test/saves/bug-N.json`. `.claude/commands/bugs.md`
führt durch Einordnung (S1–S4, Sichtbarkeit ist S1), Korrektur (Test zuerst,
`Fix #N`) und „fixed in“; `.claude/agents/reviewer.md` prüft S1-Korrekturen,
sieht nur Meldung und Diff und kann nichts ändern. **Offen für die Abnahme:**
ein echter Bug, der den ganzen Weg läuft – das geschieht mit der ersten echten
Meldung.

## Zwischenschritt – Live-Aktualisierung (ADR 0020)

Rob, 18.10.2026: Änderungen anderer Spieler sollen direkt erscheinen, ohne
Neuladen. **Stand 18.10.2026:** umgesetzt – `GET /api/v1/events` (Server-Sent
Events, nur Signale), Hub im Speicher (`server/src/live.ts`), `events.read`
in Policy und Leak-Matrix; in der App `app/src/live/live.ts`: ein Strom je
angemeldeter App, Kampagne, Notizen, Chronik, Bilder, Gefecht, Zeitleiste,
Hintergrund, Welt, Szenarien, Fragen, Listen und der Sync fragen bei einem
Signal neu; die alten Timer bleiben als Rückfall (jede sechste Runde, solange
der Strom steht). Kein Eintrag im Header (die neue Oberfläche entscheidet, ob
„live“ sichtbar wird). Abnahme: zwei Browser, ein Spieler schreibt eine Notiz,
der andere sieht sie nach etwa einer Sekunde.

## Zwischenschritt – Roster v2 (Oberfläche, Beginn)

Rob, 18.10.2026: den Entwurf `docs/mockups/roster-v2.html` (PR #70) in die App
bauen, **am Desktop die ganze Breite nutzen** (wichtiger als die App), die
Information gleich sichtbar, und bei vielen Einheiten keine Wall of Text.
**Stand 18.10.2026:** umgesetzt – eine Zeile je Krieger mit ganzer Statline,
Erfahrungsleiste und Marken; auf dem Handy öffnet sich der Krieger unter seiner
Zeile mit vier Reitern, ab 860 px steht er in einem Fenster neben der Liste,
ab 1560 px kommen die Funktionen der Warband als dritte Spalte dazu; Kopf mit
Kacheln und Leiste (+ Recruit, Hire, Trade, Export) statt ⋯-Menü; Druckblatt nur
beim Drucken; dieselbe Liste für Warbands anderer Spieler (lesend). Beschreibung
in [ui.md](ui.md#roster-v2-in-der-app). **Danach, je ein eigener Pull Request
nach denselben Regeln:** die übrigen Bildschirme (zuerst die, die Rob am
häufigsten benutzt – Rob entscheidet die Reihenfolge).

## Phase 5 – Extras

- Volltextsuche (SQLite FTS5) über Notizen, Zeitleiste, Lebensläufe.
- Push-Hinweise (Web Push).
- TTS-Skript, das Beschreibungskarten vom Pi abruft.
- Connector (MCP) für Claude; Commit freigegebener Kapitel ins Chronik-Repo.
- Kampagnenvorlagen.

## Voraussetzungen aus der Agenten-Basis

Diese offenen Punkte des Pi müssen vor Phase 2 erledigt sein:

- cgroup-Speicher aktivieren (sonst greifen keine Container-Limits).
- Chronik-Eingang: die App bindet ihn nicht ein (ADR 0018); kein Umzug nötig.
- WireGuard: prüfen, aus welchem Netz VPN-Geräte kommen (betrifft den
  Zugriff auf die Testinstanz von unterwegs).

## Offene Entscheidungen

| | Frage | Vorschlag | Bis |
| --- | --- | --- | --- |
| ~~A~~ | ~~Optik~~ – entschieden: beide Themes wählbar, Standard „Chronicle“ (dunkel), siehe [ui.md](ui.md#4-themes-und-gestaltung) | – | – |
| ~~B~~ | ~~Git im Agenten-Container~~ – entschieden: Entwicklung in Cloud-Sitzungen, Betrieb auf dem Pi (ADR 0015); kein Agent auf dem Pi für dieses Projekt | – | – |
| ~~C~~ | ~~Immer~~ – entschieden: ja, für alle Aktionen in `core/warband` (die Portierung bleibt 1:1 lesbar, Ergebnisse sind unveränderlich) | – | – |
| **D** | Alte App nach der Umstellung: `dist/mordheim-roster.html` noch eine Kampagnenrunde lang als Download behalten? | ja, danach entfernen | Phase 3 |
| **E** | Für welche der bisherigen Schlachten gibt es Snapshots? Wo keine sind, beginnt der Vergleich erst ab dem ersten Snapshot. | beim Import prüfen und festhalten. **Geprüft (09.10.2026)** an den beiden echten Ständen in `core/test/saves/` (Rangvald's Reavers, Silberne Karavane): Kampagnenmodus aus, Stufe „Setup“, keine Schlachten, kein Log, keine Snapshots – wie Rob am 29.09.2026 sagte. Der Vergleich beginnt also mit der Übernahme (4a5); die Kinder des Sotek prüft der Probelauf | Phase 4a |
| **F** | Push-Hinweise | später entscheiden | Phase 5 |

## Getroffene Entscheidungen

Siehe [decisions/](decisions/). Kurzfassung:

| ADR | Entscheidung |
| --- | --- |
| 0001 | Pi liefert App und API unter einer eigenen Hostname; Pages bleibt als Quick Build |
| 0002 | Mechanik offen, Erzählung darf verborgen sein |
| 0003 | Versionen statt Überschreiben; markierte Stände; eingefrorene Kennzahlen |
| 0004 | KI ohne API (Ablage in `eingang/chronik/` ersetzt durch [0018](decisions/0018-ai-pack-by-hand.md)) |
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
| 0019 | Bug-Token: ein eigener Zugang für Cloud-Sitzungen, nur `GET/PATCH /bugs` ([0019](decisions/0019-bug-token.md), ergänzt 0012) |
| – | Themes: „Chronicle“ (dunkel, Standard) und „Parchment“ (hell) wählbar; Druck immer hell ([ui.md](ui.md#4-themes-und-gestaltung)) |
