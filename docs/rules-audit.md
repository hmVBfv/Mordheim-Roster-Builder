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

**Nachgezogen (29.09.2026)** – was eine Datenzeile nicht konnte, kann sie
jetzt: Listenzeilen lassen sich auf Helden (`heroes`) oder auf eine Variante
der Warband (`sub`) beschränken, eine Warband kann einzelne Skills sperren
(`noSkills`), eine Aufwertung einen festen Preis für bestimmte Einheiten
haben (`always`). Tests in `core/test/data-audit.test.ts`,
`core/test/start-prices.test.ts` und `test/unit-limits.mjs`.

| Warband | Was | Jetzt |
| --- | --- | --- |
| Mercenaries (Middenheim) | Wolfcloak | in der Liste der Middenheimer Helden, 10 gc; Tooltip mit der Wolfsjagd (W6 ≤ Stärke) |
| Marauders (Hung) | Warhorse | in der Heldenliste der Hung, immer 40 gc; „Ride Warhorse“ für alle Helden steht im Stammestext |
| Lizardmen | Sacred Markings, Gifte | Oversized Jaws (Saurus-Helden, 40 gc), Poison Glands (Skink-Helden, 40 gc), Mark of the Old Ones (50 gc) – nur Helden, ein Zeichen je Held, beim Anwerben; Dark Venom (20 gc) und Black Lotus (10 gc) für Geschosse der Skink-Helden; Reptile Venom (5 gc) für Skink Braves |
| Dwarf Rangers | nie Arcane Lore | aus dem Skill-Menü genommen (die Seite sagt es ausdrücklich); den Dwarf Treasure Hunters verbietet ihre Seite es nicht |
| Pit Fighters | Gromril-Waffe für den Troll Slayer | 3× Preis, jederzeit (nicht nur bei der Gründung) |
| Cursed Cavalcade | „61 Captured!“ neu würfeln | bestätigt und in die Regel „Capture!“ aufgenommen: neu gewürfelt, sobald zwei Henchmen gefangen oder fünf Captured Thralls in der Warband sind |
| Dwarf Rangers | Master of Blades | kein Fehler: dieselbe Fertigkeit heißt dort „Combat Master“ – unser Eintrag trägt beide Namen |

**Weiter offen:**

| Warband | Was | Warum |
| --- | --- | --- |
| Lustrian Reavers | Hunting Hawk W und Ld „–“ | Profile rechnen mit Zahlen; ein Strich braucht eigene Behandlung beim Rechnen |
| Imperial Outriders | Athletic Mount, Ride | Text steht nur in Blazing Saddles, nicht auf der Seite |
| Tomb Guardians | Skeleton Chariot aufstellen | die Seite nennt es selbst unklar und gibt keine Lösung |

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

## E. Gegenstände anderer Warbands am Trading Post (29.09.2026)

**Fehler in beiden Apps:** Der Trading Post bot jeder Einheit alles an, dessen
Waffenart in ihrer Startliste vorkommt. Die Beschränkung im Katalog („Dwarfs
only“) stand nur als Text im Feld `wb` und wurde nie geprüft. Ein
Mercenary-Captain konnte so die Dwarf axe, den Censer der Pestilens, die
Starblade der Amazonen, den Trident der Pit Fighters oder die Pike der
Tileans suchen – für eine Reikland-Warband sind 106 der 176 seltenen
Gegenstände anderen Warbands vorbehalten.

