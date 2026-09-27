# Architektur

Stand: 27. September 2026 · Grundlage: [concept.md](concept.md), ADRs 0001, 0005, 0006, 0009

## 1. Überblick

```
 Handy / Desktop (PWA)                     Pi 5 (piServer)
┌──────────────────────────┐   HTTPS   ┌──────────────────────────────┐
│ app/  React-Oberfläche   │◄─────────►│ caddy   :443, Zertifikat      │
│  ├ core/  Regeln, Diff   │  Fritzbox │   └► server/ 127.0.0.1:3000   │
│  ├ Dexie (IndexedDB)     │   :443    │        Fastify + SQLite       │
│  └ Warteschlange (Outbox)│           │        /mnt/ssd/roster/data   │
└──────────────────────────┘           │   KI-Paket ► eingang/chronik/ │
                                       └──────────────────────────────┘
 GitHub Pages: Quick Build              GitHub Actions: Tests, Builds,
 (derselbe app/-Build, ohne Server)     Image → ghcr.io → roster-deploy
```

- **Die Oberfläche liest immer lokal** (Dexie) und reagiert sofort. Ein
  Synchronisations-Modul gleicht im Hintergrund mit dem Server ab.
- **Regeln rechnet der Client** mit `core/`. Der Server nutzt dasselbe
  `core/` für Prüfung und den verbindlichen Vergleich beim Markieren.
- **Gebaut wird in der CI**, nicht auf dem Pi.

## 2. Repo-Aufbau (Ziel)

```
core/        TypeScript, ohne DOM: Regeln, Zustand, Vergleich, Format
app/         React-PWA (Vite); zwei Varianten: campaign, quickbuild
server/      Fastify-API, SQLite, Migrationen, CLI
data/        geprüfte Regeldaten (JSON) – bleibt bis zur Umstellung hier
docs/        diese Doku
index.html, js/, test/, build.js   bestehende App (Legacy) bis zur Umstellung
```

- npm-Workspaces für `core`, `app`, `server`.
- **`data/` bleibt während der Übergangszeit die einzige Quelle** für alte und
  neue App. Erst wenn die alte App entfernt ist, zieht `data/` nach `core/`.
- Die alte App bleibt auf Pages live und unverändert nutzbar, bis die neue den
  Builder vollständig abdeckt (siehe [roadmap.md](roadmap.md)).

## 3. `core/`

Reine Logik, lauffähig in Browser und Node.

| Modul | Inhalt | Herkunft |
| --- | --- | --- |
| `rules/` | Kosten, Ausrüstungslisten, Profile, Rüstungswurf, Rating, Worth, Hausregeln | `js/engine.js`, Teile von `js/app.js`, `js/state.js` |
| `warband/` | Operationen auf einer Warband: anwerben, ausrüsten, Erfahrung, Aufstiege, Verletzungen, Gefallene, Gold | `js/app.js` |
| `campaign/` | Post-Battle-Sequenz, Einkommen, Wyrdstone, Unterhalt, Bezirke | `js/app.js` (Branch `chronicle`) |
| `changes/` | Vergleich zweier Stände, Abgleich mit Ereignissen, Änderungsschlüssel | neu |
| `narrative/` | Briefing, KI-Paket, Lebenslauf, Kanon-Export | neu, ersetzt `narrativeReport()` |
| `format/` | Zod-Schemas, Formatnummer, Migrationen alter Speicherstände | neu |
| `export/` | TTS-Texte, Text-Export mit `MORDHEIM-DATA`, PDF-Sheet (Vorlage und `pdf-lib` werden hineingereicht) | `js/tts.js`, `js/pdf.js` |

**Stand (Phase 1b):** `data/` (Laden, Typen), `state/` (Speicherformat,
Hausregeln) und `rules/` (Nachschlagen, Bezirkseffekte, Preise, Hired Swords
und Dramatis Personae, Ausrüstung und Rare Items, Kosten und Rating, Worth,
Rüstungswurf) sind portiert und per Paritätstest abgesichert. Die übrigen
Module folgen in der Reihenfolge aus [roadmap.md](roadmap.md).

**Wie portiert wird:** Die alte App wird *nicht* auf `core/` umgebaut; sie
bleibt unverändert live, bis der neue Builder sie ersetzt. `core/` wird gegen
sie per Differenztest geprüft (`core/test/parity/`): Für erzeugte Warbands
aller 49 Typen, aller Subtypen und dreier Hausregel-Varianten rechnen alte App
und `core/` jeden Wert aus, und beide Ergebnisse müssen identisch sein.

Regeln für `core/`:

- Keine DOM-Zugriffe, keine globalen Variablen, kein verstecktes `Date.now()`
  oder `Math.random()` – Uhr und Zufall werden hineingereicht.
- Operationen sind reine Funktionen: Zustand rein, neuer Zustand raus
  (unveränderlich; ob mit Immer, wird in Phase 1 entschieden).
- Alles, was eingefroren wird (Kennzahlen beim Markieren), berechnet `core/`
  genau einmal; gespeichert wird das Ergebnis, nie neu berechnet.
