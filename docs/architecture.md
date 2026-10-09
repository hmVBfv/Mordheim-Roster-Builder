# Architektur

Stand: 27. September 2026 · Grundlage: [concept.md](concept.md), ADRs 0001, 0005, 0006, 0009

## 1. Überblick

```
 Handy / Desktop (PWA)                     Pi 5
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
Rüstungswurf) sind portiert und per Paritätstest abgesichert, ebenso aus
`warband/` der Rosterbau (Einheiten, Ausrüstung, Rare Items, Mutationen,
Gold und Truhe, Subtyp, Bezirke, Hired Swords und Dramatis Personae,
Hausregeln), Aufstiege und Beförderungen sowie Verletzungen, Gefallene,
Verlusteinträge und gehaltene Erfahrung, in `rules/validation.ts`,
`abilities.ts` und `summary.ts` die Regeln hinter den Bildschirmen
(Warnungen, Anwerbe-Grenzen, Fähigkeiten, Übersichten), in `changes/` der Vergleich zweier
Stände und der Abgleich, in `narrative/` das Briefing, dazu in `campaign/` die Kampagne
einer Warband (Chronik, Stufen und Snapshots, Schlachten, Footholds,
Post-Battle-Sequenz, Auswertung), die Kampagnendatei, die Kontrolle über
Bezirke und die Formulare für Schlachten und Verluste. Die übrigen Module
folgen in der Reihenfolge aus [roadmap.md](roadmap.md).

`format/` lädt und schreibt Speicherstände: `loadSave` füllt fehlende
Schlüssel so auf wie die alte App und bringt den Stand in die kanonische
Form, `readSaveText` liest eingefügten Text, `writeSave` schreibt Stand,
`goldNow`, Formatnummer und App-Version. Die Zod-Schemas sind bewusst
tolerant (unbekannte Schlüssel bleiben, als Text gespeicherte Zahlen gelten);
beim Laden werden Abweichungen als Hinweise gemeldet statt abgelehnt.
Abgelehnt wird nur, was keine Warband eines bekannten Typs sein kann.

In `export/` liegen der lesbare Text, die Tabletop-Simulator-Karten, der
Chronik-Text und das PDF-Rostersheet. `buildOfficialSheet(ctx, pdfLib,
template)` bekommt pdf-lib und die Vorlage hineingereicht und gibt Bytes und
Dateinamen zurück; herunterladen oder teilen ist Sache der Oberfläche.

Die Kampagnendatei und halb ausgefüllte Formulare sind in `core/` Werte wie
eine Warband: Funktionen nehmen sie und geben neue zurück. Betrifft eine
Aktion Warband und Kampagnendatei zugleich (eine Schlacht verschiebt
Footholds bei allen Beteiligten), gibt sie beide zurück (`{ s, cf }`).

Wo die alte App im Ablauf nachfragte (Robbed anwenden? Grubenkampf gewonnen?
Gefangener kommt zurück, Lösegeld? D3 für Deep Wound?), ist die Antwort ein
Argument der Aktion; die Oberfläche fragt, bevor sie aufruft. Ebenso das
Datum eines Snapshots: `advanceRound(ctx, today)` – `core/` liest keine Uhr.

**Aktionen** (`warband/`) nehmen einen Zustand und geben einen neuen zurück
(Immer); der Eingang bleibt unverändert, eine abgelehnte Aktion gibt genau
denselben Zustand zurück. Innerhalb einer Aktion darf der Code den Entwurf so
schreiben wie die alte App ihr globales `S` – das hält die Portierung 1:1.
`normalizeState` bringt einen geladenen Stand in die kanonische Form, die die
alte App nebenbei beim Zeichnen herstellte (Kampagnenlisten, Hausregel-
Vorgaben, gültige Persona) und merkt sich die Zähler `uidSeq`/`logSeq`.

**Wie portiert wird:** Die alte App wird *nicht* auf `core/` umgebaut; sie
bleibt unverändert live, bis der neue Builder sie ersetzt. `core/` wird gegen
sie per Differenztest geprüft (`core/test/parity/`): Für erzeugte Warbands
aller 49 Typen, aller Subtypen und dreier Hausregel-Varianten rechnen alte App
und `core/` jeden Wert aus, und beide Ergebnisse müssen identisch sein.
Aktionen prüfen zufällige Aktionsfolgen (Paritäts-Wanderung). Dazu laufen die
Legacy-Tests aus `test/` unverändert gegen die alte App, und jeder Aufruf, den
sie dabei machen, wird in `core/` wiederholt – vom selben Stand aus, mit
denselben Antworten auf Rückfragen (der Spiegel, `core/test/mirror/`). Was ein
Legacy-Test über einen Aufruf behauptet, gilt damit auch für `core/`. Zuletzt
kommen echte Speicherstände der laufenden Kampagne dazu (`core/test/saves/`,
vorher mit `npm run sanitize-save` bereinigt): Beide laden sie gleich, und von
jedem aus läuft die Wanderung weiter.

Regeln für `core/`:

- Keine DOM-Zugriffe, keine globalen Variablen, kein verstecktes `Date.now()`
  oder `Math.random()` – Uhr und Zufall werden hineingereicht.
- Operationen sind reine Funktionen: Zustand rein, neuer Zustand raus
  (unveränderlich; ob mit Immer, wird in Phase 1 entschieden).
- Alles, was eingefroren wird (Kennzahlen beim Markieren), berechnet `core/`
  genau einmal; gespeichert wird das Ergebnis, nie neu berechnet.
- Jede Funktion hat Tests (Vitest). Die bestehenden Legacy-Testdateien laufen
  über den Spiegel gegen `core/`; Paritätstests vergleichen alte und neue
  Logik über alle Warbands. Bevor die alte App wegfällt (Phase 3), werden die
  Szenarien der Legacy-Tests als eigene `core/`-Tests übernommen, denn Spiegel
  und Parität fallen mit ihr weg.

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
| QR-Code | `uqr` (MIT, ohne Abhängigkeiten) für das Einrichten des Authenticators; erst dort geladen |
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

**Umgesetzt (Phase 1e):** Router im deklarativen Modus; `campaign` nutzt
Browser-Pfade (der Pi beantwortet jeden Pfad mit der App), `quickbuild` einen
Hash-Router (Pages kann das nicht). Die Regeldaten (`data/*.json`, etwa
140 KB komprimiert) sind ein eigener Teil, der erst mit dem ersten Roster
geladen und vom Service Worker für offline behalten wird; die App-Hülle
kommt ohne `core/` aus. Die CSP steht im gebauten `index.html` als
`<meta>` (ohne Inline-Skripte; das Theme setzt `public/theme-boot.js` vor dem
ersten Zeichnen). Update-Banner mit `registerType: 'prompt'`.

**Konten (Phase 3g, nur `campaign`):** `app/src/account/` – `api.ts`
spricht mit `/api/v1` (gleicher Ursprung, Cookie, Schreiben nur als JSON),
`session.ts` fragt beim Start einmal, wer angemeldet ist, und wieder, wenn das
Gerät online kommt; der Builder wartet nie darauf. Auf dem Gerät bleibt nur
der zuletzt bekannte Nutzer (Name und Flags, kein Token – das Cookie ist
`HttpOnly`). Bildschirme: `/sign-in`, `/invite#…` und `/reset#…` (das Token
verlässt sofort die Adresszeile), das Konto in More, `/admin/:tab`
(Nutzer, Einladungen, Anmelde-Log, Audit-Log). Im Dev-Server leitet Vite
`/api` an `127.0.0.1:3000` weiter.

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
| Laufzeit | Node 24 LTS (Image `node:24-trixie-slim`); die Tests laufen auch unter Node 22 |
| HTTP | Fastify (`trustProxy`: Loopback und das Gateway des Docker-Netzes, siehe unten) |
| Datenbank | SQLite über `better-sqlite3`, WAL-Modus, `synchronous = NORMAL` |
| Migrationen | nummerierte SQL-Dateien in `server/migrations/`, nur vorwärts, Tabelle `schema_migrations` |
| Validierung | dieselben Zod-Schemas aus `core/format` für Warbands und Notizen (ab 3h); die Körper der Konten mit JSON Schema in Fastify |
| Logs | JSON auf stdout (pino); eine Zeile je Anfrage; Login-Fehler als eigene Zeilen für Fail2Ban |
| Auslieferung | statische Dateien des `campaign`-Builds, API unter `/api/v1` |
| CLI | `roster-cli`: Backup, Schemastand, Epoche, Einladung (auch für den ersten Admin), Reset-Link, Faktor zurücksetzen, abmelden, Nutzerliste; später Bugs, KI-Paket |
| Build | `server/build.mjs` bündelt mit rolldown nach `server/dist/` (Server, CLI, Healthcheck); Pakete bleiben extern |

- **Kein Rendern auf dem Server**, kein Next.js.
- Ziel-Speicherbedarf 50–80 MB, Grenze 256 MB (Container-Limit); der
  Rauchtest der CI misst den Container.
- **Start** (`server/src/start.ts`): Markerdatei auf der SSD prüfen
  (`/data/.roster-volume`), sonst Abbruch, ohne etwas anzulegen; Datenbank
  öffnen, vollständige Integritätsprüfung; stehen Migrationen an und hat die
  Datenbank schon ein Schema, zuerst ein Snapshot, dann die Migrationen; dann
  die Epoche (neu bei einer neuen Datenbank und bei einem Start auf einem
  zurückgespielten Snapshot). Ist die Datenbank beschädigt, nicht lesbar
  oder neuer als der Code, lauscht der Server trotzdem und beantwortet
  Health mit 503 – die Daten-Endpunkte (ab 3g die Konten) antworten dann
  ebenfalls 503.
- **Wer fragt:** Derselbe Hook liest vor `can()` das Cookie `mh_session`
  und findet die Sitzung (`req.actor`: niemand, „Code steht aus“ oder ein
  Nutzer); eine schreibende Anfrage ohne den `Origin` der App weist er mit
  403 ab. Nur JSON wird gelesen.
- `GET /api/v1/health` meldet `status`, `version` (der Commit), `startedAt`,
  `epoch`, `db` (`integrity`: `ok` · `failed` · `unreadable`, geprüft beim
  Start und danach höchstens alle 15 Minuten) und `migrations`
  (`current`, `expected`); 200 nur bei `ok`, sonst 503. `roster-deploy`, der
  Healthcheck des Containers und `roster-alive` fragen es ab.
- **Rechte:** Jede Route nennt ihre Aktion; ein Hook fragt `can()`
  (`server/src/policy.ts`), bevor der Handler läuft. Eine Route ohne Aktion
  lässt sich nicht registrieren, und der Test der Leak-Matrix
  (`server/test/leak-matrix.ts`) schlägt für jede Aktion ohne Zeile fehl.
- **Client-Adresse:** Caddy spricht `127.0.0.1:3000` an, Docker reicht das
  in den Container weiter – dort kommt die Verbindung vom Gateway des
  Docker-Netzes. Deshalb glaubt der Server `X-Forwarded-For` von Loopback und
  von diesem Gateway (aus `/proc/net/route`), sonst niemandem; `TRUST_PROXY`
  überschreibt das. Der Rauchtest prüft es mit dem echten Image.
- **Statische Dateien:** nur die Dateien, die beim Start im Build liegen
  (feste Liste, kein Pfad aus der Anfrage erreicht etwas anderes); Assets mit
  Hash ein Jahr im Cache, alles andere wird neu geprüft; unbekannte Seiten
  der App bekommen `index.html` (die App routet über Pfade).
- **Installation ohne Skripte:** `.npmrc` setzt `ignore-scripts=true`.
  `better-sqlite3` bringt fertige Binärdateien für jede Plattform mit; npm
  hätte sonst beim `npm ci` versucht, es mit node-gyp neu zu übersetzen.

### Endpunkte (Grobschnitt)

| Bereich | Pfade |
| --- | --- |
| Anmeldung | `GET /auth/me`, `POST /auth/login`, `POST /auth/totp`, `POST /auth/logout`, `GET /auth/sessions`, `DELETE /auth/sessions/:id` (`others`: alle anderen) – Phase 3g |
| Einladungen | `POST /invites/check`, `POST /invites/accept` (Token im Körper; Register und Reset) – Phase 3g |
| Eigenes Konto | `POST /account/password`, `POST /account/totp/setup`, `…/enable`, `…/disable` – Phase 3g |
| Admin | `GET /admin/users`, `POST /admin/users/:id/:op` (`reset` · `totp-reset` · `disable` · `enable` · `sign-out`), `GET/POST /admin/invites`, `DELETE /admin/invites/:id`, `GET /admin/logins`, `GET /admin/audit` (`?limit=&before=`) – Phase 3g |
| Warbands | `GET/POST /warbands` (`?archived=1`), `GET/DELETE /warbands/:id`, `POST /warbands/:id/unarchive`, `GET /warbands/:id/versions`, `GET /warbands/:id/versions/:rev`, `POST /warbands/:id/versions` (mit `baseRev`, sonst 409 `stale`), `PUT/DELETE /warbands/:id/autosave` (mit `afterSeq`, sonst 409 `draft_conflict`) – Phase 3h |
| Kampagnen | `GET/POST /campaigns` (anlegen nur mit Authenticator), `GET/PATCH /campaigns/:id` (Name), `PUT/DELETE /campaigns/:id/members/:userId` (`role`), `POST /campaigns/:id/enrolments` (Kopie mit der Geräte-ID), `POST …/enrolments/:eid/confirm`, `…/decline`, `DELETE …/enrolments/:eid`, `GET /campaigns/:id/warbands/:wid` (eingetragene Warband für alle Mitglieder) – Phase 4a1; `PUT /campaigns/:id/house-rules` (`rules`; Leiter) – Phase 4a4 |
| Schlachten | `GET/POST /campaigns/:id/battles`, `GET/PATCH /campaigns/:id/battles/:bid` (`?since=seq`; Titel, Szenario, Bezirk, Zug, Teilnehmer, Ergebnisse), `PUT/DELETE …/battles/:bid/protocol/:eid` (Geräte-ID), `PUT …/battles/:bid/proposals/:pid`, `POST …/proposals/:pid/accept`, `…/reject` – Phase 4a2; `POST …/battles/:bid/close` (Leiter), `POST …/battles/:bid/marks` (`warbandId`, `rev`; der Spieler), `POST /campaigns/:id/rounds/advance` (Leiter) – Phase 4a4 |
| Erzählung | `GET /campaigns/:id/notes` (`?since=seq`; was der Fragende sehen darf), `PUT/DELETE /campaigns/:id/notes/:nid` (Geräte-ID) – Phase 4a3; `…/timeline/positions`, `…/attachments`, `…/questions` folgen |
| Leiter | `…/background`, `…/style`, `…/briefing/:battleId`, `…/ai-pack/:battleId` |
| Welt | `…/factions`, `…/npcs`, `…/reputation`, `…/districts`, `…/scenarios` |
| Teilen | `GET /people` (Anzeigename und Nutzername der anderen), `GET/POST /shares`, `POST /shares/peek`, `POST /shares/redeem` (Code), `POST /shares/:id/accept`, `POST /shares/:id/decline`, `DELETE /shares/:id` – Rob, 05.10.2026 |
| Sync | `GET /sync?cursor=` – Phase 3h: die eigenen Warbands mit neuester Version und Entwurf, Entferntes ohne Version, dazu `epoch` und der nächste `cursor` |
| Bugs | `POST /bugs`, `GET /bugs` (Admin, Bug-Token), `PATCH /bugs/:id` |
| Betrieb | `GET /health` (Phase 2, öffentlich) |

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
| Warband-Entwurf | ein Platz je Nutzer und Warband; ein anderes Gerät ersetzt ihn nur, wenn es ihn gesehen hat (`afterSeq`), sonst 409 und die Spielerin entscheidet |

**Umgesetzt für Warbands (Phase 3h, `app/src/sync/`):**

- **Was wartet, steht am Datensatz** statt in einer eigenen Warteschlange:
  `serverRev` (noch nie gesendet, wenn leer), `syncedAt` gegen `updatedAt`
  (neuere Änderungen warten), `removedAt` (entfernt, wartet auf das Ende von
  Undo), `restore` (nach einer Wiederherstellung des Servers). So geht beim
  Schließen des Tabs oder offline nichts verloren, und der Abgleich ist
  derselbe, egal wie lange das Gerät weg war.
- **Eine Runde:** erst holen (`GET /sync?cursor=`), dann senden – neue
  Warbands per `POST /warbands` (die UUID des Geräts, doppelt gesendet wird
  sie einmal angelegt), Änderungen als Entwurf (`PUT …/autosave`),
  Entferntes nach Undo per `DELETE`. Eine Version entsteht nur bewusst (der
  Versionen-Bildschirm), nie durch den Abgleich.
- **Beide Seiten geändert:** nichts wird überschrieben. Der Datensatz bekommt
  einen Konflikt (`draft`: ein anderes Gerät hat entworfen; `behind`: eine
  neuere Version kam dazwischen; `removed`: anderswo entfernt) und wird nicht
  mehr gesendet, bis die Spielerin im Roster „Keep this one“ oder „Take the
  other one“ wählt. Die Kopfzeile zeigt „Check“.
- **Neue Epoche:** alles neu ab Cursor 0; was der Server nicht kennt, legt das
  Gerät neu an, und wo der Server auf eine ältere Version zurückgefallen ist,
  schickt es seinen Stand als neue Version (`source: 'restore'`).
- **Wessen Warband:** neu angelegte und importierte gehören dem angemeldeten
  Nutzer; was ohne Anmeldung entstand, bleibt auf dem Gerät, bis die
  Spielerin es mit „Keep … in my account“ ins Konto nimmt. Listen zeigen
  keine Warbands eines anderen Kontos (ein geteiltes Gerät).
- **Kopfzeile:** „Saved and synced“, „n waiting“ (auch offline, auf dem
  Gerät gezählt), „Check“ bei einem Konflikt, „Not synced“ bei einem Fehler;
  ohne Anmeldung wie bisher „Saved on this device“.
- **Versionen** (`/warbands/:id/versions`) entstehen nur bewusst: „Save a
  version“ mit Notiz; eine ältere wird als neue Version wieder die neueste
  (`source: 'restore'`), nichts in der Geschichte ändert sich. Wurde
  inzwischen anderswo gespeichert (409 `stale`): die neuere nehmen oder den
  eigenen Stand als Kopie behalten.
- **Kopie** („Make a copy“, auch offline und im Quick Build): eine neue
  Warband mit eigener UUID; im Konto merkt sie sich Warband und Version, aus
  der sie kam (`copied_from`), sofern diese dem Konto gehört und auf dem
  Server liegt.
- **„Send to campaign server“** (Quick Build, concept.md 4.11): die Adresse
  steht unter More; Export öffnet `https://<server>/import#v1.<Warband>`
  (JSON, `deflate-raw`, base64url, `app/src/share/link.ts`). Die
  Kampagnen-App nimmt das Fragment sofort aus der Adresszeile, zeigt die
  Warband und legt sie als neue an oder als nächste Version einer eigenen
  (`source: 'import'`).
| Notizen | gehören ihrem Autor; letzte Fassung gewinnt, frühere bleiben als Revision |
| Schlachtprotokoll | nur der Leiter schreibt; Spieler schicken Korrekturvorschläge |
| Zeitleisten-Position | letzte Verschiebung gewinnt, jede wird geloggt |
| Hintergrund | nur Leiter; letzte Fassung gewinnt, Revisionen bleiben |

## 7. Auslieferung

**CI (GitHub Actions), bei jedem Push:**

1. Legacy-Tests (`node test/run.mjs`) und Vitest für `core`, `app`, `server`.
2. Leak-Test-Matrix (Rolle × Endpunkt × Sichtbarkeit), siehe
   [security.md](security.md).
3. Build beider App-Varianten; `app/scripts/size.mjs` prüft das Budget (was `index.html` beim Start lädt).
4. Playwright-Screenshots der Kernbildschirme bei 360 px.
5. Image bauen und prüfen: Rauchtest (SSD-Übung, Health, `roster-cli`,
   Client-Adresse, Epoche, Speicher) und Ende-zu-Ende-Test der
   Betriebsdateien auf dem Runner (`ops/test/e2e.sh`: `install.sh`, Deploy mit
   beiden Arten von Rollback, Backup und Wiederherstellungstest mit restic,
   `roster-restore`, Fail2Ban).
6. Sind alle Jobs grün: Image `ghcr.io/hmvbfv/mordheim-roster:<commit>` (die
   ersten sieben Zeichen) für `linux/arm64` und `linux/amd64` (der Desktop
   kann im Notfall als Server einspringen). Gebaut wird alles auf der
   Plattform des Runners; für arm64 wird nur kopiert, nichts übersetzt.

**Auf `master`:** zusätzlich Quick Build nach Pages (nach der Umstellung;
bis dahin die alte App wie heute) und die Tags `:master` und `:drill-broken`
(für die Rollback-Übung). Monatlich baut die CI `master` neu
(`:master-<datum>`), für die Sicherheitsupdates des Basis-Images.

**Auf dem Pi:** bewusst per `roster-deploy <commit>` (Image holen → Backup →
starten → Health → bei Fehler Rollback, wenn nötig mit Rücksicherung). Watchtower fasst die App nicht an.
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
- Rob spielt Änderungen per SSH ein: im eigenen Klon
  `~/src/Mordheim-Roster-Builder` `git pull --ff-only`, dann
  `sudo ops/install.sh`; neue App-Versionen mit `roster-deploy <tag>`. Der
  Klon liegt bewusst nicht unter `/mnt/ssd/agent/`: `install.sh` läuft als
  root, und dort können die Agenten-Container schreiben.
- Kein Agent arbeitet auf dem Pi am Roster-Projekt. Die Agenten-Basis
  (`mordheim-agent`, `chronik N`, Remote Control „Chronik“) bleibt
  unverändert und für die Chronik zuständig.

Produktion (`~/server/roster/`, `/mnt/ssd/roster/`) und Agenten-Umgebung
(`/mnt/ssd/agent/`) bleiben getrennt. Die einzige Brücke ist das Ablegen des
KI-Pakets in `/mnt/ssd/agent/eingang/chronik/`.