**Behoben:** Der Text bekommt eine Datenform `only` am Katalogeintrag
(`data/equipment.json`): welche Warbands (auch nur eine Variante,
`merc:reik`, oder nur bestimmte Einheiten, `pirates/pcaptain,mate`),
welche nicht (`notWb`), nur Helden, nur Warbands aus Menschen, nur
Zauberkundige. Wer den Gegenstand in seiner eigenen Ausrüstungsliste hat,
darf ihn immer, gleich was der Text sagt – so kamen hinzu: der Troll Slayer
der Pit Fighters (Dwarf axe), die Merchant Caravans (Pike, Rapier), die Wood
Elves (Elven wine), Lizardmen und Reavers (Blowpipe, Javelins), der Jäger der
Ostlanders (Double-barrelled pistol), der Captain der Maneaters (Cathayan
Longsword) und die Helden der Marauders (Great axe). Beide Apps prüfen das
in `catalogAllowed()` vor allem anderen;
auch die Hausregel „Free market“ hebt sie nicht auf (sie öffnet nur die
Waffenart). Test: `test/rare-restrictions.mjs`, `core/test/data-audit.test.ts`
(jeder Beschränkungstext hat eine Datenform oder steht in der Liste der
bloßen Hinweise); die Paritätstests vergleichen beide Apps über alle
Warbands.

**Entschieden (Rob, 29.09.2026):**

| Text | Gilt für |
| --- | --- |
| Dwarfs only (Dwarf axe) | Dwarf Treasure Hunters, Dwarf Rangers, der Troll Slayer der Pit Fighters (steht in seiner Liste) **und Zwerge als Hired Swords** (`only.hires: ["dwarf"]`: Troll Slayer, Pathfinder, Treasure Hunter, Runesmith Journeyman, Slayer Pirate). Heute bekommt ein Hired Sword in keiner App etwas aus dem Katalog (seine Ausrüstung ist RAW fest; die Hausregel „Hired Swords may buy extra equipment“ kauft aus der Heldenliste der Warband) – die Angabe greift, sobald das Umverteilen (V4) Gegenstände an Hired Swords geben kann. Test: `core/test/data-audit.test.ts` |
| Skaven only (Fighting claws, Weeping blades, Warplock pistol) | beide Skaven-Warbands (Eshin, Pestilens) |
| Undead („not Undead“ u. a.) | Undead, Restless Dead und Tomb Guardians |
| „(Arabian/Khemri)“ | keine Beschränkung: Gegenstände des Khemri-Settings für jede Warband dort, außer eine Quelle sagt ausdrücklich etwas anderes |

**Umgesetzt nach der naheliegenden Lesart, ohne Rückmeldung** – bei Bedarf
sagen:

| Text | Umgesetzt | Andere Lesart |
| --- | --- | --- |
| Goblins only (Ball and chain, Squig prodder) | Night Goblins, Forest Goblins, die Goblins der Orc Mob | nur Night Goblins |
| Elves („not Elves“) | Wood Elves, Dark Elves, Shadow Warriors | – |
| Cathay / Emissary (Cathayan Longsword) | Battle Monks of Cathay | auch jede Warband mit dem Swordsmith als Hired Sword |
| Marauders of Chaos (Chosen of Chaos) (Great axe) | Chieftain, Seer und Champion der Marauders (alle drei haben sie in ihrer Liste) | nur ein bestimmter Held |
| Middenheimers, Norse Explorers and Marauders (Wolfcloak) | Mercenaries Middenheim, Norse, Marauders – nicht die Ostermarkers mit Middenheim-Tabelle (C6: nur die Tabelle, nicht die Stadtregeln) | – |
| Reiklanders, Marienburgers, Tileans, Hochland (Rapier) | Mercenaries Reikland und Marienburg, Tileans, Hochland Bandits (und die Merchant Caravans, die es in ihrer Liste haben) – nicht die Ostermarkers (C6) | – |
| Marauders, Norse, Beastmen, Chaos Dwarfs, Possessed, Carnival (Obsidian weapon, Chaos armour) | Marauders, Norse, Beastmen, Sons of Hashut, Black Dwarfs, Possessed, Carnival | auch der Court of the Profane Pleasures |
| Vampires and Necromancers (Book of the Dead) | Vampire und Necromancer der Undead, Necromancer der Restless Dead | – |

