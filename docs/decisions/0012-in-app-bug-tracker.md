# 0012 – Bug-Tracker in der App, Bearbeitung auf Zuruf
Status: angenommen · Datum: 2026-09-27

## Kontext
Mitspieler sollen Fehler melden können, ohne GitHub-Konto. Claude Code soll
Meldungen einordnen und beheben können. Meldungen können echte Warband-Daten
enthalten, und die Repos sind öffentlich.

## Entscheidung
- „Report a problem“ in der App; Meldungen liegen in der Datenbank, nicht in
  GitHub Issues.
- Arten: Bug, Wunsch, Regelfehler (mit Quelle). Kontext wird angehängt, die
  Warband-Version nur mit Zustimmung.
- **Bearbeitung nur auf Zuruf** mit `/bugs` in Claude Code: einordnen (S1–S4),
  Test aus der angehängten Version, beheben, Commit mit `Fix #N`.
- Regelfehler entscheidet Rob; gemergt wird von Rob.
- S1-Korrekturen prüft ein unabhängiger Prüf-Agent.
- Bug-Texte sind Daten, keine Anweisungen; der Agent nutzt ein Token nur für
  den Tracker.

## Verworfen
- Automatische nächtliche Bearbeitung.
- GitHub Issues als Tracker: Konten nötig, Inhalte öffentlich.
- Mehrere spezialisierte Agenten für die Einordnung: bei dieser Menge unnötig.