- Jede Funktion hat Tests (Vitest). Die 32 bestehenden Testdateien werden auf
  `core/` portiert; ein Paritätstest vergleicht alte und neue Logik über alle
  Warbands.

## 4. `app/`

| Zweck | Wahl |
| --- | --- |
| Oberfläche | React 19, TypeScript `strict`, React Compiler |
| Build | Vite |
| Navigation | React Router |
| Lokale Daten | Dexie (IndexedDB) mit `useLiveQuery` |
| Validierung | Zod-Schemas aus `core/format` |
| Verschieben | dnd-kit (Touch und Tastatur) |
| Stil | CSS-Variablen (Design-Tokens), CSS-Module, natives `<dialog>`; keine UI-Bibliothek |
| PWA | vite-plugin-pwa: Manifest, Service Worker, Update-Banner |
| Tests | Vitest + Testing Library; Playwright bei 360 px (nur CI) |
| Lint | ESLint mit `eslint-plugin-react-hooks`; `dangerouslySetInnerHTML` verboten |

**Zwei Varianten aus einem Code:**

| | `campaign` | `quickbuild` |
| --- | --- | --- |
| Ausgeliefert von | Pi (`server/`) | GitHub Pages |
| Name im Manifest | Mordheim Campaign | Mordheim Quick Build |
| Login, Sync, Kampagne | ja | nein |
| Speichern | Dexie + Server | Dexie + Datei |
| Austausch | Import aus Fragment-Link, Datei, Text | „An Kampagnenserver senden“, Datei, Text |

**Zustand:** Persistente Daten liegen in Dexie und sind die Quelle der
Oberfläche. Reiner UI-Zustand (offene Bereiche, Formulareingaben) bleibt in
React-State. Kein globaler Store.

