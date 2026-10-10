# Sicherheitsprüfung vor dem ersten Spielabend

Stand: 10. Oktober 2026 · Auftrag: Rob, 05.10.2026 („dass sich weder von
außen noch angemeldet etwas ausnutzen lässt – Endpunkte, Rechte, Eingaben,
Sitzungen, Betrieb“) · Geprüft: `master` bei `22ef27f` (nach Phase 4a5)

## Kurz

- **Wie geprüft:** fünf voneinander unabhängige Prüfungen – Anmeldung und
  Sitzungen, Rechte und Sichtbarkeit, Eingaben und Ressourcen, die App im
  Browser, der Betrieb auf dem Pi – jede mit Proben als Tests gegen den
  echten Server, danach gelöscht; dazu eine eigene Durchsicht (SQL,
  Zahlen in Pfaden, statische Dateien, Rechenzeit großer Stände). Jede
  Behebung beginnt mit einem Test, der vorher fehlschlug. Danach hat eine
  weitere, unabhängige Prüfung die Behebungen selbst geprüft (Sichtbarkeit
  ist S1); was sie fand, ist ebenfalls behoben (unten).
- **Ergebnis:** 47 Befunde (3 hoch, 10 mittel). Behoben: alle hohen und
  mittleren und die meisten übrigen. Bewusst offen oder später: 7, dazu Teile
  von 4 – unten mit Grund.
- **Die drei wichtigsten:**
  1. **OPS-1** – Ein Push auf irgendeinen Branch konnte ein Image unter
     einem Tag ablegen, das Rob in die Produktion bringt. Jetzt nimmt die
     Produktion nur Images, die die CI auf `master` gebaut und signiert hat
     ([ADR 0017](decisions/0017-signed-images-from-master.md)).
  2. **CLIENT-1** – Auf einem geteilten Handy las das nächste Konto die
     Leiter-Notizen und versiegelten Worte des vorigen aus dem Gerätespeicher.
     Jetzt gehört alles Gespeicherte einem Konto und geht beim Abmelden weg.
  3. **INPUT-1** – Ein Spieler konnte den Server mit einer Anfrage dauerhaft
     anhalten (eine Steigerung von 1e15, dann „markieren“). Jetzt sind
     Zählwerte begrenzt, und die Zuordnung hört auf, sobald nichts mehr passt.

## Was Rob tun muss

1. **Mergen, in dieser Reihenfolge** (sie bauen aufeinander auf):
   `security-auth` → `security-visibility` → `security-ops`.
2. **Auf dem Pi:** `cd ~/src/Mordheim-Roster-Builder && git pull --ff-only && sudo ops/install.sh`.
   Das installiert `cosign`, gibt der Testinstanz einen eigenen
   `TOTP_KEY`, legt `secrets/staging.pass` an, übergibt Caddys
   Verzeichnisse an root, baut Caddy gehärtet neu und hält die Testinstanz
   an, weil ihre Kopie noch die Passwörter der Produktion trägt.
3. **Erst die Testinstanz, dann produktiv** mit dem ersten signierten Build
   von `master` (Tag = Commit, nie `master`): `roster-deploy --staging <tag>`
   – das gibt der Kopie zuerst das Testpasswort –, dann `roster-deploy <tag>`.
   Ältere Builds hatten keine Signatur – produktiv nimmt `roster-deploy`
   sie nicht mehr (zurückrollen auf das laufende geht weiter).
4. **Testinstanz:** anmelden mit dem Testpasswort
   (`cat /mnt/ssd/roster/secrets/staging.pass`); als Admin dort den
   Authenticator neu einrichten (eigener Eintrag in der App, z. B. „Mordheim
   Test“; nach jedem nächtlichen Wiederherstellungstest neu).
5. **Offen zur Entscheidung:** der Klarname in der Git-Geschichte (OPS-8,
   unten).

## Befunde

