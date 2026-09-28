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

## B. Datenfehler (eindeutig nach mordheimer.net)

| Warband | Einheit | Was | Werkzeug | mordheimer.net |
| --- | --- | --- | --- | --- |
| Mercenaries (Reikland) | Captain, Marksmen | Stadtregel fehlt | – | Leadership im Umkreis von 12″; Marksmen +1 BS |
| Mercenaries (Middenheim) | Captain, Champions | Stärke | S3 (die Stadtregel wird nicht angewendet) | S4 |
| Mercenaries (Middenheim) | Helden | Wolfcloak fehlt in der Liste | – | 10 gc, nur Helden aus Middenheim |
| Mercenaries, Ostermarkers | Swordsmen | Expert Swordsman | immer | nur beim Angriff |
| Witch Hunters | Warrior Priest | Regeltext | „Burn the Witch!“ | nur Prayers of Sigmar |
| Ostlanders | Ruffian, Ogre | Ld | 7 | 10 |
| Carnival of Chaos | Plague Bearer, Nurgling | Regeln fehlen | – | Daemonic Instability; Nurgling: Cloud of Flies |
| Carnival of Chaos | Plague Cart | Profil, Regeln | kein Profil | Karren T8 W4, Räder T6 W1, Pferd, Wächter; Boni für Plague Bearer/Nurglings; Nurgle's Rot beim Wächter |
| Averlanders | Bergjaeger | Set Traps | Treffer S4 | ganze Runde, Wurf 3+ |
| Orc Mob, Black Orcs | Orc-Skill | 'Ere We Go! | Fear und Terror | nur Fear |
| Orc Mob | Troll | Always Hungry | nur 15 gc | oder zwei Goblins/Squigs opfern |
| Beastmen | Beastmen-Skill | Fearless | Fear, Terror, All Alone | Fear, All Alone |
| Marauders (Hung) | Helden | Warhorse 40 gc, Ride Warhorse | fehlt | für alle Helden |
| Amazons (Mordheim) | Helden | Spezialfertigkeiten | Lustria-Liste | keine Spezialliste |
| Bretonnians | Knights | Bretonnian Barding | fehlt | 30 gc |
| Dark Elves | Cold One Beasthound | Regeln fehlen | – | Stupidity mit Ld des Beastmasters; flieht, wenn er stirbt |
| Dark Elves | Dark-Elf-Skills | Fury of Khaine, Infiltration | Zusätze; „wie Skaven“ | nur 4″ Nachrücken; aufstellen außer Sicht, ohne 12″ |
| Dwarf Rangers | Skill | Master of Blades | Wiederholung mit zwei Äxten | pariert bei Gleichstand; zwei Parierwaffen = zwei Paraden |
| Dwarf Rangers | Apprentice Runesmith | Ausrüstung | Waffen und Rüstung | nur Waffen |
| Forest Goblins | Gigantic Spider | Regel fehlt | – | geritten keine Stupidity |
| Gunnery School | Senior Gunnery Officer, Marksman | Hunter | jede Schwarzpulverwaffe | Hunter aus dem Regelbuch (Handgun, Long Rifle) |
| Imperial Outriders | Warband | Warhorse-Aufwertung, Pferderegeln | alle | nur Knight, Outriders, Hussars; weitere Regeln fehlen |
| Imperial Outriders | Knight, Outrider, Scout | Cavalry-Skills | nicht in der Liste | angekreuzt |
| Imperial Outriders | Cavalry-Skills | Athletic Mount; Ride | 2″; fehlt | halbe Bewegung; Ride gehört dazu |
| Lizardmen | Kroxigor | „zählt als 2 Modelle“ | ja | steht nicht dort |
| Lizardmen | Saurus | Helm | Helmet | Bone Helmet |
| Lizardmen | Helden, Skinks | Sacred Markings, Gifte | fehlen | Oversized Jaws, Poison Glands, Mark of the Old Ones; Gifte je Einheit |
| Norse | Berserker | Rüstung | erlaubt | nie Rüstung |
| Outlaws | alle | Zweihandwaffe | 30 gc | 15 gc |
| Outlaws | Outlaw, Marksman | Jagdpfeile, Waldumhang | erlaubt | Pfeile nur Helden und Marksmen, Umhang nur Helden |
| Outlaws | Helden | Spezialfertigkeiten | Bandit-Liste | keine |
| Outlaws | Cleric | Fertigkeiten | Combat, Academic, Strength | nur Academic |
| Pirates | Swabbies | Regeln fehlen | – | zählen nicht für Rout; verschwinden, wenn die Warband routet |
| Pit Fighters | Troll Slayer, Ogre | Ausrüstung | Rüstung beim Slayer, Zwergenaxt beim Ogre | umgekehrt; Gromril-Waffe für den Slayer |
| Pit Fighters | Warband | In the Pit! | gekürzt | verliert keine Ausrüstung; ignoriert Robbed, Captured, Hardened, Sold to the Pits, Survives |
| Amazons (Lustria) | Piranha Warrior | Conch Shell Horn | angeborene Regel | Ausrüstung (Rare 8, 25 gc) |
| Shadow Warriors | Warband | Distaste for Poison | Gifte und Drogen | nur Gifte |
| Black Dwarfs | Skill | Tyrant | Zusatz „Rout-Test, wenn der Anführer fällt“ | Rout-Test wiederholen, solange er nicht liegt |
| Black Dwarfs | Bull Centaur, Gaoler, Krieger | Engine of Chaos | in der Liste | nur Sorcerer |
| Cursed Cavalcade | Helden | Spezialfertigkeiten | Dark-Elf-Liste | Noblesse Oblige, Torturer, Duelist |
| Cursed Cavalcade | Helden | Cathayan Quilted Silk Armour | nur Aristocrat | alle Helden, 15 gc |
| Cursed Cavalcade | Warband | Capture! | fehlt | „61 Captured“ neu würfeln ab 2 Gefangenen oder 5 Thralls |
| Court of the Profane Pleasures | Wretch | Dolch | erster frei | 2 gc, keiner frei |
| Lustrian Reavers | Hunting Hawk | Profil | W1, Ld5 | W und Ld „–“ |
| Night Goblins | Troll | Dumb Monster | „würfelt nie auf Verletzungen“ | nur: lernt nichts, keine Erfahrung |

