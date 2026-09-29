# Abgleich der Regeldaten mit mordheimer.net

Stand: 28. September 2026 · Anlass: Robs Frage, ob die Fähigkeiten der
Einheiten stimmen („häufig gab es verschiedene Fähigkeiten unter gleichem
Namen“).

## Wie geprüft wurde

- Für jede der 49 Warbands wurde festgehalten, was das Werkzeug zeigt: Regeln
  der Warband, je Einheit Kosten, Höchstzahl, Start-Erfahrung, Profil,
  Fertigkeitslisten, Regeltext, die angehängten Fähigkeits-Chips mit ihrem
  Tooltip-Text, die Spezialfertigkeiten und die Ausrüstungslisten.
- Das wurde gegen die Warband-Seite auf mordheimer.net gelesen (Merchant
  Caravans selbst, die übrigen 48 in sechs Stapeln). Gemeldet sind nur
  Unterschiede in der Wirkung, keine Unterschiede im Wortlaut.
- Grenzen: mordheimer.net war nur über WebFetch lesbar, das zusammenfasst;
  wo es auf den Wortlaut ankam, wurde gezielt wörtlich nachgefragt. Die
  Bleistift-Anmerkungen (✏️) der Seiten sind so nicht lesbar und stehen unten
  als offen.
- Rangfolge der Quellen wie in `CLAUDE.md`. Wo mordheimer.net eindeutig ist,
  wird korrigiert (Rob, 28.09.2026: „alle Informationen kannst du auf
  mordheimer.net finden“). Wo die Seite sich widerspricht oder nur einen
  Konsens nennt, entscheidet Rob (Abschnitt C).

## Ergebnis in einem Satz

Die Einheiten selbst (Kosten, Profile, Listen) stimmen weitgehend. Der größte
Fehler liegt im Werkzeug: Tooltips werden über den bloßen Namen gesucht, und
der erste Treffer gewinnt – so zeigt ein Skill die Regel eines gleichnamigen
Skills einer anderen Warband oder eines Gegenstands, und eine Einheit bekommt
Chips für Regeln, die in ihrem Text nur erwähnt werden. Genau das ist
„verschiedene Fähigkeiten unter gleichem Namen“.

## A. Fehler im Werkzeug (beide Apps)

### A1 Skill-Tooltips unabhängig von der Warband

Der Tooltip eines Skills sucht den Namen in allen Listen; die erste gewinnt.
Betroffen, jeweils mit der Liste, deren Text stattdessen erscheint:

| Skill | Wo er gebraucht wird | Gezeigt wird |
| --- | --- | --- |
| Infiltration | Skaven, Wood Elves, Lizardmen (Skinks), Shadow Warriors, Horned Hunters, Dark Elves | Liste der Cursed Cavalcade (Dark-Elf-Text) |
| Bellowing Roar | Beastmen („jeder misslungene Rout-Test“) | Ogre-Version („nur der erste“) |
| Mutant | Marauders of Chaos | Beastmen-Version |
| Extra Tough, Thick Skull, True Grit, Resource Hunter | Dwarf Treasure Hunters, Dwarf Rangers, Sons of Hashut | Black-Dwarfs-Liste |
| 'Eadbasher, Waaagh! | Black Orcs | Orc-Mob-Liste |
| Black Hunger | Clan Pestilens | Eshin-Liste |
| Hide in Shadows, Sniper | Hochland Bandits, Outlaws | Shadow-Warrior-Version (Sniper ohne Schwarzpulver-Ausnahme) |
| Foul Odour, Animal Friendship | Horned Hunters | Ostlander-Liste |
| Battle Tongue | Norse | Academic-Version |
| Fury of Khaine, Powerful Build, Fey Quickness, Master of Poisons | Dark Elves, Shadow Warriors | Cavalcade-Liste |

### A2 Gegenstände verdecken Skills

