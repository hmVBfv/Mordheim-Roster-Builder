# Betrieb auf dem Pi

Stand: 27. September 2026 · Status: Plan für Phase 2. Konfigurationen hier
sind **Skizzen**; die endgültigen Dateien entstehen in Phase 2 und ersetzen
die Skizzen in diesem Dokument.

Grundlage ist der bestehende Aufbau des `piServer` (Raspberry Pi 5, 4 GB,
Raspberry Pi OS Lite 64-bit, Daten auf der SSD unter `/mnt/ssd`, Docker,
DuckDNS, Watchtower, UFW, Fail2Ban, WireGuard über die Fritzbox) und seine
Agenten-Basis unter `/mnt/ssd/agent`.

## 1. Ziele

| Ziel | Wert |
| --- | --- |
| Datenverlust im Normalfall | höchstens 24 Stunden (nächtliches Backup) |
| Zusätzliche Sicherungen | vor jedem Deploy und nach jeder abgeschlossenen Schlacht |
| Wiederherstellung | am selben Tag |
| Spielabend | läuft auch ohne Server (App offline-fähig) |
| Redundanz | keine zweite Instanz; stattdessen Offline-App, Backups, Notbetrieb auf dem Desktop, SD-Klon |

## 2. Einmalige Einrichtung

Phase 1 findet komplett in der Cloud und in der CI statt; der Pi wird dafür
nicht angefasst. Eingerichtet wird er in Phase 2, in drei Stufen. Von außen
erreichbar wird er erst in Stufe 2 – zu einem Zeitpunkt, an dem der Server
nur `GET /api/v1/health` beantwortet und es noch keine Konten gibt.

### Stufe 1 – Vorbereitung, ohne Änderung nach außen

- [ ] **cgroup-Speicher aktivieren** (offener Punkt der Agenten-Basis): in
  `/boot/firmware/cmdline.txt` `cgroup_enable=memory cgroup_memory=1`
  anhängen, neu starten, prüfen, dass `docker info` keine Warnung zu
  Memory-Limits mehr zeigt. Ohne das greifen die Container-Limits nicht.
- [ ] **Docker wartet auf die SSD:** Drop-in
  `/etc/systemd/system/docker.service.d/ssd.conf` mit
  `[Unit]` / `RequiresMountsFor=/mnt/ssd`, dann `systemctl daemon-reload`.
- [ ] **Ports frei?** `sudo ss -tlnp | grep -E ':(80|443|3000|8081) '` darf
  nichts liefern.
- [ ] **Verzeichnisse** anlegen (Besitzer `robin`, UID 1000):
  `/mnt/ssd/roster/{data,uploads,backups,secrets,caddy/data,caddy/config,staging/data,staging/uploads}`
  und `~/server/roster/`.
- [ ] **Markerdatei:** `touch /mnt/ssd/roster/data/.roster-volume`. Die App
  startet nur, wenn sie existiert – so startet sie nie leer auf der SD-Karte.
- [ ] **Chronik-Eingang angleichen:** `eingang/chronik/` anlegen (Plan der
  Agenten-Basis „Chronik-Eingang angleichen“); Samba-Share und
  `chronik-run.sh` darauf umstellen.
- [ ] **restic:** `sudo apt install restic`; Passwort in
  `/mnt/ssd/roster/secrets/restic.pass` (Rechte 600) und zusätzlich offline
  ablegen; `restic init` für `/mnt/ssd/roster/backups/restic`.
- [ ] **healthchecks.io:** drei Checks anlegen (`roster-alive`,
  `roster-backup`, `roster-restore-test`); Ping-URLs nach
  `/mnt/ssd/roster/secrets/healthchecks.env`.
- [ ] **`app.env`** anlegen (siehe Abschnitt 4).
- [ ] **Betriebsdateien holen:** im vorhandenen Klon
  `/mnt/ssd/agent/repos/roster` `git pull`; `~/server/roster/site.env` mit
  Hostname und LAN-IP anlegen; `sudo ops/install.sh` (legt Compose,
  Caddyfile, systemd-Units, `roster-deploy` und die Fail2Ban-Regel an).
- [ ] **Erster Start:** `roster-deploy <tag>`; lokal prüfen mit
  `curl -s http://127.0.0.1:3000/api/v1/health`. Caddy läuft, bekommt aber
  noch kein Zertifikat – das ist in dieser Stufe erwartet.
