# Verhaltensänderungen gegenüber der alten App

Stand: 27. September 2026

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

Gefunden durch die Paritäts-Wanderung (`core/test/parity/walk.ts`).

| Fehler | Folge | Behoben |
| --- | --- | --- |
| Beim Befördern (The Lad's Got Talent) nahm der Chronik-Eintrag die `uid` vom letzten Modell der Liste | Stand ein anderer beförderter Held am Ende, nannte der Eintrag den falschen Krieger | `js/app.js`, Test `test/promote-log.mjs` |
| Der beförderte Held teilte Verletzungs- und Zauber-Objekte mit seiner alten Gruppe | Zauberschwierigkeit des Helden senken senkte sie auch bei der Gruppe (bis zum Neuladen) | `js/app.js`, Test `test/promote-copies.mjs` |

## Erledigt: bewusst anders in `core/`

| Verhalten | Alte App | `core/` | Grund |
| --- | --- | --- | --- |
| Krieger-`uid` nach Entfernen | nie wiederverwendet, aber nur im laufenden Browser | nie wiederverwendet, Zähler `uidSeq` steht im Stand | Versionen und Vergleiche hängen an der `uid` |
| Chronik-IDs | Zähler im laufenden Browser | Zähler `campaign.logSeq` im Stand | wie oben |
| Kanonische Form (Hausregel-Vorgaben, Kampagnenlisten, gültige Persona) | entstand nebenbei beim Zeichnen | `normalizeState` beim Laden; Persona auch bei Subtyp- und Optionswechsel | Verhalten darf nicht davon abhängen, was gerade angezeigt wird |
| Offene/zugeklappte Bereiche (`_…Open`) | im Speicherstand | nicht Teil des Stands | Bildschirmzustand gehört nicht in die Historie |
| Ungültige Eingabe (unbekannte Warband/Einheit) | Fehler (Absturz) | neutraler Wert (0, leere Liste) | robust gegen alte oder beschädigte Stände |
| Abgelehnte Aktion (z. B. Heldenlimit erreicht) | Hinweisfenster | derselbe Stand zurück; die Oberfläche erklärt | keine Dialoge in der Logik |

## Geplant

*Noch leer – hier kommen Robs Wünsche für den neuen Builder hinein.*

| Nr. | Was | Warum / Quelle | Entscheidung | Status |
| --- | --- | --- | --- | --- |
