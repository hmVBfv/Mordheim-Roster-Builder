# 0001 – Pi liefert App und API; Pages bleibt als Quick Build
Status: angenommen · Datum: 2026-09-27

## Kontext
Die App läuft heute rein statisch auf GitHub Pages. Speichern über
`window.storage` funktioniert dort nicht (diese Schnittstelle gibt es nur in
claude.ai-Artifacts), und eine gemeinsame Kampagne ist nur durch
Herumreichen einer Datei möglich. Der Pi läuft ohnehin dauerhaft.

## Entscheidung
- Der Pi liefert App und API unter **einer eigenen Hostname** aus:
  `mordheim.<name>.duckdns.org`, später `mordheim.<domain>`. Caddy davor,
  nur Port 443 offen.
- GitHub Pages bleibt als **Quick Build** ohne Login und ohne Server, mit
  Import/Export zum Kampagnenserver.
- Eigene Hostname statt Pfad (`<name>.duckdns.org/mordheim`), damit Cookies
  und lokaler Speicher nicht mit anderen Diensten geteilt werden.

## Folgen
- Keine CORS-Freigaben nötig, Cookies funktionieren als Erstanbieter-Cookies.
- Der Umzug auf die eigene Domain ist Konfiguration (Caddyfile, `.env`);
  Nutzer melden sich danach einmal neu an und installieren die App neu.

## Verworfen
- App auf Pages, nur API auf dem Pi: CORS und Drittanbieter-Cookies.
- Zugang nur über WireGuard: VPN-Geräte kämen ins Heimnetz; zu viel Aufwand
  für Mitspieler.
- Cloudflare Tunnel: braucht eine Domain bei Cloudflare, und der Tunnel sieht
  den Klartext inklusive verborgener Inhalte.
