# Arbeitsplan Nachspiel (Post-Battle)

Stand: 13. November 2026. Wunsch von Rob (13.11.2026): die Nachspiel-Seite der
Kampagne so aufarbeiten, dass **alles richtig eingetragen, ausgewürfelt und
verarbeitet** wird, mit **sauberen Tabellen und Übersichten** – orientiert an
<https://mordheimer.net/docs/tools#post-battle>. Anlass war die Statistik
(`docs/plan-2026-11.md`, P14): Einnahmen lassen sich nur dann fein aufteilen
(Gold, Wyrdstone, Wert gefundener Gegenstände, Sold …), wenn das Nachspiel
festhält, **woher** etwas kommt.

**So wird der Plan benutzt:** Rob nennt die Pakete (`N1`, `N4` …), eine
Sitzung macht **ein** Paket. Je Paket ein Branch von `origin/master`, ein Pull
Request, `CLAUDE.md` gilt in voller Länge (Test zuerst, Commit als Rob,
Changelog-Datei bei sichtbaren Änderungen, `npm run check`, bei
App-Änderungen Build, Größe und e2e mit angesehenen Screenshots). Ist ein Paket
erledigt, wird es hier abgehakt – im selben Pull Request. Pakete mit **„Rob
entscheidet“** beginnen mit der Frage an Rob, nicht mit Code.

## 1. Wo wir stehen

Die Seite ist `app/src/aftermath/Aftermath.tsx` (Route
`/warbands/:id/aftermath/:bid`), ihr Modell `app/src/aftermath/view.ts`, die
Regeln `core/src/campaign/postbattle.ts`. Sie führt durch die zehn Schritte
der Regeln, ist aber zum größten Teil eine **Checkliste mit Verweisen**:

| Schritt (mordheimer, Tools) | Heute | Lücke |
| --- | --- | --- |
| 1 Injuries | Wurf je Ausfall im `InjurySheet` (D66 mit Folgewürfen, D6 je Mann) | keine Übersicht der Ergebnisse; Tabelle nur über den Link |
| 2 Allocate experience | ein Knopf: +1 überlebt, +1 Anführer des Siegers; Ausschalter aus dem Protokoll werden gehalten | Underdog-Bonus fehlt; Szenario-Erfahrung nur „auf dem Roster nachtragen“; keine Tabelle je Krieger; Steigerung nur über den Roster |
| 3 Exploration | Text „würfle N Würfel“ und ein ±-Zähler für Wyrdstone | Würfel werden nicht eingetragen; Summe → Splitter, Pasche → Ort rechnet niemand; die 30 Orte gibt es nur als Text in `data/postbattle.json`; Zusatzwürfel, Wiederholungen und ±1 fehlen |
| 4 Sell Wyrdstone | Verkauf mit Preis aus der Tabelle, einmal je Nachspiel, rücknehmbar | die Preistabelle selbst ist nicht zu sehen; die Einnahme steht nicht im Hauptbuch (`ledger`) |
| – Sold der Hired Swords | – | fehlt ganz (Regel: nach jeder Schlacht, die er mitkämpft) |
| 5 Check available veterans | Verweis „Hire“ | der 2D6-Wurf wird auf dem Roster eingetragen (`setVeteransRoll`), nicht hier; keine Übersicht des Pools |
| 6 Rarity rolls | Verweis „Trading Post“ | keine Übersicht, welcher Held schon gesucht hat |
| 7 Dramatis Personae | Verweis „Hire“ | – |
| 8 Recruits & common items | Verweise | keine Übersicht, was in dieser Runde gekauft und angeheuert wurde |
| 9 Reallocate equipment | Verweis | – |
| 10 Warband rating | eine Zahl | keine Bilanz der Runde |

Schon vorhanden und weiterzuverwenden:

- `data/postbattle.json`: `PB_HENCH_INJURY`, `PB_XP_AWARDS`, `PB_HERO_ADVANCE`,
  `PB_HENCH_ADVANCE`, `PB_ADVANCE_NOTES`, `PB_EXPLORE_SHARDS`, `PB_LOCATIONS`
  (30 Orte als Kurztext). **Die alte App liest diese Datei** – vorhandene
  Schlüssel behalten Form und Inhalt, Neues kommt unter neuen Schlüsseln dazu.
- Core: `pbExploreDice`, `pbSearchingHeroes`, `pbHeroesOOA`, `wyrdPrice`,
  `WYRD_PRICE`, `WYRD_BANDS`, `sellWyrdstone`, `awardBattleXp`, `grantXp`,
  `applyBattleResults`, `setVeteransRoll`/`veteransOf` (`warband/veterans.ts`),
  `recordSearch`/`searchOdds`/`searchBlock` (`trade/market.ts`), `bookGold`
  (`trade/ledger.ts`), `hsUpkeepFor`/`hsUpkeepTotal`/`dpUpkeepTotal`
  (`rules/hire.ts`), `injure` (`warband/injury.ts`).
- App: `InjurySheet`, `AdvanceSheet`, Trading Post mit Suche, Hire-Seite;
  das Muster „eintragen **oder** würfeln“ aus `DicePaid`
  (`app/src/roster/EquipmentSheet.tsx`) und `randomD66` (`app/src/roster/injury.ts`).
- Server: je Teilnehmer `beforeTotals` (Rating, Gold, Modelle vor der Schlacht,
  Migration 25) – daraus folgt der Underdog-Bonus.

## 2. Grundsätze

1. **Eintragen oder würfeln, immer beides.** Am Tisch wird meist echt
   gewürfelt („any dice rolls must be seen by both players“). Jedes Feld nimmt
   den Wurf als Zahl (nur im erlaubten Bereich) und hat daneben „Roll“. Gewürfelt
   wird in der Oberfläche; `core/` bekommt Zahlen (kein `Math.random()` in core).
   Im Protokoll steht, ob ein Wurf eingetragen oder in der App gewürfelt wurde.
2. **Jeder Schritt hält fest, was er gebracht hat** – in
   `campaign.postbattle[round]` – und jede Bewegung von Gold, Wyrdstone,
   Gegenständen und Erfahrung trägt ihre **Herkunft** (`source`). Daraus
   entstehen die Übersichten hier und die Statistik (P14).
3. **Regelquelle** wie in `CLAUDE.md`: Ultimate FAQ und FAQ von Toumas, dann
   mordheimer.net (Tabellenwerte samt Anmerkungen vor Fließtext), dann das
   Regelbuch. mordheimer.net **immer mit `curl`** lesen. Jede Zahl, die neu in
   `data/` kommt, steht mit Quelle im Commit; Regelfragen entscheidet Rob.