Der Tooltip sucht zuerst unter den Gegenständen, deren Muster lose greifen:
„Shield Bash“, „Shield Master“, „Human Shield“ zeigen den Schild,
„Toughened Hide“ eine Rüstung, „Cutlass Master“ den Cutlass, „Swashbuckler“
den Buckler, „Censer Bearer“ den Weihrauchkessel, „Expert Swordsman“ und
„Swordmaster“ das Schwert.

### A3 Chips für Regeln, die die Einheit nicht hat

Die Fähigkeits-Chips entstehen, indem Muster über den Regeltext laufen. Lose
Muster greifen bei bloßer Erwähnung:

| Einheit | Chip | Warum falsch |
| --- | --- | --- |
| Knights (Bretonnian), Blackheart, Devout, Wretch, Mountain Guide | All Alone | sie sind davon befreit |
| Huckster | Stupidity | nur erwähnt („Modelle mit Stupidity …“) |
| Cleric (Outlaws), Jungle Shadow | Hunter | „Witch-Hunter's“, „Silent Hunter“ |
| Forest-Goblin-Chieftain, Emissary, Questing Knight, Aristocrat | Ride (Outriders-Text) | „May Ride“, „Ride Horse“, „Ride (Nightmare)“ |
| Bergjaeger | Traps (Trapmaster) | eigene Regel heißt „Set Traps“ |
| Moot Elder | Heirloom (Kislev) | „family heirloom“ in einer Anmerkung |
| Flesh Merchant | Fate (Marauders) | eigene Regel heißt „Cruel Fate“ |
| Apprentice Runesmith | Inscribe Runes | nur erwähnt |
| Squire | Vain, Impetuous | erst nach der Beförderung |
| Warrior Priest | Burn the Witch! | steht fälschlich im Regeltext (siehe B) |
| Battle Pilgrim | Stubborn (Dwarf-Longbeard-Text) | fremde Warband |
| Sabretusk, Snotling Mob | Ignored, Mob (Raging-Peasant-Texte) | fremde Warband |
| Bull (Maneaters) | Charge (allgemein) | eigene Regel „Bull Charge“ wirkt anders |

### A4 Allgemeiner Tooltip widerspricht der eigenen Regel

Der Regeltext der Einheit steht richtig auf der Karte, der Chip darunter
erklärt dieselbe Regel anders: Leader (Gunnery School: 12″, nicht 6″),
Regeneration (4+ gegen jede Verwundung, nicht „in der Erholungsphase“),
Always Hungry (Black Orcs 20 gc, Orc Mob mit Opfer-Option), Crack Shot
(Pistole im Nahkampf, erste Runde), Looting the Dead (bei Entfernung vom
Roster), Natural Stealth (−1 Initiative, nicht halbiert), Frenzy beim
Whipmaster (endet nicht bei knocked down), Animal beim Minotaurus (darf
Erfahrung sammeln), Fiercely Loyal (Bärenzähmer ignoriert Robbed, Captured,
Sold to the Pits), Gun-Rest (+1 zu treffen), Expert Riggers, Rabble, Combat
Riding, Horse Handling, Animosity bei Night Goblins und Greenskins (ein Wurf
für die Warband, nicht der Orc-Mob-Ablauf), Drunk (Ostlander, Horned Hunters
und Centigor sind drei verschiedene Regeln), Undead bei Tomb Guardians
(Liche Priest, Acolytes und Tomb Guards sammeln Erfahrung), Daemon und
Daemonic Aura (Carnival: Rettungswurf wird von der Stärke modifiziert).

### A5 Allgemeine Texte, die selbst falsch sind

May Not Run (darf trotzdem angreifen), Expert Swordsman (nur in der Runde des
Angriffs; auch im Regeltext der Swordsmen), Woodland-dweller (nur Wald,
nicht schwieriges Gelände), Unarmed bei den Battle Monks (+1 Attacke fehlt),
Hatred (der Zusatz „kann den Kampf nicht verlassen“ steht nicht in der Regel).

