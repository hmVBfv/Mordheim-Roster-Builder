# 0028 – Images nur von master, alte Branch-Images wöchentlich weg, jeder Branch nur einmal getestet
Status: angenommen (Rob, 28.10.2026) · Datum: 2026-10-28 · ersetzt Teile von [0009](0009-deliberate-deploys.md) und [0017](0017-signed-images-from-master.md)

## Kontext
Die CI veröffentlichte nach ADR 0017 für **jeden Push auf jeden Branch** ein signiertes Image
`ghcr.io/hmvbfv/mordheim-roster:<7 Zeichen>`, damit Rob einen Branch-Build auf der Testinstanz ansehen
konnte (`roster-deploy --staging <tag>`). Seit die Arbeit in Cloud-Sitzungen läuft, sind das hunderte
Pushes (687 Läufe in einer Woche, der Großteil davon Branches von `/bugs`): Jeder baut zwei
Plattformen, lädt hoch, signiert und zieht das Image gleich wieder, um es mit `roster-verify` zu
prüfen. Das Paket sammelte so hunderte Versionen und viele „Downloads“, die nur die CI selbst waren.
Ein Pull-Request-Zweig lief außerdem doppelt: einmal als Push auf den Branch, einmal als Pull Request.
Rob (28.10.2026): Die Testinstanz mit Branch-Images nutzt er nicht mehr.

## Entscheidung
- Nur ein Push auf `master` (und der monatliche Neubau) **veröffentlicht** ein Image. Ein Branch
  veröffentlicht nichts; sein Image wird im Job `image` auf dem Läufer gebaut und geprüft, ohne es
  hochzuladen. Der Schutz aus 0017 (Signatur und Prüfung beim Ziehen mit `roster-verify`) bleibt, wie er
  war; nur gibt es weniger Images, die er prüfen müsste.
- Die CI läuft für einen Branch **einmal**, als Pull Request (`pull_request` auf `master`). Der Trigger
  `push` gilt nur noch für `master`. Ein Branch ohne Pull Request wird also nicht getestet; der
  `/bugs`-Ablauf öffnet den Pull Request gleich nach dem Push.
- `roster-deploy --staging <tag>` bleibt im Skript, nimmt aber nur noch Commits von `master`, weil es
  keine anderen gibt. Rob nutzt die Testinstanz nicht mehr für Deploys.
- Der Workflow `.github/workflows/prune-images.yml` löscht jede Woche (montags) und auf Wunsch von Hand
  (zuerst als Probelauf) Versionen des Pakets, die **älter als 14 Tage** sind und **nicht zu `master`
  gehören** – ohne Tag mit dem ganzen Commit, ohne `:master`, `:drill-broken`, `:master-<datum>` und
  `:<commit>-<datum>`. Die Signaturen von Versionen, die bleiben, bleiben. Die Regeln stehen in `.github/scripts/images-to-prune.sh`, getestet von
  `.github/scripts/test-images-to-prune.sh` in der CI.
- Versionen ohne Tag (die Plattform-Images und Nachweise hinter einem Multi-Arch-Image) gehen nur weg, wenn sie älter als 14 Tage sind und kein behaltenes Image sie auflistet (der Workflow liest die Manifeste der behaltenen Images). Lässt sich eines nicht lesen, bricht der Lauf ab, bevor etwas Untagged gelöscht wird.

## Folgen
- Weniger Läufe (jeder Branch einmal statt zweimal), weniger Images, weniger „Downloads“ am Paket.
- Rob sieht einen Branch nicht mehr auf der Testinstanz an; die Vorschau eines Branches gibt es nur
  noch über die Tests und die Screenshots der CI.
- Die ersten Läufe des Aufräum-Workflows löschen die Branch-Images der letzten Wochen. Gelöschte
  Versionen lassen sich nicht zurückholen; auf master baut die CI das Image neu.
- **Offen:** Die Testinstanz (`roster-staging`) selbst bleibt vorerst, weil sie der Ort des monatlichen
  Wiederherstellungstests ist (`roster-restore-test`: das Backup wird dorthin zurückgespielt und
  gestartet). Sie ganz zu entfernen heißt, diesen Test auf einen Wegwerf-Container umzubauen
  (`ops/lib/roster-restore-test`, `ops/install.sh`, `ops/compose.yaml`, `ops/test/e2e.sh`,
  `roster-cli test-accounts`); das ist ein eigener Schritt.

## Verworfen
- Alle Branch-Images behalten und nur das Paket aufräumen: die Läufe bleiben teuer.
- Pull-Request-Images mit kurzer Lebensdauer: ohne Testinstanz würde sie niemand ansehen.
