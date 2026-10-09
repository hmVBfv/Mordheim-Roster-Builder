# Betrieb auf dem Pi

Stand: 2. Oktober 2026 · Status: Phase 2. Die Betriebsdateien liegen unter
[`ops/`](../ops/) im Repo; dieses Dokument beschreibt sie und die Handgriffe
auf dem Pi. Die Dateien sind maßgeblich, wo beide voneinander abweichen.

Grundlage ist der bestehende Aufbau des Pi (Raspberry Pi 5, 4 GB, Raspberry
Pi OS Lite 64-bit, Daten auf der SSD unter `/mnt/ssd`, Docker, eigene Domain
mit DynDNS (Abschnitt 11),
Watchtower, UFW, Fail2Ban, VPN über die Fritzbox) und seine Agenten-Basis
unter `/mnt/ssd/agent`. `<user>` steht für das eigene Konto auf dem Pi –
Namen, Adressen und Hostnamen gehören nicht in dieses öffentliche Repo.

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

Alle Befehle laufen per SSH als `<user>`; `sudo` nur, wo es dasteht. Schritte
an der Fritzbox sind mit **Fritzbox** markiert. `install.sh` lässt sich nach
jedem `git pull` erneut ausführen: Es überschreibt nie `site.env`,
`app.env`, `staging.env`, `healthchecks.env` oder `.env`.

**Wo der Klon liegt:** `install.sh` läuft als root. Deshalb kommt es aus einem
eigenen Klon im Home-Verzeichnis (`~/src/Mordheim-Roster-Builder`), nie aus
`/mnt/ssd/agent/…`: Dort können die Agenten-Container schreiben, und was dort
liegt, würde mit root-Rechten ausgeführt. `install.sh` bricht ab, wenn es aus
dem Agenten-Verzeichnis gestartet wird oder seine Dateien oder die
Verzeichnisse darüber von jemand anderem als root und `<user>` geändert werden
können. Schreibrecht für die eigene private Gruppe (Raspberry Pi OS: umask
002) zählt als eigenes, solange niemand sonst in dieser Gruppe ist.

### Stufe 1 – Vorbereitung, ohne Änderung nach außen

1. **cgroup-Speicher** (damit die Speichergrenzen der Container greifen):
   `grep -c cgroup_enable=memory /boot/firmware/cmdline.txt` – bei `0`:
   `sudo cp /boot/firmware/cmdline.txt /boot/firmware/cmdline.txt.bak`,
   `sudo sed -i '1 s/$/ cgroup_enable=memory cgroup_memory=1/' /boot/firmware/cmdline.txt`,
   `sudo reboot`; danach zeigt `docker info 2>&1 | grep -i 'memory limit'`
   nichts mehr.
2. **Prüfen:** `sudo ss -tlnp | grep -E ':(443|3000|8081) '` liefert nichts;
   `id -nG` enthält `docker`.
3. **Fritzbox – feste Adresse für den Pi:** Heimnetz → Netzwerk → beim Pi
   „Bearbeiten“ → „Diesem Netzwerkgerät immer die gleiche IPv4-Adresse
   zuweisen“. Die Testinstanz lauscht auf dieser Adresse, und die
   Portfreigabe hängt am Gerät.
4. **restic:** `sudo apt update && sudo apt install -y restic`.
5. **Eigener Klon:**
   `mkdir -p ~/src && git clone https://github.com/hmVBfv/Mordheim-Roster-Builder.git ~/src/Mordheim-Roster-Builder`.
   Prüfen, dass kein Container das Home-Verzeichnis sieht:
   `docker inspect -f '{{.Name}}: {{range .Mounts}}{{.Source}} {{end}}' $(docker ps -q)`
   darf nirgends `/home/<user>` zeigen.
6. **Standortdatei:** `mkdir -p ~/server/roster`,
   `cp ~/src/Mordheim-Roster-Builder/ops/site.env.example ~/server/roster/site.env`,
   `chmod 600 ~/server/roster/site.env`, `nano ~/server/roster/site.env`:
   `ROSTER_HOST` (der öffentliche Hostname, z. B. `mordheim.<domain>`; sein
   A-Record muss auf die Heim-IP zeigen, Abschnitt 11) und `ROSTER_LAN_IP` (die feste Adresse aus Schritt 3,
   `hostname -I`). `install.sh` liest die Datei Zeile für Zeile als
   `KEY=value`; ausgeführt wird darin nichts.