4. **Die alte App ist eingefroren.** Neue Core-Aktionen haben kein Gegenstück:
   sie kommen in `ACTIONS`, in den Walk und in „roster actions without a legacy
   counterpart“ (`core/test/parity/walk-coverage.test.ts`). Portierte Funktionen
   (`sellWyrdstone`, `setPostBattleStep` …) ändern ihr Verhalten für gültige
   Eingaben nicht; wo doch, mit Eintrag in `docs/behaviour-changes.md` und
   benannter Paritätsausnahme.
5. **Speicherformat:** nur neue, optionale Schlüssel mit Default
   (`core/src/format/save.ts`, `schema.ts`), nie umbenennen oder entfernen
   (`test/compat.mjs`); `docs/data-model.md` im selben Commit. `FORMAT` bleibt.
   Alte Nachspiele (nur `done` und `wyrd`) bleiben lesbar und werden **nicht**
   nachgerechnet.
6. **Alles rücknehmbar**, wie heute der Wyrdstone-Verkauf: jede Aktion eines
   Schritts hat ihr Gegenstück, das Gold, Stash und Erfahrung wiederherstellt.
7. **Tabellen sind Daten**, keine Texte im Code: eine Komponente zeigt sie,
   die Seite und die Regelübersicht benutzen dieselbe.
8. **Mechanik ist offen** (ADR 0002): die Bilanz eines Nachspiels dürfen alle
   Mitglieder der Kampagne lesen; gefiltert wird nur auf dem Server.

## 3. Übersicht

| Nr. | Paket | Größe | Braucht | Rob entscheidet |
| --- | --- | --- | --- | --- |
| N0 | ADR und Datenmodell „Nachspiel als Protokoll“ | klein | – | ja (Fragen in Abschnitt 5) |
| N1 | Tabellen: Daten, Komponente, Regelübersicht | mittel | – | – |
| N2 | Rahmen der Seite: Fortschritt, Ergebnis je Schritt | mittel | N0 | – |
| N3 | Schritt 1 Verletzungen: Übersicht | klein | N1, N2 | – |
| N4 | Schritt 2 Erfahrung: Tabelle je Krieger, Underdog, Szenario | mittel | N0–N2 | – (entschieden) |
| N5 | Schritt 3 Erkundung: Würfel, Splitter, Ort erkennen | mittel | N0–N2 | – |
| N6 | Erkundung: Zusatzwürfel, Wiederholungen, ±1 | mittel | N5 | offene Frage 2 |
| N7 | Erkundung: die 30 Orte als Daten und Rechner | groß | N5 | Liste der „dämonenartigen“ Warbands |
| N8 | Erkundung: Orte in der Oberfläche, Funde verbuchen | groß | N7 | – |
| N9 | Schritt 4 Wyrdstone: Preistabelle, Sonderregeln, Hauptbuch | mittel | N0–N2 | offene Frage 3 |
| N10 | Sold der Hired Swords | mittel | N0–N2 | offene Frage 1 |
| N11 | Schritt 5 Veteranen im Schritt | klein | N2 | – |
| N12 | Schritte 6–9: Übersichten und Rückweg | mittel | N2 | – |
| N13 | Schritt 10: Bilanz der Runde, für alle lesbar | mittel | N4–N10 | – |
| N14 | Anschluss an die Statistik (P14) | klein | N13, P14 Stufe 1 | – |
| N15 | *Idee, nicht eingeplant:* Würfe aus Tabletop Simulator (Abschnitt 6) | groß | N5, eigenes ADR | ja |

Empfohlene Reihenfolge: N0 → N1 → N2, danach in beliebiger Folge N3, N4, N5,
N9, N10, N11, N12; N6–N8 nach N5; N13 und N14 zuletzt.

## 4. Die Pakete

### N0 – ADR und Datenmodell „Nachspiel als Protokoll“

- [ ] erledigt

**Ziel:** festlegen, *was* das Nachspiel speichert, bevor ein Schritt gebaut
wird. Bisher gilt (Kommentar in `postbattle.ts`): „A guided checklist, not a
dice roller“. Das ändert sich – eine Grundsatzänderung, also ein ADR.

**Umsetzung:**

1. Rob die Fragen aus Abschnitt 5 stellen; die Antworten in das ADR.
2. `docs/decisions/0032-post-battle-as-record.md` (deutsch): die Grundsätze 1,
   2, 5 und 6 von oben, die verworfene Alternative (alles aus dem Vergleich
   zweier Versionen ableiten – verliert die Herkunft).
3. Typen und Schema, **ohne Verhalten**: in `core/src/campaign/postbattle.ts`
   `PostBattleState` erweitern (alle Felder optional):

   ```ts
   interface Rolled { value: number[]; by: 'entered' | 'app' }
   interface Find {                       // was ein Schritt gebracht hat
     id: number;
     kind: 'gold' | 'wyrd' | 'item' | 'exp' | 'note';
     source: string;                      // 'explore' | 'location:<key>' | 'scenario' | 'wyrdstone' | 'upkeep' …
     amount?: number;                     // gc, Splitter, Erfahrung
     item?: string; qty?: number;         // Stash-Schlüssel wie StashItem.key
     worth?: number;                      // Listenpreis je Stück in gc (für die Statistik)
     uid?: number | string;               // betroffener Krieger
     text: string;
   }
   interface PostBattleState {
     done: Record<string, boolean>; wyrd: WyrdSale | null;
     explore?: { rolled: Rolled; kept: number[]; total: number; shards: number; location: string | null };
     xp?: { underdog: number; scenario: { uid: number | string; amount: number; reason: string }[] };
     upkeep?: { paid: { uid: string; gc: number }[]; dismissed: string[] };
     finds?: Find[];
   }
   ```

   `LedgerEntry` und `StashItem` bekommen ein optionales `source?: string`
   (beide sind im Schema `looseObject` – prüfen und im Schema benennen).
4. `docs/data-model.md` (Abschnitt Post-Battle, Zeile 108 ff.), `docs/glossary.md`
   (Nachspiel ↔ Post-battle/Aftermath ↔ `postbattle`, Fund ↔ Find, Sold ↔ Upkeep).

**Tests:** Schema liest alte und neue Form (`core/test`, ein Save mit und ohne
die neuen Felder; `node test/run.mjs` bleibt grün).

**Abnahme:** ADR vorhanden, Fragen beantwortet, keine sichtbare Änderung.

### N1 – Tabellen: Daten, Komponente, Regelübersicht

- [ ] erledigt

**Ziel:** jede Tabelle des Nachspiels sauber in der App, aus Daten.

**Umsetzung:**

1. Daten abgleichen und ergänzen (`data/postbattle.json`, nur **neue**
   Schlüssel): `PB_UNDERDOG` (0–50 keine, 51–75 +1, 76–100 +2, 101–150 +3,
   151–300 +4, 301+ +5; Quelle `…/docs/campaigns/experience#underdogs`),
   `PB_SEQUENCE` (die zehn Schritte mit einem Satz und Link). Typen in
   `core/src/data/types.ts`. Die Heldentabelle D66 kommt aus `data/injuries.json`.
