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
Warband      Roster · Story · Versions · Share…
Campaign     Overview · Notes · Timeline · Chronicle · World
             · Background* · Manage*   (4a1: Overview und Manage;
             mehrere Kampagnen: erst die Liste, eine: gleich sie)
Game night   Vollbild, aus einer Schlacht heraus (4a2: /campaign/:id/battles/:bid,
             auf dem Handy ohne die Leiste unten)
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
- **Vorschlag (Mockup `desktop.html`, 29.09.2026, noch nicht entschieden):**
  Auf Robs Wunsch nach „mehreren ggf. verschiebbaren Fenstern … ohne
  clutter“ wird der Desktop eine Arbeitsfläche aus Panels. Ein Panel ist ein
  Bildschirm des Handys (Roster, Krieger, Trading Post, Gold, Lager, Schritte
  nach der Schlacht, Timeline, Kampagne). Die Panels stehen in Spalten (so
  viele die Breite fasst, höchstens drei, je Panel mindestens 340 px), dazu
  eine Reihe über die ganze Breite; nichts überlappt, nichts schwebt – so
  bleibt es ruhig. Verschoben wird an der Titelleiste per Ziehen oder ohne
  Maus über das Menü ⋯ des Panels (Spalte links/rechts, hoch, runter, über
  die ganze Breite, Arbeitsfläche füllen, ins Dock, schließen). Die Panels
  hängen zusammen: Wer im Roster gewählt ist, zeigt das Krieger-Panel, und
  für ihn sucht der Trading Post. „Views“ sind gespeicherte Anordnungen für
  eine Aufgabe (Roster, After battle, Trading, Campaign, eigene); sie liegen
  nur auf dem Gerät. Unter 1024 px stapeln sich die Panels, und die Leiste
  unten kehrt zurück – am Handy bleibt es bei einem Bildschirm zur Zeit.
  Sheets erscheinen am Desktop in der Mitte statt am unteren Rand.
  Jedes Ziel der Leiste ist am Desktop eine eigene Arbeitsfläche mit ihren
  Panels und Views (30.09.2026): Home (Stadt, Offen für dich, Warbands,
  Kampagnen, Fragen), Warbands (die eigene, die der Mitspieler nur lesend),
  die Warband (Roster, Krieger, Trading Post, Gold, Lager, Schritte nach der
  Schlacht, Story, Was sich geändert hat), Campaign (Jetzt, Warbands,
  Schlachten, Bezirke, Timeline, Notizen, Leitung ⚑), Notes (schreiben mit
  Sichtbarkeit, Notizen, Timeline), More (Konto, Geräte, Problem melden).
  Jede Fläche behält ihre Anordnung, wenn man zwischen ihnen wechselt; die
  Reiter des Handys werden zu Panels und Views.
- **Layout von Hand, je Gerät (Rob, 02.10.2026):** Die App wechselt nie von
  selbst zwischen Handy und Desktop – im Mockup sprang die Arbeitsfläche bei
  manchen Klicks auf eine Handy-Seite, ohne Weg zurück. Gewählt wird unter
  More → „Layout on this device“ (Phone / Desktop), gespeichert auf dem
  Gerät; auf einem breiten Bildschirm fragt die App beim ersten Start einmal.
  Was am Desktop noch kein eigenes Panel hat, öffnet sich dort in einem
  großen Panel in der Mitte, nie als Handy-Seite.
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
| Trading Post (V6) | Kaufen, Suchen, Verkaufen und Umverteilen nach dem ersten Kampf; viele Regeln auf einmal |
| Home, Warbands, Campaign, World, Manage, Story, More | die Wege dazwischen: jedes Ziel der Leiste unten und jeder Reiter führt auf eine eigene Seite (Rob, 29.09.2026: Reiter ohne Ziel, aus „Notes“ kein Weg zurück) |
| Desktop-Arbeitsfläche | Rob, 29.09.2026: am Desktop mehrere, verschiebbare Fenster für einen Überblick ohne Unordnung |

