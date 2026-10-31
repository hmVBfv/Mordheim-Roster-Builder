# 0022 – Verborgene Teile bei den NPCs eines Szenarios
Status: vorgeschlagen (Leiter ohne Authenticator seit [0030](0030-authenticator-for-admins-only.md) wie Leiter mit) · Datum: 2026-10-19 · ergänzt [0002](0002-mechanics-open-narrative-hidden.md), [0011](0011-hidden-data-never-leaves.md)

## Kontext
Ein Szenario ist bis zur Freigabe nur für Leiter lesbar und danach für alle
offen ([0002](0002-mechanics-open-narrative-hidden.md)). Rob will ein Szenario
freigeben können, ohne dass jeder NPC, dem die Warbands darin begegnen, nach dem
Kampf vollständig erklärt ist: er kann später wieder auftreten und dann wieder
in ein Szenario gezogen werden. Im Tabletop Simulator steht an seiner Karte ein
„?“ statt des Werts, am Tisch wie in der App.

ADR 0002 verwirft „verborgene Werte für den Spielleiter“, weil sie der Tischregel
widersprechen: niemand soll Werte vor den Spielern haben, die das Spiel
beeinflussen. Hier geht es um etwas anderes: Werte eines Gegners, den die
Spieler am Tisch zwar bekämpft haben, dessen Karte sie aber nie ausgehändigt
bekamen. Die Regeln bleiben offen – der Gegner ist ein Modell aus dem Spiel, das
jeder nachschlagen kann; verborgen wird, *welches* Modell es ist und was der
Leiter ihm gegeben hat.

## Entscheidung
- Ein Szenario trägt seine **eigenen NPCs** (`scenarios.npcs`): neu geschrieben,
  aus dem Spiel kopiert (Warbands, Hired Swords, Dramatis Personae, Bestiary),
  aus der Welt (direkt aus der Liste der Welt-NPCs: „Add an NPC of the world“)
  oder aus einem früheren Szenario – kopiert, nie verknüpft.
- Der Leiter kann an jedem dieser NPCs **Teile verbergen**: den Namen, einzelne
  Werte (M WS BS S T W I A Ld, Sv) oder alle, Fertigkeiten, Ausrüstung,
  Sonderregeln – oder mit einem Haken **alles** („Hide everything“, jeder Teil,
  den es gibt). Er wählt sie beim Anlegen oder Ändern.
- **Die Tooltips der Ausrüstung** (`equipmentTips`: je Gegenstand Name und
  Text, was er kann) sind ein **eigener verborgener Teil**: Die Spieler sehen
  die riesige Sichel in der Hand des Gegners und müssen nicht gleich ihre Werte
  kennen (Rob, 20.10.2026). Der Leiter wählt die Gegenstände aus allem
  Ausrüstungsmaterial der Datenbank (`data/equipment.json`) oder schreibt sie
  von Hand; die Tooltips kommen aus der Datenbank (Preis, Regeln, Reichweite)
  oder aus seiner Feder und lassen sich beim Einfügen abwählen. Verborgen
  ersetzt der Server sie durch ein einziges „?“ (auch wenn der Gegenstand nie
  einen Tooltip hatte: ein „?“ verrät nicht, ob es einen gab). **Verborgene
  Ausrüstung nimmt ihre Tooltips mit** – schon die Namen der Tooltips verrieten
  den Gegenstand –; die Spieler lesen dann gar keine.
- Für alle, die nicht Leiter mit Authenticator sind, ersetzt **der Server** jeden
  verborgenen Teil durch „?“, bevor er antwortet (ADR 0011). Der Wert verlässt
  den Server nicht. Auch der Hinweis, woher der NPC kopiert wurde (`from`), fällt
  weg. **Der Typ (Hero, Henchman …) liest niemand**, auch nicht als „?“ (Rob,
  20.10.2026: zu viel Spielmechanik für die Runde): Er wird weder abgefragt noch
  angezeigt, der Server liefert ihn als leeren Text, die TTS-Karte hängt nicht
  an ihm. Er bleibt als Wert im NPC (er kommt mit einer Kopie), nur nie zu sehen.
- Leiter mit Authenticator sehen alles. Ihr Tabletop-Simulator-Export trägt das
  „?“ an den verborgenen Stellen – das ist die Karte für den Tisch –, und sie
  können sich die ganze Karte zum eigenen Gebrauch kopieren. Mit dem **Auge**
  („Players’ view“) sieht ein Leiter jede Karte so, wie die Spieler sie lesen,
  und mit einem zweiten Klick wieder ganz.
- Solange das Szenario ein Entwurf ist, lässt sich alles frei ändern: niemand
  hat es gelesen. **Nach der Freigabe** darf Verborgenes aufgedeckt, aber **nicht
  mehr geändert** werden (auch nicht beim Aufdecken), nichts bereits Gelesenes
  wird nachträglich verborgen, und ein NPC mit verborgenen Teilen bleibt
  (Versionen sind append-only, [0003](0003-versions-append-only.md)). Der Server
  antwortet sonst mit 409 `frozen`. Aufgedeckt bleibt aufgedeckt.
- Die Tooltips folgen denselben Regeln nach der Freigabe wie jeder andere Teil
  (`equipmentTips` ist ein Wert von `hidden`): gesperrt, solange verborgen,
  aufdeckbar, nie nachträglich verborgen.
- Jede Aufdeckung nach der Freigabe steht im Log als `scenario.reveal`: welcher
  NPC, welche Teile – nie der Wert.

## Folgen
- Szenario-Antworten für Nicht-Leiter werden serverseitig geschwärzt; der
  Leak-Test (`NPC-HIDDEN-SECRET`) prüft, dass kein verborgenes Wort im Antworttext
  eines Spielers steht. Frühere Fassungen (`scenario_revisions`) liest kein
  Endpunkt.
- NPCs der Welt bleiben für alle offen und ohne verborgene Teile; sie sind
  Mechanik, die alle kennen sollen ([0002](0002-mechanics-open-narrative-hidden.md)).
- Der Freitext `npc_statlines` bleibt, wie er geschrieben ist, und wird nicht
  geschwärzt. Wer einen NPC verbergen will, legt ihn als NPC des Szenarios an.
- Wer das Szenario gespielt hat, kennt die Werte aus dem Spiel selbst: das „?“
  ist Nebel, kein Geheimnis zwischen Menschen am Tisch.

## Verworfen
- Verborgene Werte in der Welt (NPC-Liste): widerspricht
  [0002](0002-mechanics-open-narrative-hidden.md) ohne Not.
- Nur im Tabletop-Simulator-Export verbergen, in der App alles zeigen: die
  Spieler läsen dann doch nach, und der Server lieferte, was er nicht liefern
  soll.
- Verborgene Werte nach der Freigabe frei änderbar: der Leiter könnte anpassen,
  was die Spieler nie sehen konnten – gegen die Tischregel, die dieser ADR sonst
  nicht antastet.
- Die NPCs eines Szenarios mit den NPCs der Welt verknüpfen: ein später
  geänderter Welt-NPC änderte ein Szenario, das schon gespielt ist.
