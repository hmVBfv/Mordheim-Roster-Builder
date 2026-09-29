# Verhaltensänderungen gegenüber der alten App

Stand: 28. September 2026

`core/` bildet die alte App zunächst 1:1 nach; die Paritätstests beweisen das.
Dieses Dokument ist das Register für alles, was davon **bewusst abweicht** –
und für die Änderungen am Roster Builder, die Rob sich wünscht. Nichts ändert
sich stillschweigend: Jede Abweichung steht hier mit Grund und Test.

## So wird eine Änderung eingebracht

1. **Eintrag hier** unter „Geplant“: Was soll anders sein, warum, und – bei
   Regelfragen – mit welcher Quelle (Quellenhierarchie siehe `CLAUDE.md`).
   Regelentscheidungen trifft Rob.
2. **Zeitpunkt:** Solange Phase 1b läuft, wird zuerst fertig portiert. Erst
   wenn die Logik vollständig und paritätsgeprüft in `core/` liegt, werden
   Änderungen eingebaut – einzeln, damit die Parität bis dahin ein sauberes
   Sicherheitsnetz bleibt.
3. **Umsetzung:** Test, der das neue Verhalten festhält, dann die Änderung in
   `core/`. Der Paritätstest bekommt eine ausdrücklich benannte Ausnahme für
   genau diesen Fall – nie eine pauschale.
4. **Alte App:** Nur echte Fehler, die im laufenden Spiel stören, werden auch
   dort behoben (mit eigenem Test in `test/`). Neue Abläufe kommen nur in den
   neuen Builder.
5. **Ab Phase 3** (neuer Builder ersetzt die alte App) entfallen die
   Paritätstests; Änderungen gehen dann direkt mit Tests in `core/`.

## Erledigt: Fehler der alten App, in beiden behoben

Gefunden durch die Paritäts-Wanderung (`core/test/parity/walk.ts`) oder beim
Portieren.

