# Gesamtkonzept

Stand: 27. September 2026 · Status: abgestimmt, Grundlage für Phase 1

## 1. Worum es geht

Der Roster Builder ist heute ein Werkzeug für eine einzelne Person: Warband
bauen, Kampagne führen, exportieren. Die Kampagne selbst lebt verstreut in den
Dateien jeder Warband, in einer herumgereichten Kampagnendatei und in Notizen
für die Chronik.

Ziel ist ein **gemeinsamer Kampagnenbegleiter** auf dem Raspberry Pi, der

1. Warbands und ihre Entwicklung über die ganze Kampagne verwaltet,
2. jede Veränderung automatisch und nachvollziehbar festhält,
3. **so viel Erzählmaterial wie möglich sammelt** – von allen Spielern, während
   und nach dem Spiel – und
4. daraus das Material für das zweisprachige Kampagnenepos bereitstellt, das mit
   Claude geschrieben wird.

Die Oberfläche wird dafür neu gebaut, handyfreundlich und als installierbare
Web-App (PWA). Die geprüften Regeldaten und die bestehende Logik bleiben.

## 2. Leitprinzipien

1. **Mechanik offen, Erzählung darf verborgen sein.** Werte, Würfe, Roster,
   Gold und Ruf sind für alle Mitglieder einer Kampagne sichtbar und
   nachvollziehbar. Verborgen sein dürfen nur erzählerische Inhalte: der
   Hintergrund des Kampagnenleiters und versiegelte Notizen bis zu ihrer
   Öffnung. Das folgt aus eurer Tischregel: Der Kampagnenleiter spielt selbst
   mit, also darf kein System von seinem Ermessen abhängen.
2. **Nichts wird überschrieben.** Speichern erzeugt eine neue Version;
   Korrekturen sind neue Einträge mit Autor und Zeit. Geschichte wird nie neu
   berechnet: Kennzahlen werden so eingefroren, wie sie zum Zeitpunkt galten.
3. **Der Spielabend hängt nie am Server.** Die App funktioniert ohne Netz und
   synchronisiert später.
4. **Der Client rechnet, der Server verwahrt.** Regelberechnungen laufen im
   Browser; der Pi prüft, speichert, sichert. Das schont den Pi und hält die
   App flüssig.
5. **Regeln streng, Hausregeln ausdrücklich.** Die Quellenhierarchie gilt
   unverändert (siehe `CLAUDE.md`); Hausregeln sind Schalter, gelten pro
   Kampagne und werden überall sichtbar ausgewiesen.
6. **Leicht und prüfbar.** Leistungsgrenzen, Sichtbarkeitsregeln und
   Doku-Vollständigkeit werden von der CI geprüft, nicht nur beabsichtigt.

## 3. Rollen

| Rolle | Ebene | Darf |
| --- | --- | --- |
| **Admin** | Server | Nutzer einladen und sperren, Passwort-Resets ausstellen, Bug-Tracker verwalten, Backups einsehen. Hat keinen Sonderzugriff auf Kampagneninhalte in der App. |
| **Kampagnenleiter** (1 oder mehr) | Kampagne | Mitglieder und Warbands verwalten, Runden weiterschalten, Schlachten anlegen und das Schlachtprotokoll führen, Hausregeln und Stilvorgaben festlegen, Zeitleiste ordnen, fremde Notizen bearbeiten oder bündeln, Markierungen korrigieren, Hintergrund führen, Fragen an Spieler stellen, Briefing und KI-Paket erzeugen. |
| **Spieler** | Kampagne | Eigene Warbands verwalten und eintragen, Notizen schreiben (auch versiegelt), Erzählung der eigenen Warband schreiben, Korrekturen vorschlagen, Fragen beantworten, alles Öffentliche der Kampagne lesen. |
| **Zuschauer** | Kampagne | Öffentliches lesen. |

Regeln, die für alle Rollen gelten:

