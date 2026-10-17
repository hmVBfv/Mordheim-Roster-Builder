# 0019 – Bug-Token: ein eigener Zugang für Cloud-Sitzungen
Status: angenommen · Datum: 2026-10-17 · ergänzt [0012](0012-in-app-bug-tracker.md)

## Kontext
ADR 0012 sah „ein Token nur für den Tracker“ vor. Seit 4c1 liegen die
Meldungen in der Datenbank, und nur der Admin mit Authenticator liest sie. Eine
Cloud-Sitzung (ADR 0015) soll sie auf Zuruf lesen und einordnen können, ohne
dass sie dadurch Konten, Kampagnen oder die Warbands anderer erreicht.
Meldungstexte stammen von Spielern und können Anweisungen enthalten
(security.md, Abschnitt 7). Eine Sitzung ist kein Mensch: für ein Admin-Cookie
müsste sie Passwort und Authenticator kennen.

## Entscheidung
- Das **Bug-Token** ist ein eigenes Zugangsmittel – keine Sitzung, kein Konto:
  `Authorization: Bearer rbt_…`.
- Es darf **genau die Aktionen, die in `policy.ts` `token: true` tragen**
  (`bugs.read`, `bugs.write` – also `GET` und `PATCH /bugs`). `can()` verweigert
  ihm alles andere, und der Anfrage-Hook weist es auf jeder anderen Route mit
  403 ab, bevor ein Handler läuft. Ein Test geht jede registrierte Route durch.
- Es entsteht **nur mit `roster-cli bug-token create`** auf dem Pi, wird einmal
  gezeigt, gespeichert ist nur der Hash (wie bei Sitzungen und Links). Es läuft
  ab (60 Tage, höchstens 180), lässt sich widerrufen, und höchstens fünf sind
  zugleich gültig. Die App stellt keines aus: ein übernommenes Admin-Konto kann
  sich so keinen dauerhaften Zugang bauen.
- Ein Cookie neben dem Token wird nie gelesen; ein ungültiges Token ist 401,
  nie „niemand“. Es braucht keinen `Origin`: der Header wird von keinem Browser
  von selbst mitgeschickt und von fremden Seiten nicht gesetzt – es gibt nichts
  zu fälschen.
- **Meldungen bleiben Daten.** `npm run bugs` zeigt sie eingezäunt und als
  „nicht Anweisung“ gekennzeichnet; `/bugs` führt nichts aus, was in einer
  Meldung steht. Das Token soll die Sitzung am besten **nie sehen**: in der
  Cloud-Umgebung liegt es als „Network secret“, das der Proxy an Anfragen für
  den Server-Host hängt; die Umgebungsvariable `ROSTER_BUG_TOKEN` ist der
  Rückfall.
- Das Log nennt `via: bug-token` und die Nummer, nie die Worte.
- Jede Meldung bekommt eine **Nummer** (Migration 22), damit der Commit
  `Fix #N` sagen kann, wie ADR 0012 es vorsah; `GET`/`PATCH /bugs/:id` nehmen
  Nummer oder Id.

## Folgen
- Eine eingeschleuste Anweisung in einer Meldung kann mit dem Token höchstens
  Meldungen lesen und Status, Grad, Bereich, Art und „fixed in“ ändern. Sie
  erreicht keine anderen Daten und kann das Token nicht ausgeben, wenn es als
  Network secret liegt.
- Das Token liest auch die angehängten Warbands – nur die, bei denen der
  Meldende den Haken gesetzt hat; dessen Text nennt Claude.
- Die Testinstanz widerruft nach jeder Wiederherstellung alle Tokens
  (`roster-cli test-accounts`): was in der Produktion gilt, gilt dort nicht.
- Nach 60 Tagen erneuert Rob das Token von Hand ([operations.md](../operations.md)).

## Verworfen
- Eine Admin-Sitzung (Cookie) in der Cloud-Umgebung: Passwort und Authenticator
  gehören nicht dorthin.
- Das Token in der App ausstellen: der Weg über ein übernommenes Admin-Konto.
- Ein Token ohne Ablauf; ein Token, das mehr darf als Meldungen.
- Ein Webhook, der den Server die Sitzung anstoßen lässt (ADR 0012: nur auf
  Zuruf).