**Bewusst ohne Beschränkung** (Text bleibt Hinweis): „(Arabian/Khemri)“
(siehe oben); „cavalry only“ (Lance) und „Warhorses only“ (Barding) – hängen
am Reittier, nicht an der Warband; „1st free“, „Common for …“, „Rare 6 for …“
– Preis oder Seltenheit, keine Beschränkung.

## F. Regeltexte für den ganzen Katalog (30.09.2026)

Rob, 30.09.2026: „Bei den Rare Searches möchte ich auch sehen, was die
Gegenstände machen.“ 58 Gegenstände des Katalogs hatten keinen Regeltext –
beide Apps zeigten bei ihnen kein ⓘ, und die Hilfen der Post-Battle-Sequenz
fanden sie nicht (etwa die Mordheim-Karte oder die Tarotkarten bei der
Erkundung). Betroffen war vor allem die sonstige Ausrüstung: Laterne,
Fackel, Banner, Krähenfüße, Feuerpfeile und -bomben, Blitzpulver, Dietriche,
Karten, Hasenpfote, Tarotkarten, Fernrohr, Kriegshorn, Gifte und Drogen,
Leitern, Truhe, Pulverfass, Fahrzeuge; dazu Schlagring, Brazier Iron,
Obsidianwaffe, Chaos-, Lamellen- und Pavise-Rüstung.

**Ergänzt** in `ITEMINFO` (`data/equipment.json`), in eigenen Worten und
knapp, nach mordheimer.net (Equipment: Miscellaneous Equipment, Armour,
Close-Combat Weapons, gelesen am 30.09.2026). Die Ultimate FAQ sagt nur zum
Zauberfolianten etwas (7.3: ob ein benutzter Foliant weitergegeben werden
darf, entscheidet die Gruppe) – das steht im Text. Wo mordheimer.net nur
Vorschläge macht (die Opulente Kutsche als Wagen), steht nur die Regel.
Fahrzeuge verweisen auf „Vehicles of the Empire“, weil ihre Regeln dort
stehen und nicht beim Gegenstand.

**Nebenwirkung, gewollt:** Die Brazier Iron ist jetzt laut ihrem Text
zweihändig; `isTwoHanded()` liest das aus dem Text, und so zählt sie beim
Wert eines Witch Hunters wie jede zweihändige Waffe. Keine bisherige
Zuordnung hat sich geändert: Die neuen Einträge stehen am Ende der Liste,
und ein Skript hat für jeden Namen aus Katalog und Ausrüstungslisten
geprüft, dass nur bisher textlose Namen einen Text bekommen.

Test: `core/test/data-audit.test.ts` („rules texts of the catalogue“) –
jeder Katalogeintrag hat einen Text, ähnliche Namen bekommen ihren eigenen
(Banner und Clan-Pestilens-Banner, Familiar und Schriftrolle, Obsidian- und
Zharr-Obsidianwaffe, kleine und große Leiter), die Brazier Iron ist
zweihändig.

**Dazu: neun Waffen mit dem Text einer anderen.** Die Suche nimmt den
ersten passenden Eintrag, und ein allgemeines Muster stand vor dem
besonderen: Der Schwertbrecher zeigte den Text des Schwerts (ohne seine
Klingenfalle), die Zwergenaxt den der Axt (ohne Parieren), der Seuchendolch
den des Dolchs, der Sigmaritische Kriegshammer, der Reiterhammer und sogar
der Hexenhammer – ein Buch – den von Keule/Hammer, die Harpunenarmbrust den
der Armbrust, die doppelläufigen Waffen der Ostländer die der einfachen.
Die besonderen Einträge stehen jetzt vorn; wo sie fehlten, sind sie neu.
Ein Skript hat für jeden Namen aus Katalog und Listen verglichen: Genau
diese 18 Namen (deutsch und englisch) haben einen anderen Text bekommen,
sonst keiner. Nebenwirkung: Der Reiterhammer ist zweihändig, wie seine
Regel sagt, und zählt so auch beim Wert. Test: „a special weapon is not
mistaken for the plain one“.