7. **Einspielen:** `cd ~/src/Mordheim-Roster-Builder && git log -1 --oneline`
   (der zuletzt gemergte Pull Request), dann `sudo ops/install.sh`. Legt an:
   das Drop-in, mit dem Docker auf die SSD wartet; die Verzeichnisse unter
   `/mnt/ssd/roster/` samt Markerdatei (nur, wenn `/mnt/ssd` eingebunden ist);
   `app.env`, `staging.env`, `secrets/healthchecks.env` (600);
   `~/server/roster/compose.yaml`, `Caddyfile`, `.env`;
   `/etc/roster/roster.conf`, `roster-deploy`, `roster-restore`, die Skripte
   unter `/usr/local/lib/roster/`, die systemd-Units und -Timer, die
   Fail2Ban-Regel. Startet Caddy und die Timer für Backup und
   Wiederherstellungstest; `roster-alive` erst in Stufe 2.
8. **restic-Repo:**
   `(umask 077; openssl rand -base64 32 > /mnt/ssd/roster/secrets/restic.pass)`,
   Inhalt zusätzlich im Passwortmanager ablegen
   (`cat /mnt/ssd/roster/secrets/restic.pass`), dann
   `restic init -r /mnt/ssd/roster/backups/restic --password-file /mnt/ssd/roster/secrets/restic.pass`.
9. **healthchecks.io:** drei Checks (`roster-alive`: alle 5 Minuten, Karenz
   10 Minuten; `roster-backup`: Cron `30 2 * * *`, `roster-restore-test`: Cron
   `0 3 * * *`, beide Europe/Berlin, Karenz 1 Stunde), Benachrichtigung
   einrichten; die drei Ping-URLs mit `nano /mnt/ssd/roster/secrets/healthchecks.env`
   eintragen. Die URLs sind Geheimnisse: Wer sie kennt, kann „alles in
   Ordnung“ melden.
10. **GitHub:** das Paket `mordheim-roster` auf *Public* stellen (Profil →
    Packages → `mordheim-roster` → Package settings → Change visibility);
    so braucht der Pi kein Token. Im Image steht nichts Geheimes. Das
    GitHub-Konto ist damit die Lieferkette für den Pi: Zwei-Faktor-Anmeldung
    muss an sein, und `master` ändert sich nur per Pull Request.
11. **Erster Start:** Tag = die ersten sieben Zeichen des Commits, für den die
    CI auf `master` grün ist (`git -C ~/src/Mordheim-Roster-Builder rev-parse --short=7 HEAD`).
    `roster-deploy --staging <tag>`, im Heimnetz
    `curl -s http://<pi-lan-ip>:8081/api/v1/health`; dann `roster-deploy <tag>`,
    `roster-deploy --status`, `curl -s http://127.0.0.1:3000/api/v1/health`.
    Nie `master` als Tag: der wandert, und ein Rollback hätte kein Ziel.
12. **Backup und Test gleich einmal:** `sudo systemctl start roster-backup.service`,
    dann `sudo systemctl start roster-restore-test.service`; beide melden sich
    bei healthchecks.io, `tail ~/server/roster/ops.log` zeigt den Verlauf.
