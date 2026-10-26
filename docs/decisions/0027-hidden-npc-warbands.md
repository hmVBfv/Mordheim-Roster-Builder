# 0027 – Versteckte NPC-Warbands: Referenz und TTS-Daten des Spielleiters
Status: angenommen (Rob, 26.10.2026, Wunsch #79) · Datum: 2026-10-26 · ergänzt [0002](0002-mechanics-open-narrative-hidden.md), [0011](0011-visibility-only-on-the-server.md), [0026](0026-planner-and-catch-up.md)

## Kontext
Ein Leiter will Warbands in die Kampagne legen, die als **Referenz** und als **Tabletop-Simulator-Daten**
dienen – Gegner, die er spielt –, ohne dass ein anderes Mitglied sie sieht. Startgold und Goldgrenze
sollen frei sein, um den Schwierigkeitsgrad einzustellen.

## Entscheidung
1. **Sichtbar nur für Leiter mit Authenticator** (Rob: „Nur Leader“). Für Spieler, Zuschauer und den
   Admin außerhalb der Kampagne gibt es nichts davon: nicht in einer Liste, einem Sync oder einem
   Export, im Log nur „etwas hat sich geändert“ (Sichtbarkeit `leader`, kein Wort). Das ist wie der
   Hintergrund (Phase 4b1), mit eigenen Aktionen `npcwarband.read` und `npcwarband.write` und
   Einträgen in der Leak-Matrix.
2. **Eine NPC-Warband ist ein Planner** ([0026](0026-planner-and-catch-up.md)): ohne Goldgrenze,
   mit geöffnetem Trading Post. **Nachgehalten** wird, was ausgegeben wurde (Wert zu Listenpreisen),
   wie viel Erfahrung die Steigerungen bräuchten und die Wertung (`plannerFigures`); eine Pflicht, die
   Erfahrung gleichmäßig zu verteilen, gibt es nicht (anders als beim Catch-up eines Nachzüglers).
3. **Eigene Tabelle `npc_warbands`** (Migration 40) mit dem Spielstand als JSON und den drei Zahlen als
   `summary`, damit die Liste keinen Stand braucht. Sie ist **keine Einschreibung**: sie zählt nicht
   zu den Warbands der Kampagne, hat keine Marken und keine Versionen. Eine Änderung braucht
   `baseSeq` (zwei Leiter), Herausnehmen ist ein Grabstein, der Name und Stand leert.
4. **Der Leiter pflegt sie in seinen eigenen Warbands.** In der Kampagne legt er eine seiner Warbands
   als NPC-Warband ab (eine Kopie als Planner), ersetzt sie später aus einer anderen oder nimmt eine
   Kopie zum Bearbeiten wieder zu sich. Die Tabletop-Simulator-Karten liest er in der Kampagne.

## Folgen
- Jede neue Route steht in der Leak-Matrix; ein Marker `NPCWARBAND-SECRET` darf in keiner Antwort an
  eine Rolle der Matrix stehen.
- Eine NPC-Warband tritt nie in eine Kampagne ein und wird nie mit anderen geteilt.
- Rechte und Sichtbarkeit sind einzig auf dem Server: der Client zeigt den Bereich nur Leitern, der
  Server entscheidet.
