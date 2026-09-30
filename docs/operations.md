# Betrieb auf dem Pi

Stand: 30. September 2026 · Status: Phase 2. Die Betriebsdateien liegen unter
[`ops/`](../ops/) im Repo; dieses Dokument beschreibt sie und die Handgriffe
auf dem Pi. Die Dateien sind maßgeblich, wo beide voneinander abweichen.

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
nur `GET /api/v1/health` und die Dateien der App ausliefert und es noch keine
Konten gibt.

Was `sudo ops/install.sh` selbst erledigt, ist mit *(install.sh)* markiert;
der Rest sind Handgriffe von Rob. `install.sh` lässt sich nach jedem
`git pull` erneut ausführen: Es überschreibt nie `app.env`, `staging.env`,
`healthchecks.env` oder `.env`.

### Stufe 1 – Vorbereitung, ohne Änderung nach außen

- [ ] **cgroup-Speicher aktivieren** (offener Punkt der Agenten-Basis): in
  `/boot/firmware/cmdline.txt` `cgroup_enable=memory cgroup_memory=1`
  anhängen, neu starten, prüfen, dass `docker info` keine Warnung zu
  Memory-Limits mehr zeigt. Ohne das greifen die Container-Limits nicht;
  `install.sh` warnt, solange die Warnung da ist.
- [ ] **Ports frei?** `sudo ss -tlnp | grep -E ':(80|443|3000|8081) '` darf
  nichts liefern.
- [ ] **robin in der Gruppe `docker`** (`id -nG robin`); `roster-deploy` und
  die Timer laufen als robin, nicht als root.
- [ ] **restic installieren:** `sudo apt install restic` (`install.sh` setzt es
  voraus).
- [ ] **Standortdatei:** `~/server/roster/site.env` aus
  [`ops/site.env.example`](../ops/site.env.example) anlegen – Hostname und
  LAN-IP. Sie steht nur auf dem Pi.
- [ ] **Betriebsdateien holen:** im vorhandenen Klon
  `/mnt/ssd/agent/repos/roster` `git pull`, dann `sudo ops/install.sh`.
  - *(install.sh)* prüft, dass `/mnt/ssd` eingebunden ist, sonst Abbruch;
  - *(install.sh)* **Docker wartet auf die SSD:** Drop-in
    `/etc/systemd/system/docker.service.d/ssd.conf` mit
    `RequiresMountsFor=/mnt/ssd`;
  - *(install.sh)* **Verzeichnisse** unter `/mnt/ssd/roster/` (Besitzer
    robin) und `~/server/roster/`;
  - *(install.sh)* **Markerdatei** `/mnt/ssd/roster/data/.roster-volume` –
    nur, wenn `/mnt/ssd` wirklich eingebunden ist. Die App und alle Skripte
    arbeiten nur, wenn sie existiert, so startet nie eine leere App auf der
    SD-Karte;
  - *(install.sh)* `app.env` und `staging.env` aus den Vorlagen in
    [`ops/env/`](../ops/env/), Rechte 600;
  - *(install.sh)* `compose.yaml`, `Caddyfile`, `roster.conf`, Skripte,
    systemd-Units und -Timer, Fail2Ban-Regel; startet Caddy und die Timer für
    Backup und Wiederherstellungstest.
- [ ] **restic-Repo:** als robin das Passwort anlegen
  (`umask 077; openssl rand -base64 32 > /mnt/ssd/roster/secrets/restic.pass`)
  und zusätzlich offline ablegen; dann
  `restic init -r /mnt/ssd/roster/backups/restic --password-file /mnt/ssd/roster/secrets/restic.pass`.
- [ ] **healthchecks.io:** drei Checks anlegen (`roster-alive` alle 5 Minuten,
  `roster-backup` und `roster-restore-test` täglich); die Ping-URLs in
  `/mnt/ssd/roster/secrets/healthchecks.env` eintragen (Vorlage:
  [`ops/env/healthchecks.env.example`](../ops/env/healthchecks.env.example);
  die leere Datei legt `install.sh` an).
- [ ] **Image-Paket öffentlich:** nach dem ersten Lauf der CI auf `master`
  unter GitHub → Packages → `mordheim-roster` → Package settings die
  Sichtbarkeit auf *Public* stellen (einmalig; das Repo ist ohnehin
  öffentlich, im Image steht nichts Geheimes). Sonst braucht der Pi ein
  `docker login ghcr.io` mit einem Token (`read:packages`).