- Jede Änderung an Daten anderer erscheint im Log mit Namen des Handelnden.
- Die eigene Warband des Leiters ist eine gewöhnliche Spieler-Warband.
- Versiegelte Notizen sind **auch für Leiter und Admin** in der App gesperrt,
  bis sie sich öffnen. (Grenze: Wer Zugriff auf die Datenbank hat, könnte sie
  technisch lesen. Das ist dokumentiert und ein Vertrauensmechanismus, keine
  Kryptografie.)
- Zweiter Faktor (Authenticator-App, TOTP) ist für Admin und Leiter Pflicht.

## 4. Bausteine

### 4.1 Warbands und Versionen

- Eine Warband gehört einem Nutzer und höchstens einer Kampagne. Warbands ohne
  Kampagne sind „frei“ (Einzelspiele, Entwürfe). Für eine neue Kampagne startet
  man mit einer Kopie.
- **Jedes Speichern erzeugt eine neue Version** (`rev`). Beim Speichern schickt
  das Gerät die Version mit, auf der es aufbaut; hat inzwischen ein anderes
  Gerät gespeichert, lehnt der Server ab und die App bietet „neueren Stand
  laden“ oder „als Kopie speichern“ an.
- Automatisches Speichern geht in einen **Autosave-Platz** pro Nutzer und
  Warband, damit nichts verloren geht, wenn das Handy den Tab schließt. Eine
  Version entsteht nur beim bewussten Speichern, beim Import und beim
  Abschließen einer Schlacht.
- Jede Version speichert Formatnummer und App-Version, die sie erzeugt hat.

### 4.2 Markierte Stände

Bestimmte Versionen tragen eine **Markierung**:

| Markierung | Entsteht |
| --- | --- |
| `start` | beim Eintragen in die Kampagne |
| `after_battle` | beim Abschluss der Post-Battle-Sequenz für eine Schlacht („nach Schlacht X“) |
| `sat_out` | wenn eine Warband eine Runde aussetzt |

Kennzahlen (Rating, Worth, Gold, Modellzahl) werden beim Markieren
eingefroren. Muss nachträglich korrigiert werden, wandert die Markierung auf
eine neue Version; die alte bleibt sichtbar mit „korrigiert von … am …“.

Die heutigen Rundensnapshots (`S.campaign.snapshots`) gehen in diesen
Markierungen auf.

### 4.3 Änderungserfassung und Abgleich

Zwischen zwei markierten Ständen einer Warband wird automatisch erfasst, was
sich geändert hat:

- **Vergleich (Diff):** was sich geändert hat – vollständig, egal auf welchem
  Weg. Krieger werden über ihre feste `uid` zugeordnet. Erfasst werden
  Neuzugänge, Gefallene, Verletzungen, Werte, Fertigkeiten, Zauber,
  Beförderungen, Ausrüstung und Rare Items, Gruppengrößen, Hired Swords und
  Dramatis Personae, Gold, Rating, Worth, Bezirke, Umbenennungen und
  Hausregeln.
- **Ereignisse:** warum es sich geändert hat – das Log der Aktionen in der App
  (Verletzungswurf, Aufstieg, Kauf) und das Schlachtprotokoll.
- **Abgleich:** Jede Änderung wird ihrem Anlass zugeordnet. Was keinen Anlass
  hat (z. B. ein Wert steigt ohne Aufstiegswurf), wird **für alle sichtbar
  markiert**, blockiert aber nichts.

Der Vergleich ist reine Logik in `core/` und läuft zweimal: im Browser als
Vorschau („Das ändert sich – stimmt das?“) und auf dem Server verbindlich beim
Markieren. Das Ergebnis wird als strukturierte Datensätze eingefroren.

### 4.4 Kampagne

- Kampagnenansicht mit den Bereichen **Übersicht**, **Notizen**,
  **Zeitleiste**, **Welt**, und für Leiter **Hintergrund** und **Verwaltung**.
- Die Übersicht zeigt je Warband: Spieler, Rating, Worth, Bezirke und Status
  („nach Schlacht 5 ✓“, „Post-Battle offen“, „2 Erklärungen fehlen“).