- [ ] **GitHub:** Regelwerk für `master` (nur per Pull Request mit grüner CI).
- [ ] **Desktop-Kopie:** den bestehenden `rsync`-Job für
  `/mnt/ssd/agent/home` um `/mnt/ssd/roster/backups/restic` erweitern.
- [ ] **SD-Klon:** zweite SD-Karte als Klon des Systems anlegen (z. B. mit
  `rpi-clone`), beschriften, beim Pi aufbewahren.

### Stufe 2 – Freischalten

- [ ] **Fritzbox-Fernzugang prüfen:** Der HTTPS-Zugang der Fritzbox selbst
  (Internetzugriff auf die FRITZ!Box) darf nicht auf Port 443 liegen, sonst
  kollidiert er mit der Freigabe.
- [ ] **Hostname prüfen:** `nslookup mordheim.<name>.duckdns.org` muss
  dieselbe öffentliche IP liefern wie der bisherige DuckDNS-Name. Der
  DuckDNS-Container bleibt, wie er ist.
- [ ] **Fritzbox:** Portfreigabe für das Gerät `piServer`: TCP 443 → 443
  (IPv4). Die bestehenden Freigaben für TeamSpeak bleiben unverändert.
- [ ] **UFW:** `sudo ufw allow 443/tcp`.
- [ ] **Zertifikat:** Caddy holt es innerhalb weniger Minuten selbst;
  prüfen mit `docker logs roster-caddy`.
- [ ] **Von außen testen:** am Handy im Mobilfunknetz (nicht im WLAN)
  `https://mordheim.<name>.duckdns.org/api/v1/health` öffnen.
- [ ] **Überwachung an:** `roster-alive`-Timer aktivieren, Fail2Ban-Regel
  aktiv (`sudo fail2ban-client status roster-auth`).

### Stufe 3 – Übungen (Abnahme Phase 2)

- [ ] Rollback-Übung mit absichtlich kaputtem Image.
- [ ] SSD-Übung: ohne Markerdatei startet die App nicht.
- [ ] Wiederherstellungstest drei Nächte in Folge grün.

Mitspieler werden erst eingeladen, wenn Phase 3 abgenommen ist.

### Nebeneinander mit den bestehenden Diensten

| Dienst | Port | Von außen | Weg |
| --- | --- | --- | --- |
| TeamSpeak Sprache | 9987/UDP | ja (bestehend) | Fritzbox → TS3-Container |
| TeamSpeak Dateien | 30033/TCP | ja (bestehend) | Fritzbox → TS3-Container |
| **Mordheim** | **443/TCP** | **ja (neu)** | Fritzbox → Caddy (Host-Netz) → App auf `127.0.0.1:3000` |
| Jellyfin | 8096/TCP | nein | Heimnetz |
| Mordheim-Testinstanz | 8081/TCP | nein | Heimnetz, WireGuard |
| SSH | 22/TCP | nur über WireGuard | Fritzbox-VPN |

- Die Fritzbox verteilt nach Port und Protokoll; TeamSpeak und Mordheim teilen
  sich die öffentliche IP und den DuckDNS-Namen, ohne sich zu berühren.
- **Last:** Die App synchronisiert nur, solange sie offen ist, und schickt
  dabei wenige Kilobyte. Neben Sprache in TeamSpeak ist das nicht spürbar,
  auch nicht am Spielabend. TTS läuft auf den Rechnern der Spieler, nicht auf
  dem Pi.
- **Im Heimnetz** funktioniert dieselbe Adresse; die Fritzbox leitet Anfragen
  an die eigene öffentliche IP intern weiter.
- **Aufrufen:** Mitspieler öffnen den Einladungslink im Browser, legen ihr
  Konto an und installieren die App über „App installieren“ bzw. „Zum
  Home-Bildschirm“. Danach starten sie sie über das Icon.

## 3. Verzeichnisse