**Behoben (28.09.2026), in beiden Apps:** Jeder Chip trägt einen Schlüssel,
der sagt, wessen Regel er zeigt. Der Tooltip nimmt die Definition der Einheit
oder ihrer Warband („Name: …“ im Regeltext), sonst einen gleichnamigen Skill
aus den Listen der Einheit, sonst den allgemeinen Eintrag. Einträge für die
Regel einer bestimmten Einheit (`own` in `data/abilities.json`) erscheinen nur,
wo sie definiert sind oder ausdrücklich freigegeben (`wb`). „immune to“,
„never has to“ und „no … test“ verneinen eine Erwähnung. Gelernte Skills
lösen über die Listen des Kriegers auf, ebenso ihr Text in TTS-Karten und im
PDF. Die Texte aus A5 sind korrigiert. Ergebnis über alle Einheiten: 22 falsche
Chips entfallen (genau die aus A3), und die Chips aus A4 zeigen den Text der
Einheit. Tests: `core/test/abilities.test.ts`, `test/ability-context.mjs`, dazu
ein Paritätstest über jeden Chip jeder Einheit.

## B. Datenfehler (nach mordheimer.net)

Jeder Befund wurde vor der Korrektur noch einmal gezielt auf der Seite
nachgelesen. Sechs Meldungen hielten dem nicht stand (unten „kein Fehler“) –
die Zusammenfassungen von WebFetch sind also kein Beleg für sich.
Test für alle Korrekturen: `core/test/data-audit.test.ts`.

**Korrigiert (28.09.2026):**

| Warband | Was | Vorher | Jetzt (mordheimer.net) |
| --- | --- | --- | --- |
| Mercenaries (Reikland) | Stadtregel | fehlte | Leadership des Captains im Umkreis von 12″; Marksmen +1 BS |
| Mercenaries (Middenheim) | Captain, Champions | S3 (Stadtregel nicht angewendet) | S4 |
| Mercenaries | Expert Swordsmen | immer | nur beim Angriff, nur mit normalem Schwert |
| Witch Hunters | Warrior Priest | „Burn the Witch!“ | nur Prayers of Sigmar |
| Ostlanders | Ruffian, Ogre | Ld 7 | Ld 10 |
| Averlanders | Set Traps | Treffer S4 | eine Runde; Auslösen bei 3+ in 2″; Marker verschwindet |
| Orc Mob, Black Orcs | 'Ere We Go! | Fear und Terror | nur Fear |
| Orc Mob | Troll, Always Hungry | nur 15 gc | oder zwei Goblins/Squigs opfern |
| Beastmen | Fearless | Fear, Terror, All Alone | Fear, All Alone |
| Dark Elves | Cold One Beasthound | – | Stupidity mit Ld des Beastmasters; fliehen, wenn er stirbt |
| Dark Elves | Fury of Khaine | Zusätze | nur 4″ Nachrücken |
| Dwarf Rangers | Apprentice Runesmith | Waffen und Rüstung | nur Waffen |
| Forest Goblins | Gigantic Spider | – | geritten keine Stupidity |
| Gunnery School | SGO, Marksmen: Hunter | jede Schwarzpulverwaffe | Hunter aus dem Regelbuch |
| Imperial Outriders | Warhorse; Pferderegeln | alle; fehlten | Knight, Outriders, Hussars; ohne Pferd kein Einsatz, tote Pferde zuerst ersetzen, gerittene Pferde kein Ziel, Reiter immer Ziel ohne +1 |
| Lizardmen | Kroxigor; Saurus-Helm | „zählt als 2“; Helmet | entfällt; Bone Helmet |
| Outlaws | Zweihandwaffe | 30 gc | 15 gc |
| Outlaws | Listen der Henchmen | wie Helden | Outlaws ohne Langbogen, leichte Rüstung, Jagdpfeile, Waldumhang; Marksmen ohne Waldumhang |
| Outlaws | Fertigkeiten | Bandit-Liste; Cleric Combat/Academic/Strength | keine Spezialliste; Cleric nur Academic |
| Pirates | Swabbies | – | zählen nicht für Rout; verschwinden, wenn die Warband routet |
| Pit Fighters | Listen; In the Pit! | Zwergenaxt beim Ogre; gekürzt | Zwergenaxt nur Slayer, Rüstung nur Ogre; volle Regel |
| Amazons (Mordheim) | Spezialfertigkeiten | Lustria-Liste | keine |
| Amazons (Lustria) | Conch Shell Horn | angeborene Regel | Ausrüstung (Rare 8, 25 gc) |
| Shadow Warriors | Distaste for Poison | Gifte und Drogen | Gifte |
| Arabian Tomb Raiders | Bedouin | „nicht kumulativ mit anderen Boni“ | nur +1, auch mit zwei Bedouins |
| Cursed Cavalcade | Spezialfertigkeiten | Dark-Elf-Liste | Noblesse Oblige, Torturer, Duelist |
| Court of the Profane Pleasures | Wretches | erster Dolch frei | jeder Dolch 2 gc |
| Carnival of Chaos | Plague Bearer, Nurgling | – | Daemonic Instability; Nurglings: Cloud of Flies, kein Fear |
| Carnival of Chaos | Plague Cart | kein Profil | Karren, Rad, Pferd, Wächter; Boni gegen Instability; Nurgle's Rot |

