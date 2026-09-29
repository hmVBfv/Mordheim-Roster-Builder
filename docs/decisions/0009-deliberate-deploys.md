# 0009 – Bewusste Deploys
Status: angenommen · Datum: 2026-09-27

## Kontext
Watchtower aktualisiert auf dem Pi dienstags um 04:00 und fasst lokal gebaute
Images nicht an. Eine App mit Datenbank und Migrationen soll nicht
unbeaufsichtigt aktualisiert werden. Die Agenten-Container haben bewusst
keinen Zugriff auf den Docker-Socket.

## Entscheidung
- Die CI baut für jeden Commit ein Image für `linux/arm64` und `linux/amd64`
  und legt es in `ghcr.io` ab.
- Auf den Pi kommt es nur per `roster-deploy <tag>` (SSH), mit Backup davor,
  Health-Prüfung danach und automatischem Rollback.
- Die App-Container tragen `com.centurylinklabs.watchtower.enable=false`;
  Caddy darf weiter von Watchtower aktualisiert werden.
- Neue Versionen gehen zuerst auf die Testinstanz.

## Folgen
- Deploys vom Handy aus brauchen SSH (Termux, `tmux`), wie die Chronik-Läufe.
- Monatlicher Neubau in der CI für Sicherheitsupdates des Basis-Images.

## Verworfen
- Automatische Updates per Watchtower für die App.
- Bauen auf dem Pi: kostet RAM und Zeit neben Jellyfin und Agenten-Läufen.
