# 0023 – Die Library: Ideen und Vorlagen beim Konto, nicht in der Kampagne

Status: vorgeschlagen (Ort, Kopie und Privatheit von Rob entschieden, 21.10.2026) · Datum: 2026-10-21 · ergänzt [0002](0002-mechanics-open-narrative-hidden.md), [0005](0005-react-pwa-client-computes.md), [0011](0011-hidden-data-never-leaves.md), [0022](0022-hidden-npc-values-in-scenarios.md)

## Kontext
Fraktionen und NPCs der World, Gruppen von Gegnern und Szenarien liegen heute
in Tabellen einer Kampagne (`factions`, `npcs`, `opponent_groups`,
`scenarios`); lesen und schreiben darf, wer in der Kampagne die Rolle hat. Rob
will sie **ohne eine Kampagne** schreiben und aufbewahren, später in neue und
laufende Kampagnen laden und zwischen Kampagnen nutzen (Meldungen 8, 13), eine
Figur einer Warband einer bereits erdachten Fraktion zuordnen (17), Ideen als
Merkhilfen festhalten, aus denen später Fraktionen, Kampagnen oder Warbands
werden (16), und vorgefertigte Fraktionen aus der Lore haben (18). Auch die
Gruppen für die eigenen Warbands (10) sind etwas, das einem Konto gehört und
keiner Kampagne.

## Entscheidung
1. **Die Library ist ein privater Speicher je Konto auf dem Server.** Eine
   Tabelle `library_items` (`id` vom Gerät, `owner_id`, `kind`, `name`,
   `body` als JSON, `created_at`, `updated_at`, `deleted_at`, `seq`). `kind`:
   `idea` · `faction` · `npc` · `group` · `scenario`. Der Server speichert
   und prüft die Form; der Client rechnet (ADR 0005). Ein Eintrag, den ein
   Gerät zweimal sendet, ist einer; was herausgenommen wird, bleibt als
   Grabstein, damit ein Gerät mit älterem Stand davon erfährt. Eine Änderung
   nennt den Stand, von dem aus sie gemacht wurde (`baseSeq`), sonst 409
   `stale`.
2. **Nur der Besitzer liest und schreibt** (`library.read`, `library.write`) –
   kein anderer Spieler, kein Leiter, auch der Admin nicht. Die Library steht
   in der Leck-Matrix (ADR 0011). Es wird in dieser Runde nichts geteilt.
3. **Der Ort links heißt „Library“** und hat die Reiter Ideas · Factions ·
   NPCs · Groups · Scenarios (später Lore). Ideas ist der erste.
4. **Immer eine Kopie.** „Add to a campaign“ (ein Leiter mit Authenticator,
   in der Kampagne) legt eine eigene Fassung in World, Gegnern oder Szenarien
   der Kampagne an, die sich danach unabhängig ändert; „Save to library“ aus
   der Kampagne legt eine Kopie in der Library ab. Keine Verknüpfung. Für die
   Kopie gelten die Regeln der Kampagne (ADR 0002: Mechanik offen,
   Erzählung verborgen; ADR 0022: verborgene Teile eines Szenarios). Was in
   der Library verborgen ist, sieht dort nur der Besitzer.
5. **Eine Figur einer Warband und ihre Fraktion (17)** speichert die Fraktion
   als `faction: { id, name }` im Profil der Figur: die ID einer Library-
   Fraktion und ihren Namen als Abschrift, damit die Figur auch bei jedem
   lesbar ist, der die Library nicht hat (Warbands werden geteilt). Der Name
   einer Fraktion ist kein Geheimnis; ihr Inhalt reist nicht mit.
6. **Gruppen für Warbands (10)** liegen ebenfalls beim Konto (eigene Tabelle,
   Zuordnung je Warband) und erscheinen in der Liste der Warbands, nicht in
   der Library.
7. **Lore (18)** ist ein geprüfter, nur lesbarer Katalog in `data/` aus
   mordheimer.net – jeder Eintrag mit Quelle, nur Regionen, Gruppen und
   Fraktionen, zu denen die Seite mehr als einen Nebensatz sagt. Im Reiter
   Lore der Library wird ein Eintrag mit „Add to library“ kopiert. Einträge in
   `data/` ändern sich nur mit Robs OK und Beleg.
8. **Reihenfolge:** Library mit Ideas (16), Factions (13) mit der Zuordnung
   (17), NPCs (8), Groups und Scenarios (13), Gruppen für Warbands (10), Lore
   (18). Jede Scheibe ist ein eigener Pull Request, die späteren bauen auf
   der ersten auf.

## Folgen
- Neue Migration, Endpunkte `GET/PUT/DELETE /library/…`, Policy-Aktionen und
  Einträge in der Leck-Matrix; `docs/data-model.md` bekommt die Tabelle.
- Wie die Daten der Kampagne nur mit Verbindung (Lesen aus dem Gerätespeicher):
  was die Library zuletzt gezeigt hat, bleibt offline sichtbar, Schreiben
  braucht die Verbindung.
- Ein Konto, das sich löscht oder gelöscht wird, nimmt seine Library mit.
- Grenzen je Konto: höchstens 500 Einträge, 20 KB Text je Eintrag – wie bei
  den Notizen und Hintergrundeinträgen einer Kampagne.
- Eine Fraktion oder ein NPC, den ein Leiter in die Kampagne lädt, ist eine
  Kopie: wer ihn später in der Library ändert, ändert die Kampagne nicht.

## Verworfen
- **Nur auf dem Gerät:** einfach, aber auf dem anderen Gerät und nach einem
  Gerätewechsel weg; Ideen und Entwürfe sind genau das, was man nicht
  verlieren will.
- **In der Warband-Datei:** reist mit Export und Teilen mit und würde Namen
  und Inhalte weitergeben, die der Besitzer für sich behalten will.
- **Verknüpfung statt Kopie:** Änderungen liefen unbemerkt in eine laufende
  Kampagne, und Verborgenes (ADR 0022) müsste mitgeführt werden.
- **Teilen von Anfang an:** viel Umfang (Annahme, Widerruf, Sichtbarkeit) für
  etwas, das später nachgerüstet werden kann.