- Hausregeln und Stilvorgaben gelten pro Kampagne. Weicht eine Warband von den
  Hausregeln der Kampagne ab, wird das markiert.
- Die Kampagnendatei (`mordheim-campaign-file`) bleibt als Export/Import für
  Abende ohne Server.

### 4.5 Schlachten und Spielabend

- **Schlachtprotokoll:** verbindliche Aufzeichnung einer Schlacht –
  Teilnehmer, Spielzug, wer wen aus dem Gefecht nimmt, Ergebnis. **Einziger
  Schreiber ist der Kampagnenleiter**, damit nichts doppelt erfasst wird.
  Spieler sehen es live und schicken bei Fehlern einen
  **Korrekturvorschlag**, den der Leiter übernimmt oder ablehnt.
- **Notizen schreiben alle gleichzeitig** (siehe 4.6). Jede Notiz ist ein
  eigener Eintrag mit genau einem Autor; niemand bearbeitet den Text eines
  anderen, also entstehen keine Konflikte. Notizen lassen sich an einen
  Protokolleintrag hängen.
- **Spielabend-Modus:** Vollbild fürs Handy, einhändig bedienbar, große Knöpfe:
  + Verlust, + Notiz, + Zitat, + Screenshot, Spielzug-Zähler.
- **Ohne Netz:** Jeder Eintrag bekommt auf dem Gerät eine eindeutige ID
  (UUID) und wartet in einer lokalen Warteschlange, bis der Server erreichbar
  ist. Doppeltes Senden erzeugt keine Duplikate.
- **Post-Battle:** Die Würfe darf der Leiter für alle eintragen; jede Änderung
  an einer fremden Warband steht mit seinem Namen im Log. Die geführte
  Post-Battle-Sequenz (10 Schritte, verlinkt auf Mordheimer) bleibt erhalten.
  Ihr letzter Schritt zeigt die Änderungsvorschau und setzt die Markierung
  `after_battle`.
- **Abschluss einer Schlacht:** Markierungen setzen, Änderungen einfrieren,
  versiegelte Notizen öffnen, Sofort-Backup auslösen.

### 4.6 Erzählmaterial

Drei Ebenen, nach dem Grundsatz: **Was einem Spieler gehört, liegt in seinem
Speicherstand; was alle schreiben, gehört der Kampagne.**

**Notizen (Kampagne, alle schreiben):**

- Hängen standardmäßig an der letzten Schlacht, sonst an einer anderen Schlacht
  oder an der Kampagne allgemein.
- Optionale Art: *Szene*, *Zitat*, *Würfelmoment*, *offener Faden*
  (`hook`) oder allgemein.
- Krieger werden aus der Liste erwähnt, nicht frei getippt – dann stimmt die
  Schreibweise und die Notiz erscheint im Lebenslauf des Kriegers.
- Screenshots (z. B. aus TTS) können an Notizen oder Schlachten hängen; sie
  dienen auch als Vorlage für Kapitelbilder.
- **Versiegelt:** Ein Spieler kann vor einer Schlacht eine Notiz versiegeln
  (z. B. seine Absicht). Sie ist für niemanden lesbar und öffnet sich
  automatisch, wenn die Schlacht abgeschlossen wird. In der Zeitleiste steht
  sie dann als „Absicht vorher“ neben dem Ausgang.
- Bearbeiten ist möglich; die alte Fassung bleibt erhalten.

**Erzählung der Warband (Spieler, im Speicherstand):**

- **Prolog** vor der Kampagne, mit Leitfragen (Woher? Was sucht ihr in
  Mordheim? Wer führt, warum folgen die anderen? Was fürchtet ihr?).
- **Zwischenspiel** zwischen den Schlachten: was die Warband getan hat
  (Handel, Genesung, Anwerben, Streit).
- **Erklärung je Änderung:** Zu jedem Eintrag der Änderungsliste ein
  optionales Textfeld („Sir Honnung +1 WS – was ist passiert?“). Nicht
  Pflicht; das Briefing zählt fehlende Erklärungen.

