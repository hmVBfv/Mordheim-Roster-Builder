# 0032 – Das Nachspiel hält fest, was es gebracht hat
Status: angenommen (Rob, 14.11.2026) · Datum: 2026-11-14

## Kontext
Die Post-Battle-Sequenz (`core/src/campaign/postbattle.ts`) war „a guided checklist, not a dice roller“: sie hielt nur fest,
welche Schritte erledigt sind (`done`) und den Wyrdstone-Verkauf (`wyrd`). Würfe, Funde und Einnahmen blieben außerhalb: der
Spieler trug Splitter und Gold von Hand ein, und danach ließ sich nicht mehr sagen, **woher** etwas kam. Die Statistik
(`docs/plan-2026-11.md`, P14) und die Bilanz einer Runde brauchen genau das: Einnahmen nach Quelle, gefundene Gegenstände mit
Wert. Der Arbeitsplan steht in `docs/plan-postbattle.md`.

## Entscheidung
1. **Das Nachspiel ist ein Protokoll.** `campaign.postbattle[round]` bekommt neben `done` und `wyrd` optionale Felder:
   `explore` (Würfel, gewählte Würfel, Summe, Splitter, Ort), `xp` (Underdog-Bonus, Szenario-Erfahrung), `upkeep` (Sold bezahlt
   oder entlassen) und `finds`. Ein **Fund** (`Find`) ist alles, was ein Schritt gebracht oder gekostet hat: Art (`gold`,
   `wyrd`, `item`, `exp`, `note`), **Herkunft** (`source`: `explore`, `location:<Ort>`, `scenario`, `wyrdstone`, `upkeep` …),
   Menge, Gegenstand, Listenpreis je Stück (`worth`), Krieger und ein Satz Text.
2. **Eintragen oder würfeln, immer beides.** Ein Wurf (`Rolled`) hält die Zahlen und ob sie eingetragen oder in der App
   gewürfelt wurden (`by: 'entered' | 'app'`). Gewürfelt wird in der Oberfläche; `core/` bekommt Zahlen (kein `Math.random()`).
3. **Herkunft auch am Gold und am Stash.** Eine Buchung des Kassenbuchs (`LedgerEntry`) und ein Gegenstand im Stash
   (`StashItem`) bekommen ein optionales `source`.
4. **Nur neue, optionale Schlüssel.** Das Speicherformat (`FORMAT`) bleibt; nichts wird umbenannt oder entfernt. Alte Runden
   (nur `done` und `wyrd`) bleiben lesbar und werden **nicht** nachgerechnet; eine Abweichung von der Form ist eine Notiz beim
   Laden, nie eine Ablehnung.
5. **Alles ist rücknehmbar.** Zu jeder Aktion eines Schrittes gehört ihr Gegenstück, das Gold, Stash, Erfahrung und den
   Eintrag in `finds` wiederherstellt – wie heute beim Wyrdstone-Verkauf.
6. **Mechanik ist offen** (ADR 0002): die Bilanz einer Runde dürfen alle Mitglieder der Kampagne lesen.

## Verworfen
- **Alles aus dem Vergleich zweier Versionen ableiten** (wie die Änderungsvorschau): das zeigt, *was* sich geändert hat, aber
  nicht, woher es kam; Gold aus einem Ort und Gold aus dem Verkauf sehen im Vergleich gleich aus.
- **Die Würfe auf dem Server speichern:** der Spielstand gehört dem Spieler und reist mit der Version (ADR 0016); der Server
  friert nur die Summen ein (ADR 0003).

## Folgen
- `docs/data-model.md` beschreibt die neuen Felder; `core/test/postbattle-record.test.ts` prüft, dass alte und neue Form ohne
  Notiz geladen werden und die neuen Felder beim Speichern erhalten bleiben.
- Die Schritte (`docs/plan-postbattle.md`, N3 bis N14) füllen die Felder; bis dahin schreibt sie niemand.
- Die alte App ändert sich nicht (eingefroren, Rob, 03.10.2026). Sie lädt `campaign` als Ganzes und schreibt es so wieder, die
  neuen Schlüssel bleiben also erhalten (`applyState` kopiert `campaign` unverändert).