## C. Fragen an Rob

| Nr. | Frage | Warum offen |
| --- | --- | --- |
| C1 | Trantio: Startgold 600 im normalen Kampagnenspiel? | Seite: +100 gc im Einzelspiel, +20 % nur in einer Lustria-Kampagne |
| C2 | Cursed Cavalcade, Nightmare: 30 oder 95 gc? | Tabelle 30, Beschreibung 95 (Tabelle geht nach unserer Regel vor) |
| C3 | Sons of Hashut, Obsidianwaffe: 30 gc (Liste) oder 60 gc (Sonderausrüstung), welche Version? | Seite widerspricht sich; Redaktion: nur eine Version verwenden |
| C4 | Tomb Lord: Zugang zu „Drive Chariot“? | Academic-Skill, den er laut Tabelle nicht hat; Seite nennt es selbst Widerspruch |
| C5 | Scarecrow „Flammable“: doppelter Schaden durch Feuer? | RAW nur „fängt bei 3+ Feuer“; doppelter Schaden ist ein Konsens-Hinweis, kein RAW |
| C6 | Ostermarkers, Champion und Youngblood: Fertigkeiten einer Stadt wählen statt Vereinigung aller? | Seite: Satz einer anderen Mercenary-Option wählen |
| C7 | Wood Elves, Shadow Warriors: Ithilmar-Waffen zum Sonderpreis (2×) nur beim Aufstellen? | Fußnote: danach normaler Preis und Seltenheitswurf |
| C8 | Black Dwarfs, Sorcerer: Rüstung erlaubt? | Eintrag nennt nur Waffen, der Mechanical Suit ist aber „Sorcerer only“ |
| C9 | Bretonnians: Men-at-Arms höchstens 8 oder beliebig viele? | Überschrift 0–8, Warband-Auswahl „any number“ |

## D. Merchant Caravans (Robs Warband)

Vollständig verglichen: Einheiten, Kosten, Profile, Höchstzahlen, alle drei
Ausrüstungslisten, Merchant-Skills, Wagen – keine Abweichung. Robs Stand
rechnet richtig (Kosten je Krieger, Erfahrungsstufen, Aufstiege, Gold in der
Hand 5 gc). Betroffen ist die Karavane nur von A: Der Chip „Lightning
Reflexes“ der Knights Vanguard zeigt den Speed-Skill statt ihrer eigenen
Regel (gleiche Wirkung, anderer Wortlaut).
