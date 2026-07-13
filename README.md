# Mordheim Roster Builder

Warband-Builder für Mordheim mit Kampagnen-Layer, TTS-Export und Befüllung des
offiziellen freebooters.org-Rostersheets.

## Struktur

```
index.html          Markup + CSS (keine Logik)
js/app.js           Kern: Zustand, Engine, Rendering
js/pdf.js           PDF-Export (offizielles Rostersheet)
js/tts.js           Tabletop-Simulator-Export
data/*.json         Spieldaten als JSON — sprachunabhängig, auch von
                    anderen Werkzeugen lesbar (z. B. einem TTS-Lua-Skript)
data/index.js       Loader: holt die JSON, wandelt Regex-Felder zurück
data/_util.js       kleine Helfer (Profil-Konstruktor)
vendor/             pdf-lib
assets/sheet.pdf    offizielles Rostersheet (Vorlage für den PDF-Export)
build.js            baut daraus EINE eigenständige HTML
dist/               Ergebnis des Builds
```

**Quelle der Wahrheit sind die Dateien in `data/` und `js/`.** `dist/` wird
generiert — dort niemals von Hand editieren.

`js/pdf.js` und `js/tts.js` importieren Helfer aus `js/app.js` (zyklischer Import;
funktioniert, weil Funktions-Deklarationen gehoistet werden). Neue Logik-Module in
`build.js` unter `JS_FILES` eintragen.

## Entwickeln

Ein Server ist nötig (ES-Module laufen nicht über `file://`):

```bash
python3 -m http.server 8000      # dann http://localhost:8000
```

## Single-File bauen

```bash
node build.js                    # -> dist/mordheim-roster.html
```

Die gebaute Datei läuft **ohne Server** per Doppelklick und lässt sich als eine
Datei weitergeben. Der GitHub-Workflow baut sie bei jedem Push automatisch.

## Datenquellen

Reihenfolge der Autorität: **mordheimer.net → Ultimate FAQ → FAQ (Toumas) → Regelbuch.**
Nichts wird eingetragen, was sich dort nicht belegen lässt.


## Daten bearbeiten

Die Spieldaten sind **JSON** (`data/*.json`) — reine Tabellen, ohne Code.

Zwei Konventionen, die JSON selbst nicht abbilden kann:

* **Regex** wird als `{"__re": "muster", "__f": "flags"}` gespeichert und beim
  Laden zu einem `RegExp` gemacht (siehe `data/index.js`).
* **Profile** stehen ausgeschrieben: `{"M":4,"WS":3,"BS":3, …}`.

## Tests

```bash
node test/smoke.mjs      # lädt die modulare Version wie im Browser
node build.js            # baut die Single-File
```

Der Smoke-Test fängt Fehler, die im Single-File-Build **nicht** auffallen —
etwa doppelte Funktionsdeklarationen oder Importe auf nicht exportierte Namen.
(Im klassischen `<script>` gewinnt die letzte Deklaration; ein ES-Modul lehnt
sie ab.)