**Profil je Krieger (Spieler, im Speicherstand):**

- Name und Titel **auf Deutsch und Englisch** (die Fassungen unterscheiden
  sich teils bewusst), Sprechweise, Herkunft, ein paar Sätze zur Figur.
- Das Profil ist die Quelle für den Kanon: Schreibweisen werden einmal
  festgelegt und überall übernommen.

**Lebenslauf je Krieger (abgeleitet):** Profil, alle Änderungen mit
Erklärungen, alle Notizen, in denen er erwähnt wird, und seine Einträge im
Schlachtprotokoll – in zeitlicher Reihenfolge.

**Fragen des Leiters:** Der Leiter kann einzelnen Spielern gezielte Fragen
stellen („Wie hat Robba die Nacht nach der Schlacht verbracht?“). Die Antwort
wird zur Notiz. Vorschläge für Fragen kann Claude aus dem Briefing liefern.

**Aufgaben:** Jeder Spieler sieht „Offen für dich“ (Post-Battle, fehlende
Erklärungen, Zwischenspiel, Fragen). Die Kampagnenübersicht zeigt den Stand
aller.

### 4.7 Zeitleiste

- Zeigt pro Abschnitt: Schlachtbericht, Protokoll, Notizen, Änderungen je
  Warband mit Erklärungen, Zwischenspiele.
- **Gerüst aus festen Ankern:** „Vor der Kampagne“, je Schlacht „vorher“,
  „Verlauf“, „Aftermath“, dann „Zwischenspiel N“. Schlachten und markierte
  Stände sind fest; alles andere lässt sich dazwischen einordnen.
- **Zwei Zeiten je Baustein:** *Erfassungszeit* (unveränderlich, Prüfspur) und
  *Erzählzeit* (Position in der Geschichte). **Verschieben** ändert nur die
  Erzählzeit.
- Innerhalb einer Schlacht sortiert ein optionaler *Spielzug* grob vor.
- Verschieben: langes Drücken und Ziehen, dazu ↑/↓ und „Verschieben nach …“.
  Jeder verschiebt seine Bausteine, der Leiter alle; jedes Verschieben wird
  geloggt.
- Leiter sehen eine zweite Ebene mit verborgenen Bausteinen (deutlich
  markiert); Spieler sehen nur die öffentliche.

### 4.8 Hintergrund (verborgen, nur Leiter)

Der Bereich für die erzählerische Führung. Er heißt bewusst nicht „Roter
Faden“, weil `notes/roter-faden.md` im Chronik-Repo eine *öffentliche*
Zusammenfassung ist.

- **Handlungsstränge:** Wahrheit · was die Spieler wissen · Status (geplant /
  aktiv / aufgelöst) · Bezüge (Schlachten, Krieger, Notizen) ·
  **Enthüllungsstufe**.
- **Enthüllungsstufen:** `hidden` (nichts), `hint` (Andeutungen erlaubt, mit
  Grenzen in Worten, z. B. „Spuren ja, Name nie“), `revealed` (ab Schlacht X
  öffentlich).
- **Weitere Einträge:** Figuren (Wahrheit und Ruf in der Stadt), Orte,
  geplante Szenarien, GM-Notizen je Schlacht (Vorbereitung, Anpassungen
  während der Partie, was hinter den Kulissen geschah).
- **Enthüllen** macht einen Eintrag oder Teil davon zur öffentlichen Notiz in
  der Zeitleiste; das Enthüllen wird geloggt.
- Der Server liefert diese Daten nie an Spieler aus; sie stehen in keinem
  Spieler-Export und in keinem Repo.

### 4.9 Kampagnenwelt

- **Fraktionen und NPCs** mit öffentlichem Status (lebt, tot, führt jetzt …),
  Namen auf Deutsch und Englisch.
- **Ruf** je Warband und Fraktion, als Ereignisse mit Grund und Schlacht
  (daraus ergibt sich der aktuelle Wert).
