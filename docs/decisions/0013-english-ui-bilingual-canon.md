# 0013 – Englische Oberfläche, zweisprachiger Kanon
Status: angenommen · Datum: 2026-09-27

## Kontext
Die Regelquellen sind englisch, die Mitspieler deutsch, das Epos erscheint auf
Deutsch und Englisch. Namen unterscheiden sich teils bewusst je Sprache
(*Die Silberne Karavane* / *The Ardent Caravan*).

## Entscheidung
- Die Oberfläche ist englisch; es gibt keine Übersetzungsschicht.
- Kanon-Felder (Warband- und Kriegernamen, Titel) haben eine deutsche und eine
  englische Fassung.
- Texte der Spieler werden in der Sprache gespeichert, in der sie geschrieben
  wurden; die Chronik-Pipeline erzeugt beide Sprachfassungen.
- Konzept- und Betriebsdoku sind deutsch, Code, Bezeichner und `CLAUDE.md`
  englisch; das Glossar verbindet beides.

## Folgen
- Die Schreibweisen für den Chronik-Linter können aus dem Kanon der App
  erzeugt werden.