- [ ] **Erster Start:** als robin `roster-deploy <commit>` (die ersten sieben
  Zeichen reichen); prüfen mit `roster-deploy --status` und
  `curl -s http://127.0.0.1:3000/api/v1/health`. Caddy läuft, bekommt aber
  noch kein Zertifikat – das ist in dieser Stufe erwartet.
- [ ] **Testinstanz:** `roster-deploy --staging <commit>`, im Heimnetz
  `http://<pi-lan-ip>:8081/api/v1/health` öffnen.
- [ ] **GitHub:** Regelwerk für `master` (nur per Pull Request mit grüner CI).
- [ ] **Desktop-Kopie:** den bestehenden `rsync`-Job für
  `/mnt/ssd/agent/home` um `/mnt/ssd/roster/backups/restic` erweitern.
- [ ] **SD-Klon:** zweite SD-Karte als Klon des Systems anlegen (z. B. mit
  `rpi-clone`), beschriften, beim Pi aufbewahren.
- [ ] **Chronik-Eingang angleichen** (Plan der Agenten-Basis): gebraucht erst
  in Phase 4b; bis dahin bindet die App ihn nicht ein.

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
- [ ] **Überwachung an:** `sudo systemctl enable --now roster-alive.timer`;
  Fail2Ban-Regel aktiv (`sudo fail2ban-client status roster-auth`).

### Stufe 3 – Übungen (Abnahme Phase 2)

- [ ] **Rollback-Übung:** `roster-deploy drill-broken` – ein Image, das sofort
  abstürzt (die CI legt es bei jedem Lauf auf `master` ab). Erwartet:
  Abbruch nach 60 Sekunden, Exit 1, „rolled back to …“;
  `roster-deploy --status` zeigt wieder den vorigen Stand.
- [ ] **SSD-Übung:** `mv /mnt/ssd/roster/data/.roster-volume ~/marker.away`,
  dann `docker restart roster-app`: Die App kommt nicht hoch
  (`journalctl CONTAINER_NAME=roster-app -n 5` zeigt `volume_missing`),
  `roster-deploy` und das Backup verweigern die Arbeit. Datei
  zurücklegen, `docker restart roster-app`, Health prüfen.
- [ ] Der **Wiederherstellungstest** ist drei Nächte in Folge grün
  (healthchecks.io).

Beide Übungen laufen zusätzlich bei jedem Push in der CI
([`ops/test/e2e.sh`](../ops/test/e2e.sh)), dazu ein Rollback mit
Rücksicherung (ein Image, dessen Migration den Stand verändert und dann
scheitert).

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
  compose.yaml        Produktion, Testinstanz, Caddy (von install.sh erzeugt)
  Caddyfile           (von install.sh erzeugt)
  .env                ROSTER_TAG, PREVIOUS_TAG, STAGING_TAG, ROSTER_IMAGE (pflegt roster-deploy)
  ops.log             was roster-deploy, Backup, Test und Wiederherstellung getan haben
/etc/roster/roster.conf            Werte für die Skripte (von install.sh erzeugt)
/usr/local/bin/roster-deploy, roster-restore
/usr/local/lib/roster/             roster-backup, roster-restore-test, roster-alive, common.sh
/mnt/ssd/roster/
  data/               roster.sqlite (+ -wal, -shm), .roster-volume, snapshots/
  uploads/            Bilder
  backups/restic/     verschlüsseltes Backup-Repo
  secrets/            restic.pass, healthchecks.env (Verzeichnis 700)
  app.env             Laufzeit-Konfiguration der App (600)
  staging.env         dasselbe für die Testinstanz (600)
  staging/            Daten der Testinstanz (data/, uploads/)
  caddy/              Zertifikate und Konfiguration von Caddy