2. Prüfskript-Test `core/test/postbattle-tables.test.ts`: `WYRD_PRICE`,
   `PB_EXPLORE_SHARDS`, `PB_UNDERDOG`, beide Steigerungstabellen und die 30
   Ortsnamen gegen feste Erwartungen aus mordheimer (Stand 13.11.2026: alle
   Werte der Tools-Seite stimmen mit den heutigen Daten überein).
3. `app/src/ui/RulesTable.tsx` (+ CSS-Modul, Test): Kopfzeile, Zeilen,
   optional eine hervorgehobene Zeile/Spalte (`aria-current`), bei 360 px ohne
   Querscrollen (schmale Tabellen: Wurf | Ergebnis; die Preismatrix kippt auf
   „eigene Spalte + ausklappbar alle“). Keine Inline-Handler, kein
   `dangerouslySetInnerHTML`.
4. `app/src/aftermath/tables.ts`: baut aus `GameData` die Tabellen
   `injuriesHero`, `injuriesHench`, `xpAwards`, `underdog`, `advanceHero`,
   `advanceHench`, `shards`, `wyrdPrices`, `locations` (gruppiert: Doubles,
   Triples, Four/Five/Six of a kind).
5. Regelübersicht `/rules/post-battle` (oder Reiter in der vorhandenen
   Regel-/Bibliotheksseite – nachsehen, wo `rulesref` gezeigt wird): alle
   Tabellen in der Reihenfolge der zehn Schritte, jede mit „Rules ↗“.

**Tests:** Komponente (Hervorhebung, Beschriftung), `tables.ts` gegen die Daten,
e2e-Screenshot der Übersicht bei 360 px und Desktop, beide Themes.

**Abnahme:** jede Tabelle der Tools-Seite ist in der App zu lesen; Changelog.

### N2 – Rahmen der Seite: Fortschritt, Ergebnis je Schritt

- [ ] erledigt

**Ziel:** die Seite zeigt auf einen Blick, wo man steht und was jeder
erledigte Schritt gebracht hat. Heute klappt ein erledigter Schritt zu und
zeigt nichts mehr.

**Umsetzung:**

1. `Aftermath.tsx` aufteilen: `app/src/aftermath/steps/<key>.tsx` je Schritt
   (heute ein `switch` in `StepBody`), `Steps.tsx`, `MarkSection.tsx`.
2. Kopf: Fortschritt „Schritt 3 von 10“ mit den zehn Punkten (antippbar:
   springt zum Schritt, ändert nichts).
3. Jeder Schritt hat drei Teile: **Eingabe**, ausklappbar **Tabelle** (aus N1),
   und – sobald etwas eingetragen ist – eine **Ergebniszeile**, die auch nach
   „Done“ stehen bleibt (`view.ts`: `summary: string | null` je Schritt, z. B.
   „3 Würfe: 1 tot, 1 Leg Wound, 1 Full Recovery“).
4. Erledigte Schritte lassen sich aufklappen und lesen; ändern nur über „Back
   to this step“ (Reihenfolge wie bisher in `setPostBattleStep`).
5. Rückweg: Verweise auf Roster, Hire und Trading Post tragen
   `?from=<battleId>`; diese Seiten zeigen dann „‹ Back to the aftermath“.
6. Desktop: Schritte links, „What changed“ rechts bleibt (`styles.columns`).

**Tests:** `aftermath.test.tsx` anpassen (Fortschritt, Ergebniszeile bleibt),
e2e-Screenshots neu und angesehen; UI-Checkliste aus `CLAUDE.md`.

**Abnahme:** keine Regeländerung; Seite bei 360 px ohne Querscrollen; Changelog.

### N3 – Schritt 1 Verletzungen: Übersicht

- [ ] erledigt

**Regel:** `…/docs/tools#1-injuries`, Einzelheiten `…/docs/campaigns#serious-injuries`.

**Umsetzung:** Tabelle der Ausfälle (eigene): Krieger | Wurf | Ergebnis |
Folge (z. B. „misses next game“, „−1 M“, „dead – 35 gc lost“), offene Zeilen
mit „Roll“ wie heute (öffnet `InjurySheet`). Darunter ausklappbar die
D66-Tabelle (Helden) und D6-Tabelle (Henchmen) aus N1. „Done“ warnt, solange
Würfe offen sind (blockiert nicht). Ergebniszeile für N2. Gegner-Ausfälle
getrennt und gedämpft („Their player rolls for them“).

**Tests:** `view.ts` (Folge-Text je Ergebnisart), Komponente.

**Abnahme:** alle Ergebnisse des Abends in einer Tabelle; Changelog.

### N4 – Schritt 2 Erfahrung: Tabelle je Krieger, Underdog, Szenario

- [ ] erledigt · Underdog entschieden (Abschnitt 5)

**Regel:** `…/docs/tools#2-allocate-experience`, `…/docs/campaigns/experience`
(Underdogs: Bonus **je teilnehmendem Kämpfer** nach Unterschied der Ratings).

**Umsetzung:**

1. Core, neue Abfrage `battleXpPlan(ctx, battleId, opts)` in
   `core/src/warband/xp.ts`: je Held, Gruppe und Hired Sword eine Zeile
   `{ uid, name, survives, leader, kills, underdog, scenario, total, sitsOut, dead }`
   – dieselben Regeln wie `awardBattleXp` (wer aussetzt oder tot ist, bekommt
   nichts); `kills` aus den gehaltenen Einträgen des Protokolls.
2. `underdogBonus(diff)` aus `PB_UNDERDOG`; `awardBattleXp` bekommt
   `opts.underdog` und `opts.scenario` (Liste je `uid` mit Grund) und hält sie
   wie die übrigen Punkte (`grantXpOn`, Grund „underdog (+N)“ / der genannte
   Grund). Ohne die Optionen bleibt alles wie heute (Parität).
3. App: das eigene und die gegnerischen Ratings stehen in `view.participants[].beforeTotals`;
   Vorschlag des Bonus daraus, änderbar (Feld 0–5), mit der Underdog-Tabelle
   daneben (eigene Zeile hervorgehoben). **Regel (Rob, 13.11.2026):** direkter
   Vergleich je Paar; bei mehr als zwei Warbands zählt für jede Warband der
   **größte** Rating-Unterschied zu einer höher bewerteten Gegnerin. Die Tabelle
   zeigt je Gegnerin den Unterschied und den Bonus, der größte ist markiert.
   Fehlt `beforeTotals`: Feld leer, Hinweis.
4. Tabelle: Krieger | Überlebt | Anführer | Ausschalter | Underdog | Szenario
   (Eingabe je Zeile, dazu „for all“) | Summe | Erfahrung vorher → nachher |
   „Advance!“ wo eine Schwelle überschritten wird. Ein Knopf „Grant and write
   onto the roster“ ersetzt die heutigen zwei.