## G. Abgleich der Warbands von Grad 2a (Plan P9, 12.11.2026)

Die 18 Warbands von Grad 2a (und die Wood Elves) kamen aus einem Importer und wurden nicht Zeile für Zeile gegengelesen. Dafür gibt es jetzt
ein Werkzeug, das bleibt: `npm run audit -- <warband>|all [--grade 2a] [--cache <dir>]` (`core/scripts/audit-warband.ts`, Logik und Test
in `audit-lib.ts` und `core/test/audit-warband.test.ts`). Es liest die Seite von mordheimer.net mit `curl` (nach `--cache`, nie ins Repo),
legt sie neben die Datei der Warband (`data/warbands/<grad>/<key>.json`) und nennt **nur die Abweichungen**: Eckdaten der Warband (Mindestzahl,
Startgold, Höchstzahl), je Einheit Preis, Werte und Startrang, die Rassenmaxima, die Tabelle der Fertigkeitslisten, und je Ausrüstungsliste
Gegenstände und Preise. Es ändert nichts: Was eine Abweichung heißt, entscheidet Rob; ohne sein OK kommt nichts in `data/`.

**Ergebnis (12.11.2026):** 49 Befunde in 19 Warbands, keiner bei den Werten der Einheiten (bis auf eine), den Eckdaten, den Rassenmaxima und
den Fertigkeitstabellen. Alle Befunde stehen bei den Ausrüstungslisten und den Namen. Ein Teil ist nur **anders benannt**; der Rest ist unten
mit einem Vorschlag, **je Zeile Robs Entscheidung**.

### Nur anders benannt (kein Eingriff nötig, wenn der Katalogname gelten soll)

| Warband | Seite | Daten |
| --- | --- | --- |
| Grave Robbers | Hooded Lantern & Rig | Hooded Lantern and Rig |
| Halflings | Meat Cleaver (Axe), Cooking Pot (Helmet), Rope and hook | Cleaver, Cooking pot helmet, Rope & hook |
| Mazzalupo, Nipponese Expedition, Order of the Mare (Archer) | Horse | Riding/Draft Horse (Border Town Burning) |
| Necrarchs, Survivors of Strigos | Unholy Relic | Holy (unholy) relic |
| Vampire Hunters | Holy Water | Blessed water |
| Order of the Mare, Protectorate of Sigmar | Longbow | Long bow |
| Nipponese Expedition (Shinobi) | Blow Pipe, Shuriken (Throwing Stars), Lockpicks, Tripwire | Blowpipe, Throwing knives/stars, Lock picks, Trip wire |
| Dwarf Slayer Cult | Throwing Axes | Throwing Axe |
| Druchii | Witch Elves (Einheit) | „Witch Elve“ – der Name der Einheit ist falsch geschrieben; Vorschlag: **Witch Elf** |
| Dreamwalkers | Morr Worshwishpers (Einheit) | Morr Worshipper – ein Tippfehler der Seite; die Daten sind richtig |

### Zur Entscheidung

