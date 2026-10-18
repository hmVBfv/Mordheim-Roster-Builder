# 0020 – Live-Aktualisierung: ein Signal-Strom je offener App
Status: angenommen · Datum: 2026-10-18 · ergänzt [0005](0005-react-pwa-client-computes.md), [0010](0010-single-writer-protocol-author-notes.md) und [0011](0011-hidden-data-never-leaves.md)

## Kontext
Bisher fragte jeder Bildschirm in seinem eigenen Takt nach (Sync alle 10 s,
Notizen und Bilder 10 s, Hintergrund 20 s, Zeitleiste 15 s, im Gefecht 5 s). Kampagne, Chronik, Welt, Szenarien, Fragen und die Listen luden nur
beim Öffnen. Spielerin A musste also neu laden oder bis zu einer Minute
warten, bis sie sah, was B getan hatte (Rob, 18.10.2026: „Es sollte
sozusagen direkt auch live mit verändert werden“). Die Schreibseite war nie
das Problem: jede Änderung geht über die Endpunkte mit `baseRev`/`baseSeq`
und der Server bleibt der eine Schreiber (ADR 0010).

Die Architektur sah Server-Sent Events als „spätere Option“ vor
(architecture.md, Abschnitt 6). Hier ist sie, mit einer Grenze: der Strom darf
nichts tragen, was die Sichtbarkeitsregeln umgehen könnte (ADR 0011).

## Entscheidung
- **Ein Strom je offener App:** `GET /api/v1/events` (Server-Sent Events) für
  jeden, der angemeldet ist. Der Strom trägt **nur Signale**:
  `{"campaign":"<id>"}` („diese Kampagne hat Neues“) oder `{"sync":true}`
  („deine Warbands haben Neues“). Keine laufende Nummer (sie zählt die
  Aktivität aller Kampagnen), kein Titel, kein Name, kein Inhalt.
- **Die App holt nach,** was sie zeigt, über die Endpunkte, die sie ohnehin
  benutzt – also durch `can()` und die Sichtbarkeitsfilter (ADR 0011). Ein
  Signal kann nichts verraten, was die Antwort nicht auch zeigt; im
  schlimmsten Fall lädt eine App einmal umsonst nach.
- **Wen ein Signal erreicht, entscheidet die Sichtbarkeit des
  Audit-Eintrags** (`live.ts`, `routesOf`): `public` → alle aktiven Mitglieder
  der Kampagne; `leader` → die Leiter; `sealed` → nur der Autor; Admin-Einträge
  → niemanden. Entwürfe einer Warband gehen nur an die Geräte ihres Besitzers
  (Sync); neue Version, Anlegen und Archivieren einer Warband in einer
  Kampagne auch an deren Mitglieder. `audit()` ruft den Hub nach dem
  Schreiben – wer einen neuen schreibenden Pfad baut, bekommt die Signale
  mit dem Audit-Eintrag, den er ohnehin schreiben muss.
- **Kein Wiederholen verpasster Signale.** Beim Öffnen des Stroms, beim
  Zurückkehren in den Vordergrund und nach langem Schweigen fragt die App
  alles neu, was sie zeigt. So muss der Server nichts vorhalten, und ein
  verlorenes Signal kostet nie mehr als die frühere Wartezeit.
- **Der alte Takt bleibt als Rückfall.** Solange der Strom steht, fragen die
  eigenen Timer der Bildschirme nur noch in jeder sechsten Runde (ein
  Sicherheitsnetz); fällt er aus, gilt wieder der alte Takt (`pollWhileVisible`
  in `app/src/live/live.ts`). Geht gar kein Strom (alter Browser, Proxy, der
  ihn verbietet), ändert sich gegenüber heute nichts.