13. **Desktop-Kopie:** der Desktop holt `/mnt/ssd/roster/backups/restic`
    selbst ab (verschlüsselt, ohne das Passwort unbrauchbar). Einen
    `rsync`-Job gab es vorher nicht, nur den Samba-Mount der Medien; der
    taugt dafür nicht (Schreibrecht, gleiche Platte, wenn das Ziel dort
    liegt). Stattdessen:
    - eigener Schlüssel `~/.ssh/roster_backup` ohne Passphrase, auf dem Pi in
      `~/.ssh/authorized_keys` eingetragen mit
      `command="/usr/bin/rrsync -ro /mnt/ssd/roster/backups/restic",restrict,from="192.168.178.0/24"`
      – nur lesen, nur dieses Verzeichnis, keine Shell, nur aus dem Heimnetz;
      nicht per `ssh-copy-id` (das trägt ihn unbeschränkt ein);
    - `Host roster-backup` in `~/.ssh/config` des Desktops mit diesem
      Schlüssel und `IdentitiesOnly yes`;
    - `~/.local/bin/roster-backup-pull`:
      `rsync -a --delete --backup --backup-dir=~/backup/roster-restic-removed/<Datum> roster-backup:./ ~/backup/roster-restic/`,
      danach Ordner in `roster-restic-removed/` älter als 30 Tage löschen
      (restic ändert keine Datei; was auf dem Pi verschwindet oder sich
      ändert, bleibt so 30 Tage auf dem Desktop);
    - ein systemd-User-Timer (`OnStartupSec=10min`, `OnUnitActiveSec=6h`).
    Das Ziel liegt auf der Platte des Desktops, nie auf dem Samba-Mount.
    Der Pi kommt nicht an den Desktop: ein kompromittierter Pi kann die
    Kopie nicht löschen. Prüfen: `restic -r ~/backup/roster-restic snapshots`
    mit dem Passwort aus der Offline-Ablage.
14. **SD-Klon:** auf dem Desktop, bei ausgeschaltetem Pi (etwa 20 Minuten
    Pause für alle Dienste). `rpi-clone` läuft unter Trixie nicht
    verlässlich, darum `dd`: Karte in den Leser am Desktop, Gerät mit
    `lsblk -o NAME,SIZE,MODEL,TRAN,MOUNTPOINTS` bestimmen (Größe der Karte,
    `TRAN` = `usb`; das falsche Gerät wird überschrieben), eingehängte
    Partitionen aushängen, dann
    `sudo dd if=/dev/sdX bs=4M status=progress | zstd -T0 > ~/backup/piServer-<Datum>.img.zst`
    und auf die Reservekarte (mindestens so groß wie die Originalkarte)
    `zstdcat … | sudo dd of=/dev/sdY bs=4M status=progress conv=fsync`.
    Die Reservekarte in den Pi, booten, `docker ps`, `roster-deploy --status`
    prüfen; die alte Karte wird die Reserve. Nie beide Karten zugleich im
    Pi (gleiche Partitions-IDs). Beschriften, zu Hause aufbewahren (auf
    Karte und Abbild liegen `site.env`, `app.env` und die SSH-Schlüssel,
    nicht das restic-Passwort).

Der Chronik-Eingang (`eingang/chronik/`) wird erst in Phase 4b gebraucht.

### Stufe 2 – Freischalten

1. **Fritzbox – eigener Fernzugang:** Internet → Freigaben →
   FRITZ!Box-Dienste. Ist „Internetzugriff auf die FRITZ!Box über HTTPS“ an
   und liegt auf Port 443, kollidiert er mit der Freigabe. Empfehlung:
   ausschalten – der Zugang von unterwegs geht über das VPN.
2. **Hostname:** `dig +short A <ROSTER_HOST>` liefert dieselbe öffentliche
   IP wie `curl -4 -s https://api.ipify.org`.
3. **Fritzbox – Portfreigabe:** Internet → Freigaben → Portfreigaben → beim
   Pi „Bearbeiten“ (sonst „Gerät für Freigaben hinzufügen“) → „Neue Freigabe“
   → „Portfreigabe“: Anwendung „HTTPS-Server“ (oder „Andere Anwendung“,
   Name „Mordheim“), Protokoll TCP, Port an Gerät 443 bis 443, Port extern
   gewünscht 443, **nur IPv4** (kein Haken bei IPv6), „Freigabe aktivieren“.
   Beim Gerät „Selbstständige Portfreigaben für dieses Gerät erlauben“ aus;
   kein „Exposed Host“. Die bestehenden Freigaben bleiben unverändert.
4. **UFW:** `sudo ufw allow 443/tcp comment 'Mordheim (Caddy)'`,
   `sudo ufw status numbered`.
5. **Zertifikat:** `docker restart roster-caddy` (Caddy versucht es sofort
   neu, statt aus der Wartezeit früherer Fehlversuche), nach einer Minute
   `docker logs --since 5m roster-caddy 2>&1 | grep -iE 'certificate obtained|error'`.