5. Steigerung **hier**: „Roll advance“ öffnet `AdvanceSheet` auf dieser Seite
   (nicht mehr der Umweg über den Roster); darunter ausklappbar beide
   Steigerungstabellen.
6. `postbattle[round].xp` festhalten (Underdog, Szenario-Punkte).

**Tests:** zuerst `core/test/battle-xp.test.ts` (Plan = was `awardBattleXp`
hält; Underdog-Grenzen 50/51, 75/76, 300/301; Aussetzer und Tote); Mirror- und
Walk-Paritäten bleiben grün; Komponententest der Tabelle.

**Abnahme:** nach einem Klick stimmt die Erfahrung jedes Kriegers samt
Underdog und Szenario; Changelog; `docs/ui.md` (Abschnitt bei Zeile 481).

### N5 – Schritt 3 Erkundung: Würfel, Splitter, Ort erkennen

- [ ] erledigt

**Regel:** `…/docs/campaigns/income` (Exploration procedure, Rolling
multiples): ein W6 je Held, der nicht ausgeschaltet wurde, einer mehr bei Sieg,
höchstens **sechs** gewählte Würfel; Summe → Splitter (`PB_EXPLORE_SHARDS`);
Pasche: die **zahlreichste** Gruppe zählt, bei gleich großen die mit der
**höheren** Augenzahl.

**Umsetzung:**

1. Core `core/src/campaign/explore.ts` (rein): `exploreShards(total)`,
   `exploreMultiple(dice)` → `{ count, face, key }` oder `null` (Schlüssel wie
   in `PB_LOCATIONS`: `'5 5 5'`), `exploreResult(kept)` → `{ total, shards, location }`.
2. Aktionen: `recordExploration(ctx, round, { rolled, by, kept })` – prüft
   (jede Zahl 1–6, `kept` ⊆ `rolled`, höchstens 6), schreibt
   `postbattle[round].explore`, legt die Splitter in den Stash und einen `Find`
   (`kind: 'wyrd'`, `source: 'explore'`) an; `clearExploration(ctx, round)` nimmt
   beides zurück (nicht mehr Splitter, als im Stash liegen – dann Meldung).
   Zweimal aufzeichnen ersetzt die erste Aufzeichnung.
3. App: so viele Würfelfelder wie `pbExploreDice().base` (Text wie heute: wer
   sucht, Würfel für den Sieg), jedes 1–6, „Roll all“; bei mehr als sechs
   Würfeln die sechs wählen (Vorschlag: die mit dem besten Ergebnis, änderbar).
   Darunter live: Summe, Splitter (Tabelle mit hervorgehobener Zeile), gefundener
   Ort mit Name und Kurztext aus `PB_LOCATIONS`. Der ±-Zähler bleibt als
   „Correct by hand“ klein darunter.

**Tests:** Core zuerst – das Beispiel der Regelseite (5, 5, 5, 3 → 18 → 4
Splitter, Market Hall), Doppel-1 und Doppel-3 → Doppel-3, Doppel-3 und
Dreier-5 → Dreier-5, sieben Würfel → höchstens sechs; Aktion in Walk und
`ACTIONS`; Komponententest.

**Abnahme:** Würfel rein, Splitter und Ort kommen heraus und liegen im Stash;
rücknehmbar; Changelog.

### N6 – Erkundung: Zusatzwürfel, Wiederholungen, ±1

- [ ] erledigt · **Rob entscheidet** (offene Frage 2)

**Ziel:** was Fertigkeiten, Ausrüstung und Hired Swords an der Erkundung
ändern, steht als Daten da und wird angeboten – nicht erzwungen.

**Umsetzung:**

1. Liste aller Stellen in `data/` erstellen (Suche nach „Exploration“ in
   `skills.json`, `equipment.json`, `hiredswords.json`, `dramatis.json`,
   `warbands/_shared.json` und den Warband-Dateien; am 13.11.2026 u. a.:
   Wyrdstone Hunter, Mordheim-Karte, Elf Ranger, Dwarf Pathfinder, Beggar,
   mehrere Karten und Talismane) und Rob als Tabelle vorlegen: Quelle, Text,
   vorgeschlagene Wirkung.
2. Nach Robs OK: Feld `explore` an den Einträgen
   (`{ dice?: 1, discard?: 1, reroll?: 1, adjust?: 1, needs?: 'notOOA' | 'leadership', once?: true }`),
   über `npm run data` für Warband-Dateien. Abstimmen mit P11 (`effects`) –
   wenn P11 läuft, dort einhängen statt eines eigenen Feldes.
3. Core `exploreAllowances(ctx, round)` → Liste `{ from, name, dice, reroll, adjust, note }`;
   `pbExploreDice` bleibt unverändert (Parität), die Zusatzwürfel kommen dazu.
4. App: unter den Würfeln je Erlaubnis ein Knopf („Re-roll one die –
   Wyrdstone Hunter“, „±1 – Elf Ranger“), der einmal gilt; das Protokoll hält
   fest, was benutzt wurde (`explore.used`).

**Tests:** Daten-Test (jeder Eintrag mit „Exploration“ im Text hat ein
`explore`-Feld oder steht in einer benannten Ausnahmeliste), Core, Komponente.

**Abnahme:** das Beispiel der Regelseite (vier Würfel, eine Wiederholung, ±1
durch den Elf Ranger) lässt sich so nachspielen; Changelog.

### N7 – Erkundung: die 30 Orte als Daten und Rechner

- [ ] erledigt · Warband-Zweige entschieden (Abschnitt 5), Liste der dämonenartigen Warbands vorlegen

**Regel:** `…/docs/campaigns/income#exploration-chart` und die 30 Abschnitte
darunter, dazu `#magical-artefacts-table`. Volltext lesen, nicht die Kurzform.

**Umsetzung:**

