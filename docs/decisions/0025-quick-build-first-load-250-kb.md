# 0025 – Erste-Laden-Grenze des Quick Builds: 250 KB wie die Kampagne
Status: angenommen (Rob, 23.10.2026) · Datum: 2026-10-23 · ersetzt einen Teil von [0021](0021-first-load-budget-per-flavour.md)

## Kontext
ADR 0021 gab der Kampagne 250 KB und ließ dem Quick Build seine 200 KB. Es sah
vor, dass der gemeinsame Code den Quick Build zuerst an die Grenze führt, und
nannte zwei Wege: Teile erst bei Bedarf laden, oder die Grenze des Quick Builds
bewusst anheben (neue Notiz).

Dieser Fall ist da. Nach dem Lauf vom 22.10.2026 (Berichte #43 bis #50) stand der
Quick Build bei 199,7 von 200 KB; die CI lehnte den nächsten Pull Request wegen
etwa 250 Bytes ab, obwohl es sich um Regeln handelte, nicht um Oberfläche. Ein
Zahlenwert in den Daten statt im Code brachte ihn durch (die Verhältnisgrenzen,
Bericht #46), aber ohne Luft für den nächsten.

## Entscheidung
- Quick Build: **≤ 250 KB**, wie die Kampagne (Rob, 23.10.2026).
- `LIMITS` in `app/scripts/size.mjs` führt weiter eine Grenze je Ausgabe, damit
  sich eine später allein ändern lässt; ein Test hält `docs/ui.md` auf denselben
  Zahlen.
- Die Zeitgrenzen aus `docs/ui.md` (3 s bis bedienbar auf dem Handy-Profil)
  bleiben und sind die eigentliche Grenze.
- Mehr als 250 KB braucht wie bisher eine neue Notiz, die das Handy-Profil des
  Tests mitbedenkt.

## Folgen
- Rund 50 KB Platz in beiden Ausgaben. Das Argument von 0021 bleibt: Wer den
  Quick Build vom Handy ohne Cache öffnet, zahlt etwa 0,6 s je 100 KB; was nicht
  beim Start gebraucht wird, wird weiter erst bei Bedarf geladen.
- Wächst der gemeinsame Code, stoßen beide Ausgaben zusammen an die Grenze.

## Verworfen
- **Bei 200 KB bleiben und weiter Bytes suchen.** Jeder Pull Request hätte
  Bytes aus anderem Code herausholen müssen; die Bytegrenze ist ein Ersatz für
  die Zeit, und die Zeitgrenze hält.
