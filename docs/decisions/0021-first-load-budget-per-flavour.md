# 0021 – Erste-Laden-Grenze je Ausgabe: Kampagne 250 KB, Quick Build 200 KB
Status: vorgeschlagen · Datum: 2026-10-19 · ergänzt [0014](0014-performance-budgets-in-ci.md)

## Kontext
ADR 0014 setzt für das JavaScript beim ersten Laden eine Grenze von 200 KB
(komprimiert), für beide Ausgaben gleich. Seitdem hat sich gezeigt:

- Die Kampagne wird vor allem am Desktop gespielt (Rob, 19.10.2026: „Der
  Hauptfokus bei der Kampagne liegt auf dem Desktop“). Dort kostet ein
  größerer Start wenig, und danach liegt die App im Cache.
- Die Grenze ist eng. Stand `master` (19.10.2026): Kampagne 190,0 KB, Quick
  Build 188,8 KB. Das Pixel-Art-Gerüst allein kostete 5,4 KB; jede weitere
  Änderung der letzten Wochen etwa 0,2 KB. Es blieben 4 bis 6 KB Luft. Die
  beiden Ausgaben unterscheiden sich nur um 1,2 KB, weil sie fast denselben
  Code laden.
- Die Bytegrenze ist ein Ersatz für das, was zählt: die Zeit bis zur
  Bedienbarkeit. Die prüft Playwright auf einem Handy-Profil (1,6 Mbit/s,
  150 ms Latenz, CPU 4× gedrosselt) gegen 3 s. Gemessen am 19.10.2026: erster
  Start 2,0 s bei 190 KB; mit künstlich 68 KB mehr Code (258 KB) 2,4 s, also
  etwa 0,6 s je 100 KB. Das Zusatzstück stand beim Start fast nur herum;
  Code, der beim Start läuft, kostet mehr Rechenzeit.

## Entscheidung
- Kampagne: **≤ 250 KB**. Quick Build: **≤ 200 KB**, unverändert.
- `app/scripts/size.mjs` führt eine Grenze je Ausgabe (`LIMITS`); ein Test
  stellt sicher, dass `docs/ui.md` dieselben Zahlen nennt.
- Die Zeitgrenzen aus `docs/ui.md` bleiben, auf dem Handy-Profil, für beide
  Ausgaben. Sie sind die eigentliche Grenze; wer sich 250 KB nähert, sieht dort
  zuerst die Zeit.
- Mehr als 250 KB braucht eine neue Notiz, die das Handy-Profil des Tests
  mitbedenkt (oder ein eigenes Desktop-Profil festlegt).

## Folgen
- Rund 55 KB Platz für die Desktop-Ansichten der Kampagne. Das ist kein
  Freibrief: Teile, die nicht beim Start gebraucht werden (Unterseiten,
  Dokumente, Zeichnungen), werden weiter erst bei Bedarf geladen.
- Kampagne und Quick Build teilen den Code. Wächst der gemeinsame Teil, stößt
  zuerst der Quick Build an seine 200 KB. Dann gibt es zwei Wege: den Teil
  erst bei Bedarf laden (hilft beiden) oder die Grenze des Quick Builds
  bewusst anheben (neue Notiz). Der Platz der Kampagne füllt sich also nur mit
  Code, der allein ihr gehört.
- Die Pixel-Art-Szenen (rund 5 KB) lassen sich unabhängig davon erst bei
  Bedarf laden, falls der Platz knapp wird.

## Verworfen
- **Beide Ausgaben auf 250 KB.** Der Quick Build ist der Link, den Neue auf
  dem Handy öffnen, ohne Cache und ohne Konto; dafür gilt das Handy-Argument
  weiter, das Desktop-Argument trifft ihn nicht.
- **Keine Bytegrenze, nur Zeitgrenzen.** Die Zeiten rauschen auf einem
  geteilten Runner; die Bytegrenze zeigt einen versehentlich eingebundenen
  großen Baustein sofort und ohne Messung.
- **Nur die Pixel-Art-Szenen nachladen.** Das bringt 5 KB zurück, aber nicht
  den Platz, den die Desktop-Ansichten brauchen.