1. Neuer Schlüssel `PB_LOCATION_RULES` in `data/postbattle.json`
   (`PB_LOCATIONS` bleibt, die alte App liest es), je Ort:

   ```jsonc
   { "key": "3 3", "name": "Corpse", "anchor": "3-3-corpse",
     "steps": [ { "roll": "D6", "table": [
        { "on": [1, 2], "finds": [ { "kind": "gold", "dice": "D6" } ] },
        { "on": [3],    "finds": [ { "kind": "item", "item": "Dolch" } ] } ] } ] }
   ```

   Bausteine, mehr nicht: `roll` (D3, D6, 2D6, 3D6 … mit `times`/`plus`),
   `table` (Ergebnis → Funde), `each` (Hidden Treasure, Slaughtered Warband:
   je Zeile ein Wurf „4+“), `test` (Toughness/Leadership eines gewählten
   Helden, mit `auto` für Warbands, die automatisch bestehen), `choice`
   (Graveyard, Fighting Arena, The Pit), `warband` (Zweige für Skaven,
   Possessed, Undead, Sisters of Sigmar, Witch Hunters – über Merkmale des
   Warband-Kopfes, nicht über Namen im Code: Undead = `siteRace` „Undead“,
   Skaven = `siteRace` „Skaven“, Possessed = „dämonenartig“, ein neues Merkmal
   `demonic`, das Rob zuerst für Possessed und Carnival bestätigt; alles andere
   „anyone else“), `lasting` (Vorteile, die
   bleiben oder später wirken: Entrance to the Catacombs, Returning a Favour,
   Straggler, Catacombs, Alchemist’s Laboratory, Jewelsmith, Graveyard-Hass).
   Gegenstände mit ihren Schlüsseln aus `equipment.json` (Test: jeder existiert).
2. Core `core/src/campaign/locations.ts` (rein): `locationPlan(ctx, key)` →
   die Fragen in Reihenfolge; `resolveLocation(ctx, key, answers)` →
   `{ finds: Find[], lasting: …, problems: string[] }`. Würfe kommen als
   Antworten herein.
3. Was sich nicht rechnen lässt, wird ein `Find` der Art `note` mit dem
   Regeltext – nie stillschweigend weggelassen.

**Tests:** je Ort mindestens ein Fall (30+), Grenzen der Tabellen, die
Warband-Zweige; Daten-Test (Schlüssel = die 30 aus `PB_LOCATIONS`, jede
Würfelzahl 1..N abgedeckt, Gegenstände bekannt).

**Abnahme:** alle 30 Orte lassen sich in core mit Würfen auflösen; noch keine
Oberfläche; Zitate im Commit.

### N8 – Erkundung: Orte in der Oberfläche, Funde verbuchen

- [ ] erledigt

**Umsetzung:**

1. Aktion `applyLocation(ctx, round, key, answers)`: bucht die Funde –
   Gold über `bookGold` (Art `adjust`, `source: 'location:<key>'`), Splitter in
   den Stash, Gegenstände in den Stash (`paid: 0`, `source`, dazu `worth` im
   `Find` = Listenpreis), Erfahrung gehalten (`grantXpOn`), Bleibendes nach
   `campaign.perks` (neuer optionaler Schlüssel, Liste
   `{ id, key, text, round, used?: boolean }`); `undoLocation(ctx, round)` nimmt
   alles zurück.
2. App: Karte des Orts im Erkundungsschritt – voller Kurztext, „Rules ↗“ auf
   den Anker, dann die Fragen aus `locationPlan` der Reihe nach (eintragen oder
   würfeln, Auswahl, Held wählen), am Ende „You find: …“ als Liste und
   „Take it“. Danach Ergebniszeile und die Funde als Tabelle (Was | Menge |
   Wert | wohin).
3. Bleibende Vorteile: Liste „Standing advantages“ auf der Seite und dort, wo
   sie wirken (Entrance to the Catacombs → als Erlaubnis in N6; Jewelsmith →
   Hinweis bei der Suche; Returning a Favour → Hinweis beim Sold, N10).
4. Tabelle aller 30 Orte ausklappbar (aus N1), der gefundene hervorgehoben.

**Tests:** Aktion in Walk und `ACTIONS`; Buchungen und Rücknahme
(Gold, Stash, Erfahrung, `perks`) für drei verschiedenartige Orte; e2e: ein Ort
mit Gold, einer mit Gegenständen, bei 360 px.

**Abnahme:** ein Pasch führt ohne Nachschlagen zum verbuchten Fund; Changelog;
`docs/data-model.md` (`perks`).

### N9 – Schritt 4 Wyrdstone: Preistabelle, Hauptbuch

- [ ] erledigt · **Rob entscheidet** (offene Frage 3)

**Regel:** `…/docs/tools#4-sell-wyrdstone`, `…/docs/campaigns/income#selling-wyrdstone`
(einmal je Nachspiel; Preis für das ganze Los nach Größe der Warband).

**Umsetzung:** die Preismatrix aus N1 mit hervorgehobener eigener Spalte
(Größe der Warband) und gewählter Zeile; darunter „Keep“ (Rest bleibt im
Stash). Verkauf wie heute (`sellWyrdstone`), zusätzlich ein `Find`
(`kind: 'gold'`, `source: 'wyrdstone'`). Prüfen, ob die Einnahme bei geführtem
Hauptbuch dort als Buchung steht (`ed.edit` ruft `settle`/`keepGold`); wenn
nur als „Changed by hand“: eine eigene Buchung mit `source: 'wyrdstone'` –
Verhalten für die alte App unverändert, sonst Eintrag in
`docs/behaviour-changes.md`.

**Sonderregeln des Verkaufs** (Fundstellen und Wortlaut: Abschnitt 5, nach
Robs Freigabe): Core `sellingSize(ctx)` → `{ models, band, adjustments[] }`
mit den Anpassungen der Größe (Ogre zählt doppelt, Koch und *Victuals* eine
Stufe kleiner, Mob als ein Modell, Troll als zwei) und `wyrdPrice(ctx, n, size)`
nimmt die angepasste Größe (Parameter gibt es schon). Der Preis des *Cathayan
Merchant* (W6 → ±2W6/+3W6) kommt als eigener Wurf mit „eintragen oder
würfeln“ hinzu und steht als eigene Zeile im `Find`. Die Oberfläche zeigt über
der Preistabelle, wie die Größe zustande kommt, jede Anpassung mit Quelle und
einzeln abschaltbar. `warbandSize` bleibt für das Roster unverändert (Parität).

**Tests:** Buchung und Rücknahme mit Hauptbuch; Komponente (Hervorhebung).

**Abnahme:** Preis ist vor dem Verkauf in der Tabelle abzulesen; die Einnahme
ist als Wyrdstone-Verkauf auswertbar; Changelog.

### N10 – Sold der Hired Swords

- [ ] erledigt · **Rob entscheidet** (offene Frage 1)

**Regel:** `…/docs/campaigns/hired-swords#hire-fee`: nach jeder Schlacht, die er
mitkämpft, **auch der ersten**, ist der Sold fällig, wenn er bleiben soll; ist
er tot oder wird nicht mehr gebraucht, kostet er nichts. Die Tools-Seite nennt
dafür keinen eigenen Schritt.