Mockups liegen als statische Seiten unter `docs/mockups/` und werden auf dem
Handy geprüft, bevor die Umsetzung beginnt. Sie nutzen dieselben
Design-Variablen wie die App; ein Streifen oben schaltet zwischen beiden
Themes um und gehört nicht zur App. Die Kampagne darin ist erfunden.
Jeder Knopf und jeder Reiter tut etwas (Rob, 29.09.2026: „Wichtig ist, dass
alle Buttons und Reiter ihre Funktion haben“). Playwright
(`app/e2e/mockups.spec.ts`) klickt jede Bedienung jeder Seite einzeln an,
dazu jede in jedem Sheet und in jedem Sheet, das ein Sheet öffnet; ein Link
darf nicht auf „#“ zeigen und muss auf eine Seite führen, die es gibt; jede
Seite hat die Leiste unten oder ←. Ein ← direkt nach dem Schließen eines
Sheets wartet, bis dessen Schritt im Verlauf zurückgenommen ist – vorher
brach dieser Schritt den neuen Seitenaufruf ab („der Pfeil macht manchmal
nichts“). Die Desktop-Seite wird zusätzlich bei 1440 px durchgeklickt, und
ein eigener Test zieht ein Panel an einen anderen Platz, verschiebt es über
⋯, legt es ins Dock und zurück und speichert die Anordnung als View.

Die Leiste unten führt zu Home (`home.html`), Warbands (`warbands.html`),
Campaign (`campaign.html`), Notes (`visibility.html`, der Reiter „Notes“ der
Kampagne) und More (`more.html`). Game night ist ein Vollbild ohne Leiste;
← führt zur Kampagne zurück.