Schwere wie in [security.md](security.md#8-schweregrade-für-bugs) gedacht:
hoch (Daten verraten oder Dienst dauerhaft weg), mittel, niedrig, Info.
„PR“ nennt den Branch, der es behebt; Tests unter `server/test/` und
`app/src/`.

### Anmeldung und Sitzungen (`security-auth`)

| ID | Befund | Schwere | Stand |
| --- | --- | --- | --- |
| AUTH-1 | Parallele falsche Passwörter für ein Konto liefen an der Bremse vorbei, solange der Hash noch rechnete | mittel | behoben: ein Versuch je Konto zugleich (429) |
| AUTH-2 | Ein Reset-Link ließ sich zweimal zugleich einlösen; ein zurückgenommener oder ersetzter Link wirkte noch, wenn sein Hash schon in der Warteschlange stand (auch AUTH-11) | niedrig | behoben: der Link wird nur verbraucht, wenn er in dem Moment noch gilt |
| AUTH-3 | Eine gestohlene Sitzung konnte den Authenticator durch einen eigenen ersetzen | mittel | behoben: Ersetzen braucht einen Code des bisherigen oder einen Wiederherstellungscode |
| AUTH-4 | Passwortänderung und Abschalten des Authenticators waren Passwort-Orakel ohne Bremse | niedrig | behoben: ein falsches aktuelles Passwort zählt als Fehlversuch |
| AUTH-5 | Nach dem Einrichten des Authenticators blieben Sitzungen gültig, die nur mit dem Passwort entstanden | niedrig | behoben: sie enden |
| AUTH-6 | Eine Passwortänderung aus einer inzwischen beendeten Sitzung ging durch | niedrig | behoben |
| AUTH-7 | Alte Anmeldeversuche wurden per Tabellen-Scan gelöscht | Info | behoben: Index (Migration 13) |
| AUTH-8 | Ohne Konto ließ sich die Warteschlange der Passwort-Hashes füllen; alle Anmeldungen warteten Minuten | niedrig | behoben: mehr als 20 wartend → sofort 503 „busy“ |
| AUTH-9 | Wer einen Kontonamen kennt, konnte das Konto dauerhaft aussperren, und die Versuche des Opfers ließen dessen eigene Adresse von Fail2Ban sperren | niedrig | behoben: Bremse je (Konto, Adresse), lockerer je Konto allein; gebremste Versuche zählen nicht für Fail2Ban |
| AUTH-10 | Wiederherstellungscodes waren ungesalzenes SHA-256 von etwa 40 Bit – eine Kopie der Datenbank verriet sie alle | niedrig | behoben: HMAC mit `TOTP_KEY`; alte Codes gelten weiter |
| AUTH-12 | Sperren oder „überall abmelden“ ließ offene Reset-Links gültig | Info | behoben |
| AUTH-13 | Zwei Einladungen mit demselben Namen zugleich: 500 | Info | behoben: „that username is taken“ |
| AUTH-14 | Die Sitzung verlängerte sich auf dem Server, das Cookie nicht | Info | behoben |
| AUTH-15 | Abschalten des Authenticators brauchte keinen Code | niedrig | behoben: Passwort und Code |
| AUTH-16 | Der Admin konnte über die App jedes Konto übernehmen, auch ein anderes Admin-Konto | Info | behoben für Admin-Konten (nur noch `roster-cli` auf dem Pi); für Spieler bleibt Reset wie gedacht – er meldet sie ab und steht im Audit-Log |

### Rechte und Sichtbarkeit (`security-visibility`)

| ID | Befund | Schwere | Stand |
| --- | --- | --- | --- |
| AUTHZ-1 | Das Audit-Log zeigte dem Admin Kampagnennamen, Schlachttitel, alte Protokolltexte und die Art versiegelter Notizen – auch von Kampagnen, in denen er nicht ist | mittel | behoben: dort nur Aktion, Zeit, Handelnder; die Art einer versiegelten Notiz steht gar nicht mehr im Log |
| AUTHZ-2 | Die Bilderquote verriet die Größe der Leiter-Bilder, und Ankündigungen ohne Bytes füllten sie | niedrig | behoben: gezählt wird Gespeichertes, höchstens 20 wartende je Mitglied |
| AUTHZ-3 | Die Zahl, mit der ein Gerät nach Neuem fragt, bewegte sich bei Leiter-Notizen auch für Spieler | niedrig | behoben: je Fragendem |
| AUTHZ-4 | Jede `seq` ist der serverweite Zähler: ein Angemeldeter sieht, wie viel insgesamt geschrieben wird | Info | bewusst offen: nur Aktivität, kein Inhalt |
| AUTHZ-5 | `copiedFrom` einer eingetragenen Warband nannte allen Mitgliedern die ID der privaten | Info | behoben: nur der Besitzer |
| AUTHZ-6 | Eine Warband, die die Kampagne verlassen hat, zeigt in Schlachten und Zeitleiste ihren späteren Namen | niedrig | später: den Namen beim Markieren einfrieren (braucht eine Migration) |
| AUTHZ-7 | Die Leak-Matrix kennt keine Zuschauer, Leiter und Admin-Mitglieder bei verborgenen Inhalten und prüft nur oberste Felder | Info | später: eigene Aufgabe vor 4b; die Befunde dieser Prüfung haben jetzt eigene Tests |

### Die App im Browser (`security-visibility`)

| ID | Befund | Schwere | Stand |
| --- | --- | --- | --- |
| CLIENT-1 | Geteiltes Gerät: das nächste Konto sah Leiter-Notizen, versiegelte Worte, Bilder und die unsendeten Einträge des vorigen | hoch | behoben: Speicher je Konto, beim Abmelden gelöscht; Warteschlange nur des eigenen Kontos; `Clear-Site-Data` beim Abmelden |
| CLIENT-2 | Abgemeldet ließen sich fremde Warbands öffnen und ändern; die Änderung ging später unter dem Namen des Besitzers hoch | mittel | behoben: abgemeldet nur Warbands ohne Besitzer |
| CLIENT-3 | Legacy-Tool: Code über die ID einer angeheuerten Klinge in einer geteilten Warband | niedrig | behoben im Format (nur schlichte Schlüssel); das Legacy-Tool selbst bleibt eingefroren |
| CLIENT-4 | Ein kleiner Link aus dem Quick Build konnte sich auf Gigabytes entpacken und den Tab einfrieren | niedrig | behoben: höchstens 256 KB Link, 4 MB entpackt |
| CLIENT-5 | Der Quick Build nahm jede `http://`-Adresse als Server | niedrig | behoben: `http` nur im Heimnetz. Später, wenn der Quick Build online geht: eigener Ursprung statt `<user>.github.io`, Schutz vor Einbetten |
| CLIENT-6 | Einladungs- und Reset-Links bleiben im Browserverlauf | Info | bewusst offen: kurze Laufzeit, einmal gültig |
| CLIENT-7 | = OPS-5 | – | behoben |
| CLIENT-8 | IDs aus Adresse und Parametern gehen ungeprüft in API-Pfade | Info | später: als UUID prüfen; kein ausnutzbarer Weg gefunden |

### Eingaben und Ressourcen (`security-ops`)

| ID | Befund | Schwere | Stand |
| --- | --- | --- | --- |
| INPUT-1 | Eine Steigerung von 1e15 und „markieren“ hielt den Server für immer an; Gruppengröße oder Ausrüstung 1e9 sprengten Speicher und Zeit | hoch | behoben: höchstens 1000 je Sache im Schema; die Zuordnung hört auf, sobald nichts mehr passt |
| INPUT-2 | Ein Körper von 3 MB aus lauter `{}` wuchs beim Lesen auf das 45-Fache – auch ohne Konto, an der Anmeldung | mittel | behoben: ohne Konto 64 KB, jeder Körper höchstens 50 000 Objekte, geprüft vor dem Lesen |
| INPUT-3 | Neun Warbands zu 2 MB brachten den Server beim Abgleich über seine 256 MB | mittel | behoben: aktuelle Warbands eines Kontos höchstens 16 MB |
| INPUT-4 | Ältere Versionen und entfernte Warbands wachsen auf der Platte ohne Grenze | niedrig | bewusst offen: nur eingeladene Mitglieder; `roster-alive` meldet ab 90 % |
| INPUT-5 | Ein legaler, sehr großer Stand braucht beim Markieren einige Sekunden (Zuordnung Änderungen × Ereignisse) | Info | bewusst offen: einmal je Schlacht und Warband |

Eigene Durchsicht, ohne Befund: SQL nur mit Parametern (die wenigen
zusammengesetzten Spaltennamen sind Konstanten), Zahlen aus Pfad und Query
geprüft oder harmlos (`NaN` findet nichts), statische Dateien nur aus der
beim Start gelesenen Liste, `__proto__` wird von Fastify abgewiesen.

### Betrieb auf dem Pi (`security-ops`)

| ID | Befund | Schwere | Stand |
| --- | --- | --- | --- |
| OPS-1 | Jeder Branch-Push konnte ein Image unter einem Produktions-Tag ablegen; `roster-deploy` prüfte nichts | hoch | behoben: Signatur der CI von `master` für genau diesen Commit, geprüft mit `cosign` vor jedem Deploy (ADR 0017); Rob, 09.10.2026: „Herkunft prüfen“ |
| OPS-2 | Betriebsskripte vertrauten Namen und Dateien aus Verzeichnissen, die ein Container beschreiben kann | mittel | behoben: Snapshot-Namen geprüft, keine Symlinks, Ziele ersetzt statt durchgeschrieben. Später: Container unter eigener UID statt Robs |
| OPS-3 | Die Testinstanz hielt eine Kopie der Produktion samt Zugangsdaten, über `http` im Heimnetz | mittel | behoben (Rob, 09.10.2026: „Zugangsdaten tauschen“): eigener `TOTP_KEY`; nach jeder Wiederherstellung ein Testpasswort für alle, keine Authenticatoren, keine Sitzungen, keine offenen Links; Fail2Ban zählt dort mit. Die Erzählung der Kopie liegt weiter dort, im Heimnetz ohne TLS |
| OPS-4 | Caddy lief ungehärtet als root mit Docker-Standardrechten | mittel | behoben: nur `NET_BIND_SERVICE`, Dateisystem nur lesbar, `no-new-privileges`, Prozessgrenze. Watchtower aktualisiert Caddy weiter (ADR 0009): schnelle Sicherheitsupdates wiegen schwerer |
| OPS-5 | Caddy überschrieb die strengere CSP der Bilder | niedrig | behoben: `?Content-Security-Policy`; `ops/test/caddy.sh` prüft es |
| OPS-6 | Ein Prozess auf dem Pi konnte eine Client-Adresse vorgeben und so fremde Adressen sperren lassen | niedrig | behoben: nur gültige IP-Adressen im Log, `usedns = no` |
| OPS-7 | Actions per Tag statt Commit; Pages-Rechte für den ganzen Workflow; Token in `.git/config` | mittel | behoben: Commits festgelegt, Dependabot monatlich, Rechte nur im Deploy-Job, `persist-credentials: false` |
| OPS-8 | Klarname und Uni-Adresse in 140 Commits; Hostname des Pi in der Doku | niedrig | Hostname ersetzt. Die Geschichte umzuschreiben (`git filter-repo --mailmap`, Force-Push, Support für PR-Refs) entscheidet Rob – nichts davon ist passiert |
| OPS-9 | `install.sh` (als root) folgte `..` und Symlinks in Pfaden des Nutzers | niedrig | behoben |
| OPS-10 | Die Ping-URL von healthchecks.io stand auf der Kommandozeile von curl | Info | behoben: über stdin |
| OPS-11 | `ops/test/e2e.sh` hätte auf dem Pi `site.env` überschrieben | Info | behoben: läuft nur auf einem frischen CI-Runner |

## Unabhängige Prüfung der Behebungen (10.10.2026)

Eine weitere Prüfung, die die Behebungen nicht kannte, hat den ganzen Stand
gelesen und mit Proben getestet. Alles Folgende ist behoben, jeweils mit
einem Test, der vorher fehlschlug:

| Befund | Schwere | Behebung |
| --- | --- | --- |
| Arbeit für Konto A lief nach einem Kontowechsel unter B weiter: ein zweiter Tab mit B's Cookie, Antworten, die nach dem Wechsel ankamen und unter B's Schlüssel landeten, Einträge der Warteschlange, die als B gingen | mittel | Jede Anfrage nennt ihr Konto (`X-Roster-User`; Warteschlange: der Autor, Abgleich: das Konto der Runde); der Server lehnt eine für ein anderes Konto als das des Cookies ab (409 `other_user`), die App fragt neu, wer angemeldet ist – auch wenn ein anderer Tab wechselt; Antworten werden nur unter dem Konto abgelegt, für das gefragt wurde |
| INPUT-3 nicht ganz: 113 kleine Stände voller leerer Listen hielten 16 MB ein und brachten den Abgleich trotzdem über 256 MB | mittel | auch Objekte und Listen zählen (200 000 je Konto); Hausregeln höchstens 16 KB |
| OPS-3: Misslang der Tausch der Zugangsdaten, blieb die Kopie liegen, und `roster-deploy --staging` hätte sie gestartet | mittel | die Kopie wird dann gelöscht; ohne Tausch startet die Testinstanz nicht, `roster-deploy --staging` holt ihn nach; `install.sh` hält eine ungetauschte an; der Test nimmt die Sperre des Deploys |
| AUTHZ-3: Eine öffentliche Notiz, die zur Leiter-Notiz wurde, blieb auf den Geräten der Spieler | niedrig | „unverändert“ nur bei genau der Zahl des Geräts |
| AUTHZ-1: Der Admin sah noch, dass verborgene Notizen existieren (Aktion, Autor, Zeit) | niedrig | nicht-öffentliche Einträge einer Kampagne erscheinen gar nicht mehr |
| OPS-1: Namen wie `master` oder `drill-broken` prüften keinen Commit – ein Branch konnte sie auf einen älteren signierten Build zeigen lassen; ein Branch „Master“ hätte die Signaturprüfung bestanden (Groß-/Kleinschreibung) | niedrig / mittel | produktiv nur Commits (der monatliche Neubau als `<commit>-<datum>`), `drill-broken` nur für das Übungs-Image; Branch und Workflow werden genau verglichen; Compose zieht nie selbst |
| CLIENT-5: `http://10.evil.example` galt als Heimnetz | niedrig | nur ganze private IPv4-Adressen |
| INPUT-2: Die 64-KB-Grenze ohne Konto griff erst, nachdem 3 MB gelesen waren | niedrig | Routen, die jeder erreicht, lesen höchstens 64 KB |
| Drei Spieler hinter einem Router konnten sich nicht im selben Moment anmelden (429) | niedrig | eine Prüfung je Konto, drei je Adresse |
| Fail2Ban kann den veröffentlichten Port 8081 der Testinstanz nicht sperren | Info | Fehlversuche dort zählen für die Sperre auf 443; 8081 ist nur im Heimnetz |

Bewusst offen aus dieser Prüfung: Warteschlange und Warbands eines
abgemeldeten Kontos bleiben auf dem Gerät (versteckt, nicht gelöscht – sonst
gingen unsendete Einträge verloren); ohne Verbindung lässt sich nicht
abmelden, die Daten des Kontos bleiben bis zur nächsten Verbindung.

## Was bleibt (und warum)

- **Innerhalb des Vertrauens der Gruppe:** Ein eingeladenes Mitglied kann
  weiterhin Platz auf der Platte füllen (INPUT-4) oder mit sehr großen,
  legalen Ständen Sekunden an Rechenzeit verbrauchen (INPUT-5). Beides
  setzt ein Konto voraus, das Rob vergeben hat, und ist im Audit-Log zu
  sehen.
- **Die Testinstanz** bleibt `http` im Heimnetz mit der Erzählung der
  Produktion – Robs Entscheidung, weil sie für Proben echte Daten braucht.
  Zugangsdaten der Produktion wirken dort nicht mehr.
- **Wer `master` ändert, bestimmt, was läuft.** Das ist der Punkt, an dem
  Rob prüft; Zwei-Faktor bei GitHub ist Pflicht (operations.md, Stufe 1).
- **Aufgaben für später:** AUTHZ-6 (Namen einfrieren), AUTHZ-7 (Leak-Matrix
  mit allen Rollen und Feldern), CLIENT-5 (Quick Build auf eigenem
  Ursprung), CLIENT-8 (IDs prüfen), OPS-2 (eigene UID für die Container).