**Umsetzung:** Core `upkeepDue(ctx, round)` → je Hired Sword und Dramatis
Persona `{ uid, name, gc, fought, free }` (`hsUpkeepFor`, `DRAMATIS[key].upkeep`;
`free` durch „Returning a Favour“ aus N8); Aktionen `payUpkeep(ctx, round, uids)`
(Buchung `source: 'upkeep'`, `postbattle[round].upkeep`) und Entlassen über das
vorhandene `dismissHire`. App: Tabelle Name | Sold | hat gekämpft | „Pay“ /
„Dismiss“, Summe, Gold danach; Warnung, wenn das Gold nicht reicht. Platz in
der Folge nach Robs Antwort (Vorschlag: eigener Unterpunkt nach Schritt 4,
ohne die Nummern 1–10 zu verschieben; `PB_STEPS`/`PB_ORDER` bleiben für die
Parität unverändert).

**Tests:** Core zuerst (Grudge-Aufschlag, ausgesetzt, tot, frei), Walk,
Komponente.

**Abnahme:** kein Nachspiel endet, ohne dass der Sold bezahlt oder der Söldner
entlassen ist – als Hinweis, nicht als Sperre; Changelog.

### N11 – Schritt 5 Veteranen im Schritt

- [ ] erledigt

**Regel:** `…/docs/campaigns/trading#new-recruits-and-existing-henchmen-groups`
(2D6 = Erfahrung, die neue Männer zusammen mitbringen dürfen; +2 gc je Punkt).

**Umsetzung:** Feld 2–12 und „Roll“ direkt im Schritt (`setVeteransRoll`),
Anzeige Pool / verbraucht / übrig (`veteransOf`). Tabelle der Gruppen:
Gruppe | Erfahrung | Männer | noch möglich (`moreMenMax`) | Preis je Mann
(mit Aufschlag) | „passt in den Pool“. „Add men“ führt mit Rückweg (N2) auf den
Roster.

**Tests:** `view.ts` (Zeilen), Komponente.

**Abnahme:** der Wurf wird im Nachspiel eingetragen; Changelog.

### N12 – Schritte 6–9: Übersichten und Rückweg

- [ ] erledigt

**Regeln:** `…/docs/tools#6-…` bis `#9-…`, `…/docs/campaigns/trading#availability`
(ein Wurf je Held, der nicht ausgeschaltet wurde; ein Gegenstand je Erfolg).

**Umsetzung:**

- **6 Rare items:** Tabelle der Helden: darf suchen (`searchBlock`) | gesucht |
  Wurf gegen Seltenheit | gefunden | bezahlt – aus den `search`-Buchungen der
  Runde; „Search“ je Zeile öffnet den Trading Post mit vorgewähltem Helden und
  Rückweg.
- **7 Dramatis Personae:** Regel der Seite `…/docs/campaigns/dramatis-personae`
  nachlesen (Suche/Wurf?), wer zulässig ist (`dpEligibility`) als Liste, Verweis
  mit Rückweg.
- **8 Recruits & common items:** Übersicht dieser Runde aus dem Hauptbuch
  (`round`): angeheuert, gekauft, verkauft, je mit Betrag; Gold in der Hand.
- **9 Reallocate equipment:** Hinweis (neue Krieger dürfen seltene Gegenstände
  aus dem Stash bekommen), Stash als Liste, Verweis mit Rückweg.

**Tests:** `view.ts` (Zeilen aus dem Hauptbuch der Runde), e2e Rückweg.

**Abnahme:** jeder der vier Schritte zeigt, was in dieser Runde schon geschah;
Changelog.

### N13 – Schritt 10: Bilanz der Runde, für alle lesbar

- [ ] erledigt

**Umsetzung:**

1. Core `postBattleSummary(ctx, round)` (rein): Verletzungen (tot, verletzt,
   erholt), Erfahrung (Summe, Steigerungen), Erkundung (Würfel, Splitter, Ort),
   Einnahmen nach Herkunft (Wyrdstone, Orte, Szenario, Verkäufe), Ausgaben
   (Sold, Käufe, Suchen, Rekruten), Funde mit Wert, Rating/Gold/Modelle vorher
   → nachher.
2. App: Schritt 10 zeigt diese Bilanz als Tabellen; dieselbe Karte auf der
   Seite der Schlacht je Warband.
3. Server: beim Markieren (`markBattle`, `server/src/aftermath.ts`) rechnet der
   Server die Bilanz aus der markierten Version und friert sie mit dem Tag ein
   (ADR 0003); Ausgabe mit der Schlacht. Neue Felder → Leak-Matrix,
   Vertragstest (`server/test/contract/aftermath.contract.test.ts`, Fake
   `app/src/sync/fakeSync.ts`), `docs/data-model.md`, Migration falls eine
   Spalte nötig ist.

**Tests:** Core zuerst; Server-Test (eingefroren, ändert sich nach späterem
Speichern nicht); Leak-Matrix; Vertragstest; e2e-Screenshot.

**Abnahme:** nach dem Markieren sieht jedes Mitglied der Kampagne, was die
Runde jeder Warband gebracht hat; Changelog.

### N14 – Anschluss an die Statistik (P14)

- [ ] erledigt

**Umsetzung:** `stageMetrics` (`core/src/campaign/stats.ts`, Branch
`feat/statistics-1`) liest die Herkunft: `incomeWyrd`, `incomeLocations`,
`incomeScenario`, `incomeGoods`, `upkeepPaid`, `lootValue` (Summe `worth` der
gefundenen Gegenstände), `wyrdFound` aus den `Find`-Einträgen statt aus
Stash + Verkäufen; für Runden ohne Protokoll bleibt die heutige Näherung.
Diagramme der Statistik bekommen diese Reihen.

**Tests:** `core/test/stats.test.ts` erweitert (mit und ohne Protokoll).

**Abnahme:** die Statistik trennt Gold, Wyrdstone und Fundwert je Runde.

## 5. Entscheidungen und offene Fragen

### Von Rob entschieden (13.11.2026)

1. **Underdog-Bonus:** immer im **direkten Vergleich** der Schlacht. Bei mehr
   als zwei Warbands wird je **Paar** verglichen; für jede Warband zählt der
   **größte** Unterschied zu einer höher bewerteten Gegnerin
   (`underdogBonus(max über Gegner (Rating Gegner − eigenes Rating))`, Tabelle
   `PB_UNDERDOG`; ist keine Gegnerin höher, gibt es nichts). Die Ratings kommen
   aus `beforeTotals` der Teilnehmer (Stand vor der Schlacht).
2. **Warband-Zweige der Orte (N7):** „Undead“ = jede Warband mit
   `siteRace: "Undead"` (heute Tomb Guardians, Restless Dead, Necrarchs, Undead;
   **nicht** die Strigoi mit `siteRace: "Vampire"` – Rückfrage bei N7).
   „Possessed“ = alles Dämonenartige: die Warbands mit Dämonen im `siteRace`
   (heute Possessed – `Chaos Human` – und Carnival – `Chaos Human/Demon`; in
   N7 über ein **Merkmal** im Warband-Kopf, z. B. `demonic: true`, nicht über
   Namen im Code, und Rob die Liste vorlegen). „Skaven“ = `siteRace: "Skaven"`
   (Core, Pestilens, Moulder). Alles andere ist „anyone else“.