- **Bezirke:** wer hält was, seit wann.
- **Szenarien:** eigene Szenarien mit Regeln und NPC-Werten im TTS-Format;
  verborgen, bis sie gespielt sind.

Ruf und Bezirke sind Mechanik und damit öffentlich; die Wahrheit über NPCs
gehört in den Hintergrund.

### 4.10 KI als Schreibwerkzeug (ohne API)

Die App ruft keine KI-API auf. Claude schreibt wie bisher, bekommt das Material
aber vollständig und geordnet:

- **Briefing je Schlacht** (Markdown): Teilnehmer, Ergebnis, Screenshots;
  Verlauf aus Protokoll und Notizen, Zitate getrennt; Aftermath je Warband
  (Tod, Verletzung + Erklärung); Aufstiege je Warband mit Erklärung **und dem,
  was der Krieger in genau dieser Schlacht getan hat**; Zwischenspiele;
  offene Fäden; Kanon (Namen, Titel, Sprechweisen, DE/EN).
- **KI-Paket** (nur Leiter): Briefing + Stilvorgaben + Kanon + Hintergrund mit
  Enthüllungsregeln + Zusammenfassung der bisherigen Kapitel. Die
  Enthüllungsstufen stehen als harte Regeln darin.
- **Anbindung an die Chronik-Pipeline:** Der Server legt das KI-Paket in
  `/mnt/ssd/agent/eingang/chronik/` ab; `chronik N` holt es dort ab. Die
  Pipeline schreibt den Hintergrund nie in `notes/` des öffentlichen
  Chronik-Repos.
- **Kanon-Export:** Die Schreibweisen für den Chronik-Linter
  (`notes/agent/spielbegriffe.txt` o. ä.) können aus dem Kanon der App erzeugt
  werden – eine Quelle für richtige Namen.
- **Von Hand, ohne Pipeline (Rob, 02.10.2026):** In der Timeline baut
  „AI pack…“ denselben Inhalt als einen Prompt – die Schlacht in der
  Reihenfolge der Timeline, Aftermath und Aufstiege, Kanon, Welt, Notizen,
  Hintergrund mit Enthüllungsregeln, die bisherige Geschichte, Stil; Teile
  lassen sich abwählen, die Sprache wählen; kopieren oder als .md laden und
  in einem Chat an Claude geben.
- **Chronicle:** Ein eigener Reiter der Kampagne zeigt die ganze
  geschriebene Geschichte, Kapitel für Kapitel. Ein Kapitel kommt als Text
  zurück (eingefügt oder als .md/.txt), einer Schlacht oder einem
  Zwischenspiel zugeordnet, mit Sprache; alle Kapitel lassen sich als eine
  .md herunterladen.
- Jeder KI-Text ist ein Entwurf; der Leiter prüft vor der Veröffentlichung.
  Eine einfache Prüfung markiert Begriffe aus verborgenen Wahrheiten im
  Entwurf (und zeigt, welche Andeutungen der Hintergrund erlaubt).
- **Später:** ein Connector (MCP), über den Claude Briefings direkt liest und
  Entwürfe zurücklegt; Claude Code committet freigegebene Kapitel ins
  Chronik-Repo.

### 4.11 Quick Build (Pages) und Austausch

- Die Pages-Version bleibt als **Quick Build**: ohne Login, ohne Server,
  Speichern im Browser und als Datei. Zum schnellen Zusammenstellen einer
  Warband und zum Durchplanen.
- Sie ist **derselbe App-Build** ohne Serverfunktionen – kein zweiter
  Code-Stand.
- **Pages → Server:** Knopf „An Kampagnenserver senden“ öffnet
  `https://<host>/import#<komprimierte Daten>`. Die Daten stehen nur im
  Fragment nach `#`, werden also nie an einen Server übertragen und brauchen
  keine CORS-Freigabe. Die Server-App zeigt eine Vorschau; der Nutzer wählt
  „neue Warband“, „neue Version von …“ oder „einer Kampagne zuordnen“.