6. **Von außen testen:** am Handy im Mobilfunknetz (nicht im WLAN)
   `https://<ROSTER_HOST>/api/v1/health` öffnen.
7. **Überwachung an:** `sudo systemctl enable --now roster-alive.timer`;
   `sudo fail2ban-client status roster-auth`.

Mit dem Zertifikat steht der Hostname in den öffentlichen
Certificate-Transparency-Logs; Scanner klopfen danach an. Erreichbar ist nur
Port 443, und dahinter liegen in Phase 2 nur Health und die Dateien der App.

### Konten (ab Phase 3g)

Der erste Admin entsteht auf dem Pi, alle weiteren Konten über
Einladungslinks aus der App:

1. Nach dem Deploy mit 3g: `grep TOTP_KEY /mnt/ssd/roster/app.env` zeigt den
   Schlüssel, den `install.sh` angelegt hat – in den Passwortmanager.
2. `docker exec roster-app roster-cli invite --admin --note Rob` druckt einen
   Link (`https://<ROSTER_HOST>/invite#…`, 7 Tage, einmal gültig). Öffnen,
   Nutzernamen und Passwort wählen.
3. In der App den Authenticator einrichten (Profil); vorher sind die
   Admin-Werkzeuge gesperrt. Die 10 Wiederherstellungscodes in den
   Passwortmanager.
4. Mitspieler bekommen ihren Link aus der App (Admin → Einladungen).

Die Testinstanz hat eine eigene Datenbank, aber denselben `TOTP_KEY`. Ein
Konto, das du dort anlegst, gilt nur dort und ist nach dem nächsten
nächtlichen Wiederherstellungstest wieder weg; danach meldest du dich dort mit
deinem Produktions-Konto und dessen Authenticator an.

`roster-cli` für Konten (immer `docker exec roster-app roster-cli …`; jeder
Aufruf steht im Audit-Log mit `"via":"roster-cli"`):

| Befehl | Wirkung |
| --- | --- |
| `invite [--admin] [--note <text>]` | Einladungslink, 7 Tage; `--admin` nur hier |
| `reset <name>` | Link für ein neues Passwort, 24 Stunden; ersetzt einen älteren |
| `totp-reset <name>` | entfernt den Authenticator und meldet das Konto überall ab – der Weg zurück, wenn ein Admin Handy und Codes verloren hat |
| `sign-out <name>` | beendet alle Sitzungen des Kontos |
| `users` | Konten mit Admin, Faktor, gesperrt, Geräten, zuletzt gesehen |

### Die laufende Kampagne übernehmen (einmalig, Phase 4a5)

Die Kampagne der Gruppe läuft seit mehreren Schlachten im Roster Builder.
So kommt sie in die App – erst als **Probelauf auf der Testinstanz**
(`roster-deploy --staging`; was dort entsteht, ist nach dem nächsten
nächtlichen Wiederherstellungstest wieder weg), dann genauso produktiv:

1. Der Leiter (mit Authenticator) legt die Kampagne an, nimmt die
   Mitspieler auf und setzt ihre Hausregeln (Manage → „Set the house
   rules“) – die Kopien, die eintreten, übernehmen sie sofort.
2. Jeder Spieler importiert seinen aktuellen Stand aus dem Roster Builder
   (Datei oder Text-Export: Warbands → Import) und trägt ihn ein
   („Enter a warband“); der Leiter bestätigt unter Manage.
3. Der Leiter trägt unter Manage → „Before the app“ jede bisherige Schlacht
   ein: Nummer, Titel (der Titel des Kapitels), Bezirk, Tag, wer kämpfte und
   wie es ausging. Die Kampagne steht danach „After battle N“, und die
   Starts der Warbands wandern dorthin („Entered after battle N“). Fehler
   lassen sich korrigieren oder herausnehmen – aber nur, bis die erste
   Schlacht in der App angelegt ist; danach ist die Vorgeschichte fest.
4. Jeder Spieler öffnet sein Roster und tippt „Take the campaign’s stage“:
   die Stufe „After battle N“, die Kampagnenebene an, ab jetzt Trading Post
   (behaviour-changes.md, Entscheidung 2). Spätestens die Nachbereitung der
   ersten Schlacht in der App holt das nach.