```
/mnt/ssd/agent/repos/roster/ops/   Quelle der Betriebsdateien (aus dem Repo)
~/server/roster/
  site.env            Hostname, LAN-IP (nur auf dem Pi, nie im Repo)
  compose.yaml        Produktion + Testinstanz (von install.sh erzeugt)
  Caddyfile
  .env                ROSTER_TAG, PREVIOUS_TAG, STAGING_TAG
/mnt/ssd/roster/
  data/               roster.sqlite (+ -wal, -shm), .roster-volume, snapshots/
  uploads/            Bilder
  backups/restic/     verschlüsseltes Backup-Repo
  secrets/            restic.pass, healthchecks.env, bugs.token
  app.env             Laufzeit-Konfiguration der App (600)
  staging/            Daten der Testinstanz
  caddy/              Zertifikate und Konfiguration von Caddy
/mnt/ssd/agent/eingang/chronik/   KI-Pakete für chronik N
```

## 4. Konfiguration (Skizzen)

### `compose.yaml`

```yaml
name: roster
services:
  caddy:
    image: caddy:2
    container_name: roster-caddy
    network_mode: host              # UFW und Fail2Ban greifen, echte Client-IP
    restart: unless-stopped
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - /mnt/ssd/roster/caddy/data:/data
      - /mnt/ssd/roster/caddy/config:/config

  app:
    image: ghcr.io/hmvbfv/mordheim-roster:${ROSTER_TAG:?}
    container_name: roster-app
    user: "1000:1000"
    restart: unless-stopped
    ports: ["127.0.0.1:3000:3000"]  # nur lokal, Caddy davor
    env_file: /mnt/ssd/roster/app.env
    volumes:
      - /mnt/ssd/roster/data:/data
      - /mnt/ssd/roster/uploads:/uploads
      - /mnt/ssd/agent/eingang/chronik:/export/chronik
    mem_limit: 256m
    cpus: 1.5
    logging: { driver: journald }   # für Fail2Ban
    labels: ["com.centurylinklabs.watchtower.enable=false"]
    healthcheck:
      test: ["CMD", "node", "server/dist/healthcheck.js"]
      interval: 30s
      retries: 3

  staging:
    image: ghcr.io/hmvbfv/mordheim-roster:${STAGING_TAG:-${ROSTER_TAG}}
    container_name: roster-staging
    user: "1000:1000"
    restart: unless-stopped
    ports: ["<pi-lan-ip>:8081:3000"] # nur Heimnetz, keine Freigabe an der Fritzbox
    env_file: /mnt/ssd/roster/staging.env
    volumes:
      - /mnt/ssd/roster/staging/data:/data
      - /mnt/ssd/roster/staging/uploads:/uploads
    mem_limit: 192m
    labels: ["com.centurylinklabs.watchtower.enable=false"]
```

Die Testinstanz schreibt nichts nach `eingang/`. Caddy darf weiter unter
Watchtower laufen; die App nicht (Updates bewusst, mit Backup davor).

### `Caddyfile`

```
mordheim.<name>.duckdns.org {
	tls {
		issuer acme {
			disable_http_challenge
		}
	}
	encode zstd gzip
	request_body {
		max_size 6MB
	}
	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
		Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
		-Server
	}
	reverse_proxy 127.0.0.1:3000
}
```

### `app.env` (Schlüssel, keine Werte im Repo)

| Schlüssel | Zweck |
| --- | --- |
| `PUBLIC_ORIGIN` | `https://mordheim.<name>.duckdns.org` (für `Origin`-Prüfung) |
| `DATA_DIR`, `UPLOAD_DIR`, `EXPORT_DIR` | `/data`, `/uploads`, `/export/chronik` |
| `TOTP_KEY` | Schlüssel zum Verschlüsseln der TOTP-Geheimnisse |
| `BUGS_TOKEN_HASH` | Hash des Tokens für die Bug-Arbeit des Agenten |
| `LOG_LEVEL` | `info` |

### Fail2Ban

```
# /etc/fail2ban/filter.d/roster-auth.conf
[Definition]
failregex = "event":"login_failed".*"ip":"<HOST>"
journalmatch = CONTAINER_NAME=roster-app

# /etc/fail2ban/jail.d/roster.local
[roster-auth]
enabled  = true
backend  = systemd
filter   = roster-auth
port     = 443
maxretry = 10
findtime = 1h
bantime  = 1d
```

## 5. Deploy und Rollback

Die CI baut für jeden Commit ein Image
`ghcr.io/hmvbfv/mordheim-roster:<sha>` (arm64 und amd64). Auf den Pi kommt es
nur bewusst, per SSH in `tmux`:

```bash
roster-deploy <sha>
```

Ablauf des Skripts (`/usr/local/bin/roster-deploy`, entsteht in Phase 2):