| Seite | Was sie zeigt |
| --- | --- |
| `game-night.html` | Vollbild ohne Navigation, Spielzug-Zähler, vier große Knöpfe im unteren Drittel, „letzten Eintrag rückgängig“, Offline-Hinweis mit Zahl der wartenden Einträge |
| `timeline.html` | feste Anker je Schlacht, Verschieben per langem Drücken, ↑/↓ und „Move to…“, Erfassungszeit bleibt sichtbar, Leiter-Ebene schaltbar; **„AI pack…“** (nur Leiter): ein Prompt aus der Schlacht in Story-Reihenfolge, Aftermath und Aufstiegen, Kanon, Welt, Notizen, Hintergrund ⚑ mit Enthüllungsregeln, bisheriger Geschichte und Stil – Teile abwählbar, Sprache, kopieren oder als .md |
| `changes.html` | je Krieger vorher → nachher mit gefundenem Anlass, ⚠ ohne Anlass, Erklärungsfelder mit Zähler, Markieren „After battle N“ |
| `visibility.html` | Auswahl öffentlich / versiegelt / nur Leiter mit Symbol, Wort und eigener Fläche; „View as player“ |
| `background.html` | Handlungsstränge mit Wahrheit, Wissen der Spieler, Enthüllungsstufe (●○○) samt Grenze in Worten; Enthüllen als bewusster Schritt |
| `roster.html` | Karte je Krieger mit Werten, Erfahrungsstufen (jede Schwelle gerahmt, die nächste markiert, „Advance due“), Ausrüstung und den häufigen Aktionen; Aufstieg und Verletzung mit Folgeentscheidung (V1); Henchmen-Gruppen mit „+ Man“ (Kosten aus Einheit, gleicher Ausrüstung und 2 gc je Erfahrungspunkt, Veteranenwurf, Grenzen: 5 je Gruppe, Einheit, 15 Modelle), Namen der einzelnen Männer, „The lad's got talent“ (Mann wird Held mit zwei Skill-Listen und sofortigem Aufstieg), Tod eines Mannes (W6), Anwerben neuer Gruppen und Helden; beim Aufstieg alle Fertigkeiten der Listen des Kriegers (Captain alle fünf, Champion Combat/Shooting/Strength, Youngblood Combat/Shooting/Speed, Beförderter seine zwei, Ogre Combat/Strength) mit ihrem Regeltext aus `data/skills.json` (`rules-data.js`) |
| `home.html` | „Offen für dich“, eigene Warbands, Kampagnen; Mordheim bei Nacht als Pixelbild (Komet über der Stadt, flackernde Fenster, Wyrdstein, der in den Trümmern aufleuchtet); bei jedem dritten Aufruf schlägt der Zweischweifige Komet ein (Blitz, Feuerball, Rauch, danach glüht der Krater), `?impact=1` bzw. `0` erzwingt es; still und ohne Blitz bei „weniger Bewegung“ (`city-art.js`, auch am Desktop); eine Frage einer Mitspielerin beantworten |
| Wappen der Warbands | `warband-art.js`: je Warband ein eigenes Wappen aus schlichten heraldischen Elementen, passend zu Volk und Fraktion (Rob, 30.09.2026: lieber Wappen als Figuren) – silberner Schild mit blauem Bord und schwarzem Adler (Silver Caravan, Söldner des Imperiums), grauer Schild mit rotem Haupt, Zweischweifigem Kometen und goldenem Kriegshammer (Grey Penitents, Schwestern des Sigmar), schwarzer Lumpen an einer Stange mit Rattenschädel über gekreuzten Klingen (Clan Skrittle, Eshin); keine Symbole aus Games-Workshop-Material; auf Home, Warbands, Campaign, Roster und am Desktop |
| `warbands.html` | eigene Warbands, **„New warband“** (Warband nach Stufe gruppiert, Variante, Name; auch von Home aus, Rob, 02.10.2026: „zu gut versteckt“), Import, die Warbands der Mitspieler nur lesend |
| `hire.html` | (in der App umgesetzt: `/warbands/:id/hire`) Hired Swords und Dramatis Personae mit den echten Regeldaten: Suche, Stufen, „nur wen diese Warband anheuern darf“, Sortierung; Sheet mit Werten, Regeln, Optionen, Kosten und Grund, wenn nicht |
| `house-rules.html` | Hausregeln (3e), drei Fälle über den Mockup-Streifen: eine Warband für sich (Quick Build oder vor der Kampagne) stellt sie selbst ein; in einer Kampagne sieht der Spieler nur, was die Leiter eingeschaltet haben, und ob die eigene Datei der Warband abweicht („Take Hel Fenn’s rules“); als Leiter für alle Warbands der Kampagne (von Manage aus). Jede Regel mit Schalter, „As written: …“, Wert per Stepper nur wenn an; Gruppen wie im Roster Builder; Wirkung auf das Gold einer Gründung; Notizen; „On every export“ zeigt die Erklärung wörtlich; alles zurück mit Undo. Vom Roster aus über den Hinweis „⚖ 1 house rule“ |
| `chronicle.html` | Reiter „Chronicle“ der Kampagne: die ganze geschriebene Geschichte, Kapitel für Kapitel (Prolog zweisprachig); **„Import a chapter“** als Text (eingefügt oder .md/.txt) mit Titel, Schlacht und Sprache, Prüfung auf Begriffe aus verborgenem Hintergrund und erlaubte Andeutungen, landet als Entwurf; „Download all (.md)“ |
| `campaign.html` | Übersicht: laufende Schlacht mit Weg in den Spielabend, Warbands mit Stand, Schlachten 1–5, Bezirke |
| `world.html` | Bezirke (Wirkungen aus `data/campaign.json`, wer sie hält, Korrektur durch Leiter), Fraktionen mit Ruf, Personen, Orte |
| `manage.html` | nur Leiter: Rollen, Einladung, Hausregeln als Schalter, Schlacht schließen (unumkehrbar, daher mit Bestätigung) |
| `story.html` | Reiter „Story“ der Warband: Kapitel, Zwischenspiel schreiben (mit Sichtbarkeit), Lebenslauf jedes Kriegers (auch aus ⋯ → „His story so far“) |
| `more.html` | Geräte, Authenticator, Passwort, Theme, Layout auf diesem Gerät, „Report a problem“ mit Status, Admin (Nutzer, Einladungen, Bugs, Backups) |
| `desktop.html` | die Arbeitsfläche aus Panels (Vorschlag, siehe §2), für jedes Ziel der Leiste eine eigene (`#home`, `#warbands`, `#campaign`, `#notes`, `#more`; ohne Anker die Warband): Views, Ziehen an der Titelleiste, Menü ⋯, Dock, verknüpfte Auswahl; Aufstieg als Sheet in der Mitte mit allen Fertigkeiten seiner Listen und ihrem Text; beim Trading Post zeigt ein Tipp auf den Namen, was der Gegenstand tut; bei 1440 px drei Spalten, unter 1024 px gestapelt; Seiten ohne eigenes Panel öffnen sich in einem großen Panel (`?embed=1` blendet Leiste und Mockup-Streifen aus), die Arbeitsfläche wird nie verlassen; Layout unter More |
| `trading-post.html` | Händler als Pixelbild (drei Bilder, steht still bei „weniger Bewegung“); Kaufen (Gewöhnliches, wer es benutzen darf und warum nicht), Suchen (ein Wurf je Held, Mindestwurf und Chance, Modifikatoren, Preis mit Zufallsanteil), Verkaufen (halber Preis, abgerundet, mindestens 1 gc; Wyrdstein nach der Tabelle für die Warband-Größe), Geben (Gruppe braucht je Mann ein Stück), Kassenbuch (V7); alle 70 seltenen Gegenstände, die eine Reikland-Warband suchen darf (106 weitere gehören anderen Warbands), mit Filter und „wer darf es benutzen“; `#search`, `#sell`, `#give` öffnen den jeweiligen Reiter; jeder Gegenstand mit Regeltext, auch beim Suchen für den gewählten Gegenstand (Rob, 30.09.2026) |

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