| Fehler | Folge | Behoben |
| --- | --- | --- |
| Beim Befördern (The Lad's Got Talent) nahm der Chronik-Eintrag die `uid` vom letzten Modell der Liste | Stand ein anderer beförderter Held am Ende, nannte der Eintrag den falschen Krieger | `js/app.js`, Test `test/promote-log.mjs` |
| Der beförderte Held teilte Verletzungs- und Zauber-Objekte mit seiner alten Gruppe | Zauberschwierigkeit des Helden senken senkte sie auch bei der Gruppe (bis zum Neuladen) | `js/app.js`, Test `test/promote-copies.mjs` |
| Nach dem Laden bekam ein neuer Rekrut die `uid` eines Gefallenen, wenn dieser die höchste hatte | Tod zurücknehmen stellte zwei Krieger mit derselben `uid` auf; Änderungen am einen landeten beim anderen | `js/state.js` (`resyncUid` zählt die Gefallenen mit), Test `test/uid-after-fallen.mjs` |
| Sonderpreise der Gründung galten immer | Die Liste des Aristocrat verlangte 95 gc für den Nightmare statt 30 (die 95 gelten erst am Trading Post), und was in der Startliste stand, bot der Trading Post nie an – nach der ersten Schlacht blieb nur der Gründungspreis. Zwerge zahlten Gromril-Waffen immer dreifach, Dunkelelfen die Dark Elf Blade immer mit +15. | Listenzeilen mit Gründungspreis tragen `{start: true}` (Nightmare, Mechanical Suit, Engine of Chaos, Zharr-Obsidianwaffe, Ithilmar der Shadow Warriors und Wood Elves, Nagarythe-Gegenstände, Gromril-Rüstung der Zwerge); ab der Stufe nach Schlacht 1 sind sie gesperrt, und der Trading Post bietet sie zu seinem Preis an. Gromril ×3 und Dark Elf Blade +15 nur bei der Gründung (`UPGRADES[…].start`). `js/engine.js`, `js/app.js`, `core/src/rules/equipment.ts`; Tests `test/start-prices.mjs`, `core/test/start-prices.test.ts` (Rob, 29.09.2026, C2/C3/C7) |
| Die Obsidianwaffe der Sons of Hashut hieß wie die Obsidian-Aufwertung aus Border Town Burning | Sie zeigte deren Regeln und Preis-Hinweis (4× Preis) | Umbenannt in „Zharr obsidian weapon“ (`Zharr-Obsidianwaffe`), wie mordheimer.net es empfiehlt; ältere Speicherstände werden beim Laden umbenannt (`RENAMED`). Ebenso die alte Zeile „Ithilmar-Waffe“ der Shadow Warriors → Ithilmar-Schwert. Tests dito |
| Auf dem Handy (360 px) ließ sich die Seite um 180 px seitlich schieben | Das Anwerbe-Menü, Profiltabellen, die Gefallenen und die Zauberliste waren breiter als der Bildschirm; die Spalte wuchs mit | `index.html`: Spalte darf schrumpfen, Anwerbe-Zeilen und Tabellen umbrechen unter 560 px. Test `app/e2e/legacy.spec.ts` mit den echten Warbands |
| Hinweise („Saved.“, „Imported.“) fingen 2,6 Sekunden lang jeden Tipp in der Bildschirmmitte unten ab | Knöpfe darunter reagierten nicht | `js/app.js` `flash`: `pointer-events:none`. Tests `test/ui-bugs.mjs`, `app/e2e/legacy.spec.ts` |
| Tooltips wurden über den bloßen Namen gesucht, der erste Treffer gewann | Skills und Regeln gleichen Namens zeigten den Text einer anderen Warband („Infiltration“, „Bellowing Roar“, „Animosity“) oder eines Gegenstands („Swashbuckler“ → Buckler); Chips für Regeln, die eine Einheit nur erwähnt oder von denen sie befreit ist; dasselbe in TTS-Karten und PDF | Chips tragen einen Schlüssel (`abil|…`, `skill|…`): eigene Definition der Einheit oder Warband zuerst, dann ein Skill ihrer Listen, dann der allgemeine Eintrag; Regeln einzelner Einheiten nur mit Definition oder Freigabe (`own`, `wb` in `data/abilities.json`); „immune to“, „never has to“, „no … test“ verneinen. `js/info.js`, `js/app.js`, `core/src/rules/abilities.ts`, Tests `test/ability-context.mjs`, `core/test/abilities.test.ts` ([Abgleich](rules-audit.md#a-fehler-im-werkzeug-beide-apps)) |

## Erledigt: bewusst anders in `core/`

| Verhalten | Alte App | `core/` | Grund |
| --- | --- | --- | --- |
| Krieger-`uid` nach Entfernen | nie wiederverwendet, aber nur im laufenden Browser | nie wiederverwendet, Zähler `uidSeq` steht im Stand | Versionen und Vergleiche hängen an der `uid` |
| Chronik-IDs | Zähler im laufenden Browser; nach dem Laden ab der höchsten ID in Log und Schlachten | Zähler `campaign.logSeq` im Stand; ohne ihn ab der höchsten ID in Log, Schlachten, Verlusten und Erfahrungseinträgen | wie oben; ein alter Stand konnte sonst die ID eines Verlusts ein zweites Mal vergeben |
| Kanonische Form (Hausregel-Vorgaben, Kampagnenlisten, gültige Persona) | entstand nebenbei beim Zeichnen | `normalizeState` beim Laden; Persona auch bei Subtyp- und Optionswechsel | Verhalten darf nicht davon abhängen, was gerade angezeigt wird |
| Offene/zugeklappte Bereiche (`_…Open`) | im Speicherstand | nicht Teil des Stands | Bildschirmzustand gehört nicht in die Historie |
| Ungültige Eingabe (unbekannte Warband/Einheit) | Fehler (Absturz) | neutraler Wert (0, leere Liste) | robust gegen alte oder beschädigte Stände |
| Abgelehnte Aktion (z. B. Heldenlimit erreicht) | Hinweisfenster | derselbe Stand zurück; die Oberfläche erklärt | keine Dialoge in der Logik |
| Datum eines Stufen-Snapshots, eines Imports in die Kampagnendatei und im Dateinamen eines Exports | Uhr des Browsers | Argument `today` | `core/` liest keine Uhr (Invariante) |
| Laden eines Stands | übernimmt nur die bekannten Schlüssel oben im Stand | behält zusätzlich `uidSeq`, `canon`, `story`; meldet Abweichungen vom Schema als Hinweise | Zähler und Erzählung dürfen beim Laden nicht verloren gehen |
| Schreiben eines Stands | Stand und `goldNow` | zusätzlich `format` (1) und `appVersion` | Migrationen brauchen die Formatnummer |
| Exporte (Text, PDF) | Datei wird direkt heruntergeladen; Name aus dem Eingabefeld „Speichern unter“ | Funktionen geben Text bzw. Bytes und Dateinamen zurück; der Name kommt als Argument | keine Dateien und kein DOM in der Logik |
| Offene Kampagnendatei | Modulvariable im Browser | ein Wert, den die Oberfläche hält und an die Funktionen übergibt | keine globalen Zustände |
| Halb ausgefüllte Formulare (Schlacht, Verlust, Notiz) | im Speicherstand (`campaign._draft`, `_cas`, `_note`); ein Import von Kampagnendaten verwarf sie nebenbei | eigene Werte der Oberfläche, nicht Teil des Stands | Bildschirmzustand gehört nicht in die Historie |
| Rückfragen im Ablauf (Robbed anwenden? Grubenkampf gewonnen? Gefangener kommt zurück, Lösegeld? D3 für Deep Wound? Löschen bestätigen?) | Dialog mitten in der Aktion | Antwort ist ein Argument (`InjuryChoices`); die Oberfläche fragt vorher | wie oben; Vorgaben = was die alte App ohne Dialog tat |

## Geplant

Hier kommen Robs Wünsche für den neuen Builder hinein, dazu Ungereimtheiten,
die beim Portieren auffallen. Vorschläge sind erst nach Robs Entscheidung
geplant.

| Nr. | Was | Warum / Quelle | Entscheidung | Status |
| --- | --- | --- | --- | --- |
| V1 | Ein Verlust, der über die Verlustliste gewürfelt wird, soll dieselben Folgen haben wie das Ergebnis über „+ Injury“ an der Einheitenkarte | Heute weichen fünf Ergebnisse ab: **35 Deep Wound** wird als bleibende Verletzung eingetragen, ohne verpasste Spiele; **36 Robbed** ohne Verlust der Ausrüstung; **61 Captured** und **65 Sold to the Pits** ohne Rückfrage (kein Lösegeld, kein Grubenkampf); **66 Survives Against the Odds** ohne +1 Erfahrung. Umgekehrt schließt „+ Injury“ bei diesen fünf Ergebnissen (außer einem Gefangenen, der nicht zurückkommt) einen offenen Verlusteintrag nicht ab. Der Code behauptet, beide Wege seien gleich. | Rob, 28.09.2026: angleichen, **nur im neuen Builder**; Folgeentscheidungen aus der Verletzungstabelle ableiten, Spielinhalte von mordheimer.net | geplant, Spezifikation [unten](#v1--ablauf-einer-verletzung) |
| V2 | Gefallene über eine feste ID statt über ihre Position ansprechen | Ein Verlusteintrag verweist mit `fallenId` auf die Position in `fallen`. Wird ein Gefallenen-Eintrag gelöscht, zeigen spätere Verlusteinträge auf den falschen Krieger. | Rob, 28.09.2026: ja, **im neuen Builder** | geplant, Spezifikation [unten](#v2--feste-ids-für-gefallene) |
| V3 | Augur und „Blinded in one eye“ | Toumas: nach Regeltext (RAW) wirkt das Ergebnis auch beim Augur; beabsichtigt (RAI) war, dass Augurs Augenverletzungen ignorieren. mordheimer.net nennt keine solche Ausnahme – weder beim Augur (*Sisters of Sigmar*) noch bei Ergebnis 31 (*Campaigns – Serious Injuries*). | Rob, 28.09.2026: Eine Auslegung nach Absicht gilt nur, wenn mordheimer.net sie übernimmt. Hier nicht, also **RAW**: Der Augur verliert 1 BS wie jeder andere. | entschieden; alte App und `core/` rechnen schon so, Test `core/test/rulings.test.ts` |
| V4 | Ausrüstung zwischen Kriegern verschieben, besonders seltene Gegenstände | Heute nur über Abwählen (voller Preis zurück) und neu Anwählen (voller Preis weg); ein seltener Gegenstand verliert dabei seinen bezahlten Preis. RAW erlaubt es ausdrücklich: Post-Battle-Stufe 9 „Reallocate equipment“ (UFAQ-Errata zu S. 117), Regelbuch S. 79 und mordheimer.net *Trading* („hoarded … or redistributed“). | Rob, 28.09.2026: gewünscht, mindestens für Helden | entschieden, [unten](#entscheidungen-rob-29092026) |
| V5 | Startausrüstung nach dem ersten Kampf sperren; danach nur über den Trading Post | Heute lässt die Liste der Einheit jederzeit jeden Gegenstand zum Listenpreis an- und abwählen, auch seltene. RAW (Regelbuch S. 46, 79, 104–105; mordheimer.net *Trading*): nach dem ersten Spiel Seltenes nur mit Suchwurf eines Helden, neue Rekruten nur Gewöhnliches, Verkauf zum halben Preis. | Rob, 28./29.09.2026: gewünscht; Sperre für die ganze Warband | entschieden; Gründungspreise schon in beiden Apps (oben, „Erledigt“), der Rest im neuen Builder |
| V6 | Kaufansicht übersichtlich, Tooltips und Erklärungen überall, wo es ohne Zusammenhang unklar ist | Rob, 28.09.2026 | gewünscht; Händler in Pixelart als Idee (Rob, 29.09.2026) | Mockup folgt |
| V7 | Gold als Kassenbuch statt „Schatz minus Wert“ | Heute ist Gold in der Hand = gespeicherter Schatz − heutiger Wert aller Krieger. Daraus folgen die Fehler aus V4/V5 (Abwählen erstattet, Lager kostet nichts und beim Ausrüsten noch einmal) und Sprünge, wenn sich Preise oder Hausregeln ändern. | Rob, 29.09.2026: ja, so ausführlich wie möglich und nötig | entschieden |

**Grundsatz (Rob, 28.09.2026):** Ändert mordheimer.net eine Regel nach ihrer
Absicht (RAI) statt nach dem Wortlaut (RAW), übernehmen wir das – aber nur,
wenn es dort ausdrücklich steht. Eine RAI-Auslegung, die nur in einem FAQ oder
Forum steht, bleibt draußen; wer sie spielen will, bekommt sie höchstens als
Hausregel.

Zur Erklärungspflicht: Erfahrung braucht keine Erklärung (Rob, 28.09.2026) –
in vielen Szenarien bekommt ein Held schon fürs Ausschalten eines Gegners einen
Punkt. `experience` steht deshalb bewusst nicht in `STORY_KINDS`.

### Reihenfolge

V1 und V2 kommen nach Schritt 1d: Solange die Legacy-Tests gegen `core/` laufen
sollen, muss `core/` sich noch wie die alte App verhalten. Danach wird jede
Änderung einzeln eingebaut – Test zuerst, dann `core/`, dazu eine benannte
Ausnahme in den Paritätstests (`walk.ts`, `injuries.parity.test.ts`) und in der
Liste der Legacy-Tests, die bewusst anders ausgehen.

## V1 – Ablauf einer Verletzung

Quellen, in der Rangfolge aus `CLAUDE.md`: Ultimate FAQ (UFAQ) 10.2, 10.3,
11.1, 19 und die Errata zu Empire in Flames; FAQ von Tuomas („Augur Blind in
one Eye“, nach V3 ohne Ausnahme für den Augur); mordheimer.net, *Campaigns – Serious Injuries*; Regelbuch S. 80–81
(Tabelle) und S. 107 (Hired Swords); Bezirkseffekte aus der Kampagnenkarte
(`data/campaign.json`). Die Wirkungen der Ergebnisse selbst stehen schon so in
`data/injuries.json`; neu ist, dass beide Eingänge denselben Ablauf nehmen und
die Folgeentscheidungen ausdrücklich abgefragt werden.

### Grundsätze

1. **Ein Ablauf, zwei Eingänge.** Der Wurf in der Verlustliste und „+ Injury“
   an der Einheitenkarte rufen dieselbe Aktion in `core/` auf. Gibt es für den
   Krieger einen offenen Verlusteintrag, schließt jeder Eingang ihn ab;
   „+ Injury“ ohne Verlusteintrag bleibt möglich (Nachtrag von Hand).
2. **Folgeentscheidungen sind Argumente.** Jeder Nachwurf und jede Wahl steht
   in der Tabelle unten; die Oberfläche fragt sie ab, bevor sie die Aktion
   ruft, und bietet wahlweise „würfeln“ (Zufall aus der Oberfläche, `core/`
   würfelt nie) oder „Ergebnis eintragen“.
3. **Alles landet im Verlusteintrag.** Ergebnis, Nachwürfe und Teilergebnisse
   (Multiple Injuries, Grubenkampf) stehen im Eintrag, damit Chronik, Briefing
   und Änderungsabgleich sie als Beleg finden.
4. **Bleibendes und Vorübergehendes getrennt.** Bleibende Folgen kommen in
   `inj` (Profil, Fähigkeiten, Karte, Exporte); verpasste Spiele in `miss`
   mit Grund; Einmaliges (Gold, Erfahrung, verlorene Ausrüstung) als Ereignis
   in der Chronik.
5. **Wer würfelt:** Nur wer am Ende der Schlacht außer Gefecht ist. Geflohene
   würfeln nicht (UFAQ 10.2). Henchmen, Hired Swords (S. 107) und der
   Leibwächter des Merchant (UFAQ 19) würfeln W6: 1–2 tot, 3–6 in Ordnung.
6. **Erfahrung fürs Überleben** bekommt auch, wer verwundet überlebt
   (UFAQ 11.1, 10.3); das regelt weiter `awardBattleXp`, der
   Verletzungsablauf ändert daran nichts.
7. **Bezirke** wirken nur, wenn die Warband des Verwundeten den Bezirk in der
   verlangten Stufe hält (Foothold oder Kontrolle, wie in den Daten).

### Heroes' Serious Injuries (D66)

| Ergebnis | Folgeentscheidung | Wirkung | Heute abweichend |
| --- | --- | --- | --- |
| 11–15 Dead | Temple of Morr (Foothold): W6, bei 5+ stattdessen 41–55 | Krieger fällt, alle Ausrüstung verloren (UFAQ 10.2) | Bezirk wird nicht angeboten |
| 16–21 Multiple Injuries | W6 = Anzahl weiterer Ergebnisse; jedes davon mit eigenem Ablauf; Dead, Captured und Multiple Injuries werden neu gewürfelt, sind also nicht wählbar | Summe der Teilergebnisse; der Eintrag listet sie | heute nur Hinweistext |
| 22 Leg Wound | Temple of Sigmar (Foothold, gilt für 22–35): W6, bei 5+ 41–55. Pirat mit Peg Leg: W6, bei 4+ ignoriert | M −1 | Bezirk, Peg Leg fehlen |
| 23 Arm Wound | W6: 1 = Arm amputiert, 2–6 = verpasst das nächste Spiel | 1: bleibend „nur eine einhändige Waffe“; 2–6: `miss` +1 | heute zwei getrennte Einträge 23a/23b statt Nachwurf |
| 24 Madness | W6: 1–3 Stupidity, 4–6 Frenzy | bleibend, als Fähigkeit sichtbar | wie 23 |
| 25 Smashed Leg | W6: 1 = kann nicht mehr rennen (aber angreifen), 2–6 = verpasst das nächste Spiel; Peg Leg wie bei 22 | wie 23 | wie 23 |
| 26 Chest Wound | – | T −1 | – |
| 31 Blinded in one eye | Hat er schon 31: muss die Warband verlassen (siehe Vorschläge) | BS −1 | zweites Auge nicht erkannt |
| 32 Old Battle Wound | – | bleibend; vor jeder Schlacht W6, bei 1 kämpft er nicht (Erinnerung im Spielabend-Modus) | – |
| 33 Nervous Condition | – | I −1 | – |
| 34 Hand Injury | – | WS −1 | – |
| 35 Deep Wound | W3 | verpasst so viele Spiele (`miss`), kein bleibender Eintrag | über die Verlustliste heute bleibend und ohne `miss` |
| 36 Robbed | – | alle Waffen, Rüstung und Ausrüstung verloren, ohne Erstattung | über die Verlustliste heute ohne Verlust; über „+ Injury“ nur nach Rückfrage |
| 41–55 Full Recovery | – | nichts | – |
| 56 Bitter Enmity | W6: 1–3 der Verursacher (war es ein Henchman: dessen Anführer), 4 Anführer seiner Warband, 5 seine ganze Warband, 6 alle Warbands dieser Art | bleibend „Hatred“ mit Ziel; das Ziel kommt aus dem Verlusteintrag (Angreifer) | Ziel wird nicht festgehalten |
| 61 Captured | The Gaol (Kontrolle): wird 41–55. Sonst: ausgetauscht / freigekauft (Preis) / an Sklavenhändler verkauft / von Untoten getötet (wird Zombie) / von Besessenen geopfert | Austausch oder Lösegeld: kommt mit aller Ausrüstung zurück, Lösegeld aus der Truhe. Sonst verloren, Ausrüstung bleibt beim Fänger | über die Verlustliste heute ohne Rückfrage; Bezirk fehlt |
| 62–63 Hardened | – | bleibend: immun gegen Angst | – |
| 64 Horrible Scars | – | bleibend: verursacht Angst | – |
| 65 Sold to the Pits | Amphitheatre (Foothold): gewonnen. Sonst: gewonnen oder verloren; verloren → D66 nur 11–35, mit eigenem Ablauf | gewonnen: +50 gc, +2 Erfahrung, behält alles. Verloren und nicht tot: verliert Waffen und Rüstung | über die Verlustliste heute ohne Rückfrage; Nachwurf nur als Hinweis |
| 66 Survives Against the Odds | – | +1 Erfahrung | über die Verlustliste heute ohne Erfahrung |

Neue Erfahrung aus 65 und 66 erscheint im Änderungsabgleich als `experience`
mit dem Verlusteintrag als Beleg.

### Die Gegenseite: wenn wir einen Helden gefangen nehmen

Ist das Opfer eines Verlusteintrags nicht unser Krieger und lautet das
Ergebnis 61, fragt der Ablauf, was unsere Warband mit dem Gefangenen tut
(Regeltext 61, UFAQ-Errata Empire in Flames „Tainted“):

| Wahl | Wirkung bei uns |
| --- | --- |
| an Sklavenhändler verkaufen | +W6×5 gc in die Truhe; seine Ausrüstung kommt in die Truhe |
| Lösegeld | vereinbarter Betrag in die Truhe |
| Austausch | gegen einen unserer Gefangenen (schließt dessen Eintrag) |
| töten, neuer Zombie (nur Untote) | ein Zombie mehr im Roster; Ausrüstung in die Truhe |
| opfern (nur Possessed und Carnival of Chaos) | unser Anführer +1 Erfahrung; Ausrüstung in die Truhe |

Der Gefangene zählt nicht als unser Krieger: Er erhöht weder Rating noch
Warbandgröße.

### Vorschläge, die über den Regeltext hinausgehen – Rob entscheidet

- **Gefangen als Zustand.** Die Regel kennt Gefangene, die gehalten und später
  getauscht werden. Vorschlag: Ein Gefangener bleibt im Roster, markiert als
  „gefangen von …“, kämpft nicht und zählt wie ein Krieger, der ein Spiel
  aussetzt (UFAQ 19: zählt fürs Rating, nicht für den Rout-Test), bis Austausch,
  Lösegeld oder Verlust eingetragen sind. Die alte App kennt nur „kommt zurück“
  oder „verloren“.
- **Zweites Auge.** „Must retire from the warband“ sagt nichts über die
  Ausrüstung. Vorschlag nach Tuomas (Entlassen im Post-Battle: vorher darf
  die Ausrüstung in die Truhe): Er verlässt die Warband, seine Ausrüstung geht
  in die Truhe; in `fallen` als „ausgeschieden“, nicht als „gefallen“.
- **Robbed nicht als bleibende Verletzung.** Die alte App führt Robbed in
  `inj`; es hat aber keine dauerhafte Wirkung. Vorschlag: nur Ereignis in der
  Chronik.
- **Man-catcher** (Border Town Burning, 1c): Wer damit außer Gefecht geht,
  würfelt nicht, sondern ist gefangen, sofern der Gegner eine Engine of Chaos
  hat. Vorschlag: als Wahl „gefangen durch Man-catcher“ im Verlustformular,
  sobald jemand diese Warband spielt.

## V2 – Feste IDs für Gefallene

- Jeder Eintrag in `fallen` bekommt eine `id` aus derselben Folge wie Chronik,
  Schlachten, Verluste und Erfahrung (`campaign.logSeq`).
- Ein Verlusteintrag verweist mit einem neuen Schlüssel `fallenRef` auf diese
  `id`. `fallenId` (Position) bleibt erhalten und wird beim Schreiben aus
  `fallenRef` berechnet, damit die alte App solche Stände weiter richtig liest
  (kein Schlüssel wird umbenannt oder entfernt, `test/compat.mjs`).
- Migration auf `FORMAT` 2: vorhandene Gefallene bekommen IDs in ihrer
  Reihenfolge, Verlusteinträge ihr `fallenRef` aus der bisherigen Position.
- Test zuerst: Gefallenen-Eintrag löschen, danach zeigt ein späterer
  Verlusteintrag weiter auf den richtigen Krieger.

## V4 bis V7 – Handel, Lager und Gold

Quellen: Regelbuch S. 46 („Note that you may buy rare weapons and armour when
starting a warband … after playing the first game the only way to get
further rare weapons and armour is to roll“), S. 79 („Warriors can also swap
equipment between themselves … hoarded and re-used“; „When a warrior is
killed … all his weapons and equipment are lost“), S. 104–105 (Trading,
Availability, Selling), die offizielle Errata zur Post-Battle-Sequenz in der
Ultimate FAQ 10.1 (Stufen 6, 8 und 9) und mordheimer.net *Campaigns* und
*Trading*. Robs Wünsche sind damit genau der Regeltext.

### Was die Regeln sagen

1. **Beim Aufstellen** kauft jede Einheit aus ihrer Liste, seltene
   Gegenstände der Liste eingeschlossen, zum Listenpreis.
2. **Nach dem ersten Spiel**
   - gibt es **Gewöhnliches** jederzeit zum festen Preis;
   - **Seltenes** nur, wenn ein Held sucht: 2W6 ≥ Seltenheit, ein Wurf je
     Held, nicht wer im letzten Spiel außer Gefecht ging; Preis mit
     Zufallsanteil. Gekauftes Seltenes geht **ins Lager** (Stufe 6);
   - **neue Rekruten** bekommen ihren Dolch und Gewöhnliches aus ihrer Liste,
     Seltenes nur aus dem Lager (Stufe 8/9).
3. **Umverteilen** (Stufe 9): Gegenstände wandern zwischen Kriegern und dem
   Lager, wenn der Empfänger sie benutzen darf (Waffen und Rüstung aus seiner
   Liste; Sonderausrüstung nur für Helden, außer der Gegenstand erlaubt es
   Henchmen). Eine Henchmen-Gruppe ist immer gleich ausgerüstet – ein
   Gegenstand für die Gruppe braucht so viele Stücke, wie sie Mitglieder hat.
   Hired Swords bekommen keine Ausrüstung und geben keine ab.
4. **Verkaufen** bringt den halben Listenpreis, bei Seltenem mit
   Zufallspreis die Hälfte des Grundpreises. Merchant Caravans verkaufen
   zusätzlich über „Trade“ (W6-Tabelle).
5. **Tod**: Die Ausrüstung ist verloren; umverteilen geht nicht mehr.
   **Entlassen** darf man jederzeit, die Ausrüstung vorher ins Lager
   (Tuomas, „Dismiss Hero Equipment“).

### Vorschlag für den neuen Builder

- **Aufstellen** bis zum ersten Kampf der Warband wie heute: Liste an- und
  abwählen, voller Preis hin und zurück.
- **Danach** ist die Ausrüstung eines Kriegers gesperrt. Änderungen gehen
  über drei Wege, jeder mit Erklärung:
  - **Trading Post:** Gewöhnliches kaufen; Seltenes nach einem Suchwurf eines
    Helden (der Wurf wird mit Modifikatoren angezeigt: Marienburg, Bedouin,
    Reputation des Handelswagens …), Preis eingeben. Gekauftes landet im
    Lager oder direkt beim Krieger, wenn er es benutzen darf.
  - **Umverteilen (V4):** ziehen oder „Geben an …“ zwischen Kriegern und dem
    Lager, ohne Gold; der bezahlte Preis wandert mit. Die Auswahl zeigt nur,
    wer den Gegenstand benutzen darf, und nennt den Grund, wenn nicht.
  - **Verkaufen:** halber Preis vorgeschlagen, änderbar (Haggle, Trade).
- **Neue Rekruten** bekommen beim Anwerben nur gewöhnliche Gegenstände ihrer
  Liste angeboten; Seltenes aus dem Lager danach über Umverteilen.
- **Kaufansicht (V6):** nach Kategorie, mit Seltenheit, Preis nach
  Hausregeln, wer es benutzen darf, Tooltip mit Regeltext an jedem Eintrag;
  unklare Felder mit einer Erklärung in einem Satz.
- **Gold (V7):** Gold in der Hand wird gespeichert und nur durch Buchungen
  geändert (Kauf, Verkauf, Einkommen, Lösegeld, Unterhalt …), jede mit
  Anlass. Das Lager hält Gegenstände mit ihrem bezahlten Preis. Das macht
  Umverteilen goldneutral und liefert der Änderungsansicht ihre Anlässe. Im
  Speicherformat als `FORMAT` 3: `goldNow` bleibt, neu ist ein Kassenbuch
  und das Lager mit Wert; Migration aus dem heutigen Stand.

### Entscheidungen (Rob, 29.09.2026)

1. **Sperre für die ganze Warband** ab ihrer ersten Schlacht. Nach RAW gilt
   sie je Krieger nach seinem ersten Kampf; für die ganze Warband ist es
   einfacher bei gleichem Ergebnis. Neue Krieger bekommen danach nur
   Gewöhnliches aus ihrer Liste, zu den Preisen des Trading Post.
2. **Laufende Kampagne:** Alle heutigen Krieger gelten als „hat gekämpft“,
   außer sie sind als aussetzend markiert. Gelesen als: Wer bisher nur
   ausgesetzt hat und nie gekämpft hat, zählt als neu. Die echten Stände der
   Gruppe haben den Kampagnenmodus aus und stehen auf „Setup“ – beim Import
   einer laufenden Kampagne fragt der neue Builder deshalb, ab welcher Stufe
   sie steht, statt es aus den Schlachten abzuleiten.
3. **Verkauf zum halben Preis,** gerechnet vom Preis, der gerade gilt – also
   auch die Hälfte eines Preises, den eine Hausregel ändert; bei Seltenem mit
   Zufallspreis die Hälfte des Grundpreises. Regeln, die den Verkauf ändern
   (Haggle, „Trade“ der Merchant Caravans), rechnet der Builder eigens.
4. **Kassenbuch (V7):** ja, so ausführlich wie möglich und nötig – jede
   Buchung mit Anlass, Betrag, Krieger und Gegenstand, damit die
   Änderungsansicht und die Chronik daraus lesen können.

**Schon umgesetzt, in beiden Apps:** die Gründungspreise (Tabelle
„Erledigt“ oben). Die Stufe der Kampagne entscheidet: bis „Setup“ gilt der
Gründungspreis, ab „After battle 1“ ist die Zeile gesperrt und der
Gegenstand am Trading Post zu finden. Außerhalb des Kampagnenmodus bleibt
alles beim Gründungspreis.

