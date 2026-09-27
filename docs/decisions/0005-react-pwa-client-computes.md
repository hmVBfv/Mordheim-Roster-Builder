# 0005 – React-PWA; Client rechnet, Server verwahrt
Status: angenommen · Datum: 2026-09-27

## Kontext
Die Oberfläche soll neu, handyfreundlich und „app-artig“ werden, ohne Store.
Die heutige App baut HTML aus Zeichenketten, zeichnet bei jeder Änderung die
ganze Seite neu (mit Workarounds, damit Eingabefelder den Fokus behalten) und
bindet Handler global. Entwickelt wird überwiegend mit Claude Code; Ziel ist
„leicht, aber möglichst fehlerfrei“. Der Pi hat 4 GB RAM und teilt sie mit
Jellyfin, TeamSpeak und Agenten-Läufen.

## Entscheidung
- **React 19 + TypeScript (strict) + Vite**, React Compiler, React Router,
  Dexie für lokale Daten, Zod, dnd-kit, CSS-Variablen und CSS-Module,
  vite-plugin-pwa. Keine UI-Bibliothek.
- **Progressive Web App:** installierbar, offline, Update-Banner.
- **Kein Rendern auf dem Server**, kein Next.js.
- **Der Client rechnet** (Regeln, Vorschau des Vergleichs, Briefing,
  Bildverkleinerung), **der Server verwahrt** (Anmeldung, Rechte,
  Speicherung, verbindlicher Vergleich beim Markieren, Backups).

## Folgen
- ESLint mit `react-hooks`-Regeln und Verbot von `dangerouslySetInnerHTML`.
- Strenge Content Security Policy ist von Anfang an möglich.
- Server bleibt bei 50–80 MB RAM.

## Verworfen
- Weiter mit handgebautem HTML/JS: skaliert nicht für Offline-Sync und viele
  Ansichten; fehleranfällig.
- Svelte 5: kleiner und schneller, aber die Syntax hat sich mit Version 5
  grundlegend geändert, und es gibt weniger Material – höheres Fehlerrisiko
  bei KI-geschriebenem Code. Der Leistungsunterschied ist für diese App nicht
  spürbar.
- Native App oder Capacitor: Store bzw. Signierung nicht gewollt, PWA reicht.