5. Der Leiter importiert die veröffentlichten Kapitel: Zeitleiste →
   „Import chapters…“, alle Dateien aus `_posts/de/` und `_posts/en/` des
   Chronik-Repos auf einmal. Deutsche und englische Datei desselben `ref`
   werden ein Kapitel; jedes bekommt seine Stelle (Prolog vor der Kampagne,
   `battle-N` bei Schlacht N, `interlude-N` im Zwischenspiel N, ein anderes
   wie `pits-interlude` nach der letzten Schlacht, die vor ihm erschien) –
   vor dem Import prüfen und bei Bedarf ändern. Ein späterer Import
   desselben Kapitels ersetzt den Text und lässt die Stelle.
6. Prüfen: die Übersicht (jede Warband „✓ Entered after battle N“, die
   Schlachten „before the app“, nichts „Open for you“), die Zeitleiste mit
   den Kapiteln.
7. Der nächste Spielabend: „New battle“ legt Schlacht N+1 an.

Die Stände der Gruppe tragen keine Stufen-Snapshots (Entscheidung E in der
[Roadmap](roadmap.md#offene-entscheidungen)): der erste Vergleich „What
changed“ läuft von der Übernahme bis nach Schlacht N+1.

### Stufe 3 – Übungen (Abnahme Phase 2)

1. **Rollback-Übung:** `roster-deploy drill-broken; echo "exit=$?"` – ein
   Image, das sofort abstürzt (die CI legt es auf `master` ab). Erwartet:
   nach 60 Sekunden „rolled back to …“, `exit=1`; `roster-deploy --status`
   zeigt den vorigen Stand.
2. **SSD-Übung:** `mv /mnt/ssd/roster/data/.roster-volume ~/roster-volume.away`,
   `docker restart roster-app`, nach ein paar Sekunden
   `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/v1/health`
   → `000`, `journalctl CONTAINER_NAME=roster-app -n 3 --no-pager` zeigt
   `volume_missing`, `roster-deploy <tag>` verweigert die Arbeit. Zurück:
   `mv ~/roster-volume.away /mnt/ssd/roster/data/.roster-volume`,
   `docker restart roster-app`, Health prüfen.
3. Der **Wiederherstellungstest** ist drei Nächte in Folge grün
   (healthchecks.io).

Beide Übungen laufen zusätzlich bei jedem Push in der CI
([`ops/test/e2e.sh`](../ops/test/e2e.sh)), dazu ein Rollback mit
Rücksicherung (ein Image, dessen Migration den Stand verändert und dann
scheitert).

Mitspieler werden erst eingeladen, wenn Phase 3 abgenommen ist.

### Aktualisieren

```bash
cd ~/src/Mordheim-Roster-Builder
git fetch && git log --oneline HEAD..origin/master     # was neu ist
git diff HEAD origin/master -- ops/                     # was als root laufen wird
git pull --ff-only && sudo ops/install.sh               # nur wenn ops/ sich geändert hat
roster-deploy --staging <tag> && roster-deploy <tag>
```

### Nebeneinander mit den bestehenden Diensten

| Dienst | Port | Von außen | Weg |
| --- | --- | --- | --- |
| **Mordheim** | **443/TCP** | **ja (neu)** | Fritzbox → Caddy (Host-Netz) → App auf `127.0.0.1:3000` |
| Mordheim-Testinstanz | 8081/TCP | nein | Heimnetz und VPN |
| bestehende Dienste | wie bisher | unverändert | die bestehenden Freigaben bleiben, wie sie sind |

- Die Fritzbox verteilt nach Port und Protokoll; die bestehenden Dienste und
  Mordheim teilen sich die öffentliche IP und die Domain, ohne sich zu
  berühren.
- **Last:** Die App synchronisiert nur, solange sie offen ist, und schickt
  dabei wenige Kilobyte. Neben Sprache im Voice-Chat ist das nicht spürbar,
  auch nicht am Spielabend. TTS läuft auf den Rechnern der Spieler, nicht auf
  dem Pi.
- **Im Heimnetz** funktioniert dieselbe Adresse; die Fritzbox leitet Anfragen
  an die eigene öffentliche IP intern weiter.
- **Aufrufen:** Mitspieler öffnen den Einladungslink im Browser, legen ihr
  Konto an und installieren die App über „App installieren“ bzw. „Zum
  Home-Bildschirm“. Danach starten sie sie über das Icon.

## 3. Verzeichnisse

```
~/src/Mordheim-Roster-Builder/ops/  Quelle der Betriebsdateien (eigener Klon, nicht unter /mnt/ssd/agent)
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
| [`ddns/porkbun-ddns`](../ops/ddns/porkbun-ddns) | `/usr/local/sbin/` | DynDNS der Domain; nur, wenn `/etc/porkbun-ddns.env` existiert (Abschnitt 11) |
| [`image/roster-cli`](../ops/image/roster-cli) | im Image | `roster-cli` im Container |
| [`install.sh`](../ops/install.sh) | – | spielt alles ein; `--render <dir>` erzeugt nur die Dateien |
| [`test/`](../ops/test/) | – | Rauch- und Ende-zu-Ende-Test der CI, DynDNS-Updater gegen einen API-Ersatz |

Platzhalter in den Vorlagen (`{{ROSTER_HOST}}`, `{{ROSTER_LAN_IP}}`,
`{{ROSTER_DATA}}`, `{{ROSTER_MOUNT}}`, `{{ROSTER_UID}}` …) füllt `install.sh`
aus `site.env`. `ROSTER_MOUNT` (Standard `/mnt/ssd`) ist der Mount, auf dem
die Daten liegen: Docker und die Timer warten auf ihn, und `install.sh`
bricht ab, solange er nicht eingebunden ist.

### `compose.yaml`

- **Caddy** im Host-Netz (UFW und Fail2Ban greifen, die App sieht die echte
  Client-IP), 128 MB. Watchtower darf Caddy weiter aktualisieren.
- **App** (`roster-app`) auf `127.0.0.1:3000`, als `<user>` (1000:1000),
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
| `PUBLIC_ORIGIN` | `https://<ROSTER_HOST>` (für die `Origin`-Prüfung); `install.sh` warnt, wenn es nicht zu `site.env` passt | Phase 2 |
| `LOG_LEVEL` | `info` | Phase 2 |
| `TOTP_KEY` | Schlüssel zum Verschlüsseln der TOTP-Geheimnisse (32 Byte, base64). `install.sh` hängt ihn an, wenn er fehlt (`openssl rand -base64 32`), und ersetzt ihn nie. Die Testinstanz bekommt **denselben** Schlüssel (`install.sh` gleicht `staging.env` an `app.env` an, nie umgekehrt): Der nächtliche Wiederherstellungstest spielt ihr eine Kopie der Produktion ein, und mit einem eigenen Schlüssel wäre dort kein Authenticator lesbar. **Kopie in den Passwortmanager** – er liegt nicht im Backup. Ein falscher Wert hält den Server an (`ConfigError`); fehlt er, startet der Server, aber niemand kann einen Faktor einrichten | Phase 3g |
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
kommt ein Image nur bewusst, als `<user>` per SSH in `tmux`:

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
| wenn der Desktop läuft | Kopie des restic-Repos | Desktop (`roster-backup-pull`, User-Timer, alle 6 h) |

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
    `https://<ROSTER_HOST>/api/v1/health` auf und prüft
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
| vierteljährlich | SD-Klon auffrischen (wie Schritt 14; alte Abbilder bis auf das letzte löschen) |
| jährlich | restic-Passwort aus der Offline-Ablage testweise verwenden |

## Ausfall-Handbuch

| Fall | Erkennen | Folge | Vorgehen |
| --- | --- | --- | --- |
| Internet, Fritzbox oder DNS weg | `roster-alive` bleibt aus | kein Zugriff von außen | nichts tun; App läuft offline, gleicht später ab |
| Pi hängt oder ist aus | `roster-alive` bleibt aus | wie oben | Pi neu starten; Container starten selbst |
| SSD nach Neustart nicht eingebunden | Docker startet nicht; `roster-alive` bleibt aus | Dienste aus, aber keine leere App auf der SD | SSD-Verbindung prüfen, `mount -a`, `systemctl start docker` |
| SSD defekt | wie oben, Mount schlägt fehl | Daten auf dem Pi weg | neue SSD, restic-Kopie vom Desktop zurückspielen; bis dahin Notbetrieb (Abschnitt 10) |
| SD-Karte defekt | Pi bootet nicht | alles aus | SD-Klon einsetzen; sonst Neuaufbau nach diesem Dokument und der Agenten-Basis |
| Deploy fehlerhaft | Health schlägt fehl | App aus oder falsch | `roster-deploy` rollt selbst zurück (Exit 1); bei Exit 2 von Hand: `roster-restore --file <pre-deploy-…>` |
| Bug verfälscht Daten | Meldung, Abgleich-Markierungen | falsche Werte | frühere Version in der App wiederherstellen; im schlimmsten Fall `roster-restore`; Bug als S1 |
| Datenbank beschädigt | Health meldet `integrity: failed` bzw. `unreadable` (503) | App liefert nur Health | `roster-restore` (Abschnitt 6); Geräte bieten Neueres an |
| Arbeitsspeicher voll | App neu gestartet, Log zeigt OOM | kurze Pause | laufende Agenten-Läufe beenden; Limits prüfen |
| Zertifikat erneuert nicht | `roster-alive` meldet < 14 Tage | Browserwarnung droht | Caddy-Log prüfen: `docker logs roster-caddy`; Port 443 und DNS prüfen |
| Konto übernommen | ungewohnte Einträge im Audit-Log oder im Anmelde-Log (Admin) | fremde Änderungen | `roster-cli sign-out <name>`, `roster-cli reset <name>` (bei Verdacht auf den Faktor auch `totp-reset`), Audit-Log durchsehen, Versionen zurückholen |
| Admin hat Authenticator und Codes verloren | – | keine Admin-Werkzeuge | `roster-cli totp-reset <name>`, anmelden, Faktor neu einrichten |
| `TOTP_KEY` verloren oder ersetzt | Code wird nie angenommen | Konten mit Faktor kommen nicht mehr hinein | alten Schlüssel aus dem Passwortmanager zurück in `app.env`; sonst `roster-cli totp-reset <name>` für jedes Konto mit Faktor (`roster-cli users`) |
| Verborgenes war sichtbar | Meldung (automatisch S1) | Leak | vorige Version deployen; Umfang über Audit- und Zugriffslog klären; Test ergänzen, der den Fall abdeckt |
| Neustart um 03:30 | – | kurze Pause | nichts; Container starten selbst |

## 10. Notbetrieb auf dem Desktop

Das Image gibt es auch für amd64. Fällt der Pi länger aus:

1. Auf dem Manjaro-Desktop Docker starten, `compose.yaml` und `Caddyfile`
   mit `ops/install.sh --render <verzeichnis> --site <site.env>` erzeugen
   (`ROSTER_MOUNT` und `ROSTER_DATA` in der `site.env` auf den Desktop
   setzen, z. B. `/` und `/srv/roster`).
2. Letzten Stand aus der restic-Kopie auf dem Desktop zurückspielen.
3. An der Fritzbox die Freigabe TCP 443 auf den Desktop umstellen.
4. Der DNS-Eintrag zeigt weiter auf die Heim-IP; nichts zu ändern.
5. Nach der Rückkehr des Pi: Stand vom Desktop per Backup/Restore
   zurückholen, Freigabe zurückstellen.

## 11. Eigene Domain und DynDNS

Seit 02.10.2026 läuft der Dienst unter einer eigenen Domain statt unter
DuckDNS (dessen Namensauflösung war zeitweise langsam). Die Domain liegt bei
Porkbun; Porkbun zeigt die Inhaberdaten im WHOIS nicht an. Namen und Schlüssel
stehen nur auf dem Pi, hier `<domain>`.

### DNS-Einträge

| Typ | Host | Ziel | Zweck |
| --- | --- | --- | --- |
| A | `mordheim` | Heim-IP (vom Updater gepflegt) | Roster (`ROSTER_HOST`) |
| A | `ts` | Heim-IP (vom Updater gepflegt) | bestehender Sprachdienst |
| SRV (optional) | `_ts3._udp` | `0 5 9987 ts.<domain>` | Sprachdienst auch unter `<domain>` allein |

Kein AAAA-Eintrag: die Freigaben der Fritzbox gelten nur für IPv4. DNSSEC ist
nicht nötig (die Zertifikatsprüfung schützt den Roster ohnehin) und schadet
nicht, wenn man es beim Anbieter einschaltet. HTTP gibt es nicht: Port 80
bleibt zu, Caddy hört dort nicht, und HSTS hält Browser nach dem ersten
Besuch ein Jahr lang auf HTTPS. HSTS-Preload lohnt nicht (gälte für die ganze
Domain, braucht die Umleitung auf Port 80 und lässt sich nur über Monate
zurücknehmen).

### DynDNS-Updater

`ops/ddns/porkbun-ddns` hält die A-Records auf der öffentlichen IPv4: alle
5 Minuten (`porkbun-ddns.timer`) fragt es Porkbun nach der eigenen IP und
ändert einen Eintrag nur, wenn er abweicht; fehlt er, legt es ihn an. Es läuft
als Wegwerf-Benutzer ohne Rechte (`DynamicUser`), die Schlüssel bekommt nur
dieser eine Prozess, und an `curl` gehen sie über stdin, nicht über die
Befehlszeile. `ops/test/ddns.sh` prüft es in der CI gegen einen Ersatz der
Porkbun-API.

Debians `ddclient` (3.11) taugt dafür nicht: Es ruft `porkbun.com` statt
`api.porkbun.com` auf und bekommt 403.

1. Bei Porkbun: Account → API Access → Schlüssel anlegen; bei der Domain
   „API Access“ einschalten. Die Schlüssel nirgends hineinkopieren außer in
   die Datei aus Schritt 2 (geraten sie in einen Chat oder ein Log: löschen
   und neu anlegen).
2. `sudo apt install -y jq`,
   `sudo install -m 600 /dev/null /etc/porkbun-ddns.env`,
   `sudo nano /etc/porkbun-ddns.env` nach
   [`ops/env/porkbun-ddns.env.example`](../ops/env/porkbun-ddns.env.example).
3. `sudo ops/install.sh` installiert Skript und Timer, sobald es die Datei
   findet (und verweigert, wenn andere sie lesen können).
4. Prüfen: `sudo systemctl start porkbun-ddns.service`,
   `journalctl -u porkbun-ddns -n 10 --no-pager` (ohne Ausgabe des Skripts:
   alles stimmte schon; sonst `mordheim.<domain>: <alt> -> <neu>`),
   `dig +short A mordheim.<domain> @curitiba.ns.porkbun.com`.

### Umzug des Hostnamens

1. `ROSTER_HOST=mordheim.<domain>` in `~/server/roster/site.env`, dann
   `sudo ops/install.sh`: schreibt `Caddyfile` und `/etc/roster/roster.conf`
   neu (damit prüft `roster-alive` die neue Adresse) und startet Caddy neu;
   Caddy holt das Zertifikat über TLS-ALPN auf 443
   (`docker logs --since 10m roster-caddy 2>&1 | grep -iE 'obtain|error'`).
2. `app.env` überschreibt `install.sh` nie; es warnt aber, solange
   `PUBLIC_ORIGIN` nicht zu `ROSTER_HOST` passt. Ändern
   (`sudo nano /mnt/ssd/roster/app.env`), dann
   `cd ~/server/roster && docker compose up -d --force-recreate app` – ein
   `docker restart` liest die Datei nicht neu.
3. Die alte Adresse antwortet danach nicht mehr (der `Caddyfile` kennt nur
   einen Host). Solange niemand angemeldet ist (vor 3g), braucht es keine
   Umleitung; danach wäre sie ein zweiter Block
   `<alt> { redir https://<neu>{uri} permanent }`.
4. Die App auf jedem Gerät unter der neuen Adresse neu installieren (die PWA
   und ihre lokalen Daten hängen an der Adresse: vorher exportieren); ab 3g
   melden sich alle einmal neu an (Cookies hängen am Hostnamen).
5. Serveradresse in der Quick-Build-Einstellung und ggf. im TTS-Skript
   ändern; im Sprachdienst `ts.<domain>` eintragen.
6. Den alten DynDNS-Dienst erst abschalten, wenn alle umgestellt haben.