3. **Wyrdstone-Verkauf, Sonderregeln:** geprüft, siehe unten.

### Sonderregeln für Erkundung und Verkauf (Fundstellen in `data/`, 13.11.2026)

Die Regeln wirken auf die **Größe der Warband** (Spalte der Preistabelle), auf
den **Preis** oder auf die **Zahl der Splitter**. Heute rechnet nur
`warbandSize` (Modelle + Hired Swords + Dramatis Personae); keine der folgenden
Regeln ist umgesetzt.

| Wirkung | Quelle | Regel |
| --- | --- | --- |
| Größe +1 Modell je Ogre | Maneaters (`1c/maneaters.json`, Ability *Gluttony*) | „Each Ogre counts as two models when selling wyrdstone or treasure“, mindestens als eines; gefressene Gefangene senken die Zahl um 1 (Large: 2) |
| Größe eine Stufe kleiner | Halflings, Koch (*Master Chef*, `2a/halflings.json`) | W6 5+: beim Verkauf von Treasure **oder Wyrdstone** gilt die Warband als eine Größe kleiner |
| Größe eine Stufe kleiner | Gegenstand *Victuals* (8 gc, Common; `data/equipment.json`) | „after a battle when selling treasures: one size band smaller (never below 1–3 models). Any number may be used.“ – gilt dem Wortlaut nach nur für **Treasure**, nicht für Wyrdstone → Rob, ob auch Wyrdstone |
| Größe: Mob = 1 Modell | Snotlings, Night Goblins (*Insignificant*, `abilities.json`, `nightgoblins.json`) | „counts as a single model for … maximum warband size and income“ |
| Größe: Troll = 2 Modelle | Black Orcs (*Always Hungry*, `1b/blackorcs.json`) | 20 gc Sold nach jeder Schlacht **oder** der Troll zählt als 2 Mitglieder für nur 5 gc – wirkt auf die Größe |
| Preis ±2W6/+3W6 | Hired Sword *Cathayan Merchant* (Border Town Burning; `hiredswords.json`, *Stone Cutter*) | W6 bei jedem Verkauf: 1–2 verliere 2W6 gc, 3–5 gewinne 2W6 gc, 6 gewinne 3W6 gc |
| Splitter +1 | Dark Elves / Druchii (*Fey Acuity*, `2a/druchii.json`) | beim Erkunden +1 gefundenes Stück, wenn mindestens ein Held sucht (**Erkundung**, nicht Verkauf) |
| Splitter +1 | Strigoi-Fertigkeit *Light Fingers* (`2a/strigos.json`) | ein Held mit der Fertigkeit, der einen Gegner ausschaltet, findet ein Stück Wyrdstone extra; höchstens eines je Spiel |
| Würfel ±1, Wiederholung, Zusatzwürfel | siehe N6 | Elf Ranger, Pathfinder, Karten, Talismane … (Erkundung) |
| Sold in Wyrdstone | Dramatis Personae (`dramatis.json`: Nicodemus 1 Splitter zum Anheuern und 1 nach jeder Schlacht; Luthor verliert bei W6 = 1 einen Splitter) | wirkt auf den **Stash** nach dem Verkauf, nicht auf den Preis |
| Gold bedeutet etwas anderes | Sisters of Sigmar, Skaven, Undead (mordheimer, Income) | Regelwert der Währung, keine Rechenregel – nur Beschriftung („favour“, „warp tokens“) |

Ergebnis: **ja, es gibt solche Regeln**, auch für den Verkauf. Sie gehören in
N9 (Preis und Größe) und N6 (Erkundung); Vorschlag: nach der Freigabe als
Daten am Eintrag (`income: { sizeBand?: -1, models?: +1, perOgre?: … }`, über
P11 `effects`, wenn es dann läuft), in der Oberfläche als **sichtbare Zeile
über der Preistabelle** („Size for selling: 9 models (3 Ogres count double),
band 7–9; Victuals ×1 → band 4–6“), jede Anpassung mit Namen der Quelle und
ausschaltbar, damit niemand etwas Stilles verliert.

### Noch offen

1. **Sold:** wo in der Folge? Vorschlag: Unterpunkt nach Schritt 4 (Geld ist
   dann da), Dramatis Personae ebenso.
2. **Erkundung, Sonderregeln:** die Tabelle aus N6 – freigeben oder ändern.
3. **Verkaufs-Sonderregeln:** Victuals auch für Wyrdstone? Wirken Master Chef
   und Victuals zusammen (zwei Stufen)? Snotlings/Night Goblins als *ein*
   Modell auch beim Verkauf (Wortlaut „income“)? Strigoi (`Vampire`) als
   „Undead“ für die Orte?
4. **In der App gewürfelt:** reicht der Vermerk „rolled in the app“ im
   Protokoll, oder sollen App-Würfe für die anderen Mitglieder eigens
   sichtbar sein (z. B. in der Bilanz, N13)? Vorschlag: Vermerk in der Bilanz.

## 6. Idee für später: Würfe aus Tabletop Simulator (N15)

**Nur festgehalten, nicht eingeplant** (Rob, 13.11.2026). Wird erst nach N5
sinnvoll und braucht vorher ein eigenes ADR (neuer Zugang von außen).

### Was TTS hergibt

Geprüft an <https://api.tabletopsimulator.com> am 13.11.2026:

- Skripte (Lua) im Tisch: `onObjectRandomize(object, player_color)` meldet
  jeden Wurf samt Spielerfarbe; `object.resting` sagt, wann der Würfel liegt,
  `object.getValue()` die Augenzahl. `onObjectEnterZone`/`onObjectLeaveZone`
  für eine Zone, `setLock`, `addTag`/`hasTag`, `createButton`, `spawnObject`,
  `randomize()` (würfelt per Skript, mit sichtbarer Physik), `onSave` (Zustand
  des Skripts bleibt im Spielstand).
- Nach außen: `WebRequest.get/post/custom` mit eigenen Kopfzeilen. Skripte
  laufen beim **Host** des Tisches – nur sein Rechner spricht mit dem Server.
- Eine Logdatei mit Würfen (wie das Combat Log von WoW) gibt es **nicht**.

### Leitgedanke: die App führt, der Tisch würfelt

Niemand tippt Würfe ab und niemand springt zwischen Feldern. Die App weiß aus
`core`, welcher Wurf als Nächster fällig ist (Verletzung von X, Folgewurf,
Erkundung mit N Würfeln, Veteranen 2D6, Seltenheit). Daraus entsteht eine
**Wurfliste**; der Tisch arbeitet sie der Reihe nach ab. Am Ende steht in der
App alles vorausgefüllt zur Durchsicht – „Take it“ bleibt beim Spieler, und
alles ist rücknehmbar wie sonst.