1. Markerdatei auf der SSD prüfen, sonst Abbruch.
2. Sicherung: `docker compose exec -T app roster-cli backup --label pre-deploy-<sha>`.
3. `docker pull ghcr.io/hmvbfv/mordheim-roster:<sha>`.
4. In `.env`: `PREVIOUS_TAG` ← bisheriger Tag, `ROSTER_TAG` ← `<sha>`.
5. `docker compose up -d app`.
6. Bis zu 60 Sekunden auf `GET /api/v1/health` warten; erwartet werden die
   neue Version, eine lesbare Datenbank und der erwartete Migrationsstand.
7. **Fehlgeschlagen:** zurück auf `PREVIOUS_TAG`; hat sich der
   Migrationsstand geändert, vorher die Sicherung aus Schritt 2
   zurückspielen. Ergebnis und Grund ins Log.

Die Testinstanz bekommt neue Versionen zuerst: `STAGING_TAG=<sha>` setzen,
`docker compose up -d staging`, im Heimnetz prüfen, dann produktiv
deployen.

## 6. Backups

| Wann | Was | Wohin |
| --- | --- | --- |
| täglich 02:30 (`roster-backup.timer`) | SQLite-Snapshot im laufenden Betrieb (`roster-cli backup`) + Uploads | restic-Repo auf der SSD |
| vor jedem Deploy | SQLite-Snapshot | `data/snapshots/` + nächstes restic |
| nach jeder abgeschlossenen Schlacht | SQLite-Snapshot (löst der Server selbst aus) | `data/snapshots/` + nächstes restic |
| wenn der Desktop läuft | Kopie des restic-Repos | Desktop (bestehender `rsync`-Job) |

- **Aufbewahrung:** `restic forget --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --prune`.
  Rohe Snapshots in `data/snapshots/`: die letzten 5.
- **Grenze:** Ohne Kopie außer Haus schützt das nicht gegen Brand oder
  Diebstahl. Entscheidung: bewusst so (ADR 0007).
- Nach erfolgreichem Backup: Ping an `roster-backup`.

### Wiederherstellung

1. `docker compose stop app`
2. `restic -r /mnt/ssd/roster/backups/restic restore latest --target /tmp/roster-restore`
3. `roster.sqlite` nach `/mnt/ssd/roster/data/` kopieren, alte `-wal`/`-shm`
   entfernen; Uploads zurückkopieren.
