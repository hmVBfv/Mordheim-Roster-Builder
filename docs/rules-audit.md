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
