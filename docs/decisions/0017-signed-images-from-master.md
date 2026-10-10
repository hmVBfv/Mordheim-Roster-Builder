# 0017 – In die Produktion nur signierte Images von master
Status: angenommen (Rob, 09.10.2026) · Datum: 2026-10-09

## Kontext
Die Sicherheitsprüfung vom 09.10.2026 (OPS-1, `docs/security-review.md`)
fand den kürzesten Weg in die Produktion: Die CI veröffentlichte für jeden
Push auf jeden Branch ein Image unter `ghcr.io/hmvbfv/mordheim-roster`, und
der Workflow eines Branches läuft in dessen eigener Fassung – er kann jeden
Tag überschreiben, auch den eines geprüften master-Commits oder `:master`.
`roster-deploy <tag>` zog den Tag und prüfte nichts. Der Schutz von master
(nur per Pull Request mit grüner CI) galt damit für die Registry nicht. Push
dürfen Rob, die Claude-GitHub-App in den Cloud-Sitzungen und später der
`/bugs`-Agent, der unzuverlässige Bug-Texte liest. Wer ein Image in die
Produktion bringt, läuft dort als `roster-app` mit allen Daten und dem
`TOTP_KEY`.

## Entscheidung
- Die CI signiert jedes Image, das sie veröffentlicht, schlüssellos mit
  Sigstore (`cosign sign`). Das Zertifikat stellt GitHub über das OIDC-Token
  des Laufs aus; es nennt Workflow, Branch und Commit. Ein Branch kann kein
  Zertifikat für `refs/heads/master` bekommen, auch mit geändertem Workflow
  nicht.
- `roster-deploy <tag>` bringt ein Image nur in die Produktion, wenn
  `roster-verify` (`ops/lib/roster-verify`) es bestätigt: Signatur auf dem
  Digest, mit dem es gezogen wurde, von `.github/workflows/ci.yml` an
  `refs/heads/master` dieses Repositorys, für den Commit, den das Image
  nennt (`ROSTER_VERSION`); ein Tag aus Hex-Ziffern muss dessen Anfang
  sein, damit kein älteres Image unter neuem Namen kommt. Sonst bricht der
  Deploy ab, bevor sich etwas ändert.
- Die Testinstanz nimmt jedes Image, auch Branch-Builds
  (`roster-deploy --staging <tag>`), und sagt nur, ob es eines von master ist.
- `ops/install.sh` installiert eine feste cosign-Version, deren Prüfsumme im
  Skript steht. Die CI nutzt dieselbe Version und prüft nach jedem Push mit
  `roster-verify`, dass master durchkommt und ein Branch abgewiesen wird.
- master veröffentlicht zusätzlich den Tag mit dem ganzen Commit.
- Die Actions in den Workflows sind auf Commits festgelegt (Tag im
  Kommentar), Dependabot schlägt monatlich neuere vor.

## Folgen
- Ein Deploy braucht Netz zu Sigstore (Transparenzlog, TUF-Wurzel im
  Cache unter `~/.sigstore`). Ohne Netz kommt aber auch kein Image.
- Die Rollback-Übung mit `:drill-broken` geht weiter: auch dieses Image
  signiert master.
- `ROSTER_NO_PULL=1` (nur für Tests mit lokal gebauten Images) überspringt
  die Prüfung und sagt das im Log.
- Bleibt offen: Wer `master` ändern kann (Rob, und wer Pull Requests
  mergen darf), bestimmt weiterhin, was in die Produktion darf. Das ist
  gewollt – genau diese Stelle prüft Rob.

## Verworfen
- Nur auf master veröffentlichen: Ein Branch-Workflow kann trotzdem pushen,
  solange das Paket am Repository hängt; die Prüfung muss beim Ziehen
  passieren.
- Deploy per Digest statt Tag, ohne Signatur: Der Digest käme aus einer
  Quelle, die der Branch ebenfalls beschreiben kann (Registry,
  Zusammenfassung der CI).
- `gh attestation verify`: braucht auf dem Pi ein GitHub-Token und die
  GitHub-CLI; cosign kommt ohne beides aus.
