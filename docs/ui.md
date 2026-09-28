# Oberfläche

Stand: 27. September 2026 · Status: Grundsätze und Struktur abgestimmt;
Detaildesign entsteht je Phase als klickbares Mockup, das vor dem Code auf dem
Handy geprüft wird.

Die Oberfläche wird neu gebaut. Die bestehende App bleibt bis zur Umstellung
unverändert auf Pages.

## 1. Grundsätze

1. **Handy zuerst.** Referenzbreite 360 px; der Desktop ist eine Erweiterung
   (mehrspaltig), kein eigenes Design.
2. **App-Gefühl ohne Store.** Installierbar (PWA), Vollbild ohne
   Browserleiste, startet offline, eigenes Icon.
3. **Sichtbarkeit ist immer erkennbar.**
   - Jedes Eingabefeld, das nicht öffentlich sein könnte, zeigt eine Auswahl
     „Sichtbar für: alle / versiegelt bis Schlacht N / nur Leiter“ mit
     sichtbarem Standardwert.
   - Verborgenes und Versiegeltes ist optisch klar abgesetzt (eigene Fläche,
     Symbol, Beschriftung) – nicht nur durch Farbe.
   - Leiter haben den Schalter **„Als Spieler ansehen“**.
4. **Synchronisationsstand ist immer sichtbar:** ✓ gespeichert · ⏳ n
   ausstehend · ⚠ Konflikt · Offline-Hinweis.
5. **Aufgaben statt Suchen.** Der Start zeigt „Offen für dich“.
6. **Rückgängig statt Nachfragen,** wo Versionen das erlauben. Bestätigung nur
   bei Unumkehrbarem (z. B. Schlacht abschließen). Der Hinweis mit „Undo“
   steht nicht im Weg (Rob, 28.09.2026): Er verschwindet nach 5 Sekunden, lässt
   sich sofort wegtippen (✕), und nur seine Knöpfe fangen Tipps ab – was unter
   dem Text liegt, bleibt bedienbar.
7. **Englische Oberfläche.** Spielbegriffe wie in den Regeln (Warband, Out of
   Action, Hired Sword). Zweisprachig sind nur Kanon-Felder (Namen, Titel)
   und die Texte, die Spieler selbst schreiben.
8. **Nie neu laden ohne Zustimmung.** Updates kommen als Banner
   („New version – reload“), nie automatisch, erst recht nicht am Spielabend.
9. **Zurück schließt, was zuletzt aufging.** Die Zurück-Taste (Handy-Taste,
   Geste, Browser) schließt einen offenen Bereich, statt den Bildschirm oder
   die App zu verlassen; wer einen Bereich anders schließt, hinterlässt keinen
   Schritt im Verlauf (`app/src/ui/useSheet.ts`).

## 2. Navigation

```
Home         Open for you · Warbands · Campaigns
Warband      Roster · Story · Versions
Campaign     Overview · Notes · Timeline · World
             · Background* · Manage*
Game night   Vollbild, aus einer Schlacht heraus
Profile      Devices · Authenticator · Password
Admin*       Users · Invites · Bugs · Backups
Report a problem   überall erreichbar
                                  (* nur Leiter bzw. Admin)
```

- **Handy:** Navigationsleiste unten (Home, Warbands, Campaign, Notes, More);
  Formulare und Auswahl als Bereich, der von unten aufklappt (native
  `<dialog>`), statt Pop-up-Fenstern.
- **Desktop:** Seitenleiste links, Inhalt mit Liste und Detail
  nebeneinander (z. B. Roster links, gewählter Krieger rechts). Karten
  stehen nebeneinander, so viele die Breite fasst (Roster: ab 1440 px drei
  Spalten); der Inhalt ist bis 1320 px breit.
- **Quick Build (Pages):** nur Home (lokale Warbands), Warband (Roster),
  Import/Export und „Send to campaign server“.

## 3. Bildschirme, die zuerst als Mockup entstehen

| Bildschirm | Warum zuerst |
| --- | --- |
| Game night | einhändig, unter Zeitdruck, offline; bestimmt die Outbox |
| Timeline mit Verschieben | Ziehen am Handy ist heikel; bestimmt Segmente und Sortierschlüssel |
| Änderungsansicht (vorher / nachher je Krieger, Abgleich, Erklärungsfeld) | Kern der Nachbereitung |
| Auswahl der Sichtbarkeit | Schutz vor versehentlichem Verraten |
| Background | viel Struktur (Stränge, Enthüllungsstufen) auf wenig Platz |
| Roster (neu) | meistgenutzter Bildschirm, heute nicht handytauglich |

Mockups liegen als statische Seiten unter `docs/mockups/` und werden auf dem
Handy geprüft, bevor die Umsetzung beginnt. Sie nutzen dieselben
Design-Variablen wie die App; ein Streifen oben schaltet zwischen beiden
Themes um und gehört nicht zur App. Die Kampagne darin ist erfunden.

