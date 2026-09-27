# 0011 – Verborgenes verlässt nie den Server
Status: angenommen · Datum: 2026-09-27

## Kontext
Beide Repos (`Mordheim-Roster-Builder`, `mordheim-chronicle`) sind öffentlich.
Der Hintergrund des Leiters und versiegelte Notizen dürfen Spielern nicht
zugänglich sein – weder über die App noch über ein Repo.

## Entscheidung
- Sichtbarkeit wird ausschließlich auf dem Server gefiltert (Endpunkte und
  Sync). Hintergrund-Daten gehen nur an Leiter.
- Eine **Leak-Test-Matrix** (Rolle × Endpunkt × Sichtbarkeit) ist Pflicht in
  der CI.
- Verborgene Inhalte kommen in kein Repo. Die Chronik-Pipeline bekommt den
  Hintergrund nur über `eingang/` und schreibt ihn nie nach `notes/`.
- Testvorlagen aus echten Daten werden vor dem Commit bereinigt.
- Der verborgene Bereich heißt „Hintergrund / Background“, nicht „Roter
  Faden“, weil `notes/roter-faden.md` im Chronik-Repo öffentlich ist.

## Folgen
- Leiter haben „Als Spieler ansehen“, um vor dem Veröffentlichen zu prüfen.
- Jede Meldung, die Sichtbarkeit betrifft, ist S1.