4. `docker compose start app`, Health prüfen.
5. Der Server wechselt dabei seine **Epoche** (siehe
   [architecture.md](architecture.md#6-synchronisation)): Die Geräte
   gleichen neu ab und bieten Einträge an, die nach dem Backup entstanden
   sind. Was auf einem Handy noch lokal liegt, geht also nicht verloren.

### Automatischer Wiederherstellungstest

Jede Nacht nach dem Backup (`roster-restore-test.timer`): letzten Stand aus
restic in `/mnt/ssd/roster/staging/data` zurückspielen, Testinstanz neu
starten, Health über die LAN-Adresse prüfen, Ping an `roster-restore-test`.
Schlägt das fehl, ist das Backup nicht brauchbar – Meldung kommt über
healthchecks.io.

## 7. Überwachung

- **Totmannschalter (healthchecks.io):**
  - `roster-alive`: alle 5 Minuten ruft ein Timer auf dem Pi
    `https://mordheim.<name>.duckdns.org/api/v1/health` auf, prüft
    zusätzlich die Restlaufzeit des Zertifikats (> 14 Tage) und pingt nur bei
    Erfolg.
  - `roster-backup`, `roster-restore-test`: nach den nächtlichen Läufen.
  - Bleibt ein Ping aus, kommt eine Nachricht.
- **Speicherplatz:** Der Alive-Timer meldet Fehler, wenn `/mnt/ssd` über 90 %
  belegt ist.
- **Logs:** `journalctl CONTAINER_NAME=roster-app -n 100`.

## 8. Ressourcen

| Dienst | Grenze |
| --- | --- |
| `roster-app` | 256 MB, 1,5 Kerne |
| `roster-staging` | 192 MB |
| `roster-caddy` | ohne Limit (typisch < 50 MB) |
| Agenten-Läufe | 2 GB, 2 Kerne je Rolle, nie parallel |
| Jellyfin, TeamSpeak | wie bisher |

Keine Agenten-Läufe während eines Spielabends.

## 9. Routinen

| Wann | Was |
| --- | --- |
| monatlich | CI baut das Image neu (Sicherheitsupdates des Basis-Images); Testinstanz, dann produktiv deployen |
| monatlich | Blick auf healthchecks.io und `docker image prune -f` |
| vierteljährlich | SD-Klon auffrischen |
| jährlich | restic-Passwort aus der Offline-Ablage testweise verwenden |

## Ausfall-Handbuch

| Fall | Erkennen | Folge | Vorgehen |
| --- | --- | --- | --- |
| Internet, Fritzbox oder DuckDNS weg | `roster-alive` bleibt aus | kein Zugriff von außen | nichts tun; App läuft offline, gleicht später ab |
| Pi hängt oder ist aus | `roster-alive` bleibt aus | wie oben | Pi neu starten; Container starten selbst |
| SSD nach Neustart nicht eingebunden | Docker startet nicht; `roster-alive` bleibt aus | Dienste aus, aber keine leere App auf der SD | SSD-Verbindung prüfen, `mount -a`, `systemctl start docker` |
| SSD defekt | wie oben, Mount schlägt fehl | Daten auf dem Pi weg | neue SSD, restic-Kopie vom Desktop zurückspielen; bis dahin Notbetrieb (Abschnitt 10) |
| SD-Karte defekt | Pi bootet nicht | alles aus | SD-Klon einsetzen; sonst Neuaufbau nach diesem Dokument und der Agenten-Basis |
| Deploy fehlerhaft | Health schlägt fehl | App aus oder falsch | `roster-deploy` rollt selbst zurück; sonst von Hand auf `PREVIOUS_TAG` |
| Bug verfälscht Daten | Meldung, Abgleich-Markierungen | falsche Werte | frühere Version in der App wiederherstellen; im schlimmsten Fall Backup; Bug als S1 |
| Datenbank beschädigt | Health meldet `integrity_check` fehlgeschlagen | App aus | Wiederherstellung (Abschnitt 6); Geräte bieten Neueres an |
| Arbeitsspeicher voll | App neu gestartet, Log zeigt OOM | kurze Pause | laufende Agenten-Läufe beenden; Limits prüfen |
| Zertifikat erneuert nicht | `roster-alive` meldet < 14 Tage | Browserwarnung droht | Caddy-Log prüfen: `docker logs roster-caddy`; Port 443 und DNS prüfen |
| Konto übernommen | ungewohnte Einträge im Audit-Log | fremde Änderungen | `roster-cli sessions revoke --user <name>`, Reset-Link, Audit-Log durchsehen, Versionen zurückholen |
| Verborgenes war sichtbar | Meldung (automatisch S1) | Leak | vorige Version deployen; Umfang über Audit- und Zugriffslog klären; Test ergänzen, der den Fall abdeckt |
| Neustart um 03:30 | – | kurze Pause | nichts; Container starten selbst |

## 10. Notbetrieb auf dem Desktop

Das Image gibt es auch für amd64. Fällt der Pi länger aus:

1. Auf dem Manjaro-Desktop Docker starten, `compose.yaml` und `Caddyfile`
   aus diesem Dokument übernehmen (Pfade anpassen).
2. Letzten Stand aus der restic-Kopie auf dem Desktop zurückspielen.
3. An der Fritzbox die Freigabe TCP 443 auf den Desktop umstellen.
4. DuckDNS zeigt weiter auf die Heim-IP; nichts zu ändern.
5. Nach der Rückkehr des Pi: Stand vom Desktop per Backup/Restore
   zurückholen, Freigabe zurückstellen.

## 11. Umzug auf die eigene Domain

1. DNS-Eintrag `mordheim.<domain>` auf die Heim-IP (oder als CNAME auf den
   DuckDNS-Namen).
2. Im `Caddyfile` den Hostnamen ergänzen; den alten Block für einige Wochen
   als `redir https://mordheim.<domain>{uri} permanent` behalten.
3. `PUBLIC_ORIGIN` in `app.env` ändern, App neu starten.
4. Alle melden sich einmal neu an (Cookies hängen am Hostnamen); die App muss
   neu installiert werden, weil die PWA an die Adresse gebunden ist.
5. Serveradresse in der Quick-Build-Einstellung und ggf. im TTS-Skript
   ändern.