| Seite | Was sie zeigt |
| --- | --- |
| `game-night.html` | Vollbild ohne Navigation, Spielzug-Zähler, vier große Knöpfe im unteren Drittel, „letzten Eintrag rückgängig“, Offline-Hinweis mit Zahl der wartenden Einträge |
| `timeline.html` | feste Anker je Schlacht, Verschieben per langem Drücken, ↑/↓ und „Move to…“, Erfassungszeit bleibt sichtbar, Leiter-Ebene schaltbar |
| `changes.html` | je Krieger vorher → nachher mit gefundenem Anlass, ⚠ ohne Anlass, Erklärungsfelder mit Zähler, Markieren „After battle N“ |
| `visibility.html` | Auswahl öffentlich / versiegelt / nur Leiter mit Symbol, Wort und eigener Fläche; „View as player“ |
| `background.html` | Handlungsstränge mit Wahrheit, Wissen der Spieler, Enthüllungsstufe (●○○) samt Grenze in Worten; Enthüllen als bewusster Schritt |
| `roster.html` | Karte je Krieger mit Werten, Erfahrungsstufen, Ausrüstung und den häufigen Aktionen; Verletzung mit Folgeentscheidung (V1) |

## 4. Themes und Gestaltung

**Entschieden (27.09.2026):** ein gemeinsamer Satz Design-Variablen mit zwei
Themes, beide wählbar. **Standard ist „Chronicle“ (dunkel).**

| | Hell: „Parchment“ | Dunkel: „Chronicle“ |
| --- | --- | --- |
| Herkunft | heutiger Builder | Chronik-Seite |
| Grundfarben | Pergament, Blutrot, Gold, Eisen | Knochenweiß auf Anthrazit, Wyrdstone-Grün |
| Schriften | Pirata One (Titel), EB Garamond | Cinzel (Titel), EB Garamond |
| Gut für | Druck, Tageslicht | Spielabend, Handy, dunkle Räume |

- Standard ist „Chronicle“; im Profil wählbar: Chronicle, Parchment oder
  „wie System“.
- Druck und PDF-Export verwenden immer „Parchment“.
- Schriften werden selbst ausgeliefert (strenge CSP, offline).
- Zierschriften nur für Titel; Fließtext und Werte in einer gut lesbaren
  Schrift, Zahlen tabellarisch ausgerichtet.
- Kontrast mindestens WCAG AA in beiden Themes.

## 5. Bedienung

- **Tippflächen** mindestens 44 × 44 px.
- **Statuswerte** (M WS BS S T W I A Ld Sv) als feste Tabelle mit
  gleichbreiten Ziffern; auf 360 px ohne horizontales Scrollen.
- **Game night:** große Knöpfe im unteren Drittel (+ Casualty, + Note,
  + Quote, + Screenshot), Spielzug-Zähler oben, letzter Eintrag rückgängig.
- **Timeline:** langes Drücken zum Ziehen; zusätzlich ↑/↓ und „Move to …“
  (Auswahl des Segments). Verborgene Bausteine für Leiter gestreift
  hinterlegt und beschriftet.
- **Änderungsansicht:** je Krieger eine Karte mit vorher → nachher;
  Änderungen ohne Anlass mit ⚠; Erklärungsfeld direkt darunter.
- **Erwähnen:** `@` öffnet die Liste der Krieger und Warbands der Kampagne.

## Leistungsgrenzen

Von der CI geprüft; ein Überschreiten lässt den Build fehlschlagen.

| Grenze | Wert | Prüfung |
| --- | --- | --- |
| JavaScript beim ersten Laden | ≤ 200 KB (komprimiert) | `size-limit` |
| Reaktion auf eine Eingabe | < 100 ms auf einem Mittelklasse-Handy | Playwright mit CPU-Drosselung für Kernabläufe |
| Erster Start online (4G) | < 3 s bis bedienbar | Playwright mit Netzwerkprofil |
| Start aus Cache | < 1 s | Playwright |
| Bild-Upload | ≤ 1600 px lange Kante, ≤ 500 KB nach Neukodierung | Unit-Test des Verkleinerers |

## 6. Checkliste für jede UI-Änderung

Diese Liste steht auch in `CLAUDE.md`.

- [ ] Bei 360 px Breite ohne horizontales Scrollen bedienbar
- [ ] Tippflächen ≥ 44 px
- [ ] Sichtbarkeit angegeben, wo Inhalte nicht öffentlich sein könnten
- [ ] Synchronisationsstand sichtbar, Offline-Fall bedacht
- [ ] Beide Themes geprüft
- [ ] Kein `dangerouslySetInnerHTML`, keine Inline-Handler im HTML
- [ ] Zurück schließt offene Bereiche, ohne die App zu verlassen
- [ ] Hinweise versperren nichts (kurz, wegtippbar, Tipps gehen durch)
- [ ] Am Desktop wird die Breite genutzt
- [ ] Playwright-Screenshot des Bildschirms aktualisiert und angesehen
