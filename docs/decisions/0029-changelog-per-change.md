# 0029 – Changelog: eine kleine Datei je Änderung, mit dem Build ausgeliefert
Status: angenommen (Rob, 30.10.2026, Wunsch #154) · Datum: 2026-10-30

## Kontext
Die Spieler sollen nach einem Deploy kurz lesen können, was sich geändert hat: klein unter „Reload“ in der
Update-Meldung, als Popup, und später jederzeit unter „More“. Ein gemeinsames Changelog würde sich in
jedem Pull Request an derselben Stelle ändern; das hat bei `HISTORY.md` schon jeden zweiten Pull Request eines
Laufs in einen Konflikt geschoben.

## Entscheidung
- Jede Änderung, die Spieler sehen, bringt **eine eigene Datei** `changelog/YYYY-MM-DD-<kurzname>.md` mit,
  im Pull Request, der sie liefert: erste Zeile `date: YYYY-MM-DD`, dann je Zeile `- New: …`, `- Changed: …`
  oder `- Fixed: …`. Englisch, kurz, in Spielersprache, ohne Nummern von Meldungen. Reine Technik
  (Infrastruktur, Tests, Doku) bekommt keine.
- Der Build sammelt alle Dateien: in die App (`import.meta.glob`, für „More → What's new“) und als
  `changelog.json` neben die App. Die Datei steht **nicht** im Precache des Service Workers, die alte Version liest also
  beim Hinweis „New version available“ die **neue** Liste aus dem Netz und zeigt, was ihr fehlt („What's new“ unter „Reload“).
  Ohne Netz oder bei einem älteren Server erscheint der Knopf einfach nicht.
- Die CI prüft Form, Datum zum Dateinamen und „keine Nummer“ (`app/src/changelog/changelog.test.ts`). Dass überhaupt
  eine Datei mitkommt, ist Regel für die Arbeit (`CLAUDE.md`, `/bugs`), nicht erzwungen.
- Rückblickend sind die letzten Wochen angelegt (ab 27.10.2026).

## Folgen
Keine Konflikte zwischen Pull Requests, kein neuer Dienst. Wer einen Eintrag nachträglich ändern will, ändert die Datei.