- **Tippflächen** mindestens 44 × 44 px. Ausnahme: ein Regelwort im
  Fließtext einer Karte (siehe Regeltexte); seine Trefferfläche ist etwas
  größer als das Wort, ohne das Wort der nächsten Zeile zu überdecken.
- **Regeltexte auf jeder Karte (Rob, 02.10.2026: „essentiell und muss drin
  sein“):** Ausrüstung, seltene Gegenstände, Fertigkeiten, Zauber,
  Verletzungen, Mutationen und Sonderregeln sind gepunktet unterstrichen.
  Antippen zeigt eine Blase mit Werten und Regeltext (am Desktop auch beim
  Darüberfahren); erneutes Antippen, ein Tipp daneben oder Esc schließt sie.
  Die Blase verdeckt keine Knöpfe dauerhaft und hält nichts auf. Die Texte
  kommen aus `core` (`itemInfo`, `skillInfo`, `abilityInfo`, Zaubertexte,
  Verletzungstabelle) – dieselben wie im Trading Post.
- **Sheets:** Die Knöpfe eines Sheets (Hire, Save, Start …) stehen am unteren
  Rand fest und sind ohne Scrollen erreichbar (Rob, 02.10.2026: „Hire“ lag
  unter langen Werten). Nach dem Anheuern steht die Liste wieder oben bei den
  Filtern.
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
| JavaScript beim ersten Laden | ≤ 200 KB (komprimiert) | `app/scripts/size.mjs`: der Einstieg aus `index.html`, alle Teile, die er vorlädt, und Workbox (bis 04.10.2026 `size-limit` über Dateinamen, das abgespaltene Teile übersah) |
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
