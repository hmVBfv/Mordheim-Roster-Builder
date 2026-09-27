# 0015 – Entwicklung in Cloud-Sitzungen, Betrieb auf dem Pi
Status: angenommen · Datum: 2026-09-27

## Kontext
Rob will ohne Hin-und-Her zwischen Chat, GitHub und Pi entwickeln. Auf dem Pi
gibt es eine Agenten-Basis (Claude Code im Container, Remote Control) mit der
Regel, dass git nur auf dem Host läuft. Für das Roster-Projekt hätte das
bedeutet: Claude ändert Dateien in der App, Rob committet per SSH. Seit
GitHub mit claude.ai verbunden und die Claude GitHub App installiert ist,
können Cloud-Sitzungen von Claude Code das Repo klonen und Branches pushen.
Der Pi hat 4 GB RAM, die er mit Jellyfin, TeamSpeak und den Chronik-Läufen
teilt.

## Entscheidung
- **Entwickelt wird in Cloud-Sitzungen** (Code-Tab der App, claude.ai/code):
  Feature-Branch, Tests inklusive Playwright, Push; Rob merged per Pull
  Request.
- **Der Pi betreibt nur den Dienst.** Kein Agent arbeitet dort am
  Roster-Projekt; es gibt kein `roster-rc`.
- **Die Pi-Konfiguration ist Code:** `ops/` im Repo (Compose, Caddyfile,
  systemd, Skripte, `install.sh`). Rob spielt sie per SSH ein
  (`git pull`, `sudo ops/install.sh`) und deployt mit `roster-deploy <tag>`.
  Standortwerte (Hostname, LAN-IP) stehen nur in `~/server/roster/site.env`.
- Die Agenten-Basis auf dem Pi bleibt unverändert für die Chronik.

## Folgen
- Die Git-Regel der Agenten-Basis muss für dieses Projekt nicht aufgeweicht
  werden.
- Die Cloud-Sitzung hat keinen Zugang zu Produktionsdaten; für `/bugs`
  bekommt sie nur die Server-Domain als erlaubte Domain und ein Token, das
  auf den Tracker beschränkt ist.
- Tests und Screenshots belasten den Pi nicht.
- Änderungen an der Pi-Konfiguration sind im Repo nachvollziehbar und
  überprüfbar, bevor sie eingespielt werden.

## Verworfen
- `roster-rc` auf dem Pi mit Commit/Push aus dem Container (abgesichert durch
  Branch-Schutz und Freigabe per Tipp): funktioniert, belastet aber den Pi und
  weicht die Git-Regel der Agenten-Basis auf.
- `roster-rc` mit Commits auf dem Host: bedeutet für jede Änderung einen
  Wechsel zu SSH.