### Am Tisch: eine Schale je Warband

Das Skript stellt nach dem Koppeln je teilnehmender Warband eine
**Würfelschale** auf (Zone mit Rand, beschriftet mit dem Namen der Warband):

1. **Anzeige:** über der Schale steht der fällige Wurf: „Hans – Serious
   Injury (D66)“, darunter „2 of 7“.
2. **Würfel:** die Schale legt genau die nötigen Würfel hinein (4 weiße für
   die Erkundung; für D66 einen **roten Zehner** und einen **weißen Einer**,
   am Tag erkannt). Andere Würfel in der Schale zählen nicht.
3. **Würfeln:** Knopf „Roll“ an der Schale (ruft `randomize()` für ihre
   Würfel) oder von Hand aufnehmen und werfen – beides ist echte, für alle
   sichtbare Physik.
4. **Ergebnis:** liegen alle Würfel (`resting`) **in** der Schale, liest das
   Skript sie, sperrt sie (`setLock`) und zeigt groß „5 · 5 · 3 · 1“ mit
   „✓ Take“ und „↺ Again“. Nach „✓“ geht der Wurf an den Server, die Schale
   zeigt den nächsten.
5. **Wer:** die Schale gehört zur Warband; wer geworfen hat (Farbe und Name
   des Spielers) wird mitgeschrieben.

### Zuordnung: welcher Wurf ist welcher?

- **Über die Wurfliste, nicht über Raten.** Ein Wurf gehört zu der Anfrage,
  die die Schale gerade zeigt (`requestId`). Anzahl und Art der Würfel müssen
  zur Anfrage passen, sonst meldet die Schale „needs 4 dice – 3 in the tray“.
- **Folgewürfe** (Multiple Injuries, Arm Wound D6, Ort mit Tabelle aus N7)
  erzeugt die App aus dem Ergebnis sofort als nächste Anfrage – der Spieler
  bleibt am Tisch.
- **Regel-Wiederholungen** (Wyrdstone Hunter, Karte, ±1 des Elf Rangers aus
  N6) wählt der Spieler in der App; daraus wird die Anfrage „Re-roll die 3“:
  die Schale hält die übrigen Würfel gesperrt und gibt nur den einen frei.
- **Würfe ohne Anfrage** (jemand würfelt einfach in der Schale) landen im
  **Eingang** der Warband; neben jedem Wurffeld der App steht dann „Use last
  roll from TTS“. Das ist zugleich die einfache erste Ausbaustufe.

### Versehentliche und ungültige Würfe

- Es zählt nur, was **in der Schale**, **bei offener Anfrage** und **bestätigt**
  ist. Ein angestoßener Würfel irgendwo auf dem Tisch ist nie ein Wurf.
- Nach dem Liegen sind die Würfel gesperrt – Anrempeln ändert nichts mehr.
- Schräg liegende Würfel (Neigung über einer Schwelle) weist die Schale ab:
  „cocked – roll again“.
- „↺ Again“ verwirft den Wurf, **aber er bleibt im Wurfprotokoll** stehen
  („verworfen: 3 · 4, von Rob“). Vertrauen entsteht durch Sichtbarkeit, nicht
  durch Sperren – wie am echten Tisch („any dice rolls must be seen“).
- In der App ist ein TTS-Wurf ein **Vorschlag** im Feld, mit Herkunft
  („from TTS, rolled by Rob, 21:14“). Übernommen wird er erst mit „Take it“;
  danach gilt das normale Undo.

### Koppeln ohne Geheimnis im Mod

Der Mod aus dem Workshop enthält **kein** Token (jeder könnte es lesen):

1. In der App auf der Seite der Schlacht: „Connect a TTS table“ → ein
   Einmal-Code (sechs Zeichen, zehn Minuten gültig).
2. Der Host tippt ihn im Tisch ein; das Skript tauscht ihn gegen ein
   **Tisch-Token** und merkt es sich im Spielstand (`onSave`).
3. Das Tisch-Token darf nur drei Dinge, nur für diese Schlacht: Teilnehmer
   lesen (Namen der Warbands – Mechanik, offen nach ADR 0002), offene
   Wurfanfragen lesen, Würfe melden. Es läuft mit dem Markieren der Schlacht
   oder nach wenigen Tagen ab und ist in der App widerrufbar. Vorbild:
   Bug-Token (ADR 0019).

### Server und App

- Tabelle `roll_requests` (Schlacht, Warband, Schritt, Beschriftung, Würfel,
  Status `open | rolled | discarded | taken`, Ergebnis, wer, wann) – kurzlebig,
  nach dem Markieren nur noch das Protokoll.
- Endpunkte: Koppeln (Code erzeugen, Code einlösen – streng begrenzt gegen
  Raten), `GET` offene Anfragen und `POST` Wurf mit dem Tisch-Token; für
  Mitglieder: Anfrage anlegen (nur für die eigene Warband), Würfe lesen. Alles
  über `can()`, in Leak-Matrix und Vertragstest.
- Der Tisch fragt alle zwei Sekunden nach offenen Anfragen, ohne gekoppelte
  offene Schlacht gar nicht (Last für den Pi vernachlässigbar). Die App
  erfährt Würfe über den vorhandenen Ereignis-Kanal (`/events`).
- `Rolled.by` aus N0 bekommt den dritten Wert `'tts'` (neben `'entered'` und
  `'app'`); Spieler und Zeit stehen dabei.
- Ohne TTS ändert sich nichts: eintragen oder in der App würfeln bleibt.

### Ausbaustufen

1. **Eingang:** Schale meldet bestätigte Würfe, die App bietet „Use last roll
   from TTS“ am Feld an. Kleinster Schnitt, schon nützlich.
2. **Wurfliste:** Anfragen aus der App, Anzeige und passende Würfel an der
   Schale, Folgewürfe von selbst.
3. **Wurfprotokoll der Runde** in der Bilanz (N13): jeder Wurf, auch der
   verworfene, für alle Mitglieder lesbar.

### Offen

- Der Mod selbst: eigenes kleines Skript zum Einfügen in den vorhandenen
  Mordheim-Tisch (Global oder ein Objekt „Dice tray“ zum Abspeichern) – wo es
  liegt und wie es getestet wird (Lua lässt sich hier nicht in der CI fahren;
  der Server-Teil schon, gegen aufgezeichnete Anfragen).
- Würfe **während** der Schlacht (Verletzungswurf im Spiel, Rout-Test) sind
  bewusst nicht Teil der Idee: das Protokoll der Schlacht hält Ausfälle fest,
  keine Würfel.
- Ob „✓ Take“ an der Schale nach einigen Sekunden von selbst gilt (schneller)
  oder immer geklickt wird (sicherer) – Einstellung je Tisch.
