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
Campaign     Overview · Warbands · Notes · Timeline · Chronicle · World
             · Background* · Manage*   (4a1: Overview und Manage;
             mehrere Kampagnen: erst die Liste, eine: gleich sie)
Game night   Vollbild, aus einer Schlacht heraus (4a2: /campaign/:id/battles/:bid,
             auf dem Handy ohne die Leiste unten)
Profile      Devices · Authenticator · Password
Admin*       Users · Invites · Reports · Backups
Report a bug       überall erreichbar (Käfer mit dem Wort „Bug“ im Kopf jeder Seite, öffnet das Blatt „Report a problem“ mit gewählter Art Bug; die Warband in Sicht lässt sich anhängen, auch eine fremde in einer Kampagne, so wie die Kampagne sie zeigt (#158); Account → Your reports; Admin → Reports)
                                  (* nur Leiter bzw. Admin)
```

- **Handy:** Navigationsleiste unten (Home, Warbands, Campaign, Library, Account; für
  den Admin dazu Admin); Formulare und Auswahl als Bereich, der von unten aufklappt (native
  `<dialog>`), statt Pop-up-Fenstern. Die Abschnitte einer Kampagne stehen dort
  als Reiter über der Kampagne.
- **Library (Rob, 21.10.2026, [ADR 0023](decisions/0023-library-per-account.md)):**
  Wer angemeldet ist, hat in der Navigation einen Eintrag **Library** vor Admin
  und Account (am Handy fünf Einträge unten, mit Admin sechs). Dort liegt, was man ohne
  Kampagne schreibt und aufbewahrt, beim Konto, auf jedem Gerät da und **nur für
  einen selbst** lesbar. Reiter am Handy über der Seite, ab 900 px als
  Unterpunkte der Seitenleiste (`library/tabs.ts`): bisher **Ideas** (Titel, „About“:
  Campaign · Faction · Warband · Something else, Text; Karten nebeneinander am
  Desktop; Entfernen erst nach Rückfrage) und **Factions** (Name englisch und
  deutsch, „What the players may read“, die Lore) und **Lore**: ein schreibgeschützter
  Katalog aus `data/lore.json` (Regionen, Fraktionen, Gruppen der Welt, je mit
  eigener Zusammenfassung und Quelle auf mordheimer.net; nur Einträge mit mehr als
  einem Nebensatz Lore). Filter All · Regions · Factions · Groups; „Add to Library“
  kopiert eine Fraktion oder Gruppe als Faction, eine Region als Idea (About:
  Campaign) in die eigene Library; Orte liegen ineinander (die Zeile nennt den Weg, „In
  Ostermark › Mordheim“), Gruppen und Fraktionen nennen, woher sie kommen („From …“), und die
  Auswahl „Place“ nimmt, was in einem Ort liegt, mit (ADR 0024) – ein Name, der dort schon steht, wird nicht noch
  einmal angeboten. Beim Kopieren geht der Weg in den Text mit („Place: Old World › The Empire ›
  Ostermark“ bei einem Ort, „Comes from: …“ bei einer Gruppe oder Fraktion; Rob, 22.10.2026). Orte und
  Gruppen, die mordheimer.net auslässt, stammen aus dem Warhammer Fantasy Wiki auf Fandom (je mit Quelle). **NPCs** (Name englisch und deutsch, Fraktion als Name, Status,
  „Named“ und die Werte wie in der World, nur ohne Kampagne: keine eigenen Fertigkeiten
  der Kampagne, keine Krieger zum Kopieren) und **Groups** (Gegnergruppen: Name,
  Note, Profile wie im Background → Opponents, ebenfalls ohne Kampagne) und
  **Scenarios** (Titel, Regeln und NPCs – **kein Freifeld für NPC-Statlines mehr**, Wunsch #97,
  Rob, 26.10.2026: „NPC hinzufügen oder erstellen“). Im Formular listet „NPCs of this scenario“ die
  NPCs des Szenarios mit „Take out“; **„Add an NPC from the Library“** kopiert einen NPC der Library
  hinein (die Kopie trägt dieselbe ID wie der NPC, nichts verborgen, ein NPC nur einmal) und **verknüpft** beide
  – so zeigt jede Seite die andere; **„Create a new NPC“** legt einen neuen NPC an (Name und Werte wie im
  Reiter NPCs), der **auch dort geführt wird**, und fügt ihn ein. „Take out“ nimmt Kopie und Verknüpfung
  weg, der NPC bleibt in der Library. Die Kopie samt verborgenen Teilen reist unverändert mit und wird in der Kampagne
  geändert, wo ihr Formular liegt. Statlines, die früher als Text geschrieben wurden, bleiben
  lesbar („Statlines written earlier“) und lassen sich mit „Clear the earlier statlines“ löschen.
  **Eine Gruppe in eine Kampagne:** „Groups from the Library…“ bei den Opponents
  (nur Leiter; eine Kopie mit allen Profilen, jedes mit eigener ID, ohne Verweis auf
  eigene Fertigkeiten einer anderen Kampagne – Name und Text bleiben; eine Gruppe
  gleichen Namens wird nicht noch einmal angeboten) und „Save to Library“ an jeder
  Gruppe (eine Kopie zurück, ebenfalls ohne diese Verweise).
  **Ein Szenario in eine Kampagne:** „Scenarios from the Library…“ bei den Szenarien
  (nur Leiter; kommt als **Entwurf** herein – nur Leiter lesen ihn, bis er einem
  Kampf zugewiesen wird –, mit Regeln, Statlines und den NPCs samt ihren
  verborgenen Teilen; ein Titel, der schon da ist, wird nicht noch einmal
  angeboten) und „Save to Library“ an jedem Szenario (eine Kopie zurück; auch die
  Library ist nur für einen selbst).
  **Locations und Verknüpfungen (Wünsche #73 und #74, Rob, 25.10.2026):** der Reiter
  **Locations** (zwischen Scenarios und Lore) hält Orte der eigenen Welt – Name
  englisch und deutsch, „Kind of place“ als freier Tag („Region“, „Town“ … zum
  Sortieren und Finden, höchstens 40 Zeichen) und die Lore. Fraktionen, NPCs,
  Gruppen, Szenarien und Orte lassen sich **untereinander verknüpfen**: im Formular
  „Linked to“ mit einer **Suche** (Meldung #104: eine reine Liste wäre zu lang; Suchfeld nach dem Namen, Auswahl „Kind of entry“ – Faction, NPC, Group, Scenario, Place, dazu die Lore als Regions, Factions und Groups –, höchstens zwölf Treffer, dann „n more – type more“; ohne Eingabe wird nichts angeboten; angeboten wird alles Verknüpfbare außer dem Eintrag
  selbst, mit seiner Art, auch die Lore) und „Remove link to …“; auf jeder Karte steht unter „Linked
  entries“, womit der Eintrag verbunden ist – **offen, von beiden Enden** (eine
  Verknüpfung wird nur auf einer Seite gespeichert). Ideen und Gruppen von Warbands
  tragen keine. Ein Eintrag, der entfernt wurde (oder auf einem anderen Gerät
  noch nicht angekommen ist), wird nicht angezeigt; das Speichern behält die
  Verknüpfung, damit nichts verloren geht, was dieses Gerät nur noch nicht sieht. **Nichts davon geht in eine Kampagne:**
  eine Kopie (Fraktion, NPC, Gruppe, Szenario) nimmt die Verknüpfungen nicht mit; was
  die Library über das Zusammengehören weiß, bleibt dort, bis ein Leiter es später auf
  irgendeinem Weg freigibt (noch nicht gebaut). Orte nimmt eine Kampagne noch nicht
  auf.
  **Ordner (Wunsch #99, Rob, 26.10.2026: „für die gesamte Library“):** Jeder Eintrag – Idee,
  Fraktion, NPC, Gruppe, Szenario, Ort – hat im Formular das Feld **Folder** (ein Name, mit den
  schon benutzten zur Auswahl; leer = keiner). Ein Reiter zeigt seine Einträge unter den Ordnern
  (Überschrift je Ordner nach Namen, „No folder“ zuletzt); sobald keiner einen Ordner trägt, bleibt
  es die schlichte Liste. Derselbe Name in zwei Reitern ist ein Ordner. Ein Ordner besteht, solange ihn
  ein Eintrag trägt – Umbenennen heißt, den Namen an den Einträgen zu ändern; eine Kopie in eine
  Kampagne nimmt ihn nicht mit.
  **Ein NPC in eine Kampagne:** „NPCs from the Library…“ in der World (eine Kopie
  mit den Werten; die Fraktion wird in der World nach Namen gesucht, sonst ohne
  Fraktion; ein NPC gleichen Namens wird nicht noch einmal angeboten) und „Save to
  Library“ an jedem NPC der World (eine Kopie zurück).
  **Eine Fraktion in eine Kampagne:** in der World der Kampagne bietet ein Leiter
  „From the Library…“ an (eine Kopie: die Namen und was die Spieler lesen dürfen,
  die Lore bleibt in der Library; eine Fraktion gleichen Namens wird nicht noch
  einmal angeboten) und „Save to Library“ an jeder Fraktion der World (eine Kopie
  zurück, ohne Lore). **Eine Figur einer Warband** bekommt ihre Fraktion im Profil
  (Story → die Figur → „Edit the profile“ → Faction, nur für Angemeldete mit der
  Auswahl aus der eigenen Library); die Warband behält den Namen, damit er auch
  ohne Library lesbar bleibt, und die Fraktion steht in der Liste und im Leben der
  Figur. Lesen geht aus dem Gerätespeicher, Schreiben
  braucht die Verbindung.
- **Gruppen für Warbands (Wunsch #10, Rob, 21.10.2026):** Wer angemeldet ist, hat
  auf der Warband-Liste die Schaltfläche **Groups**: eigene Gruppen anlegen,
  umbenennen, entfernen (die Warbands darin bleiben, ohne Gruppe). Unter jeder
  Warband steht eine Auswahl „Group of …“ (eine Gruppe oder „No group“) – das ist
  das Zuweisen. Gibt es Gruppen, teilt sich die Liste in je einen Abschnitt je Gruppe
  (nach Namen) und „Not in a group“; ohne Gruppe bleibt die Liste, wie sie war. Die
  Gruppen sind Library-Einträge (`warband_group`, [ADR 0023](decisions/0023-library-per-account.md)):
  nur für einen selbst, auf jedem Gerät, lesbar auch ohne Verbindung; Ändern braucht
  sie. Ohne Anmeldung (und im Quick Build) gibt es keine Gruppen.
- **Favoriten (Wunsch #95, Rob, 26.10.2026):** Wer angemeldet ist, kann jede Warband – auch einen Planner – über die Schaltfläche „Favourite“ unter ihrem Eintrag zum Favoriten machen (aria-pressed; erneutes Tippen nimmt es zurück). Favoriten stehen zusätzlich in einem eigenen Abschnitt **Favourites** ganz oben auf der Warband-Liste (sie bleiben auch an ihrem Platz in Gruppe, Planners oder In campaigns) und tragen ein **dunkelblaues Band mit einem goldenen Kometen** (zwei Schweife; nur der Komet ist die Medaille, Wunsch #103) in der Ecke; ein Planner, der Favorit ist, trägt beide Bänder – das blaue näher an der Ecke, das grüne „P“ weiter außen, beide von Kante zu Kante (Meldung #102), und die Zeile unter dem Namen nennt „Planner · Favourite“. Das Band zeigt auch Home. Gespeichert als Library-Eintrag `warband_favourites` (ADR 0023): nur für einen selbst, auf jedem Gerät, lesbar auch ohne Verbindung; Ändern braucht sie.
- **Reihenfolge der Warband-Liste (Wunsch #157, Rob, 30.10.2026):** Favourites, dann **In campaigns** (die Warbands, die in einer Kampagne spielen), dann die übrigen (die eigenen Gruppen, sonst die ungeordnete Liste), zuletzt **Planners**. Das Seitenmenü behält seine Reihenfolge.
- **Notes nur in einer Kampagne (Rob, 20.10.2026):** Notes hat keinen eigenen
  Eintrag in der Navigation mehr; es ist ein Reiter jeder Kampagne (unter
  Campaign → die Kampagne → Notes). Die alte Adresse `/notes` führt zur Liste
  der Kampagnen.
- **„Account“ statt „More“ (Rob, 19.10.2026):** Das letzte Ziel heißt in der
  Kampagnen-App „Account“ und zeigt eine Person; drei Punkte lasen sich wie ein
  Menü oder Einstellungen. Im Quick Build, der kein Konto hat, heißt es
  „Settings“ mit Zahnrad. Die Adresse ist `/account` (Quick Build: `/settings`; `/more` leitet nur dorthin um); die Karte mit Anmeldung,
  Authenticator und Passwort darin heißt „Sign-in and security“.
- **„Admin“ als eigener Ort (Rob, 20.10.2026):** Wer Admin ist, hat in der
  Navigation einen sechsten Eintrag **Admin** vor Account (Handy: sechs Einträge
  unten); sonst gibt es ihn nicht. Der Kasten „Admin“ auf Account entfällt. Die
  Werkzeuge (Users, Invites, Sign-ins, Audit log, Reports) stehen am Handy als
  Reiter über der Seite und ab 900 px als Unterpunkte der Seitenleiste
  (`account/adminTabs.ts`). Ihre Listen sind Tabellen; am Handy wird jede Zeile
  zur Karte, deren Zellen ihre Spalte nennen.
- **Export: Gruppen und Aufklappkarten (Meldung #139, Wunsch #138, Rob, 29.10.2026):** die Abschnitte der Export-Seite sind **Gruppen mit
  Titel** wie auf den anderen Seiten (Platz über dem Block, wenig zwischen Titel und Text; vorher saß die Überschrift näher am Block
  darüber als an ihrem Text). Die Karten unter „Tabletop Simulator“ haben die **Leiste mit dem Pfeil** der anderen Aufklappfelder (`ui.fold`),
  damit man sieht, dass man sie öffnen kann (`app/src/roster/TtsCard.tsx`).
- **Eine Warband finden (Wunsch #116, Rob, 28.10.2026; umgebaut mit #121–#125, Rob, 28.10.2026):** unter „New warband“ steht
  **„Find a warband“** immer offen (nicht einklappbar) über der **Tabelle** der passenden Warbands. Filter: Name („Look for“, eine eigene Zeile über den anderen Feldern, Meldung #134),
  Rasse, Grade, **Heldenzahl zum Start** (was die Heldeneinheiten der Warband zusammen erlauben, höchstens 6: „Up to 4/5/6“), ein
  **großes Wesen** (Daten: `large`, z. B. Kroxigor, Minotaur), **Gold from/to** und **Max. models from/to**, dazu die Sortierung
  (Stufe, Name, Gold, Modellzahl, Helden). Gold und Modellzahl sind **vorbelegt** mit dem kleinsten und größten Wert über alle
  Warbands: das lässt alles drin und zeigt die Spanne; erst ein engerer Wert filtert, „Clear filter“ stellt die Spanne wieder
  her. Die Tabelle hat eine Zeile je Warband mit den Spalten **Warband, Race, (Grade), Gold, Max. models, Heroes, Big creature** (Yes/No) –
  in dieser Reihenfolge stehen auch die Filterfelder (Wünsche #130, #133, Rob, 29.10.2026); bei Sortierung nach Stufe gibt es statt der
  Spalte Grade eine Überschriftszeile je Stufe. Gewählt wird durch Tippen auf die Zeile (die gewählte hat einen Balken in der
  Akzentfarbe); der Radio-Knopf ist unsichtbar über dem Namen und nur für Tastatur und Screenreader da. Am Handy wird jede Zeile zur Karte. Die schon gewählte Warband bleibt in
  der Tabelle. Eine **Region** gibt es in den Daten nicht, darum keinen Filter dafür (`core/src/rules/summary.ts`, `warbandFacts`,
  `filterWarbands`, `sortWarbands`; `app/src/routes/WarbandFinder.tsx`).
- **Sea dragon cloak im Sv (Meldung #137, Rob, 29.10.2026):** der Umhang bessert Rüstungswürfe (+2 gegen Fernkampf, +1 im Nahkampf,
  kombiniert mit Rüstung). Die Karte zeigt den schlechteren Wert, also **+1, mit Sternchen** („5+*“ statt „6+“; ohne Rüstung „6+*“, nie besser
  als 2+). Nur die Karte (`core/src/rules/saves.ts`, `svShown`); `svOfModel` bleibt wie im Legacy, damit Exporte und Paritätstests gleich
  bleiben.
- **Das Meldefenster ist verschiebbar (Wunsch #129, Rob, 28.10.2026):** ab 900 px Breite lässt sich „Report a problem“ an seiner Überschrift
  mit der Maus ziehen, um zu sehen, was dahinter steht (Einträge, Gold), ohne es zu schließen. Der Zeiger bleibt im Fenster des
  Browsers; beim Schließen springt das Blatt zurück. Am Handy bleibt es das Blatt von unten. Nur dieses Fenster, keine anderen Blätter
  (`app/src/ui/useMovable.ts`).
- **Gear einer Einheit nach Art (Wunsch #113, Meldungen #126, #127, Rob, 28.10.2026):** die Ausrüstung auf der Karte steht in den Gruppen
  **Close combat weapons, Missile weapons, Blackpowder weapons, Armour, Poisons and Drugs, Miscellaneous equipment** (Namen wie auf
  mordheimer.net). Wohin ein Stück gehört, entscheidet zuerst die Preisliste (`group` im Katalog, Schwarzpulver), dann die Liste der
  Einheit, dann die Art im Katalog, zuletzt die erste Zeile seiner Regel (so steht der Seedrachen-Umhang unter Armour, obwohl der
  Katalog ihn als „misc“ führt). Der Tooltip eines Gifts oder einer Droge nennt in der Kopfzeile **„one use“** (`app/src/roster/tips.ts`).
- **Werte beim Anwerben (Wunsch #131, Rob, 29.10.2026):** im Blatt **Recruit** zeigt jede Einheit unter Preis und Grenze ihre neun Werte
  (M WS BS S T W I A Ld) in einer Zeile, damit man eine Anwerbung beurteilen kann, bevor man sie macht; Einheiten ohne Profil
  (Fahrzeuge) zeigen keine. Henchmen ebenso wie Helden (`RecruitUnit.stats`).
- **Carried zuerst (Wunsch #135, Rob, 29.10.2026):** im Ausrüstungsblatt steht **„Carried“ ganz oben** in einem eigenen Kasten (Rand und
  Balken in der Akzentfarbe); darunter, unter der Überschrift **„Buy from the list“** und einer Trennlinie, die Listen, aus denen man kauft,
  zuletzt die seltenen Gegenstände.
- **Gegenstände antippen (Wunsch #136, Rob, 29.10.2026):** im Ausrüstungsblatt ist jeder Name – in den Listen zum Kaufen, auch bei den
  einfachen Startgegenständen, und in „Carried“ – ein Wort mit Blase (`TipWord`): ein Tipp zeigt die Art und die Stärke („Close combat ·
  Strength: as user“, bei Zweihändern +2) und die Sonderregeln („Parry …“, „Strikes last“). Nur ein Name ohne Regeltext in den Daten
  bleibt ein schlichtes Wort (`ListRow.tips`, `CarriedRow.tips`).
- **Planner (Wunsch #77, Rob, 25.10.2026):** unter „New warband“ der Haken **„A planner“**
  (nicht bei einer Warband für eine Kampagne): eine Warband ohne Goldgrenze, die zeigt,
  wie eine starke späte Zusammenstellung aussieht. Statt Gold zeigt sie den **Wert**
  (alles, was sie besitzt, zu Listenpreisen); „Not enough gold“ gibt es nicht. Steigerungen
  brauchen keine Erfahrung: jede Karte nennt „Needs N exp for the advances …“ (ein
  Held nach den Heldenstufen, eine Henchmen-Gruppe nach ihren). In der Liste der Warbands
  steht sie im eigenen Abschnitt **Planners** und trägt die Marke „Planner“. Sie wird
  einer Kampagne nicht als Kopie angeboten und der Server lehnt sie so ab.
  **Spät einsteigen (Catch-up, [ADR 0026](decisions/0026-planner-and-catch-up.md)):**
  im Blatt „Enter a warband“ stehen Planner unter **„Planners, to join late“**. Wer einen
  wählt, sieht, wonach gemessen wird („Measured by the median of N warbands that have
  fought: rating …, value … gc, … battles“), was er besitzen darf und wie viele
  Wertungspunkte Erfahrung verteilt werden, und die Erfahrung je Modell: Gruppen fest
  („+3 each“), Helden mit −/+ zwischen den Helden verschiebbar (unter den Schlachten und
  über dem Anderthalbfachen geht es nicht). Was den Plan übersteigt, steht in Rot
  („needs N exp …“, „Its value is …“) mit dem Satz, dass ein Leiter es trotzdem
  bestätigen kann; der Knopf heißt dann **„Enter anyway“**, sonst **„Enter as a
  latecomer“**. Eingetragen wird eine gewöhnliche Warband; wer sie liest, sieht auf ihrer
  Seite den Kasten **„Joined late“** (Runde, Gold, Erfahrung, Maß, was übersteigt).
- **Nach der Anmeldung: Home (Wunsch #76, Rob, 25.10.2026):** wer sich normal anmeldet,
  landet auf Home, nicht auf Account; kam er von einer Stelle, die ihn geschickt hat
  (`?next=`), geht es dorthin zurück. Die Einladung bleibt bei Account, weil dort als
  Nächstes der Authenticator eingerichtet wird.
- **Sign-ins filtern (Wunsch #72, Rob, 25.10.2026):** über der Tabelle ein Filter
  nach Person (ein Teil des Namens), Art (Signed in · Joined · Failed) und Tag
  (From, To, beide eingeschlossen); der Server filtert, auch über die Seiten.
  Die Tabelle nennt das Gerät jedes Versuchs. **Adressen sind verborgen**, bis
  der Admin „Show addresses“ drückt, und bei jedem erneuten Öffnen des Reiters
  wieder verborgen; ebenso in der Liste der letzten Anmeldungen einer Person.
- **„Your reports“ als Reiter von Account (Rob, 20.10.2026):** Account hat zwei
  Reiter, **Settings** (`/account`) und **Your reports** (`/account/reports`; am Handy
  über der Seite, ab 900 px als Unterpunkte von Account in der Seitenleiste,
  `account/accountTabs.ts`). Die eigenen Berichte stehen dort als Tabelle
  (Titel, Art, Stand in den Worten des Meldenden, gesendet, letzte Änderung) und
  verlängern die Einstellungen nicht mehr. Nie der Schweregrad, nie die
  technischen Angaben.
- **Seitenleiste mit Unterpunkten (Rob, 19.10.2026: „aufklappbare
  Unterreiter“):** ab 900 px öffnen sich Warbands und Campaign in ihre
  Einträge – unter Warbands zuerst, wo es sie gibt, die **Überschriften** (klein, gesperrt, keine Seite) **Planners**, **In campaigns** und je eine für die eigenen Gruppen, jede mit ihren Warbands darunter (Wunsch #91, #92, #93, Rob, 26.10.2026; die Überschrift springt zu ihrem Abschnitt der Liste, `/warbands?show=planners|campaigns|group-<id>`, und ist nie als „hier“ markiert; eine neue oder gelöschte Gruppe, auch eine Warband darin, erscheint sofort, ohne Neuladen – jeder Schreibvorgang der Library meldet sich bei den anderen Bildschirmen), darunter unter **Free warbands** die freien Warbands ohne Gruppe (je Überschrift höchstens die sechs zuletzt geänderten; gibt es weder Planner noch Kampagnen-Warbands noch Gruppen, steht statt dessen die schlichte Liste der sechs zuletzt geänderten) und zuletzt „+ New warband“, unter Campaign die eigenen Kampagnen im Spiel (archivierte
  nicht) und unter der offenen Kampagne ihre Abschnitte (Overview, Warbands, Notes,
  Timeline, Chronicle, World, Questions, Background ⚑, Manage – wer was sieht,
  wie auf den Seiten selbst; `campaign/tabs.ts`). Eine Gruppe ist offen, wo
  man gerade ist; der Pfeil daneben öffnet oder schließt sie, und die Wahl
  bleibt auf dem Gerät (`mordheim-nav-open`). Die Reiter über der Kampagne
  entfallen dann, weil die Seitenleiste sie trägt; eine archivierte oder noch
  nicht geladene Kampagne, die offen ist, steht trotzdem mit ihren
  Abschnitten da (aus dem Speicher des Geräts).
- **Desktop:** Seitenleiste links, Inhalt mit Liste und Detail
  nebeneinander (z. B. Roster links, gewählter Krieger rechts). Karten
  stehen nebeneinander, so viele die Breite fasst (Roster: ab 1440 px drei
  Spalten); der Inhalt ist bis 1920 px breit (Rob, 20.10.2026: vorher nur das Roster, alle anderen Seiten endeten bei 1320 px).
- **Home und Kampagnen-Übersicht am Desktop (Rob, 19.10.2026: „Dann auch die
  Desktopübersicht angehen“):** Home steht ab 900 px in zwei Spalten – links
  „Open for you“ und die zuletzt geänderten Warbands als Raster (sechs statt
  drei, zwei bis vier nebeneinander), rechts „Campaigns“: die Kampagnen im
  Spiel, eine Zeile je Kampagne mit Rolle, Runde und Zahl der Warbands; „All
  campaigns“ führt zur Liste mit dem Archiv. Auf dem Handy steht die Karte
  unter den Warbands (dort trägt die Leiste unten dieselbe Aufgabe). Der Quick
  Build hat keine Kampagnen und gibt den Warbands die ganze Breite. Die
  Übersicht einer Kampagne sortiert **wer** nach links (Warbands, Mitglieder –
  eine Zeile je Person mit Rolle, zwei nebeneinander) von **was geschah** nach
  rechts (Schlachten, Karte); die Reihenfolge auf dem Handy bleibt Warbands,
  Mitglieder, Schlachten, Karte. Ein leerer Teil einer Seite zeigt sein Bild
  klein neben dem Satz (`Empty compact`), nicht als Plakat; das große Bild
  bleibt dem leeren Bildschirm. Der Inhalt wird bis 1920 px breit, auf jeder
  Seite wie im Roster (Rob, 20.10.2026); nur Text und Formulare – Account,
  Manage, Notes, Timeline, Chronicle, Questions, Background – behalten eine
  Lesebreite von 1120 px (`ui.measure`), weil eine Zeile von 1900 px sich nicht
  lesen lässt.
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
  Account → „Layout on this device“ (Phone / Desktop), gespeichert auf dem
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
(`app/e2e/mockups.spec.ts`, nur noch mit `npm run e2e:mockups` und im eigenen Workflow `mockups.yml`, wenn sich unter `docs/mockups/` etwas ändert – die Prüfung dauerte halb so lange wie alle anderen zusammen) klickt jede Bedienung jeder Seite einzeln an,
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
| `game-night` (Version vor der Schlacht, 4c) | In „Who fought“ steht unter jeder Warband, welche Version in die Schlacht geht: „Version not confirmed yet“ oder „✓ Version N goes in · confirmed by …“. Der Spieler bestätigt seine eigene Warband mit **„Confirm my warband for battle N“** (das speichert den Gerätestand als Version „before battle N“ und friert ihre Zahlen ein); ein Leiter kann **„Confirm for <Spieler>“** (die neueste Version auf dem Server) und, wenn danach eine neuere Version entstand, **„Take version N instead“**. Nichts davon hält eine Schlacht auf: ohne Bestätigung steht nur „Went in without a confirmed version“. Leiter mit Authenticator sehen darunter „Before and after“: je Warband Rating, Gold, Models und Fallen vor und nach der Schlacht mit Unterschied. In „What changed“ der Nacharbeit steht dieselbe Karte für die eigene Warband. In „Open for you“ erscheint „Confirm your version“ (Marke „to confirm“), solange die Schlacht läuft und die eigene Warband nicht bestätigt ist; die Kampagnenübersicht zeigt „live · n/m confirmed“ |
| `timeline.html` | feste Anker je Schlacht, Verschieben per langem Drücken, ↑/↓ und „Move to…“, Erfassungszeit bleibt sichtbar, Leiter-Ebene schaltbar; **„AI pack…“** (nur Leiter): ein Prompt aus der Schlacht in Story-Reihenfolge, Aftermath und Aufstiegen, Kanon, Welt, Notizen, Hintergrund ⚑ mit Enthüllungsregeln, bisheriger Geschichte und Stil – Teile abwählbar, Sprache, kopieren oder als .md. **Umgesetzt in 4b4a (12.10.2026):** der Knopf ist nur für Leiter mit Authenticator da und wartet, bis Zeitleiste, Notizen und Bilder geladen sind; das Blatt „AI pack“ ist ein Sheet mit Schlacht-Auswahl (neueste zuerst), den sieben Teilen als Kästchen mit Zahl (der Verlauf der Schlacht ist immer dabei), Sprache Deutsch/English/Both, der Liste „Gaps in the material“, dem Prompt als schreibgeschütztem Feld und seiner Größe (Zeichen, etwa Tokens); „Copy prompt“ und „Download .md“ (`<kampagne>-battle-<n>-ai-pack.md`). Das Blatt hält den Stand der Zeitleiste vom Öffnen fest (sie fragt alle 15 s neu), beim nächsten Öffnen fragt es den Server neu |
| `changes.html` | je Krieger vorher → nachher mit gefundenem Anlass, ⚠ ohne Anlass, Erklärungsfelder mit Zähler, Markieren „After battle N“ |
| `visibility.html` | Auswahl öffentlich / versiegelt / nur Leiter mit Symbol, Wort und eigener Fläche; „View as player“ |
| `background.html` | Handlungsstränge mit Wahrheit, Wissen der Spieler, Enthüllungsstufe (●○○) samt Grenze in Worten; Enthüllen als bewusster Schritt. **Umgesetzt in 4b1 (12.10.2026):** Reiter „Background ⚑“ nur für Leiter mit Authenticator; fünf Arten (Threads, People, Places, Scenarios, GM notes) als Auswahl mit Zahl; Enthüllen wählt den Ort in der Zeitleiste (Vorgabe: der Zwischenspiel-Anker nach der letzten Schlacht), „View as player“ liegt bei den Notizen und zeigt Notizen und Bilder, wie ein Spieler sie bekommt **„Refers to“ (19.10.2026):** statt einer Auswahlliste mit nur Schlachten fragt das Formular „What does it refer to?“ – ein Umschalter **Battle · Faction · Named NPC · Something else** und darunter Kacheln zum Antippen (ein zweites Tippen nimmt den Verweis wieder heraus; die Verweise stehen darüber mit der Art als Vorsilbe). Fraktionen und **Named** NPCs kommen aus der Welt; gibt es keine, sagt eine Zeile, wo man sie anlegt. Die Karte zeigt den **aktuellen** Namen (eine umbenannte Fraktion bleibt dieselbe) und „(removed)“, wenn Fraktion oder NPC nicht mehr in der Welt ist; am Desktop liegen die Kacheln über die Breite des Fensters. |
| `plans` (kein Mockup) | Im Reiter „Background ⚑“ ein weiterer Knopf **„Plans“** neben den Arten: die Pläne der Leiter je Schlacht als Karten („Battle N · Titel · next / being fought / played“, Text, von wem), „Plan a battle“ öffnet ein Blatt mit „Battle number“ (Vorgabe: die nächste; eine Nummer mit Plan wird ersetzt und sagt es) und „The red thread“; „Edit“ öffnet denselben Plan, „Take the plan out“ nimmt ihn heraus. Hat ein anderer Leiter inzwischen geändert, zeigt das Blatt dessen Text und überschreibt erst beim zweiten Speichern. In der Schlacht sehen Leiter mit Authenticator über „Who fought“ **„Your plan for this battle ⚑“** zugeklappt (oder einen Verweis, wo man einen schreibt); das KI-Paket hat den Teil „The leaders’ plan ⚑“. Speichern nur online |
| `opponents` (kein Mockup) | Im Reiter „Background ⚑“ der Knopf **„Opponents“**: Gegnergruppen als Karten (Name, Notiz, je Profil Name ×Anzahl, Typ, Wertezeile, Skills), „Edit“ und **„Tabletop Simulator“** (ein Blatt mit einer TTS-Karte je Profil: Name und Description zum Kopieren, wie im Export), „New group“; darunter „Our own skills“ (Name, Tooltip-Text, „Edit“, „New skill“). Das Gruppenblatt: Name, Notiz, Profile als aufklappbare Editoren (Name, Type mit Vorschlägen, How many, die neun Werte und Sv als Raster – 5 Spalten am Handy, 10 ab 560 px –, Skills als Chips mit ×, „Add a skill“, Equipment, Special rules, Note), **„Copy a model from the game…“** (Suche über alle Modelle aller Warbands, Hired Swords, Dramatis Personae, das Bestiarium und „Our warriors“ – die Krieger der eingetragenen Warbands, wie sie jetzt stehen –, mit Filterknöpfen; die ersten 40 Treffer mit Wertezeile und „Add“) und „Write your own“. „Add a skill“ sucht in allen Skill-Listen des Spiels und unseren eigenen; „Or write one in“ nimmt Name und Tooltip, auf Wunsch gleich als eigener Skill gespeichert. Hat ein anderer Leiter inzwischen geändert, überschreibt erst das zweite Speichern. Immer nur Leiter (Rob, 19.10.2026); speichern nur online. **Auch am Spieltisch (Rob, 19.10.2026):** auf der Schlachtseite zeigt ein Leiter mit Authenticator, solange die Schlacht läuft, unter „Who fought“ denselben Abschnitt **„Opponents ⚑“** – die Gruppen, „New group“, „Edit“ und die TTS-Karten, ohne „Our own skills“ (die bleiben im Reiter; ein eigener Skill lässt sich aber im Profil gleich mit anlegen); „Our warriors“ bietet dort alle eingetragenen Warbands an. Spieler, Leiter ohne Authenticator und eine geschlossene Schlacht sehen ihn nicht, der Server wird dann auch nicht gefragt |
| `questions` (kein Mockup) | Reiter „Questions“ der Kampagne (Leiter und Spieler, nicht Zuschauer): Leiter stellen, ändern, ziehen zurück und stellen wieder; der Gefragte antwortet in einem Sheet mit Sichtbarkeit (alle · versiegelt bis zum Ende der Schlacht der Frage, solange sie läuft · nur Leiter, wenn er Leiter ist); die Frage steht nie bei der Notiz. Schreiben nur online (Knöpfe gesperrt), Lesen aus dem Gerätespeicher |
| `warbands` (kein Mockup) | Reiter „Warbands“ der Kampagne, für alle Mitglieder (Rob, 19.10.2026: „eine Unterkategorie links zum schnellen Überblick“): je Warband, die teilnimmt, eine Karte – Name, Spieler und Typ, Stand (✓ Start, ✓ After battle …), ein Balken gegen die stärkste Warband und die Zahlen ihrer letzten Marke (Rating, Krieger, Helden, Gold, Gefallene), gehaltene Bezirke, Hinweis auf eigene Hausregeln –, nach Rating sortiert, ohne Marke zuletzt; am Desktop nebeneinander, am Handy untereinander. Wer auf eine Marke noch wartet, steht darunter („Waiting for a leader“). „Enter a warband“ und „House rules“ wie auf der Übersicht. Die Zahlen sind die der letzten Marke, nicht live. **Nur für Leiter** (mit Authenticator) steht darunter „NPC warbands · only leaders see these“ (Wunsch #79, [ADR 0027](decisions/0027-hidden-npc-warbands.md)): die versteckten Planner des Spielleiters, je Eintrag Wert, Erfahrung, Rating und Zahl der Modelle, aufklappbar mit den Tabletop-Simulator-Karten, dazu „Take a copy to work on“, „Replace from one of my warbands“, „Remove“; unten das Formular „Add an NPC warband“ |
| `world` (kein Mockup) | Reiter „World“ der Kampagne, für alle Mitglieder (Zuschauer eingeschlossen): je Fraktion eine Karte mit Status, ihren Leuten (Statline aufklappbar) und dem Stand jeder Warband (Summe des Rufs, +/−); darunter Leute ohne Fraktion und das Ruf-Log, neueste zuerst. Leiter (mit Authenticator) legen Fraktionen und NPCs an, ändern und entfernen sie (mit Rückfrage) und tragen Ruf ein („Gains / Loses reputation“, Betrag 1–100 – kein Minuszeichen auf dem Handy nötig); ein Eintrag wird nie geändert, nur herausgenommen. Jedes Formular sagt, dass alle es lesen und das Verborgene in den Hintergrund gehört. **NPC-Werte (19.10.2026):** das NPC-Formular ist ein breites Fenster (`sheetWide`) und öffnet mit dem **Werte-Raster** (Type, M WS BS S T W I A Ld Sv, Skills mit Suche, Equipment, Special rules) statt mit dem TTS-Text (Equipment wie bei den NPCs eines Szenarios mit **„Add equipment“** aus der Datenbank oder von Hand, samt Tooltips, die jeder liest); „Text for Tabletop Simulator“ bleibt als Rückfall (ein NPC, der nur als Text geschrieben ist, öffnet auch so, „Values“ liest ihn zurück, wenn mindestens fünf Werte erkennbar sind, sonst bleibt der Text stehen und das sagt eine Zeile). **„Copy from a model…“** öffnet die Auswahl über alle Modelle des Spiels (Warbands, Hired Swords, Dramatis Personae, Bestiary), die Krieger der Kampagne und die anderen NPCs der Welt – zwei Treffer je Zeile am Desktop; kopiert wird, nicht verknüpft, und ein leerer Name füllt sich. Der Haken **„Named“** macht den NPC zu einer Person für sich (Abzeichen „Named“, goldener Rand), auf die sich später Threads beziehen können. Die Karte einer Person zeigt die Werte als Tabelle (ohne Typ), darunter aufklappbar „Skills, equipment and rules“ und „Tabletop Simulator“ (Name und Description, je mit „Copy“) – auch für Spieler, die Mechanik ist offen. Das Formular wird erst beim Öffnen geladen, damit der erste Start klein bleibt. Schreiben nur online, Lesen aus dem Gerätespeicher |
| `scenarios` (kein Mockup) | Abschnitt „Scenarios“ im Reiter „World“ (zwischen Fraktionen und Ruf-Log). Alle Mitglieder lesen die **gespielten** Szenarien: Karte mit Titel, „Played in Battle n · released by …“ (und „corrected since“), Regeln und NPC-Werte aufklappbar, **„Copy statlines“** (Titel plus Werte als Text für den Tabletop-Simulator-Tisch). Leiter mit Authenticator sehen zuerst die **Entwürfe** (gestrichelte Karte, „⚑ Draft – only leaders read it“) mit „Change“, **„Release“** und „Remove“ (mit Rückfrage), und „Write a scenario“. Das Freigeben-Blatt sagt, dass es alle Mitglieder lesen lassen und nicht rückgängig zu machen ist, und lässt die Schlacht wählen, in der gespielt wird; ein freigegebenes Szenario hat nur noch „Change“ (das Formular sagt, dass alle die Korrektur sehen). **NPCs** kommen nach dem Anlegen des Szenarios: „Add NPCs“ / „Change NPCs“ öffnet ein breites Fenster (nur Leiter, lädt erst beim Öffnen) mit „New NPC“ (Raster aus Bewegung, WS, BS … wie bei den NPCs der Welt, **ohne Typ**), „Copy from a model…“ (Spiel, Krieger der Kampagne, NPCs der Welt), **„Add an NPC of the world“** (die NPCs, die unter World angelegt sind, als Liste nach Fraktion; „Add this one“ kopiert den NPC ins Szenario, ohne den Umweg über die Modell-Auswahl; gibt es keinen, sagt die Liste es) und „Bring along from another scenario“ (der NPC taucht wieder auf; kopiert samt verborgenen Teilen, mit neuer Id). Pro NPC ein Block (Name und „Hide from the players“ links, Werte rechts): **„Hide everything“** (ein Haken für jeden Teil, halb gesetzt, wenn nur einige verborgen sind), Haken für den Namen, **„All stats“**, jede Eigenschaft und Sv einzeln, Fertigkeiten, Ausrüstung, **„Equipment tooltips“**, Sonderregeln; darunter „As the players read it“ mit „?“. **Ausrüstung** wählt der Leiter mit **„Add equipment“** aus allem, was die Datenbank kennt (Suche, Filter Close combat · Missile · Blackpowder · Armour · Equipment, „Bring the tooltip along“ vorgesetzt), oder schreibt sie unter „Or write one in“ mit eigenem Tooltip; die Tooltips stehen als „Equipment tooltips“ unter der Zeile „Equipment:“ der Karte und im TTS-Text. Verborgen lesen die Spieler den Gegenstand (oder, bei verborgener Ausrüstung, „?“), nicht aber, was er kann. Die Karte zeigt die NPCs mit Werte-Zeile (am Desktop nebeneinander) und der TTS-Karte; Spieler lesen „?“ (der Server hat es ersetzt, [ADR 0022](decisions/0022-hidden-npc-values-in-scenarios.md)), Leiter lesen alles, verborgene Zellen gestrichelt und im Wortlaut genannt („The players read “?” for: WS, skills.“), dazu eine zweite TTS-Karte mit allen Werten für sie selbst. Das **Auge „Players’ view“** an der Karte (nur bei NPCs mit verborgenen Teilen; wie das Auge am Passwortfeld) zeigt die Karte so, wie die Spieler sie lesen – Standard ist die Leitersicht, ein zweiter Klick bringt sie zurück. **Den Typ eines NPCs zeigt keine Karte** und kein Formular (20.10.2026). Jedes Aufklappfeld einer NPC-Karte (und „Rules“, „NPC statlines“) ist eine **Leiste mit Pfeil** (`ui.fold`), die sich beim Öffnen dreht – man sieht, dass man sie antippen kann. Nach der Freigabe sind verborgene Werte gesperrt: sie lassen sich zeigen („Saving shows WS to everybody …“), nicht ändern, nichts Neues verbergen, und ein NPC mit verborgenen Teilen bleibt. Schreiben nur online, Lesen aus dem Gerätespeicher |
| `roster.html` | (Aufbau seit 18.10.2026 ersetzt durch `roster-v2.html`, die Regeln darin gelten weiter) Karte je Krieger mit Werten, Erfahrungsstufen (jede Schwelle gerahmt, die nächste markiert, „Advance due“), Ausrüstung und den häufigen Aktionen; Aufstieg und Verletzung mit Folgeentscheidung (V1); Henchmen-Gruppen mit „+ Man“ (Kosten aus Einheit, gleicher Ausrüstung und 2 gc je Erfahrungspunkt, Veteranenwurf, Grenzen: 5 je Gruppe, Einheit, 15 Modelle), Namen der einzelnen Männer, „The lad's got talent“ (Mann wird Held mit zwei Skill-Listen und sofortigem Aufstieg), Tod eines Mannes (W6), Anwerben neuer Gruppen und Helden; beim Aufstieg alle Fertigkeiten der Listen des Kriegers (Captain alle fünf, Champion Combat/Shooting/Strength, Youngblood Combat/Shooting/Speed, Beförderter seine zwei, Ogre Combat/Strength) mit ihrem Regeltext aus `data/skills.json` (`rules-data.js`) |
| `roster-v2.html` | **Umgesetzt (18.10.2026), Rob: „am Desktop (wichtiger als App) die gesamte Breite nutzen, die Info möglichst direkt ersichtlich, bei vielen Einheiten nicht erschlagen werden von einer Wall of Text“.** Eine Zeile je Krieger statt einer Karte; die geöffnete Karte erst unter der Zeile (Handy) oder in einem Fenster neben der Liste (Desktop). Beschreibung unten, „Roster v2 in der App“ |
| `home.html` | „Offen für dich“ (**umgesetzt in 4b3a, 12.10.2026:** Fragen an dich, Nachbereitungen, Zwischenspiele aller Kampagnen, je Zeile ein Link dorthin; dazu die Kopien, die andere dir schickten), eigene Warbands, Kampagnen; Mordheim bei Nacht als Pixelbild (Komet über der Stadt, flackernde Fenster, Wyrdstein, der in den Trümmern aufleuchtet); bei jedem dritten Aufruf schlägt der Zweischweifige Komet ein (Blitz, Feuerball, Rauch, danach glüht der Krater), `?impact=1` bzw. `0` erzwingt es; still und ohne Blitz bei „weniger Bewegung“ (`city-art.js`, auch am Desktop); eine Frage einer Mitspielerin beantworten |
| Wappen der Warbands | `warband-art.js`: je Warband ein eigenes Wappen aus schlichten heraldischen Elementen, passend zu Volk und Fraktion (Rob, 30.09.2026: lieber Wappen als Figuren) – silberner Schild mit blauem Bord und schwarzem Adler (Silver Caravan, Söldner des Imperiums), grauer Schild mit rotem Haupt, Zweischweifigem Kometen und goldenem Kriegshammer (Grey Penitents, Schwestern des Sigmar), schwarzer Lumpen an einer Stange mit Rattenschädel über gekreuzten Klingen (Clan Skrittle, Eshin); keine Symbole aus Games-Workshop-Material; auf Home, Warbands, Campaign, Roster und am Desktop |
| `warbands.html` | eigene Warbands, **„New warband“** (Warband nach Stufe gruppiert, Variante, Name; auch von Home aus, Rob, 02.10.2026: „zu gut versteckt“), Import, die Warbands der Mitspieler nur lesend |
| `hire.html` | (in der App umgesetzt: `/warbands/:id/hire`) Hired Swords und Dramatis Personae mit den echten Regeldaten: Suche, Stufen, „nur wen diese Warband anheuern darf“, **„Spellcasters only“** (Wunsch #120, Rob, 28.10.2026: wer eine eigene Zauberliste hat oder in dessen Regeln Wizard, Prayers oder Funerary Rites stehen, `hireIsCaster`), Sortierung; Sheet mit Werten, Regeln, Optionen, Kosten und Grund, wenn nicht |
| `house-rules.html` | Hausregeln (3e), drei Fälle über den Mockup-Streifen: eine Warband für sich (Quick Build oder vor der Kampagne) stellt sie selbst ein; in einer Kampagne sieht der Spieler nur, was die Leiter eingeschaltet haben, und ob die eigene Datei der Warband abweicht („Take Hel Fenn’s rules“); als Leiter für alle Warbands der Kampagne (von Manage aus). Jede Regel mit Schalter, „As written: …“, Wert per Stepper nur wenn an; Gruppen wie im Roster Builder; Wirkung auf das Gold einer Gründung; Notizen; „On every export“ zeigt die Erklärung wörtlich; alles zurück mit Undo. Vom Roster aus über den Hinweis „⚖ 1 house rule“ · **Vanilla Mordheim der Warband (Wunsch #167 Schritt 1, Rob, 31.10.2026):** eine Karte „Vanilla Mordheim“ erscheint bei einer Warband, die es spielt; ohne Kampagne schaltet „Play with every item and skill“ es aus, in einer Kampagne mit Vanilla nicht (erst wenn deren Leiter es ausschalten). Beim Anlegen (Formular „New warband“) wählt man es für eine Warband des Regelbuchs mit einem Häkchen; für eine Vanilla-Kampagne ist es gesetzt, ohne zu fragen. |
| `chronicle.html` | **Umgesetzt in 4b5a (16.10.2026) und 4b5b (16.10.2026; „Import a chapter“ heißt in der App „Bring in a chapter“ und liegt als Abschnitt „Drafts ⚑ Leaders only“ unter den Kapiteln, nur für Leiter; die Prüfung läuft schon beim Eintippen im Formular und noch einmal im Prüfblatt, „Add as draft“ ist „Save the draft“, freigegeben wird im Prüfblatt):** Reiter „Chronicle“ für alle Mitglieder zwischen Timeline und World; Sprachwahl Deutsch/English oben, „Download all (.md)“, die Kapitel als Karten in Story-Reihenfolge (Art · Label · IC-Datum · Ort, Titel, Abschnitt der Zeitleiste und vorhandene Sprachen, Sieger), „Read“ klappt den Text an Ort und Stelle auf. Reiter „Chronicle“ der Kampagne: die ganze geschriebene Geschichte, Kapitel für Kapitel (Prolog zweisprachig); **„Import a chapter“** als Text (eingefügt oder .md/.txt) mit Titel, Schlacht und Sprache, Prüfung auf Begriffe aus verborgenem Hintergrund und erlaubte Andeutungen, landet als Entwurf; „Download all (.md)“ |
| `backstory` (kein Mockup, 4c) | Abschnitt „Backstory“ im Reiter „Chronicle“, über den Kapiteln: die Vorgeschichte als aufklappbare Abschnitte (Überschrift, „before the first battle“ oder „Battle N“), **für alle Mitglieder** lesbar, auch Zuschauer, aus dem Gerätespeicher. Leiter mit Authenticator haben **„Bring in the backstory…“** (später „Replace the backstory…“): Text einfügen oder .md/.txt lesen; das Blatt schneidet ihn an Überschriften („Battle 3 …“, „Schlacht 3 …“, Markdown) in „Sections found“ (Überschrift, Schlacht, Wörter), hält jeden Abschnitt bei seiner Schlacht gegen den verborgenen Hintergrund („Check before it is saved“, Befunde je Abschnitt) und verlangt bei Befunden ein bewusstes Häkchen („everyone in the campaign may read this“); es sagt, wie viele Abschnitte es ersetzt, und weist einen Stand zurück, den ein anderer Leiter inzwischen ersetzt hat. Speichern nur online. „New battle“ hat das Feld **„Battle number“** (Vorgabe: die nächste; nicht kleiner als die erste Nummer nach der Vorgeschichte; eine größere sagt, dass die Kampagne auf die Runde davor rückt) |
| `campaign.html` | Übersicht: laufende Schlacht mit Weg in den Spielabend, Warbands mit Stand, Schlachten 1–5, Bezirke |
| `world.html` | Bezirke (Wirkungen aus `data/campaign.json`, wer sie hält, Korrektur durch Leiter), Fraktionen mit Ruf, Personen, Orte |
| `manage.html` | nur Leiter: Rollen, Einladung, Hausregeln als Schalter, Schlacht schließen (unumkehrbar, daher mit Bestätigung). **Seit 4b4a:** Abschnitt „Style guide ⚑“ (zwischen Hausregeln und „The next round“): ein Textfeld „Instructions for the writer“ (höchstens 10 000 Zeichen), „Save the style“; nur Leiter mit Authenticator. Hat ein anderer Leiter zuerst gespeichert, zeigt das Feld dessen Text mit dem Hinweis, die Änderung neu zu machen. Offline ist der letzte gesehene Text da, speichern geht nur online. **Seit 4b4b:** Abschnitt „Canon for the linter“ direkt darunter: „Download the canon (.txt)“ lädt die Namen der Kampagne in Deutsch und Englisch als Datei für den Chronik-Linter (nur Namen, nichts Verborgenes); die Meldung sagt, wie viele Namen es sind, wie viele sich zwischen den Sprachen unterscheiden und wie viele noch nicht fertig sind; kann eine Warband nicht gelesen werden, wird nichts gespeichert, und die Meldung nennt sie. Offline ist der Knopf gesperrt |
| `story.html` | Reiter „Story“ der Warband: Prolog, Zwischenspiel je Runde, Namen in beiden Sprachen, Lebenslauf jedes Kriegers (auch über den letzten Reiter des Kriegers im Roster → „Story so far & profile“). **Umgesetzt in 4b2 (12.10.2026)** ohne Sichtbarkeit je Zwischenspiel: die Story liegt im Stand der Warband (ADR 0016) und ist für die Kampagne lesbar, die Seite sagt das oben. Zu jeder Änderung der Nachbereitung gehört „Say what happened“ (nie Pflicht) · **Eröffnung (Wunsch #170, Rob, 31.10.2026):** solange der Prolog leer ist, bietet die Seite die kurze Lore-Eröffnung der Warband an („The opening from the setting“, `data/warbandintro.json`, mit eigenen Worten nach der Seite auf mordheimer.net zusammengefasst, nie kopiert); „Use as the prologue“ übernimmt sie einmal in den Speicherstand, danach gehört der Text dem Spieler. |
| `more.html` | Geräte, Authenticator, Passwort, Theme, Layout auf diesem Gerät, „Report a problem“ (Käfer-Knopf „Bug“ im Kopf jeder Seite – Rob fand die Fahne nicht, 20.10.2026 –, öffnet das Blatt mit Art, Text, bei Regelfehlern Quelle; „What goes along“ zeigt den Kontext lesbar vor dem Senden; offline, abgemeldet oder im Quick Build bleibt „Copy the report“), „Your reports“ mit Status und „fixed in“, Admin (Nutzer, Einladungen, Reports, Backups; **Umgesetzt in 4c1, 17.10.2026:** Reiter „Reports“ mit Filter Open/Fixed/All, Blatt zum Sortieren – Status, Grad, Bereich, „Fixed in version“ – und „Copy for Claude“, „Download the report“, „Download the warband“; **4c2:** Liste und Blatt zeigen die Nummer `#N`, die Dateien heißen `report-N-…`; **Wunsch #28, 21.10.2026:** eine kurze Überschrift (`headline`) steht über der Meldung in Liste und Blatt, die Worte des Meldenden darunter, auf vier Zeilen gefaltet und mit „Show all“ ganz zu öffnen; Überschrift im Sortierfeld, `/bugs` schreibt sie beim Einordnen; **#141–#143:** ab 860 px brechen Nummer, Art, Status („Fixed in …“), Grad, Daten und der Knopf nie in sich um, Titel und Bereich geben nach; **Wunsch #142:** eine Meldung mit Status „fixed“ ist gesperrt, das Blatt zeigt nur noch den Hinweis und die Wege zum Weitergeben) |
| `desktop.html` | die Arbeitsfläche aus Panels (Vorschlag, siehe §2), für jedes Ziel der Leiste eine eigene (`#home`, `#warbands`, `#campaign`, `#notes`, `#more`; ohne Anker die Warband): Views, Ziehen an der Titelleiste, Menü ⋯, Dock, verknüpfte Auswahl; Aufstieg als Sheet in der Mitte mit allen Fertigkeiten seiner Listen und ihrem Text; beim Trading Post zeigt ein Tipp auf den Namen, was der Gegenstand tut; bei 1440 px drei Spalten, unter 1024 px gestapelt; Seiten ohne eigenes Panel öffnen sich in einem großen Panel (`?embed=1` blendet Leiste und Mockup-Streifen aus), die Arbeitsfläche wird nie verlassen; Layout unter More |
| `trading-post.html` | Händler als Pixelbild (drei Bilder, steht still bei „weniger Bewegung“); Kaufen (Gewöhnliches, wer es benutzen darf und warum nicht), Suchen (ein Wurf je Held, Mindestwurf und Chance, Modifikatoren, Preis mit Zufallsanteil), Verkaufen (halber Preis, abgerundet, mindestens 1 gc; Wyrdstein nach der Tabelle für die Warband-Größe), Geben (Gruppe braucht je Mann ein Stück), Kassenbuch (V7); alle 70 seltenen Gegenstände, die eine Reikland-Warband suchen darf (106 weitere gehören anderen Warbands), mit Filter und „wer darf es benutzen“; die Maske wählt zusätzlich nach der Kampagne, mit der ein Gegenstand erschien („Released with“: Regelbuch, Empire in Flames, Border Town Burning, Khemri, Lustria, Warband-eigene), und nach dem Grad der Warband (Rob, 22.10.2026); die Zeile nennt bei einem Gegenstand, der nicht zur Preistabelle des Regelbuchs gehört, woher er kommt; `#search`, `#sell`, `#give` öffnen den jeweiligen Reiter; jeder Gegenstand mit Regeltext, auch beim Suchen für den gewählten Gegenstand (Rob, 30.09.2026) |

### Roster v2 in der App

Rob, 18.10.2026: zuerst der Desktop (wichtiger als die App am Handy), die
Information möglichst gleich sichtbar, und bei vielen Einheiten keine Wand aus
Text. Das Mockup `docs/mockups/roster-v2.html` (PR #70) ist der Entwurf; die
App setzt es um (`app/src/roster/Board.tsx`, `Detail.tsx`, `Panel.tsx`,
`Board.module.css`). Dieselbe Liste zeigt auch die Warband eines Mitspielers,
nur lesend (`CampaignWarband`, ohne Aktionen).

**Kopf.** Name der Warband (mit Stift zum Umbenennen), eine Zeile mit Typ,
Stufe und – falls an – „⚖ N house rules“, vier Kacheln (Gold, Rating, Models
mit Anzeige gegen das Maximum – das der Warband selbst, ein Zuschlag etwa durch einen Halfling Scout steht dahinter: „8/12(+1)“ –, Worth) und eine Leiste mit den Aktionen der
Warband: **+ Recruit, Hire, Trade** (mit dem Lager als Zahl) und **Export**.
Auf dem Handy bleibt die Leiste beim Scrollen oben stehen; am Desktop steht
sie neben den Kacheln. Nichts davon liegt hinter einem Menü.

**Die Zeile eines Kriegers** (Helden, Henchmen-Gruppen, Hired Swords): Name
(bei Gruppen ×N), Art, die **ganze Statline** auf einen Blick (abweichende
Werte gefärbt, Verletzungen und Aufstiege schon eingerechnet), Erfahrung als
Zahl und als Leiste mit den Stufen (erreichte Schwellen gefüllt, noch nicht
übernommene Aufstiege golden), bis zu vier Marken (Leader, Verletzung,
gefangen, Aufstieg fällig …) und was er trägt. Am Desktop wird daraus eine
Tabellenzeile: Name und Statline stehen nebeneinander (Container-Query ab
620 px Breite der Liste, nicht der des Fensters). Eine Zeile ist ein
Knopf; sein Name sagt „Name, N men, Art“, der Rest steht in der Beschreibung
(`aria-describedby`) – ein Screenreader hört dieselbe Information.

**Drei Anordnungen**, gemessen an der Breite der Arbeitsfläche selbst
(Seitenleiste und Rand schon abgezogen; `useLayout`, ResizeObserver, nicht
Media-Query):

| Anordnung | ab Breite | Verhalten |
| --- | --- | --- |
| `stack` | unter 860 px | eine Spalte; ein Tipp öffnet den Krieger **unter seiner Zeile**, mit vier Reitern (Overview, Gear, Skills & injuries, Story & more; Hired Swords haben kein Gear); ein zweiter Tipp schließt ihn; geöffnet scrollt die Zeile unter die festen Leisten (kein Sheet, also kein eigener Schritt im Verlauf) |
| `split` | ab 860 px | die Liste und daneben das **Fenster** mit dem gewählten Krieger, alle Abschnitte offen und ohne Reiter; es bleibt beim Scrollen stehen und scrollt in sich; vorgewählt ist der erste Krieger |
| `triple` | ab 1560 px | wie `split`, dazu eine dritte Spalte „Warband“ mit den Funktionen der Warband (House rules, Districts, Story, Versions, Make a copy; Share, In campaign, Remove) als sichtbare Liste statt ⋯ |

Unter 860 px steht dieselbe Liste „Warband“ unter den Kriegern. Helden und
Henchmen stehen in der Reihenfolge der Rekrutierungsliste der Warband (Anführer
zuerst), nicht in der des Anwerbens (#140). Die Arbeitsfläche
(Shell) wird bis 1920 px breit, auf jeder Seite (früher nur auf dem Roster,
`.main.wide`); Text und Formulare haben ihre Lesebreite.

**Was wo liegt** (früher im ⋯-Menü der Karte): Overview – Erfahrung (Stepper,
Stufen), Advance, Injury bzw. Captivity, „+ Man“, Anführer („Lead the
warband“), Männer einer Gruppe mit Namen und Entlassen, Sonderregeln; Gear –
die Liste, „Equipment & rare items“ bzw. der Weg zum Trading Post; Skills &
injuries – Fertigkeiten, Zauber, Mutationen, Mal des Chaos und Segnungen,
Verletzungen mit Korrektur, genommene Aufstiege mit Korrektur; Story & more –
„Story so far“, „Tabletop Simulator card“ und, getrennt, „Out of
action for good…“ bzw. Entlassen. Die Beschriftungen der Knöpfe und der
Stepper sind dieselben wie zuvor.
Der Name einer Einheit hat einen Stift daneben, der das Blatt zum Benennen
öffnet – wie bei der Warband: am Handy in der aufgeklappten Zeile rechts neben dem
Namen, ohne eigene Zeile (#156), am Desktop im Kopf des Fensters; das Namensfeld
ganz unten in „Story & more“ entfällt (#152, #153).

**Seltene Gegenstände im Ausrüstungsblatt (#162).** Der Name steht in „Rare and trading-post items“ wie in „Carried“ als Wort mit Blase, nicht nur als `title`, den ein Handy nie zeigt.

**Die Gefallenen (#159, #160, #161).** Je Einheit steht die Einheit als Überschrift („Hero unit“ oder „Henchmen unit“), darunter „N models fallen“
mit Erfahrung und verlorenem Gold, dann die gefallenen Modelle als Liste („Fallen models of …“). Jedes Modell nennt, wo es
aufgezeichnet wurde, die Runde, in der es fiel, und wer es ausgeschaltet hat, und die Runde, in der es dazukam. Die verlorene
Erfahrung (die im Spiel verdiente) steht neben dem Gold, in der Zusammenfassung wie in jeder Zeile; jede Zahl bleibt in einem Stück.
Wie viele Kämpfe ein Modell mitmachte, zählt seit Wunsch #166 die Warband (Absatz „Zähler der Kämpfe“); die Gefallenen nennen die Zahl, wo sie gezählt wurde.

**Zähler der Kämpfe (#166).** Wo die Kampagne die Kämpfe zählt, steht in „Experience“ eine Zeile „Battles fought“: Wer sie nicht
ändern kann, sieht die Zahl, der Besitzer hat daneben − und +, um einen Stand nachzutragen, der vor dem Zähler begann. Gezählt wird
im Schritt „Grant the battle's experience“ der Nachbereitung (`countBattle`, einmal je Kampf): +1 für jedes Modell, jede Gruppe und jeden
Gekauften, der nicht aussetzt („Misses games“); wer in diesem Kampf fiel, steht schon bei den Gefallenen und bekommt ihn dort
(„Took part in N battles“). Eine Henchmen-Gruppe zählt als Ganzes, auch Männer, die später dazukamen.

**Vanilla Mordheim in der Kampagne (#167, Schritt 2, Rob, 30.10.2026).** Beim Start einer Kampagne gibt es das Häkchen „Vanilla Mordheim“
(nur das Regelbuch: seine Warbands, Gegenstände und Fertigkeiten; „Core“ ist dasselbe), standardmäßig aus. Es lässt sich später nicht
einschalten; eine laufende Kampagne wird nie auf Vanilla umgestellt. Ein Leiter kann es für immer abschalten: auf „House rules“ steht eine
Karte „Vanilla Mordheim“ mit „Allow every rule“ (nach einer Rückfrage), für alle anderen nur der Hinweis. Der Überblick der Kampagne nennt
„Vanilla Mordheim“ unter dem Namen. In eine Vanilla-Kampagne treten nur Warbands des Regelbuchs (Grade core: Mercenaries, Witch Hunters,
Sisters of Sigmar, Skaven, Undead, Cult of the Possessed) – „Enter a warband“ zeigt die anderen ausgegraut mit dem Grund, „New warband for this
campaign“ nur die sechs, und der Server weist die anderen mit 400 ab. Die Gegenstände und Fertigkeiten einer Vanilla-Kampagne sind damit noch
nicht eingeschränkt: das kommt mit den Warbands (Schritt 1).

**Eröffnungsszene (#169).** Ganz oben unter „World“ steht der Abschnitt „Opening scene“: was die Leiter geschrieben haben („Written by the leaders“),
solange nichts geschrieben ist die Beschreibung des Ortes der Kampagne aus der Lore („From the Lore · Khemri“; alle 120 Orte haben einen Text, ohne
Ort steht „No opening scene yet.“). Jedes Mitglied liest sie. Ein Leiter hat „Write your own“ (das Blatt beginnt mit dem angezeigten Text, so lässt
sich der der Lore bearbeiten) und, wo etwas geschrieben ist, „Use the Lore text“, das den eigenen Text leert.

**What's new (#154, ADR 0029).** Jede Änderung, die Spieler sehen, bringt eine Datei in `changelog/` mit (Datum, dann
„New/Changed/Fixed“-Zeilen, kurz, ohne Nummern). Unter „More“ öffnet „What's new“ ein Blatt mit allen Änderungen, nach Tagen
gruppiert, das Neueste oben. In der Meldung „New version available.“ steht zwischen Text und „Reload“ ein kleines „What's new“,
das nur zeigt, was die neue Version mehr enthält (ihre `changelog.json`, aus dem Netz gelesen, nicht aus dem Cache); ohne Netz oder
ohne Neues erscheint der Knopf nicht.

Damit es nicht versteckt ist (#155): ein Knopf „New“ steht im Kopf jeder Seite neben „Bug“ (ab 700 px; am Handy ist der Kopf
voll), auf Home steht am Handy wie am Desktop eine Karte „What's new“ mit den neuesten Änderungen und „All changes“, und
unter der Meldung „New version available.“ steht die erste Änderung der neuen Version samt Knopf „What's new“.

**Aufstieg (Advance).** Die Zeilen der Heldentabelle, die einen zweiten Wurf
verlangen (6: Stärke oder Attacken, 8: Initiative oder Mut, 9: Wunde oder
Widerstand), fragen nach dem W6 („D6 as rolled“, 1–3 die erste, 4–6 die zweite
Eigenschaft) statt eine freie Wahl zu lassen; nur 7 (WS oder BS) wird gewählt.
Steht die genannte Eigenschaft am Maximum, nimmt der Held die andere und die
Zeile sagt es. Sind beide am Maximum, steht an der Stelle eine Meldung „Roll the
2D6 again“ mit dem Knopf „Roll again“, der den 2W6 leert; „Apply“ bleibt aus
(#144, #145).
Bei „New skill“ stehen Fertigkeiten und – für Zauberer – Zauber als zwei
gleichwertige Knöpfe nebeneinander („New skill“ / „Spell · Lore“); darunter die
gewählte Liste. Fertigkeiten und Zauber sind Listen in Spalten gleicher Breite,
Namen linksbündig; ein Zauber trägt seinen Castwert („cast on 7+“, ein bekannter
„7 → 6“) (#146, #147, #148).

**Druck.** Das Blatt zum Drucken gibt es nur, solange der Browser druckt
(`beforeprint` bis `afterprint`): jeder Krieger in voller Länge, ohne Knöpfe.
Auf dem Bildschirm steht die Liste nie doppelt. „Export“ → „Print the
roster“ führt zurück auf den Roster, der einmal `window.print()` aufruft; der
Test ersetzt es und schaltet dann auf Druckmedien.

**Zauber leichter machen.** Ein bekannter Zauber, der beim Aufstieg leichter
gewirkt werden soll, ändert den Wert in der Klammer („Zauber (6)“ statt (7));
der Export zeigt denselben Wert. In der Zauberliste steht der gedruckte Wert mit
dem Schritt daneben („cast on 7(−1)+“). In „Advances“ steht jeder Schritt als
eigener Eintrag „1 easier to cast“ mit eigenem „Remove“, nicht zusammengefasst
(#150, #151).
Ein erlernter Zauber steht in der Zauberliste mit leicht getöntem Hintergrund und
Balken links, sein Castwert als Plakette in der Akzentfarbe (#149).

**Grenzen für Gestaltung und Prüfung.** 360 px ohne Seitwärtsscrollen,
Tippflächen mindestens 44 px, beide Themes, Screenshots bei 360, 820, 1440 und
1920 px (`app/e2e/app.spec.ts`, `campaign-*-roster*.png`). Die übrigen
Bildschirme folgen denselben Regeln – jeder als eigener Pull Request:
Information sofort sichtbar, kein Menü für etwas Wichtiges, die Breite
nutzen, bei vielen Einträgen Zeilen mit Aufklappen statt Fließtext.

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

### Bilder (Pixelart)

**Entschieden (Rob, 19.10.2026):** jede Seite hat ein passendes Pixelbild –
ein **Banner** im Seitenkopf und, wo etwas fehlt, eine **große Szene** im
leeren Zustand. Beides bleibt auch bei „weniger Bewegung“ stehen; nur die
kleinen Lichter (Fenster, Feuer, Wyrdstein, Sterne) bewegen sich sonst ein
wenig.

- **Gezeichnet im Code** (`app/src/art/`): `draw.ts` ist ein kleiner
  Pixelmaler (Gitter aus Ein-Buchstaben-Farben, feste Palette, Sterne und
  erleuchtete Fenster aus einem Zufallsgenerator mit festem Startwert – ein
  Bild sieht immer gleich aus), `scenes.ts` hat die elf Szenen, `Pixels.tsx`
  macht daraus ein SVG mit einem Pfad je Farbe. Eigene Motive, nichts aus
  Games-Workshop-Material.
- **Banner:** 520 Pixelspalten breit (`WB`), die Szene steht in der Mitte,
  und zu beiden Seiten geht der Ort thematisch weiter (**Rob, 22.10.2026,
  Bericht #33:** am Desktop passierte nur in der Mitte etwas, der Rest war
  nackter Hintergrund). `wings.ts` streut je Szene ihre Umgebung entlang
  des Bodens – ein Zufallsgenerator mit festem Startwert, nie zweimal
  dasselbe hintereinander, die Szene behält ihren Platz: Mordheim mehr
  Häuser, Türme und Trümmer mit Schloten, das Lager mehr Zelte, Feuer und
  Wimpel, der Markt mehr Stände, Laternen, Fässer und Karren, die Bücherseiten
  Regale, Leuchter und Schreibtische, die Karte Berge, Wälder und Flüsse,
  das Stadttor Mauern mit Fackeln, das Schloss Türen, Truhen und Schlüssel
  usw. Über die ganze Breite bewegt sich außerdem: Rauch steigt, Funken
  steigen und verglühen, zwei Schwärme Fledermäuse ziehen über den Himmel,
  eine Wolkenbank treibt durch den Dunst (bei „weniger Bewegung“ alles
  still). 60 px hoch am Handy (zeigt nur die Mitte), bis 112 px am Desktop;
  daneben malt die Seite weiter die Himmelsbänder, falls ein Bildschirm
  breiter ist als das Bild. Es ist Dekoration (`aria-hidden`), nicht
  antippbar, und fehlt nur bei der Spielnacht (`/campaign/:id/battles/:bid`,
  Vollbild am Handy).
- **Leere Szene:** `<Empty scene title>text</Empty>` – Bild, Titel (der bisherige
  Satz, z. B. „No battles yet.“) und darunter, was zu tun ist. Sie zeigt ein
  anderes Motiv als das Banner derselben Seite.
- **Welche Seite welches Bild:** `art/route.ts`, die erste passende Regel
  gewinnt (Test in `art.test.tsx`).

| Szene | Motiv | Seiten |
| --- | --- | --- |
| `city` | Mordheim bei Nacht, Komet, Wyrdstein in den Trümmern | Home |
| `camp` | Zelte, Banner, Lagerfeuer | Warbands, Roster, Neue Warband, Manage |
| `market` | Marktstände, Münzen | Trading Post, Hire, Import |
| `dice` | Tisch, zwei Würfel, kleiner Krieger | TTS-Karten (Export) |
| `tome` | aufgeschlagenes Buch zwischen Kerzen | House rules, Chronicle |
| `map` | Karte mit Straßen, Fluss, Nadeln | Districts, World, Kampagnenliste |
| `scribe` | Schreibtisch, Schriftrolle, Feder, Bücher | Story, Versions, Notes, Timeline |
| `fire` | Lagerfeuer nach der Schlacht, zwei Sitzende | Nachbereitung |
| `gate` | zerstörtes Stadttor mit Fackeln | Kampagnen-Übersicht |
| `battle` | Schild vor gekreuzten Schwertern | Schlachten |
| `lock` | Tür mit Vorhängeschloss, Schlüssel | Account, Admin, Fragen, Hintergrund |

- Die Szenen im Mockup (`city-art.js`, `warband-art.js`) bleiben Vorlage für
  den Stil; der Kometeneinschlag und die Wappen der Warbands sind nicht
  übernommen.
- Neue Szene: in `SCENES` eintragen (`span` = Breite des Motivs, der Test
  prüft, dass nichts darüber hinausragt), in `wings.ts` (`WINGS`) die Dinge
  nennen, aus denen ihre Umgebung besteht, und in `route.ts` einer Seite geben.

## 5. Bedienung

- **Tippflächen** mindestens 44 × 44 px. Ausnahme: ein Regelwort im
  Fließtext einer Karte (siehe Regeltexte); seine Trefferfläche ist etwas
  größer als das Wort, ohne das Wort der nächsten Zeile zu überdecken.
- **Mit Maus oder Trackpad** (`hover: hover` und `pointer: fine`) sind
  Knöpfe, Felder und Reiter 36 px hoch und ihre Beschriftung 16 px statt 17 px
  (Rob, 19.10.2026: die Knöpfe am Desktop waren „zu groß und klobig“). Das
  steuert allein die Variable `--tap` (`app/src/theme/tokens.css`); mit dem
  Finger bleibt es bei 44 px. Die Desktop-Tests laufen ohne Touch und
  verlangen dort mindestens 32 px.
- **Knöpfe:** Hauptaktion gefüllt in der Akzentfarbe, alles andere ruhig auf
  der Fläche mit Rand; beim Darüberfahren etwas heller. Ein gesperrter Knopf
  ist grau mit gedämpfter Schrift, nicht eine verblasste Akzentfarbe.
- **Reiter einer Seite** (Kampagne, Admin) sind eine Zeile aus Wörtern, der
  aktuelle unterstrichen; ist die Zeile zu lang, scrollt sie seitwärts, nicht
  die Seite.
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
  Filtern. Am Handy ist ein Sheet ein Blatt vom unteren Rand; ab 900 px ein
  Fenster in der Mitte (bis 920 px breit, `ui.sheetWide` bis 1180 px), dessen
  Felder in zwei Spalten stehen – Titel, Hinweise, lange Texte und die Knöpfe
  nehmen die ganze Zeile. Solange ein Sheet offen ist, bleibt die Seite dahinter
  stehen und scrollt nicht mit (Rob, 19.10.2026: das Sheet klebte unten, oben
  war Platz, und die Seite musste erst ganz nach unten gescrollt werden).
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
| JavaScript beim ersten Laden | Kampagne ≤ 250 KB, Quick Build ≤ 250 KB (komprimiert, [ADR 0021](decisions/0021-first-load-budget-per-flavour.md), [ADR 0025](decisions/0025-quick-build-first-load-250-kb.md)) | `app/scripts/size.mjs`: der Einstieg aus `index.html`, alle Teile, die er vorlädt, und Workbox (bis 04.10.2026 `size-limit` über Dateinamen, das abgespaltene Teile übersah) |
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