**Performance:** Abgeleitete Werte (Rating, Worth, Kosten) werden je Warband
gemerkt und nicht bei jedem Tastendruck neu berechnet; lange Listen
(Zeitleiste) zeichnen nur Sichtbares; Bilder werden vor dem Hochladen
verkleinert (siehe [ui.md](ui.md#leistungsgrenzen)).

## 5. `server/`

| Zweck | Wahl |
| --- | --- |
| Laufzeit | Node 24 LTS |
| HTTP | Fastify (`trustProxy` nur für `127.0.0.1`) |
| Datenbank | SQLite über `better-sqlite3`, WAL-Modus |
| Migrationen | nummerierte SQL-Dateien, nur vorwärts, Tabelle `schema_migrations` |
| Validierung | dieselben Zod-Schemas aus `core/format` |
| Logs | JSON auf stdout (pino); Login-Fehler als eigene Zeilen für Fail2Ban |
| Auslieferung | statische Dateien des `campaign`-Builds, API unter `/api/v1` |
| CLI | `roster-cli`: Backup, Einladung, Reset-Link, Bugs, KI-Paket |

- **Kein Rendern auf dem Server**, kein Next.js.
- Ziel-Speicherbedarf 50–80 MB, Grenze 256 MB (Container-Limit).
- Beim Start: Markerdatei auf der SSD prüfen (`/data/.roster-volume`), sonst
  Abbruch. Migrationen laufen nur nach einem Backup.
- `GET /api/v1/health` meldet Version, Datenbank-Zustand und
  Migrationsstand; `roster-deploy` wartet darauf.

### Endpunkte (Grobschnitt)

| Bereich | Pfade |
| --- | --- |
| Anmeldung | `POST /auth/login`, `POST /auth/totp`, `POST /auth/logout`, `GET/DELETE /auth/sessions` |
| Einladungen | `POST /invites` (Admin), `POST /invites/:token/accept` |
| Warbands | `GET/POST /warbands`, `GET /warbands/:id/versions`, `POST /warbands/:id/versions` (mit `baseRev`), `PUT /warbands/:id/autosave` |
| Kampagnen | `GET/POST /campaigns`, `…/members`, `…/enrolments`, `…/rounds/advance` |
| Schlachten | `…/battles`, `…/battles/:id/protocol`, `…/battles/:id/proposals`, `…/battles/:id/close` |
| Erzählung | `…/notes`, `…/timeline/positions`, `…/questions`, `…/attachments` |
| Leiter | `…/background`, `…/style`, `…/briefing/:battleId`, `…/ai-pack/:battleId` |
| Welt | `…/factions`, `…/npcs`, `…/reputation`, `…/districts`, `…/scenarios` |
| Sync | `GET /sync?cursor=` |
| Bugs | `POST /bugs`, `GET /bugs` (Admin, Bug-Token), `PATCH /bugs/:id` |
| Betrieb | `GET /health` |

Details und Felder: [data-model.md](data-model.md). Rechte:
[security.md](security.md).

## 6. Synchronisation

**Lokal zuerst:** Die App arbeitet gegen Dexie; ein Sync-Modul gleicht ab.

- **Holen:** `GET /api/v1/sync?cursor=N` liefert alle für den Nutzer
  sichtbaren Datensätze, die sich seit `N` geändert haben, plus den neuen
  Cursor. Jede Schreibaktion auf dem Server bekommt eine fortlaufende Nummer
  (`seq`). Gelöschtes kommt als Grabstein.
- **Senden:** Einträge warten in der Outbox mit einer auf dem Gerät erzeugten
  UUID. Der Server nutzt sie als Idempotenzschlüssel: doppelt gesendet ergibt
  keinen doppelten Eintrag.
- **Häufigkeit:** beim Öffnen, beim Fokus und alle ~10 Sekunden, solange die
  App sichtbar ist. Am Spielabend erscheinen Protokolleinträge damit nach
  wenigen Sekunden bei allen. Server-Sent Events sind eine spätere Option.
- **Epoche:** Der Server trägt eine Epochen-ID, die sich bei jeder
  Wiederherstellung aus einem Backup ändert. Sieht ein Gerät eine neue
  Epoche, gleicht es vollständig neu ab und bietet alle lokalen Einträge an,
  die der Server nicht kennt (dank UUIDs ohne Duplikate). Was nach dem
  letzten Backup auf einem Handy entstanden ist, geht so nicht verloren.
- **Sichtbarkeit wird auf dem Server gefiltert,** nie im Client. Versiegelte
  Notizen gehen an ihren Autor vollständig, an alle anderen – auch Leiter –
  nur als Platzhalter (ID, Autor, `sealed_until`), bis sie sich öffnen.
  Hintergrund-Datensätze gehen nur an Leiter.

**Konflikte:**

| Daten | Regel |
| --- | --- |
| Warband-Versionen | `baseRev` muss der aktuellen Version entsprechen, sonst 409; die App bietet „neueren Stand laden“ oder „als Kopie speichern“ |
| Notizen | gehören ihrem Autor; letzte Fassung gewinnt, frühere bleiben als Revision |
| Schlachtprotokoll | nur der Leiter schreibt; Spieler schicken Korrekturvorschläge |
| Zeitleisten-Position | letzte Verschiebung gewinnt, jede wird geloggt |
| Hintergrund | nur Leiter; letzte Fassung gewinnt, Revisionen bleiben |

## 7. Auslieferung

**CI (GitHub Actions), bei jedem Push:**

1. Legacy-Tests (`node test/run.mjs`) und Vitest für `core`, `app`, `server`.
2. Leak-Test-Matrix (Rolle × Endpunkt × Sichtbarkeit), siehe
   [security.md](security.md).
3. Build beider App-Varianten; `size-limit` prüft das Budget.
4. Playwright-Screenshots der Kernbildschirme bei 360 px.
5. Image `ghcr.io/hmvbfv/mordheim-roster:<sha>` für `linux/arm64` und
   `linux/amd64` (der Desktop kann im Notfall als Server einspringen).

**Auf `master`:** zusätzlich Quick Build nach Pages (nach der Umstellung;
bis dahin die alte App wie heute) und Tag `:<version>`.

**Auf dem Pi:** bewusst per `roster-deploy <tag>` (Backup → Image holen →
starten → Health → bei Fehler Rollback). Watchtower fasst die App nicht an.
Details: [operations.md](operations.md).

## 8. Wo entwickelt und wo betrieben wird

Grundlage: ADR 0015.

**Entwickelt wird in Cloud-Sitzungen von Claude Code** (Code-Tab der
Claude-App oder claude.ai/code), mit diesem Repo als Quelle:

- Die Sitzung klont das Repo, arbeitet auf einem Feature-Branch, lässt die
  Tests laufen (auch Playwright, Chromium ist dort vorhanden) und pusht den
  Branch. Rob prüft den Diff und merged per Pull Request.
- Die Cloud-Sitzung hat keinerlei Zugang zu den Produktionsdaten auf dem Pi.
- Für `/bugs` bekommt die Cloud-Umgebung die Domain des Servers als erlaubte
  Domain und das Bug-Token als Umgebungsvariable. Das Token erlaubt nur
  `GET/PATCH /bugs`.

**Betrieben wird auf dem Pi:**

- Die Pi-Konfiguration liegt als Dateien im Repo unter `ops/`: `compose.yaml`,
  `Caddyfile`, systemd-Units und -Timer, `roster-deploy`, Backup- und
  Test-Skripte, Fail2Ban-Regel, `install.sh`. Echte Hostnamen und IPs stehen
  nicht darin, sondern in `~/server/roster/site.env` auf dem Pi.
- Rob spielt Änderungen per SSH ein: im vorhandenen Klon
  `/mnt/ssd/agent/repos/roster` `git pull`, dann `sudo ops/install.sh`;
  neue App-Versionen mit `roster-deploy <tag>`.
- Kein Agent arbeitet auf dem Pi am Roster-Projekt. Die Agenten-Basis
  (`mordheim-agent`, `chronik N`, Remote Control „Chronik“) bleibt
  unverändert und für die Chronik zuständig.

Produktion (`~/server/roster/`, `/mnt/ssd/roster/`) und Agenten-Umgebung
(`/mnt/ssd/agent/`) bleiben getrennt. Die einzige Brücke ist das Ablegen des
KI-Pakets in `/mnt/ssd/agent/eingang/chronik/`.