**Kein Fehler (Meldung widerlegt):** Black Dwarfs „Tyrant“ (unser Text steht
so auf der Seite); Dark Elves „Infiltration“ (mit 12″, wie Skaven); Cursed
Cavalcade Quilted Silk Armour (nur Aristocrat); Norse Berserker (Rüstung ist
schon gesperrt); Night-Goblin-Troll würfelt nicht auf Verletzungen (steht in
der Regeneration der Trolle); Imperial Outriders Cavalry-Skills (die Liste
hängt schon an allen drei Helden).

**Offen – braucht mehr als eine Datenzeile:**

| Warband | Was | Warum noch offen |
| --- | --- | --- |
| Mercenaries (Middenheim) | Wolfcloak 10 gc für Helden | Listen kennen noch keine Einträge je Stadt |
| Marauders (Hung) | Warhorse 40 gc, alle Helden mit Ride Warhorse | dito, je Stamm |
| Lizardmen | Sacred Markings (Oversized Jaws, Poison Glands, Mark of the Old Ones), Gifte je Einheit | Aufwertungen beim Anwerben gibt es noch nicht |
| Dwarf Rangers u. a. | Zwerge nie Arcane Lore | Sperre einzelner Skills fehlt im Skill-Menü |
| Pit Fighters | Gromril-Waffe für den Slayer | Gromril ist ein Aufschlag, keine Listenzeile |
| Lustrian Reavers | Hunting Hawk W und Ld „–“ | Profile rechnen mit Zahlen |
| Cursed Cavalcade | „61 Captured“ neu würfeln | Wortlaut nicht bestätigt |
| Imperial Outriders | Athletic Mount, Ride | Text steht nur in Blazing Saddles, nicht auf der Seite |
| Dwarf Rangers | Master of Blades | steht nicht auf der Seite der Dwarf Rangers |

## C. Robs Entscheidungen (29.09.2026)

