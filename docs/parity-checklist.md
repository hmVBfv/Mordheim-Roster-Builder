# Paritäts-Checkliste – alte App ↔ neue App

Rob, 29.09.2026: „Checke allg., ob die Funktionalität mindestens der der
Legacy-Version entspricht.“ Diese Liste ist die Antwort und zugleich die
Checkliste, die Phase 3 verlangt ([roadmap.md](roadmap.md#phase-3--nutzer-warbands-neuer-builder)):
Pages wird erst auf den Quick Build umgestellt, wenn jede Zeile in der Spalte
„neue App“ ein ✓ hat.

## Stand in einem Satz

**Die Logik ist vollständig und geprüft, die Oberfläche wächst.** Jede
Rechnung der alten App steckt in `core/` und kommt dort nachweislich zum
selben Ergebnis (alle Legacy-Tests laufen über den Spiegel auch gegen
`core/`, dazu Zufallswanderungen über alle 49 Warbands und Szenarien für
seltene Zweige). Seit 3a (02.10.2026) legt die neue App Warbands an, wirbt
an, benennt und entlässt, setzt Erfahrung und Anführer; Ausrüstung,
Aufstiege, Verletzungen, Hired Swords und Exporte folgen in 3b–3e. Bis zur
Umstellung bleibt die alte App die, mit der gespielt wird.

## Legende

| Zeichen | Bedeutung |
| --- | --- |
| ✓ | vorhanden |
| ◐ | teilweise (steht in der Anmerkung) |
| – | fehlt noch |
| n/a | gibt es dort nicht und braucht es nicht |

Spalten: **alt** = heutiger Roster Builder, **core** = Logik in `core/` mit
Paritätstest, **App** = neue App heute, **Mockup** = Seite unter
[`docs/mockups/`](mockups/), **Phase** = wann die App es bekommt.

## Warband und Aufstellung

| Funktion | alt | core | App | Mockup | Phase | Anmerkung |
| --- | --- | --- | --- | --- | --- | --- |
| Warband wählen (49, Reihenfolge nach Grad), Stadt/Variante, Name | ✓ | ✓ | ✓ | – | 3a | „New warband“; ohne Mockup, die App selbst ist es (Liste und Auswahl wie gehabt); umbenennen über ✎ |
| Startgold, Budget, Sonderregeln wie Trantio (+20 %) | ✓ | ✓ | ✓ | – | 3a | Startgold schon bei der Auswahl |
| Einheiten anwerben und entlassen, Höchst- und Mindestzahlen | ✓ | ✓ | ✓ | roster (Recruit) | 3a | Liste wie im Builder (Helden, Henchmen, Fahrzeuge), mit Grund, wenn nicht; entlassen über ⋯ mit Undo |
| Anführer bestimmen | ✓ | ✓ | ✓ | – | 3a | ⋯ → „Lead the warband“ bei jedem Helden, der führen darf |
| Henchmen-Gruppen: Größe, Namen der Männer, Nachrekrutieren mit Aufpreis | ✓ | ✓ | ✓ | roster (+ Man mit Veteranenwurf und Grenzen, Namen antippen) | 3a/3c | „+ Man“ mit Preis samt Aufpreis und Grund, wenn nicht; Namen antippen; einen bestimmten Mann entlassen (neu, `dismissMember`). Seit 3c öffnet „+ Man“ das Sheet „More men“: wie viele, Preis, Namen; nach der ersten Schlacht bei einer Gruppe mit Erfahrung der Veteranenwurf der Runde (neu, `setVeteransRoll`, `addMen`) |
| Warnungen zur Legalität (Seitenleiste) | ✓ | ✓ | ✓ | – | 1e | |
| Rating, Worth, Gold, Modelle | ✓ | ✓ | ✓ | roster | 3a | |

## Ausrüstung und Handel

| Funktion | alt | core | App | Mockup | Phase | Anmerkung |
| --- | --- | --- | --- | --- | --- | --- |
| Ausrüstungslisten je Einheit, erster Dolch frei, Waffengrenzen | ✓ | ✓ | ✓ | trading-post | 3b | bis zur ersten Schlacht ⋯ → „Equipment & rare items“ mit Stepper je Gegenstand; Waffengrenzen als Warnung |
| Preise nach Hausregeln und Bezirken (halber Preis) | ✓ | ✓ | ✓ | trading-post | 3b | Liste und Trading Post zeigen den Preis, der gerade gilt |
| Gründungspreise und Trading Post (C2, C3, C7) | ✓ | ✓ | ✓ | trading-post | 3b | Trading Post ab der ersten Schlacht (`/warbands/:id/trade`) |
| Seltenes: Katalog, bezahlter Preis, Material-Upgrades (Gromril, Ithilmar …) | ✓ | ✓ | ◐ | trading-post | 3b | hinzufügen, Anzahl, Waffe eines Upgrades; den bezahlten Preis von Hand ändern fehlt noch |
| Suchwurf je Held mit Modifikatoren, Chance | – | ✓ | ✓ | trading-post | 3b | neu (V5/V6); `searchOdds`, ein Wurf je Held und Stufe |
| Verkaufen zum halben Preis | – | ✓ | ✓ | trading-post | 3b | neu (V6); abrunden, mindestens 1 gc, eine Gruppe zusammen |
| Umverteilen zwischen Kriegern und Lager | – | ✓ | ✓ | trading-post | 3b | neu (V4); `giveItem` mit Grund, wenn nicht |
| Lager (Truhe): Gegenstände, Wyrdstone, Gold | ✓ | ✓ | ◐ | roster, trading-post | 3b | Gegenstände und Gold im Trading Post; Wyrdstone und Gold von Hand fehlen (kommt mit der Post-Battle-Sequenz, 4a) |
| Kassenbuch mit Anlass je Buchung | – | ✓ | ✓ | trading-post | 3b | neu (V7), ab der ersten Schlacht; ohne neue Formatnummer |
| Regeltexte als Tooltip (Gegenstände, Fertigkeiten, Zauber, Fähigkeiten) | ✓ | ✓ | ✓ | trading-post, roster | 3b/3d | Gegenstände: Regeltext im Trading Post. Rob, 02.10.2026: „essentiell und muss drin sein“ – auf jeder Karte öffnet jedes Wort, das eine Regel nennt, eine Blase mit Werten und Regeltext (Antippen; mit Maus auch Darüberfahren): Sonderregeln (neue Zeile „Rules“, in der Fassung der Einheit), Ausrüstung samt Aufwertung, seltene Gegenstände, Fertigkeiten, Zauber, Mutationen, Mal, Verletzungen; bei Hired Swords auch ihre festen Fertigkeiten, wie im Roster Builder (`app/src/roster/tips.ts`, `app/src/ui/Tip.tsx`) |

## Profile und Entwicklung

| Funktion | alt | core | App | Mockup | Phase | Anmerkung |
| --- | --- | --- | --- | --- | --- | --- |
| Profil mit allen Änderungen, Rassenmaxima, Rüstungswurf | ✓ | ✓ | ✓ | roster | 1e | geänderte Werte markiert |
| Erfahrung mit Schwellen (gerahmt, nächste markiert), „Advance due“ | ✓ | ✓ | ✓ | roster | 1e | App: mit Pull Request #4 |
| Erfahrung setzen (Stepper, Sprung auf eine Schwelle) | ✓ | ✓ | ◐ | roster | 3a | Stepper (nicht unter die Starterfahrung, Hired Swords bis 14); Sprung auf eine Schwelle fehlt |
| Aufstiege: Werte, Fertigkeiten (eigene Listen, Sperren wie `noSkills`), Zauber | ✓ | ✓ | ✓ | roster (Advance) | 3c | „Advance“ auf jeder Karte: Wurf nach den Tabellen, Werte bis zum Rassenmaximum, Fertigkeit aus seinen Listen oder ein Zauber stattdessen; Korrektur über ⋯ |
| Mutationen, Male der Marauder, Segnungen | ✓ | ✓ | ✓ | App (Liste, Auswahl) | 3c | ⋯ → „Mutations“ bzw. „Blessings of Nurgle“ (Preis, Regeltext, Summe; auch über die Fertigkeit „Mutant“); Seher ⋯ → „Mark of Chaos…“, Häuptling ⋯ → „Take the Mark“; die Regeln des Mals auf der Karte |
| Beförderung („The lad's got talent“) und Rücknahme | ✓ | ✓ | ◐ | roster (Advance 10–12) | 3c | 10–12 einer Gruppe: wer, zwei Listen; Rücknahme über Undo, eine spätere Rücknahme fehlt noch |
| Schwere Verletzungen (D66) mit Folgeentscheidungen, ausgesetzte Spiele | ✓ | ✓ | ✓ | roster (Injury, V1) | 3c | „Injury“ auf jeder Karte: D66 wie gewürfelt (oder „Roll the dice“), jede Nachfrage der Tabelle, verschachtelt bei Multiple Injuries und verlorenem Grubenkampf; Bezirke und Peg Leg; Henchmen und Hired Swords W6. Neue Logik `core` `injure` (V1), beide Eingänge gleich. Korrektur und ausgesetzte Spiele über ⋯ |
| Tod, Gefallene, Rücknahme, verlorener Wert | ✓ | ✓ | ◐ | roster („Out of action for good“) | 3c | Tod über die Verletzung (auch „Out of action for good…“ im ⋯), Rücknahme über Undo; App listet Gefallene. Eine spätere Rücknahme und feste IDs (V2) folgen |

## Hired Swords und Dramatis Personae

| Funktion | alt | core | App | Mockup | Phase | Anmerkung |
| --- | --- | --- | --- | --- | --- | --- |
| Listen mit Filtern (Grad, Werte, Name), wer anheuern darf und warum nicht | ✓ | ✓ | ✓ | hire | 3d | Bildschirm „Hire“ (Roster → Hire…): Suche nach Name oder Volk, Grade, Kennwert mit Vergleich (wie im Roster Builder), „Only those this warband may hire“, Sortierung; jeder, der nicht darf, mit Grund (neu, `hireProblem`) |
| Anheuern, Kosten, Unterhalt, Personas, Optionen | ✓ | ✓ | ✓ | hire (Sheet) | 3d | Sheet mit Werten (bei Paaren beiden), Ausrüstung, Regeln und Fertigkeiten mit Regeltext, Erfahrung, Hinweis (Wanderer); Waffen oder Persona vor dem Anheuern (neu, `hire`); Gebühr mit halbem Preis durch einen Bezirk, Unterhalt, Rating, Gold danach; nach der ersten Schlacht ins Kassenbuch. Hired Swords zählen nicht zu Kriegern und Helden (Errata S. 147); wer einen Heldenplatz besetzt, braucht einen freien |
| Erfahrung (Henchmen-Schritte), Aufstiege, Fertigkeiten, Zauber | ✓ | ✓ | ✓ | roster (Big Gunnar) | 3c | Hired Swords würfeln auf der Heldentabelle mit ihren Listen |

## Hausregeln

| Funktion | alt | core | App | Mockup | Phase | Anmerkung |
| --- | --- | --- | --- | --- | --- | --- |
| Schalter und Vorgaben, Abweichungen sichtbar, im Export erklärt | ✓ | ✓ | – | house-rules (Warband allein, in einer Kampagne, als Leiter), manage | 3e | Mockup 03.10.2026: alle Hausregeln des Roster Builders in seinen Gruppen, aus = wie geschrieben („Enforce equipment list“ daher umgekehrt als „Equipment beyond the lists“), je Regel was das Regelwerk sagt, Wert nur wenn an, Wirkung auf das Gold einer Gründung, Erklärung für den Export; in einer Kampagne gelten deren Regeln, eine abweichende Datei der Warband wird markiert. „Show rarity“ ist eine Anzeige, keine Regel: Vorschlag, sie unter More zu führen und nicht im Export zu nennen |

## Kampagne

| Funktion | alt | core | App | Mockup | Phase | Anmerkung |
| --- | --- | --- | --- | --- | --- | --- |
| Kampagnenmodus, Stufen („Setup“, „After battle N“), Snapshots, Stufenvergleich | ✓ | ✓ | – | changes | 4a | |
| Chronik: Ereignisse, Notizen | ✓ | ✓ | – | timeline | 4a | |
| Schlachtformular mit Seiten und Verlusten | ✓ | ✓ | – | game-night | 4a | |
| Bezirke, Footholds, Kontrolle, Effekte | ✓ | ✓ | – | – | 4a | |
| Post-Battle-Sequenz: Schritte, Wyrdstone-Verkauf, Erkundungswürfel | ✓ | ✓ | – | trading-post (Schritte 6, 8, 9) | 4a | |
| Nachschlagetabellen nach der Schlacht (Helfer) | ✓ | Daten ✓ | – | roster (Advance, Injury) | 4a | |
| Ausstehende Erfahrung, Schlachtergebnisse anwenden | ✓ | ✓ | – | changes | 4a | |
| Kampagnendatei: mehrere Warbands, Zusammenführen, Statistik | ✓ | ✓ | – | – | 4a | übernimmt dann der Server |
| Auswertung je Krieger, Lebenslauf, Erzähl-Export | ✓ | ✓ | – | timeline, background | 4b | |

## Speichern und Exporte

| Funktion | alt | core | App | Mockup | Phase | Anmerkung |
| --- | --- | --- | --- | --- | --- | --- |
| Speichern und Laden auf dem Gerät, Liste, Löschen | ✓ | ✓ | ✓ | index | 1e | App: Import, Liste, „Remove from this device“ |
| Import: Datei, eingefügte Datei, Text-Export | ✓ | ✓ | ✓ | – | 1e | Kampagnendatei noch nicht |
| Export: Text mit eingebettetem Stand, Datei | ✓ | ✓ | – | – | 3 | |
| Tabletop-Simulator-Karten (Krieger, Männer, Hired Swords, DP) | ✓ | ✓ | – | roster (TTS) | 3 | |
| Offizielles Rostersheet als PDF | ✓ | ✓ | – | – | 3 | |
| Drucken | ✓ | n/a | – | – | 3 | |

## Oberfläche

| Funktion | alt | core | App | Mockup | Phase | Anmerkung |
| --- | --- | --- | --- | --- | --- | --- |
| Am Handy bedienbar (360 px, 44-px-Tippflächen) | ◐ | n/a | ✓ | ✓ | 1e | alt: seit dem Umbau der Reihenfolge brauchbar |
| Zwei Themes | – | n/a | ✓ | ✓ | 1e | |
| Offline | ◐ | n/a | ✓ | n/a | 1e | alt: als heruntergeladene Datei |
| Jeder Knopf reagiert | ✓ | n/a | ✓ | ✓ | – | Mockups: Playwright klickt jede Bedienung (`app/e2e/mockups.spec.ts`) |

## Was daraus folgt

1. **Mockups, die noch fehlen**, bevor Phase 3 baut: Warband anlegen,
   Hired Swords und Dramatis Personae anheuern, Hausregeln einer Warband
   ohne Kampagne, Mutationen und Male, Exporte (PDF, Text, TTS für die ganze
   Warband). Die Wege zwischen den Bildschirmen (Leiste unten, Reiter) sind
   seit dem 29.09.2026 vollständig.
2. **Neue Logik** (in keiner der beiden Apps): Suchwurf, Verkaufen,
   Umverteilen, Kassenbuch (V4–V7) – kommt nach `core/` mit eigenen Tests,
   bevor der Builder sie braucht.
3. **Bis zur Umstellung** wird mit der alten App gespielt; sie bleibt live
   und bekommt nur noch Fehlerbehebungen und die entschiedenen Regeländerungen.