| Warband | Befund | Seite | Daten | Vorschlag |
| --- | --- | --- | --- | --- |
| Snotlings | Snotling Wheelo: Bewegung | M 0 | M 4 | Seite prüfen (das Rad hat evtl. eine eigene Regel für die Bewegung); sonst Daten auf 0 |
| Snotlings | Pebble (Free!) fehlt in den Listen; Pointy Stick (2 gc) und Small Pebble (0 gc) stehen in den Daten, nicht auf der Seite | – | – | Pebble aufnehmen; Pointy Stick und Small Pebble streichen oder die Quelle nennen |
| Halflings | Hunting Arrows (35 gc) fehlen in der Liste des Cook | 35 gc | fehlt | aufnehmen |
| Masters of Horror | Chainsaw Sword, Electric Trident (15 + D6 gc), Repeater Pistol (25 + 3D6 gc) fehlen in der Heldenliste | Preis mit Würfel | fehlt | als Gegenstand mit Würfelpreis aufnehmen (der Trading Post kennt Würfelpreise, Meldung #29) |
| Skaven of Clan Moulder | Club (3 gc) steht in der Heldenliste, nicht auf der Seite | – | 3 gc | streichen |
| Dwarf Slayer Cult | Hammer (3 gc) in den Listen von Slayer, Doomseeker und Rememberer, nicht auf der Seite; Dwarf Axe (nur Dwarf, 15 gc) fehlt beim Rememberer | – | – | Hammer streichen, Dwarf Axe aufnehmen |
| Order of the Mare | Spear, Halberd, Bow (nur Pilgrims) fehlen in der Liste „Footman“, Horse (nur Esquiresses) in der Liste „Archer“ | je 10 gc, 10 gc, 10 gc, 40 gc | fehlt | als Gegenstände mit Einschränkung aufnehmen |
| Wood Elves | Ithilmar armour (60 gc) fehlt in der Liste des Scout | 60 gc | fehlt | aufnehmen |
| Nipponese Expedition | die Namen der Gegenstände (oben) – wenn die Seite gelten soll | | | Namen nach der Seite, Katalog entsprechend |

Nicht geprüft (das Werkzeug kann es noch nicht): Sonderregeln, Fertigkeitstexte, die Zauberlisten und der Text der Einleitungen; die Hired Swords,
die jede Warband anheuern darf, stehen in P10.
## H. Lücken aus dem 2a-Lauf (Plan P10, 12.11.2026) – Fragen an Rob

Aus Pull Request 409 blieben drei Punkte offen. Nachgesehen auf mordheimer.net; **geändert ist nichts**, jede Zeile ist Robs Entscheidung.

### H1. Zauberlisten ohne Inhalt

| Liste in `data/spells.json` | Befund | Vorschlag |
| --- | --- | --- |
| **Blessings of the Lady** (leer, von keiner Warband benutzt; Notiz „Paladin (Bretonnian)“) | Auf der Seite gibt es `…/docs/magic/ladys-prayers` („Lady’s Prayers“): sechs Gebete mit vollem Text (Lady’s Favors, Blessed Protection, Swiftstride, Lady’s Scorn, Elixir of Life, Guiding Vision), benutzt von der **Chapel Guard Damsel** der Bretonnen – nicht vom Paladin. Eine Liste „Blessings of the Lady“ steht nicht dort. | Die Liste als **„Lady’s Prayers“** mit den sechs Texten aufnehmen (wie die anderen Gebetslisten, mit den FAQ-Anmerkungen der Seite) und der Damsel zuordnen; die leere Liste „Blessings of the Lady“ streichen. Frage: Hat der Paladin der Bretonnen eine eigene Liste? Dann bitte die Quelle nennen. |
| **Ice Magic** (leer, unbenutzt; Notiz „Ice Maiden (Kislev)“) | Unter `/docs/magic/` gibt es keine Seite „Ice Magic“; auch die Seiten der Warbands von Kislev nennen sie nicht unter den gefundenen Adressen. | Entweder **streichen** (keine Quelle, keine Warband) oder du nennst die Seite, dann wie oben mit vollen Texten. |

### H2. Hired Swords der neuen Warbands

Die Daten setzen die Regel „darf anheuern“ als Menge (`tags`: `merc`, `wh`, `sos`, `undead`, `skaven`, `goodElves` …; oder `only`/`except`/`none`). Die Seiten sagen in den meisten Fällen dasselbe in Worten – das stimmt mit den Daten überein. **Nicht belegt oder abweichend:**

| Warband | Seite | Daten | Vorschlag |
| --- | --- | --- | --- |
| Skaven of Clan Moulder, Necrarchs, Outlaws of Stirwood Forest | sagt nichts zu Hired Swords | `skaven` / `undead` / `merc` (nach Analogie gesetzt) | so lassen und in der Warband vermerken, dass die Seite schweigt; oder du entscheidest anders |
| Druchii | „darf nur anheuern“: Pit Fighter, Ogre Bodyguard, Warlock, Imperial Assassin, Tilean Marksman, Highwayman; inoffiziell Duelist, Witch, Emissary of Chaos, Human Scout, Old Prospector u. a. | Menge `goodElves` | die Liste der Seite als `only` eintragen (offizielle; die inoffiziellen nur nach deinem OK) |
| Sorcerous Society | keine Hired Swords oder Dramatis Personae mit der Fähigkeit Wizard, außer dem High Elf Mage; sonst wie Mercenaries | `merc` | Ausnahme „kein Wizard außer High Elf Mage“ in den Daten ergänzen (heute nur der Text) |
| Dreamwalkers | wie Mercenaries, Witch Hunters und Sisters, nicht nekromantisch oder chaotisch | `merc`, `wh`, `sos` | so lassen; Ausschluss „nekromantisch/chaotisch“ prüfen |

### H3. Gegenstände mit offenem Preis

Das sind keine Lücken des Katalogs, sondern Gegenstände mit Würfelpreis (z. B. 15 + D6 gc), die in den **Startlisten** fehlen, weil dort ein fester Preis stehen muss. Die Fälle der 2a-Warbands (Chainsaw Sword, Electric Trident, Repeater Pistol bei den Masters of Horror; Beastlash und Hunting Arrows) stehen in Abschnitt G mit dem Vorschlag, sie **mit Würfelpreis** aufzunehmen, wie der Trading Post ihn schon rechnet. Frage: Gilt der Würfelpreis auch beim Gründen (Startliste) oder nur danach (Trading Post)? Ich schlage vor: nur danach, bei der Gründung der Durchschnitt (aufgerundet), wie bei den Raritäten.

## I. Regeln mit Wirkung (Plan P11, Schritt 1) – die Liste, vor jedem ADR

Ich habe die Regeltexte aller 67 Warbands nach Sätzen durchsucht, die eine Zahl dauerhaft ändern (Wert, Rettungswurf, Zählung der Modelle, Startrang, Preis). Fast alles sind **Regeln für das Spiel selbst** (+1 Stärke bis Spielende, Führungswert im Umkreis, Treffer auf einen Wagen): Sie ändern das Roster nie und bleiben Text. Was das Roster betrifft, sind es wenige Fälle:

| Regel | Warband | Wirkung auf das Roster | Heute |
| --- | --- | --- | --- |
| Captured Thrall | Cavalcade | zählt nicht zur Höchstzahl der Modelle (13 → bis 18), kann nicht entlassen werden | Text |
| Troll: Always Hungry | Black Orcs | 20 gc Unterhalt nach dem Spiel, oder zählt als 2 Mitglieder für 5 gc (Höchstzahl faktisch 11) | Text |
| Goblin / Cave Squig: Not Orcs | Orc Mob | zählt für den Rout-Test nur als halbes Modell | Text |
| Not Orcs, Snotling Shoota Team | Orc Mob, Snotlings | die Gruppe zählt als ein Modell (Shoota Team) | Text |
| Wheelo: Upgrades | Snotlings | steigt nach der Heldentabelle auf, nicht „That Lad’s Got Talent“, kein Wert mehr als einmal erhöht | Text |
| Bullied Goblin | Snotlings | +1 Führungswert je 2 Snotlings in 6 Zoll (höchstens 10) – nur im Spiel | Text |
| Guiding Dream, Goading, Commands, Slayer Rites, Transform | verschiedene 2a | nur im Spiel oder Auswahl beim Aufstieg | Text |

**Vorschlag:** kein allgemeiner Regel-Interpreter. Wenn überhaupt, ein kleines Feld am Regel-Eintrag nur für **„zählt als“** (n Modelle für die Höchstzahl, die Rout-Zählung und die Kosten) – das sind drei der Zeilen oben (Thrall, Troll, Shoota Team) und gehört zu `core/src/rules/` (Höchstzahl und Worth). Ob sich das lohnt, ist deine Entscheidung; ein ADR schreibe ich erst danach. Die übrigen bleiben Text. (P11 hängt an P9: die Daten der Einheiten sollen vorher stimmen.)

## J. Robs Entscheidungen zu G, H und I (13.11.2026) und was daraus wurde

Rob: „Ice Magic streichen. Würfelpreise bei Start Equipment sollten ein Feld zum Eintragen haben (nur mit erlaubter Range, aber immer Gesamtpreis) und mit
Option zum Würfeln. Beim Rest gehe mit deinen Vorschlägen.“ Umgesetzt:

- **Gestrichen:** `iceMagic` und `blessingsLady` aus `data/spells.json` (beide leer und von keiner Warband benutzt). **Korrektur zu H1:** „Lady’s Prayers“ gab es
  schon (`ladysPrayers`, sechs Gebete, von der Damsel der Chapel Guard benutzt, in den Daten mit denselben Namen und Schwierigkeiten wie auf der Seite); neu
  aufzunehmen war nichts.
- **Würfelpreis:** Masters of Horror: Chainsaw Sword und Electric Trident (15 + D6 gc), Repeater Pistol (25 + 3D6 gc) stehen jetzt in der Heldenliste, und
  jede Zeile mit `dice` hat im Roster je Stück ein Feld für den Gesamtpreis (nur im erlaubten Bereich) und einen Knopf „Roll“ ([ui.md](ui.md),
  [data-model.md](data-model.md): `models[].eqPaid`). Ohne eingetragenen Preis zählt das Stück zur Basis, wie in der alten App.
- **Aus G eingearbeitet:** Halflings: Hunting Arrows (35 gc) in der Liste des Cook; Skaven of Clan Moulder: Club aus der Heldenliste gestrichen; Dwarf Slayer
  Cult: „Hammer“ gestrichen (die Seite führt „Mace/Hammer“ als einen Gegenstand, die Daten hatten Streitkolben und Hammer), Dwarf Axe (15 gc) beim Rememberer;
  Wood Elves: Ithilmar armour (60 gc) in der Liste des Scout; Druchii: die Einheit heißt **Witch Elf**; Snotling Wheelo: Bewegung `D6` (die Seite zeigt „*“ und
  sagt „1D6 Zoll“; die 4 in den Daten war ein Platzhalter).
- **Nichts zu ändern war bei** Order of the Mare (die Seite hat eine Liste „Footman“ mit Hinweisen „nur Pilgrims“, die Daten haben dafür eine Liste je Einheit
  und führen Spear, Halberd und Bow bei den Pilgrims) und den Snotlings (die Seite nennt den Dolch „Dagger/Pointy Stick“ und den Kiesel „Pebble“; die Daten
  „Pointy Stick“ und „Small Pebble“ sind dieselben Gegenstände). Die Namen aus der Tabelle „Nur anders benannt“ bleiben, wie die Kataloge sie führen.
- **Hired Swords:** Druchii: die offizielle Liste der Seite als `only` (Pit Fighter, Ogre Bodyguard, Warlock, Imperial Assassin, Tilean Marksman,
  Highwayman); die inoffiziellen Namen nur nach deinem OK. Sorcerous Society: `except` für die Hired Swords, die Wizard sind (Warlock, Witch, Dark Mage, Fallen
  Sister); der High Elf Mage bleibt erlaubt. Die Ausnahme für Dramatis Personae mit Wizard fehlt noch.
- **P11 („zählt als“):** zurückgestellt bis zum Abschalten der alten App (P13). Beim Versuch am Captured Thrall (`noCount`, zählt nicht zur Höchstzahl)
  bricht die Parität bei der Cavalcade, weil die alte App ihn mitzählt; eine Ausnahme je Wanderung wäre breit. Ohne die alte App ist es ein kleines Feld
  ohne Ausnahme.