/mnt/ssd/agent/eingang/chronik/   KI-Pakete für chronik N (ab Phase 4b)
```

## 4. Die Betriebsdateien

| Datei in `ops/` | Wird zu | Was |
| --- | --- | --- |
| [`compose.yaml`](../ops/compose.yaml) | `~/server/roster/compose.yaml` | Caddy, App, Testinstanz |
| [`Caddyfile`](../ops/Caddyfile) | `~/server/roster/Caddyfile` | TLS, Header, Weiterleitung an die App |
| [`env/*.example`](../ops/env/) | `app.env`, `staging.env`, `secrets/healthchecks.env` | nur angelegt, nie überschrieben |
| [`bin/roster-deploy`](../ops/bin/roster-deploy), [`bin/roster-restore`](../ops/bin/roster-restore) | `/usr/local/bin/` | Deploy mit Rollback; Wiederherstellung |
| [`lib/`](../ops/lib/) | `/usr/local/lib/roster/` | Backup, Wiederherstellungstest, Totmannschalter |
| [`systemd/`](../ops/systemd/) | `/etc/systemd/system/` | Timer und Dienste; Docker wartet auf die SSD |
| [`fail2ban/`](../ops/fail2ban/) | `/etc/fail2ban/` | Filter und Jail `roster-auth` |
| [`image/roster-cli`](../ops/image/roster-cli) | im Image | `roster-cli` im Container |
| [`install.sh`](../ops/install.sh) | – | spielt alles ein; `--render <dir>` erzeugt nur die Dateien |
| [`test/`](../ops/test/) | – | Rauch- und Ende-zu-Ende-Test der CI |

Platzhalter in den Vorlagen (`{{ROSTER_HOST}}`, `{{ROSTER_LAN_IP}}`,
`{{ROSTER_DATA}}`, `{{ROSTER_UID}}` …) füllt `install.sh` aus `site.env`.

### `compose.yaml`

- **Caddy** im Host-Netz (UFW und Fail2Ban greifen, die App sieht die echte
  Client-IP), 128 MB. Watchtower darf Caddy weiter aktualisieren.
- **App** (`roster-app`) auf `127.0.0.1:3000`, als robin (1000:1000),
  256 MB, 1,5 Kerne; Logs an journald (für Fail2Ban); Watchtower
  ausgeschlossen. Gehärtet: Dateisystem nur lesbar außer `/data`,
  `/uploads` und `/tmp`, keine Capabilities, `no-new-privileges`, höchstens
  128 Prozesse, `init`.
- **Testinstanz** (`roster-staging`) auf `<pi-lan-ip>:8081`, 192 MB, eigene
  Daten unter `staging/`, sonst wie die App. Sie schreibt nichts nach
  `eingang/`.
- Der Chronik-Eingang wird erst in Phase 4b eingebunden – vorher braucht die
  App ihn nicht, und was sie nicht braucht, sieht sie nicht.

### `Caddyfile`

- Nur der konfigurierte Hostname; Zertifikat per TLS-ALPN auf 443
  (`disable_http_challenge`), kein Listener auf Port 80
  (`auto_https disable_redirects`), keine Admin-Schnittstelle (`admin off`;
  ein geänderter Caddyfile wirkt nach einem Neustart, den `install.sh`
  selbst auslöst).
- Header wie in [security.md](security.md#2-netz), dazu
  `Permissions-Policy`; Anfragen höchstens 6 MB.

### `app.env` (Schlüssel, keine Werte im Repo)

| Schlüssel | Zweck | ab |
| --- | --- | --- |
| `PUBLIC_ORIGIN` | `https://mordheim.<name>.duckdns.org` (für die `Origin`-Prüfung) | Phase 2 |
| `LOG_LEVEL` | `info` | Phase 2 |
| `TOTP_KEY` | Schlüssel zum Verschlüsseln der TOTP-Geheimnisse | Phase 3 |
| `BUGS_TOKEN_HASH` | Hash des Tokens für die Bug-Arbeit des Agenten | Phase 4c |

`DATA_DIR` (`/data`), `UPLOAD_DIR` (`/uploads`), `PORT` (3000) und die
Version (`ROSTER_VERSION`, der Commit) setzt das Image selbst.

### Fail2Ban

Der Server schreibt jeden fehlgeschlagenen Login als eigene JSON-Zeile,
`"event"` zuerst, `"ip"` direkt dahinter, vor jedem Feld, das ein Nutzer
bestimmt ([`server/src/log.ts`](../server/src/log.ts)). Der Filter liest genau
das:

```
failregex = "event":"login_failed","ip":"<HOST>"
journalmatch = CONTAINER_NAME=roster-app
```

Jail `roster-auth`: 10 Fehlversuche in einer Stunde sperren die Adresse für
einen Tag, auf Port 443. Ein Test prüft, dass ein Kontoname keine fremde
Adresse in die Zeile schmuggeln kann; die CI sperrt eine Adresse mit
echten Journal-Zeilen.

## 5. Deploy und Rollback

Die CI baut für jeden Push ein Image für `linux/arm64` und `linux/amd64` und
legt es als `ghcr.io/hmvbfv/mordheim-roster:<commit>` ab (die ersten sieben
Zeichen des Commits) – aber erst, wenn alle Tests grün sind, auch der
Rauchtest des Images und der Ende-zu-Ende-Test der Betriebsdateien. Auf
`master` zusätzlich `:master` und `:drill-broken` (Rollback-Übung). Auf den Pi
kommt ein Image nur bewusst, als robin per SSH in `tmux`:

```bash
roster-deploy --staging <commit>   # zuerst die Testinstanz, im Heimnetz prüfen
roster-deploy <commit>             # dann produktiv
roster-deploy --status             # was läuft wo
```

Ablauf von `roster-deploy <commit>`:

1. Markerdatei auf der SSD prüfen, sonst Abbruch.
2. Image holen; schlägt das fehl, hat sich nichts geändert.
3. Sicherung: `roster-cli backup --label pre-deploy-<commit>` im laufenden
   Container (läuft keiner, mit dem bisherigen Image); Schemastand merken.
4. In `.env`: `PREVIOUS_TAG` ← bisheriger Tag, `ROSTER_TAG` ← `<commit>`;
   `docker compose up -d app`.
5. Bis zu 60 Sekunden warten: Der Container läuft mit genau diesem Image, und
   `GET /api/v1/health` meldet `ok` (Datenbank lesbar und unversehrt,
   Migrationsstand wie erwartet).
6. **Fehlgeschlagen:** `.env` zurück, App mit dem vorigen Tag starten. Hat sich
   der Schemastand verändert, vorher die Sicherung aus Schritt 3
   zurückspielen; die gescheiterte Datenbank bleibt als
   `roster.sqlite.failed-<commit>-<zeit>` liegen.

Exit-Codes: 0 deployt; 1 nicht deployt, der vorige Stand läuft wieder;
2 auch der vorige Stand ist nicht gesund – dann das Ausfall-Handbuch. Alles
steht zusätzlich in `~/server/roster/ops.log`.

## 6. Backups

| Wann | Was | Wohin |
| --- | --- | --- |
| täglich 02:30 (`roster-backup.timer`) | Snapshot im laufenden Betrieb (`roster-cli backup --label nightly`), dann restic über alle Snapshots und die Uploads | restic-Repo auf der SSD |
| vor jedem Deploy | Snapshot `pre-deploy-<commit>` | `data/snapshots/` + nächstes restic |
| vor jeder Migration | Snapshot `pre-migrate-v<alt>-v<neu>` (der Server selbst, beim Start) | `data/snapshots/` + nächstes restic |
| nach jeder abgeschlossenen Schlacht (ab Phase 4a) | Snapshot (löst der Server selbst aus) | `data/snapshots/` + nächstes restic |
| wenn der Desktop läuft | Kopie des restic-Repos | Desktop (bestehender `rsync`-Job) |

- **Snapshots** schreibt der Server mit `VACUUM INTO`: eine vollständige,
  in sich stimmige Kopie, während die App weiterläuft. Jede Kopie trägt eine
  Markierung; wer je auf ihr startet, wechselt die **Epoche** (siehe
  [architecture.md](architecture.md#6-synchronisation)).
- **Aufbewahrung:** `restic forget --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --prune`.
  Rohe Snapshots in `data/snapshots/`: die letzten 5.
- **Grenze:** Ohne Kopie außer Haus schützt das nicht gegen Brand oder
  Diebstahl. Entscheidung: bewusst so (ADR 0007).
- Pings an `roster-backup`: Start, Erfolg oder Fehlschlag mit Grund.

### Wiederherstellung

```bash
roster-restore                  # letzter Stand aus restic
roster-restore --restic <id>    # ein bestimmter (restic snapshots)
roster-restore --file <name>    # ein Snapshot aus data/snapshots/, z. B. pre-deploy-…
```

Das Skript fragt nach (`RESTORE` eintippen), hält die App an, legt die
bisherige Datenbank als `roster.sqlite.before-restore-<zeit>` beiseite,
spielt den Snapshot ein, ergänzt Uploads aus dem Backup (nichts Neueres wird
gelöscht), startet die App und wartet auf Health. Die App startet auf einer
neuen **Epoche**: Die Geräte gleichen neu ab und bieten Einträge an, die nach
dem Backup entstanden sind. Was auf einem Handy noch lokal liegt, geht also
nicht verloren.

Von Hand, falls das Skript selbst nicht geht: `docker compose stop app`;
`restic -r /mnt/ssd/roster/backups/restic restore latest --target /mnt/ssd/roster/restore-tmp`;
den neuesten Snapshot aus `…/data/snapshots/` als `roster.sqlite` nach
`/mnt/ssd/roster/data/` kopieren, alte `-wal`/`-shm` entfernen;
`docker compose up -d app`. Hat die Kopie `roster-cli` nicht selbst gemacht,
danach `docker exec roster-app roster-cli epoch renew`.

### Automatischer Wiederherstellungstest

Jede Nacht um 03:00, nach dem Backup und vor dem Neustart um 03:30
(`roster-restore-test.timer`): letzten Stand aus restic in
`/mnt/ssd/roster/staging/` zurückspielen, Testinstanz neu starten, Health über
die LAN-Adresse prüfen, Ping an `roster-restore-test`. Schlägt das fehl, ist
das Backup nicht brauchbar – Meldung kommt über healthchecks.io.

## 7. Überwachung

- **Totmannschalter (healthchecks.io):**
  - `roster-alive`: alle 5 Minuten ruft ein Timer auf dem Pi
    `https://mordheim.<name>.duckdns.org/api/v1/health` auf und prüft
    zusätzlich die Restlaufzeit des Zertifikats (> 14 Tage), die
    Markerdatei und den Platz auf `/mnt/ssd` (< 90 %). Erfolg pingt, ein
    Problem pingt `/fail` mit dem Grund.
  - `roster-backup`, `roster-restore-test`: nach den nächtlichen Läufen.
  - Bleibt ein Ping aus, kommt eine Nachricht.
- **Logs:** `journalctl CONTAINER_NAME=roster-app -n 100`; eine Zeile je
  Anfrage (Route, Status, Dauer, Adresse – nie die volle URL), die Abfragen
  von Health nur, wenn sie scheitern. `~/server/roster/ops.log` für die
  Skripte.

## 8. Ressourcen

| Dienst | Grenze |
| --- | --- |
| `roster-app` | 256 MB, 1,5 Kerne (gemessen im Rauchtest der CI: rund 30 MB; über 160 MB schlägt er fehl) |
| `roster-staging` | 192 MB, 1 Kern |
| `roster-caddy` | 128 MB (typisch < 50 MB) |
| Agenten-Läufe | 2 GB, 2 Kerne je Rolle, nie parallel |
| Jellyfin, TeamSpeak | wie bisher |

Keine Agenten-Läufe während eines Spielabends.

## 9. Routinen

| Wann | Was |
| --- | --- |
| monatlich | CI baut das Image neu (Sicherheitsupdates des Basis-Images) als `:master-<datum>`; Testinstanz, dann produktiv deployen |
| monatlich | Blick auf healthchecks.io und `docker image prune -f`; alte `roster.sqlite.failed-*` und `…before-restore-*` in `data/` löschen, wenn nicht mehr gebraucht |
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
| Deploy fehlerhaft | Health schlägt fehl | App aus oder falsch | `roster-deploy` rollt selbst zurück (Exit 1); bei Exit 2 von Hand: `roster-restore --file <pre-deploy-…>` |
| Bug verfälscht Daten | Meldung, Abgleich-Markierungen | falsche Werte | frühere Version in der App wiederherstellen; im schlimmsten Fall `roster-restore`; Bug als S1 |
| Datenbank beschädigt | Health meldet `integrity: failed` bzw. `unreadable` (503) | App liefert nur Health | `roster-restore` (Abschnitt 6); Geräte bieten Neueres an |
| Arbeitsspeicher voll | App neu gestartet, Log zeigt OOM | kurze Pause | laufende Agenten-Läufe beenden; Limits prüfen |
| Zertifikat erneuert nicht | `roster-alive` meldet < 14 Tage | Browserwarnung droht | Caddy-Log prüfen: `docker logs roster-caddy`; Port 443 und DNS prüfen |
| Konto übernommen | ungewohnte Einträge im Audit-Log | fremde Änderungen | `roster-cli sessions revoke --user <name>`, Reset-Link, Audit-Log durchsehen, Versionen zurückholen |
| Verborgenes war sichtbar | Meldung (automatisch S1) | Leak | vorige Version deployen; Umfang über Audit- und Zugriffslog klären; Test ergänzen, der den Fall abdeckt |
| Neustart um 03:30 | – | kurze Pause | nichts; Container starten selbst |

## 10. Notbetrieb auf dem Desktop

Das Image gibt es auch für amd64. Fällt der Pi länger aus:

1. Auf dem Manjaro-Desktop Docker starten, `compose.yaml` und `Caddyfile`
   mit `ops/install.sh --render <verzeichnis> --site <site.env>` erzeugen
   (`ROSTER_DATA` in der `site.env` auf den Desktop-Pfad setzen).
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
