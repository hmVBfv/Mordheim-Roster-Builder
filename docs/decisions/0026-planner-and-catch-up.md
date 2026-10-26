# 0026 – Der Planner und das Catch-up: späte Warbands planen und spät einsteigen
Status: angenommen (Rob, 25.10.2026, Wunsch #77) · Datum: 2026-10-25 · ergänzt [0002](0002-mechanics-open-narrative-hidden.md), [0003](0003-versions-append-only.md)

## Kontext
Rob will sehen, welche Rares stark sind und wie am Ende eine gute Zusammenstellung
aussieht – ohne Goldgrenze und ohne Erfahrung für Steigerungen. Daraus folgt eine
zweite Frage: wie steigt ein Spieler in eine laufende Kampagne ein, wenn die
anderen längst Erfahrung, Gold und Ausrüstung haben?

## Entscheidung
1. **Der Planner ist eine eigene Art Warband** (`planner: true` im Spielstand, kein
   Schalter an einer bestehenden). Er zeigt den **Wert** (alles, was er besitzt, zu
   Listenpreisen) statt des Golds, kennt kein „Not enough gold“ und nennt je Modell
   die **Erfahrung, die seine Steigerungen bräuchten**. Er steht in der Liste in
   einem eigenen Abschnitt und tritt **nicht** als Kopie in eine Kampagne ein: die
   App bietet ihn dort nicht an, der Server lehnt `planner: true` ab.
2. **Nachzügler steigen mit dem Catch-up ein.** Ein Planner tritt über „Planners, to
   join late“ in eine Kampagne ein; eingetragen wird eine **gewöhnliche Warband**
   (ohne Planner-Merkmal), die Kopie verweist wie sonst auf ihren Ursprung.
3. **Maß ist der Median** der Warbands der Kampagne, die mindestens eine Schlacht
   gespielt haben (nicht der Durchschnitt: eine übermächtige und eine fast
   aufgeriebene Warband verzerren ihn): Wertung, Wert (Besitz zu Listenpreisen plus
   Gold in der Hand) und Zahl der gespielten Schlachten. Hat noch keine eine Schlacht
   gespielt, gilt, womit eine neue Warband beginnt.
4. **Die Wertung (5 je Krieger, dazu alle Erfahrung; die einer Henchmen-Gruppe je
   Mann) schließt man mit Erfahrung, in Wertungspunkten.** Der Wert erlaubt das Gold:
   höchstens der Median, nie weniger als das Startgold; was man nicht ausgibt, bleibt
   in der Hand.
5. **Die Erfahrung geht gleichmäßig aus, nie an einen allein:** jede Henchmen-Gruppe
   so viele Punkte wie Schlachten, jeder Held ebenso, der Anführer die Hälfte davon
   (aufgerundet) zusätzlich; der Rest der Lücke gleichmäßig auf die Helden. Ein Held
   darf verschoben werden, aber nicht unter die Schlachten und nicht über das
   Anderthalbfache des gleichmäßigen Anteils. Reicht die Lücke dafür nicht, bekommen
   alle gleichmäßig weniger.
6. **Steigerungen werden gewählt, nicht gewürfelt.** Der Planner hält je Modell die
   nötige Erfahrung; der Eintrag prüft sie gegen das, was der Plan gibt.
7. **Der Leiter darf übersteuern.** Was den Plan übersteigt, steht in der Warband
   (`campaign.catchUp.over`) und wird dem Leiter, der bestätigt, gezeigt; verboten
   wird nichts. Der Eintrag nennt, wonach gemessen wurde (`campaign.catchUp`), und
   wird mit der Fassung „start“ eingefroren wie jede andere (ADR 0003).
8. **Die Zahlen der anderen sind offen** für jedes Mitglied (ADR 0002, Mechanik): `GET
   /campaigns/:id/catchup` liefert Wertung, Wert und Schlachten der aktiven Warbands,
   ohne Namen. Gerechnet wird im Client (`core/src/campaign/catchup.ts`, ADR 0005).

## Folgen
- Neuer Schlüssel `planner` im Spielstand und `campaign.catchUp`; nur Schlüssel
  (`test/compat.mjs`), keine Migration des Formats.
- Der Server kennt eine Route mehr (Leck-Matrix: `campaign.read`).
- Offen, nicht gebaut: Warbands, die der Spielleiter als NPC verborgen in eine
  Kampagne legt (Wunsch #79) – sie könnten dieselbe Art ohne Goldgrenze nutzen.

## Verworfen
- **Ein Schalter „Late Game“ an jeder Warband:** Rob wollte eine eigene Gruppe/Art.
- **Durchschnitt statt Median:** Ausreißer verzerren ihn.
- **Alle Erfahrung an einen Helden:** das ist die Sorge hinter Punkt 5.
- **Würfeln der Steigerungen beim Eintrag:** der Planner soll nicht nachgebaut werden
  müssen.