- **Rückfallebene:** Datei-Export und Text-Export mit `MORDHEIM-DATA`.
- **Server → Pages:** „Kopie zum Planen“ – offline durchrechnen, ohne den
  Kampagnenstand anzufassen.
- Ein Import ist eine normale neue Version mit Quelle „Import“; Vergleich und
  Abgleich greifen. Über den Import lässt sich nichts unbemerkt einschleusen.
- Die Serveradresse ist in der Pages-Version eine Einstellung.

### 4.12 Bug-Tracker

- „Problem melden“ überall in der App. Arten: **Bug**, **Wunsch**,
  **Regelfehler** (mit Quellenangabe: Mordheimer-Link, FAQ-Seite).
- Automatisch angehängt: App-Version, Gerät, Ansicht, letzte JS-Fehler; mit
  Zustimmung die betroffene Warband-Version (macht den Fehler exakt
  nachstellbar). Verborgene Daten werden nie angehängt.
- **Einfach melden, auch mit „funktioniert nicht“** (Rob, 09.10.2026): Wer
  meldet, schreibt meist nur das. Deshalb trägt jede Meldung ohne Zutun den
  Zusammenhang mit – der Bildschirm und Reiter, auf dem gemeldet wurde (mit
  offenem Bereich von unten), die letzten Schritte davor (Bildschirme und
  Aktionen, ohne eingegebene Texte), die Einstellungen (Theme, Layout,
  Flavour, Online- und Sync-Stand, Rolle in der Kampagne), die Hausregeln der
  Warband und der Kampagne. Das Formular fragt freundlich nach („Was wolltest
  du tun? Was ist stattdessen passiert?“), verlangt aber nichts außer einem
  Satz; ein Knopf „Problem melden“ ist überall mit einem Tipp erreichbar.
  Was mitgeht, steht vor dem Senden lesbar da.
- Status: neu → bestätigt → in Arbeit → behoben in Version X → geschlossen.
  Der Meldende sieht den Stand.
- **Bearbeitung nur auf Zuruf:** Claude Code mit `/bugs` (siehe
  [roadmap.md](roadmap.md), Phase 4c). Einordnung nach festen Schweregraden
  (S1–S4, siehe [security.md](security.md)); Regelfehler entscheidet Rob;
  gemergt wird von Rob; S1-Korrekturen prüft ein unabhängiger Prüf-Agent.

## 5. Kernabläufe

1. **Einstieg:** Einladungslink → Konto anlegen (Leiter/Admin: Authenticator
   einrichten) → Warband anlegen oder importieren → Kampagne beitreten →
   Leiter bestätigt.
2. **Spielabend:** Leiter legt Schlacht an und führt das Protokoll; Spieler
   schreiben Notizen, Zitate, Screenshots; alles funktioniert offline.
3. **Nachbereitung Spieler:** Post-Battle-Sequenz → Änderungsvorschau →
   Markierung „nach Schlacht X“ → Erklärungen und Zwischenspiel schreiben.
4. **Nachbereitung Leiter:** Protokoll abschließen → Zeitleiste ordnen,
   Notizen bündeln → Fragen an Spieler → Briefing prüfen → KI-Paket nach
   `eingang/chronik/` → `chronik N`.
5. **Quick Build → Kampagne:** Warband auf Pages bauen → „An Kampagnenserver
   senden“ → Vorschau → übernehmen.
6. **Problem melden:** Formular → Kontext wird angehängt → Status verfolgen.

## 6. Abgrenzung

- Keine KI-API-Aufrufe aus der App.
- Keine öffentliche Registrierung, kein E-Mail-Versand.
- Keine Echtzeit-Zusammenarbeit an einem gemeinsamen Text.
- Keine zweite Serverinstanz, keine Hochverfügbarkeit (siehe
  [operations.md](operations.md)).
- Keine Übersetzung der Oberfläche: Das Tool ist englisch; zweisprachig sind
  Kanon und Epos.

Offene Entscheidungen stehen in [roadmap.md](roadmap.md#offene-entscheidungen).