- **Grenzen auf dem Pi:** höchstens 6 Ströme je Konto (der älteste weicht – eine
  neue Verbindung nach einem Abriss darf nicht an ihrem Geist scheitern),
  150 insgesamt (dann 503 mit `Retry-After: 30`), ein Herzschlag alle 20 s als
  `event: ping` (ein Kommentar erreichte den JavaScript-Code nie, und die App
  müsste eine tote Leitung erraten), danach ein Blick, ob die Sitzung noch
  gilt; spätestens nach 15 Minuten endet ein Strom, die App verbindet neu
  und fragt alles neu. Änderungen im Abstand von weniger als 40 ms werden
  als eine Meldung gesendet, und die App fasst Signale nochmals 150 ms
  (höchstens 1 s) zusammen. Ein langsamer Leser (mehr als 64 KB offen) wird
  getrennt.
- **Das Konto steht in der Adresse** (`?user=<id>`), weil ein EventSource keinen
  Header `X-Roster-User` schicken kann. Der Server vergleicht es wie sonst
  mit der Sitzung: ein anderes Konto ist 409 `other_user`.
- **Der Hub lebt im Speicher** (eine Instanz je Datenbank). Nach einem
  Neustart verbinden sich die Apps neu und fragen alles neu; nichts davon
  steht in der Datenbank.
- **Beim Beenden** schließt ein `preClose`-Hook alle Ströme, und `start.ts`
  trennt nach einer Frist (3 s) die übrigen Verbindungen; sonst wartete
  `server.close()` auf Keep-Alive-Verbindungen, die ein abgebrochener Strom
  hinterlässt (Node 22). Compose gibt dem Container 20 s (`stop_grace_period`).
- **Caddy braucht keine Änderung.** `reverse_proxy` reicht
  `text/event-stream` sofort weiter, und `encode` fasst eine Antwort mit
  `Cache-Control: no-transform` nicht an. `ops/test/caddy.sh` prüft beides
  gegen eine Nachbildung des Stroms (erste Zeile sofort da, nicht
  komprimiert).
- **Neuer Endpunkt, neue Aktion:** `events.read` (jeder Angemeldete) in
  `policy.ts` und als Zeile der Leak-Matrix. Die Matrix kennt dafür eine
  Probe `stream`, die Kopf und erste Zeile liest und den Strom schließt.

## Folgen
- Änderungen anderer Mitglieder erscheinen in Kampagne, Notizen, Chronik,
  Bildern, Gefecht, Zeitleiste, Hintergrund, Welt, Szenarien, Fragen, den
  Listen und im Sync nach etwa einer Sekunde, ohne neu zu laden.
- Eine App im Hintergrund hält den Strom offen, solange der Browser sie
  lässt; ein schlafendes Handy verliert ihn, die App fragt beim Zurückkehren
  alles neu.
- Das Signal sagt, **dass** sich in einer Kampagne etwas geändert hat. Ein
  versiegelter Eintrag eines Spielers erreicht nur ihn; dass jemand schreibt,
  sehen andere nie.
- Last: ein offener Strom je Gerät; auf dem Pi (256 MB) bei vier bis acht
  Spielern kein Thema. Die Grenze von 150 schützt vor einem Fehler in der App.
- Der Trail einer Fehlermeldung kennt den Zustand des Stroms als Schritt der
  Art `sync` („stream live“, „stream down“) – ohne neue Art, damit das
  Meldungsformat bleibt.

## Verworfen
- **Inhalte im Strom.** Dann müsste der Strom pro Empfänger filtern, ein
  zweiter Pfad neben `can()`; ein Fehler dort wäre ein Leck. Signale sind
  harmlos, weil die Antwort der Endpunkte gilt.
- **WebSocket.** Bidirektional, aber wir schreiben schon über Endpunkte mit
  Konflikterkennung; ein zweiter Schreibweg wäre mehr Fläche, und Proxys und
  Wiederverbinden sind aufwendiger als bei SSE (das der Browser selbst
  wiederholt).
- **Kürzeres Abfragen.** Mehr Last und Akku, und trotzdem Sekunden Verzug.
- **Eine laufende Nummer im Signal** (zum Nachholen genau des Verpassten):
  sie verriete Aktivität anderer Kampagnen und braucht einen Puffer im
  Server.
- **Redis, Message-Broker, mehrere Prozesse.** Ein Prozess, ein Pi.
- **Web Push** für Benachrichtigungen bei geschlossener App: bleibt
  Entscheidung F in Phase 5.
