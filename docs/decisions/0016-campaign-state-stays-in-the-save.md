# 0016 – Die Kampagnenmechanik einer Warband bleibt in ihrem Speicherstand

Status: vorgeschlagen · Datum: 2026-10-05

## Kontext
Das Datenmodell sah vor, dass die Kampagnendaten einer Warband (Runde,
Schlachten, Verluste, Log, Stufen-Snapshots, Post-Battle-Fortschritt) auf
den Server in eigene Tabellen wandern und in der Version nur noch
`{ campaignId, round }` steht. Die gesamte Mechanik danach – Verletzungen
aus Verlusten, ausstehende Erfahrung, Erkundung, Wyrdstein, Stufen, der
Vergleich zweier Stände samt Abgleich mit dem Anlass – liegt aber 1:1
portiert in `core/` und arbeitet auf genau diesem Teil des Speicherstands
(`S.campaign`), geprüft durch die Paritätstests gegen die alte App. Sie für
Servertabellen neu zu schreiben, hieße, die geprüfte Logik aufzugeben und
eine zweite zu bauen, die niemand gegen die alte App prüft.

## Entscheidung
- Was eine Warband in der Kampagne erlebt, steht weiter in ihrem
  Speicherstand (`campaign`: Runde, Schlachten, Verluste, Log, Snapshots,
  Post-Battle). `core/` rechnet darauf wie bisher.
- Was alle teilen, liegt auf dem Server: Kampagne, Mitglieder, Schlachten,
  Protokoll, Notizen, Markierungen (Tags) mit eingefrorenen Kennzahlen und
  Änderungen.
- Die Brücke ist ein Schritt der App: Zu Beginn der Nachbereitung übernimmt
  sie die geschlossene Schlacht in den Speicherstand der eigenen Warband –
  die Stufe bis zur Runde der Schlacht weiterschalten, die Schlacht mit
  allen Seiten und ihrem Ergebnis, die Verluste, an denen die Warband
  beteiligt war (als Opfer oder als Angreifer). Einmal je Schlacht (die
  Schlacht im Speicherstand trägt die Server-ID); danach rechnet `core/`.
- Beim Markieren („After battle N“) rechnet der Server mit `core/` den
  Vergleich zwischen der Version der vorigen Markierung und der markierten
  Version und gleicht ihn mit Log und Verlusten dieser Schlacht im
  Speicherstand ab; Kennzahlen und Änderungen werden eingefroren
  (ADR 0003, ADR 0005: verbindlicher Vergleich beim Markieren).

## Folgen
- Ein Speicherstand bleibt vollständig: exportiert, im Quick Build oder in
  der alten App geöffnet, trägt er seine Kampagnengeschichte mit.
- Was der Server über eine Schlacht weiß (Protokoll), steht danach zweimal:
  auf dem Server als Protokoll, im Speicherstand als Verluste. Maßgeblich
  für die Mechanik der Warband ist der Speicherstand; das Protokoll ist die
  Quelle beim Übernehmen.
- `data-model.md` beschreibt die Version entsprechend; die Kampagnendatei
  bleibt ein Export.

## Verworfen
- Kampagnendaten nur auf dem Server: verlangt eine zweite Implementierung
  der Mechanik und bricht die Parität mit der alten App.
- Den Server die Verluste in den Speicherstand schreiben lassen: der Server
  ändert keine Warband (ADR 0005), und der Spieler soll sehen, was übernommen
  wird.