| Nr. | Frage | Entscheidung | Umsetzung |
| --- | --- | --- | --- |
| C1 | Trantio: Startgold 600 im normalen Kampagnenspiel? | Unsere Kampagne zählt für solche Zwecke als „Lustrian campaign“ (+20 %) | 600 gc wie bisher |
| C2 | Cursed Cavalcade, Nightmare: 30 oder 95 gc? | 30 gc bei der Gründung, 95 gc bei der Suche nach einer Schlacht | Liste 30 gc als Gründungspreis, Trading Post 95 gc (Rare 11) |
| C3 | Sons of Hashut, Obsidianwaffe: 30 oder 60 gc? | 30 gc bei der Gründung, 60 gc später; umbenennen wegen Border Town Burning | „Zharr obsidian weapon“ – nach Zharr-Naggrund, der Stadt der Chaos-Zwerge; Liste 30 gc als Gründungspreis, Trading Post 60 gc (Rare 10) |
| C4 | Tomb Lord und „Drive Chariot“ | Die impliziten Korrekturen der Liste „Inconsistencies“ gelten (RAI, weil mordheimer.net sie nennt) | Tomb Lord darf Drive Chariot lernen; Home Ground in jedem Kampagnen-Setting; Nehekharan Javelins sind Wurfwaffen; Asp Arrows sind Sonstige Ausrüstung; Tomb Guardians sammeln Erfahrung (war schon so); „Mummy“ = Tomb Lord (war schon so). Offen bleibt nur, wie der Skeleton Chariot aufgestellt wird – dafür nennt die Seite keine Lösung |
| C5 | Scarecrow „Flammable“ | Doppelter Schaden durch Feuer, auch RAW: „Flammable“ ist das Stichwort der Tomb Guardians | stand schon so im Text |
| C6 | Ostermarkers: Fertigkeiten | Die Warband gehört fest zu ihrer Region, alle Champions und Youngbloods lernen aus derselben Tabelle | Ostermark hat keine eigene Tabelle; nach der späteren Klarstellung nimmt man die einer anderen Mercenary-Option. Sie wird jetzt einmal bei der Gründung gewählt (wie die Stadt der Mercenaries): Reikland, Middenheim oder Marienburg – nur die Tabelle, nicht die Stadtregeln |
| C7 | Wood Elves, Shadow Warriors: Ithilmar zum Sonderpreis nur bei der Gründung? | Ja | Gründungspreis; die Shadow Warriors haben wie die Wood Elves je eine Zeile für Schwert, Speer und Zweihandwaffe (2× Preis) statt einer Zeile zu 20 gc |
| C8 | Black Dwarfs, Sorcerer: Rüstung? | Ja, aber keine Rituale in Rüstung – außer im Mechanical Suit | Regeltext ergänzt; Chaos armour hindert laut ihrer eigenen Regel ebenfalls nicht |
| C9 | Bretonnians: Men-at-Arms | 0–8 | stand schon so |
| C10 | Black Dwarfs: Engine of Chaos | Für alle Chaos Dwarfs; die Seite beschränkt Fahrer und Passagiere nicht | stand schon so; 125 gc bei der Gründung, 195 gc später (Rare 10) |

Test: `core/test/data-audit.test.ts` („Rob, C2“ …) und
`core/test/start-prices.test.ts`, in der alten App `test/start-prices.mjs`.

Beim Nachlesen fiel dasselbe Muster an weiteren Stellen auf und ist gleich
mit behoben: Mechanical Suit (175 gc bei der Gründung, 225 gc später),
Gromril-Rüstung der Zwerge (75 gc, später 150 gc), Gromril-Waffen der Zwerge
(3× bei der Gründung, später 4×), Dark Elf Blade (+15 gc, später +20 gc) und
die Nagarythe-Gegenstände der Shadow Warriors. Das „Banner von Nagarythe“ im
Katalog heißt jetzt wie in der Liste „Standarte“; das Kriegshorn fehlte dort.

## D. Merchant Caravans (Robs Warband)

Vollständig verglichen: Einheiten, Kosten, Profile, Höchstzahlen, alle drei
Ausrüstungslisten, Merchant-Skills, Wagen – keine Abweichung. Robs Stand
rechnet richtig (Kosten je Krieger, Erfahrungsstufen, Aufstiege, Gold in der
Hand 5 gc). Betroffen ist die Karavane nur von A: Der Chip „Lightning
Reflexes“ der Knights Vanguard zeigt den Speed-Skill statt ihrer eigenen
Regel (gleiche Wirkung, anderer Wortlaut).
