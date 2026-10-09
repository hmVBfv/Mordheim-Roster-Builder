# Datenmodell

Stand: 27. September 2026 · Status: Entwurf für Phase 3/4, wird mit dem Code
fortgeschrieben. Bezeichner sind englisch, Erklärungen deutsch.

## 1. Grundsätze

- **IDs:** UUIDs (Text). Was offline entstehen kann (Notizen,
  Protokolleinträge, Autosaves, Uploads), bekommt seine UUID auf dem Gerät;
  der Server nutzt sie als Idempotenzschlüssel.
- **`seq`:** Jede Schreibaktion bekommt eine global fortlaufende Nummer. Sie
  treibt die Synchronisation (`GET /sync?cursor=`).
- **Zeit:** ISO 8601 in UTC. `created_at` ist die Erfassungszeit und wird nie
  geändert.
- **Nichts wird überschrieben:** Warband-Stände sind Versionen; Notizen und
  Hintergrund haben Revisionen; Löschen ist ein Grabstein (`deleted_at`), kein
  physisches Löschen. Endgültig löschen kann nur der Admin (z. B. auf Wunsch
  eines Mitspielers), und das wird geloggt.
- **JSON-Spalten** werden beim Schreiben mit den Zod-Schemas aus
  `core/format` geprüft.
- **Sichtbarkeit** (`visibility`): `public` · `sealed` · `leader`. Wird
  ausschließlich auf dem Server ausgewertet. Siehe
  [security.md](security.md#sichtbarkeit).

## 2. Speicherformat einer Warband

Das JSON, das die App heute exportiert (`exportState()`), bleibt die Grundlage
und ist zugleich der Inhalt einer Version. Erweiterungen:

| Feld | Neu | Bedeutung |
| --- | --- | --- |
| `format` | ja | Formatnummer: fehlt = 0 (alte App), 1 = `core/` bis 02.10.2026, 2 = Gefallene mit fester `id` und `fallenRef` (V2, Stand jetzt); `core/format` migriert ältere Stände beim Laden (`normalizeState`) |
| `appVersion` | ja | App-Version (Commit), die den Stand erzeugt hat |
| `canon` | ja | `{ name_de, name_en }` der Warband (z. B. *Die Silberne Karavane* / *The Ardent Caravan*) |
| `uidSeq` | ja | nächste freie Krieger-`uid`; verhindert, dass eine `uid` nach Entfernen oder Tod wiederverwendet wird. Fehlt er oder läge er nicht hinter jeder vergebenen `uid` (Gefallene eingeschlossen), setzt `normalizeState` ihn hinter die höchste |
| `campaign.logSeq` | ja | zuletzt vergebene ID der Chronik; Log, Schlachten, Verluste und Erfahrungseinträge teilen sich diese Folge |
| `story` | ja | `{ prologue, interludes: { [round]: text }, explain: { [changeKey]: text } }` |
| `models[].profile` | ja | `{ name_de, name_en, title_de, title_en, voice, origin, text }` |
| `ledger` | ja | Kassenbuch (V7), ab der ersten Schlacht der Warband: `[{ id, kind: 'open'\|'roster'\|'buy'\|'sell'\|'search'\|'adjust', amount, text, round, uid, item, qty, found }]`. Gold in der Hand = Summe der `amount`. `stash.gold` wird so nachgeführt, dass die Formel der alten App (Schatz − Wert) dasselbe ergibt; die alte App verwirft das Kassenbuch beim Laden und zeigt trotzdem das richtige Gold. Fehlt es, gilt die Rechnung der alten App |
| `stash.items[]`: `key`, `rare`, `paid` | ja | was der Gegenstand ist (deutscher Listenname oder Katalogschlüssel), ob selten, Preis je Stück; Einträge ohne `key` (alte App, freier Text) bleiben, lassen sich aber keinem Krieger geben |
| `wb`, `subtype`, `name`, `budget`, `models`, `stash`, `fallen`, `hired`, `dp`, `mark`, `house`, `leaderUid`, `goldNow` | nein | wie heute |
| `models[]`: `uid`, `uid_def`, `name`, `names`, `qty`, `exp`, `adv`, `skills`, `spells`, `inj`, `eq`, `rare`, `mut`, `promoted`, `promoCats`, `xpPaid`, `heirloom`, `caster`, `lore`, `magic`, `miss`, `missWhy` | nein | wie heute |
| `campaign` | geändert | siehe unten |

- Schlüssel mit `_` am Anfang sind Bedienzustand und werden vor dem Speichern
  entfernt (bestehende Konvention `_stripTransient`).
- **Regeln für Formatänderungen** (wie `test/compat.mjs`): nur Schlüssel
  hinzufügen, nie umbenennen oder entfernen; jeder neue Schlüssel bekommt
  einen Vorgabewert in `core/src/format/save.ts` und steht im Schema
  (`core/src/format/schema.ts`). Die Formatnummer steigt nur mit einer
  Migration. Die alte App verwirft beim Laden unbekannte Schlüssel oben im
  Stand (`uidSeq`, `canon`, `story`, `ledger`); `core/` behält sie.
- **Gefallene** (`fallen[]`, in der Reihenfolge ihres Todes):
  `{ id, kind: 'hero'|'hench', m, uid_def, exp, memberIdx, memberName,
  lostValue, casualtyId, casFromDeath }`. `id` (ab Format 2, V2) kommt aus
  derselben Folge wie Chronik, Schlachten, Verluste und Erfahrung; Einträge
  ohne `id` (alte App) bekommen beim Laden eine, in ihrer Reihenfolge. `m` ist der Krieger, wie er fiel (bei
  Henchmen genau ein Mann der Gruppe, mit der `uid` der Gruppe);
  `lostValue` ist das Gold, das dafür aus der Kasse ging und bei Rücknahme
  zurückkommt.
- **Verluste** (`campaign.casualties[]`): `{ id, round, battleId, victim,
  attacker, result: 'pending'|'recovered'|'injured'|'dead', detail,
  fallenId, note, code, applied, xpId, injury }`; `victim`/`attacker` =
  `{ uid, name, wb, grade, value, memberIdx, uid_def }`, `uid` nur bei
  eigenen Kriegern. `fallenId` ist ein Index in `fallen` – das liest die
  alte App; `fallenRef` (ab Format 2, V2) verweist über die `id` und hält
  auch, wenn ein früherer Gefallener gelöscht wird. `core/` hält `fallenId`
  mit `fallenRef` im Gleichschritt und repariert beim Laden, was die alte
  App an Positionen verschoben hat. `injury` (neu,
  V1, optional) hält den Wurf, mit dem `injure` den Eintrag abschloss,
  samt Folgeentscheidungen: `{ hero: { code, saved?, d6?, games?, hates?,
  captured?, pit?, more? } }` oder `{ d6, member? }`; die alte App liest
  darüber hinweg.
- **Angeworben in Runde** (`models[].joined`, neu, optional): die
  Kampagnenrunde, in der ein Krieger nach der ersten Schlacht der Warband
  kam (`recruitUnit`); fehlt er, kam der Krieger mit der Warband. Bis zu
  seiner ersten Schlacht kauft er von seiner Liste (Rob, 02.10.2026).
- **Gefangener** (`models[].captive`, neu, optional): `{ by, round,
  casualtyId }` – nach 61 „vorerst gefangen“ (Rob, 02.10.2026); er bleibt im
  Roster, bis `releaseCaptive` den Schlüssel entfernt oder ihn zu den
  Gefallenen legt. Die alte App führt ihn als gewöhnlichen Krieger.
- **Gehaltene Erfahrung** (`campaign.xp[]`): `{ id, round, uid, name,
  amount, reason, applied }`; `applyPendingXp` schreibt sie auf die Krieger.
- **Schlachten** (`campaign.battles[]`): `{ id, round, sides: [{ key, name,
  wb, outcome }], opponents: [{ name, wb }], district, outcome, notes }`;
  `key: 'me'` ist die eigene Warband, `opponents` bleibt für ältere Leser.
- **Snapshots** (`campaign.snapshots[round]`): `{ round, at, state, totals }`
  beim Abschluss einer Stufe; `state` ist die ganze Warband ohne
  Kampagnenaufzeichnungen und ohne `_`-Schlüssel, `totals` = `{ rating,
  spent, models, heroes, gold, fallen }` so, wie sie damals standen.
- **Post-Battle** (`campaign.postbattle[round]`): `{ done: { [step]: true },
  wyrd: { done, shards, gc, size } | null, veterans? }`. `veterans` (neu,
  optional): `{ roll, spent }` – der Veteranenwurf der Runde (2W6) und wie
  viel Erfahrung neue Männer davon schon mitgebracht haben (`core`
  `setVeteransRoll`, `addMen`).
- **Kampagnendatei** (eigenes Dokument, Quick Build): `{ type:
  'mordheim-campaign-file', version: 1, name, round, warbands: [{ id, player,
  name, wb, updated, roster }], battles: [...], log: [...] }`. `roster` ist
  der Export der Warband zum Zeitpunkt des Imports; `battles` enthält nur
  Schlachten, an denen die eigene Warband nicht beteiligt war, oder die aus
  Dateien anderer zusammengeführt wurden.
- **`uid` eines Kriegers ist unveränderlich** und die Grundlage für Vergleich,
  Lebenslauf und Erwähnungen.
- **`campaign`:** bleibt wie heute im Speicherstand (Runde, Schlachten,
  Verluste, Log, Snapshots, Bezirke, Post-Battle) – auch auf dem Server, in
  jeder Version (ADR 0016). Was alle teilen (Schlachten, Protokoll, Notizen,
  Markierungen), liegt in eigenen Tabellen; zu Beginn der Nachbereitung
  übernimmt die App die geschlossene Schlacht in den Speicherstand – über
  das Schlachtformular des Roster Builders (`core` `saveBattleDraft`): die
  Stufe bis zur Runde der Schlacht weitergeschaltet, alle Seiten mit
  Ergebnis, die Verluste, an denen die Warband beteiligt war. Zwei Schlüssel
  am übernommenen Eintrag in `campaign.battles[]` (beide optional, ohne
  Vorgabe): `serverId` (die Schlacht auf dem Server; einmal je Schlacht) und
  `xpAwarded` (die Erfahrung der Schlacht wurde gewährt; „Grant the battle’s
  experience“ nur einmal). Die Kampagnendatei bleibt ein Export.

## 3. Tabellen

### Nutzer und Anmeldung

| Tabelle | Spalten | Hinweise |
| --- | --- | --- |
| `users` | `id`, `username` (eindeutig ohne Groß/klein), `display_name`, `pw_hash`, `is_admin`, `totp_secret_enc`, `totp_pending_enc`, `totp_enabled_at`, `totp_last_step`, `totp_recovery`, `created_at`, `disabled_at` | seit Migration 2. `pw_hash`: `scrypt$N$r$p$salz$hash`. TOTP-Geheimnis mit `TOTP_KEY` aus `app.env` verschlüsselt (AES-256-GCM); ein Geheimnis im Einrichten wartet in `totp_pending_enc`, bis sein erster Code stimmt. `totp_last_step`: Zeitschritt des zuletzt benutzten Codes (jeder Code nur einmal). `totp_recovery`: JSON-Liste der Hashes der Wiederherstellungscodes; ein benutzter fällt heraus |
| `sessions` | `id`, `user_id`, `token_hash`, `stage` (`totp` · `full`), `device_label`, `ip`, `created_at`, `last_seen_at`, `expires_at`, `revoked_at` | nur Hash des Tokens. `totp`: Passwort stimmte, Code steht aus (5 Minuten); `full`: angemeldet, 90 Tage ab letzter Nutzung (höchstens stündlich nachgeführt, mit Adresse). Mit dem Code bekommt die Sitzung ein neues Token |
| `invites` | `id`, `token_hash`, `kind` (`register` · `reset`), `created_by`, `for_user_id`, `campaign_id`, `is_admin`, `note`, `created_at`, `expires_at`, `used_at`, `revoked_at` | einmal gültig; Register 7 Tage, Reset 24 Stunden. `created_by` leer: von `roster-cli`; nur von dort `is_admin`. Ein neuer Reset-Link widerruft den älteren. `campaign_id` ab Phase 4a |
| `login_attempts` | `id`, `username`, `ip`, `at`, `ok`, `reason` (`password` · `unknown` · `disabled` · `code` · `braked` · `registered` · leer) | für Bremse, Fail2Ban und die Admin-Ansicht „wer wann“ (Rob, 03.10.2026); 180 Tage aufbewahrt. Von der Bremse abgewiesene Versuche zählen nicht für sie |

### Warbands

| Tabelle | Spalten | Hinweise |
| --- | --- | --- |
| `warbands` | `id`, `owner_id`, `name`, `wb_type`, `head_rev`, `copied_from`, `copied_rev`, `created_at`, `updated_at`, `archived_at`, `seq`, `campaign_id` | seit Migration 3; `campaign_id` seit Migration 5: die Kampagne, in die sie eingetragen ist (ausstehend oder bestätigt), sonst leer (frei); solange sie gesetzt ist, lässt sich die Warband nicht entfernen (409 `enrolled`). `id` vom Gerät (UUID). `head_rev` = aktuelle Version. Ohne Kampagne „frei“ (Entwurf, Blaupause) und nur für den Besitzer sichtbar; `copied_from`/`copied_rev`: Warband und Version, aus der sie kopiert wurde (Kampagnenstart aus einer Blaupause, concept.md 4.1). `seq`: `audit_log.seq` der letzten Änderung (Sync). `archived_at`: entfernt (Grabstein) |
| `warband_versions` | `warband_id`, `rev`, `data` (JSON), `format`, `app_version`, `source` (`save` · `import` · `copy` · `restore` · `migration`), `created_by`, `created_at`, `note` | Primärschlüssel (`warband_id`, `rev`); nur anhängen; `data` höchstens 2 MB, geprüft gegen `warbandSaveSchema` aus `core/format`, Schlüssel mit `_` entfernt |
| `warband_shares` | `id`, `from_user`, `to_user`, `code_hash`, `warband_id`, `name`, `wb_type`, `data`, `created_at`, `expires_at`, `answered_at`, `accepted`, `uses`, `revoked_at` | seit Migration 4: eine Warband teilen (Rob, 05.10.2026), immer als Kopie. Entweder an einen Nutzer (`to_user`, einmal annehmen oder ablehnen) oder als Code (`code_hash`, nur der Hash; mehrfach einlösbar, `uses` zählt). `data` ist die Warband beim Teilen (höchstens 2 MB), geleert (`''`), sobald sie niemand mehr nehmen kann (beantwortet, zurückgenommen, abgelaufen); `warband_id` nur zur Anzeige beim Absender. 7 Tage gültig, zurücknehmbar |
| `code_attempts` | `id`, `user_id`, `ip`, `at` | falsche Teilen-Codes, für die Bremse (10 in 15 Minuten je Nutzer); einen Tag aufbewahrt |
| `warband_autosaves` | `warband_id`, `user_id`, `base_rev`, `data`, `device`, `updated_at`, `seq` | ein Platz je Nutzer und Warband (Entwurf seit der letzten Version); eine neue Version desselben Nutzers leert ihn. Ein anderes Gerät desselben Nutzers überschreibt ihn nur, wenn es ihn gesehen hat (`afterSeq`) oder ausdrücklich (`force`). Im `audit_log` steht je Entwurf nur der letzte Eintrag (`warband.autosave`); die Admin-Ansicht zeigt Entwürfe nicht |
| `tags` | `id`, `warband_id`, `rev`, `kind` (`start` · `after_battle` · `sat_out`), `campaign_id`, `battle_id`, `round`, `totals` (JSON, eingefroren), `created_by`, `created_at`, `superseded_by` | seit Migration 5. Korrektur = neuer Tag, alter bekommt `superseded_by`. `totals` rechnet der Server mit `core` (`stageTotals`: `rating`, `spent`, `models`, `heroes`, `gold`, `fallen` – dieselben Kennzahlen wie die Stufen-Snapshots der alten App), nie neu berechnet. `start` entsteht, wenn ein Leiter die Einschreibung bestätigt, auf der dann neuesten Version; `after_battle` setzt der Spieler auf eine Version seiner Wahl, sobald die Schlacht geschlossen ist (`battle_participants.rev_after`); `sat_out` setzt der Server beim Weiterschalten der Runde für jede eingetragene Warband ohne Schlacht in dieser Runde, auf ihre neueste Version |
| `changes` | `id`, `tag_id`, `warband_id`, `battle_id`, `seq_in_tag`, `kind`, `uid`, `change_key`, `payload` (JSON), `event_ref`, `unexplained` | seit Migration 8; eingefroren beim Markieren „After battle N“ (siehe Abschnitt 4): der Server vergleicht mit `core` (`diffWarbands`, `reconcile`) die markierte Version mit der Version der vorigen Markierung und gleicht mit Log und Verlusten dieser Schlacht im Speicherstand ab (ADR 0016). `uid`: Krieger-`uid` oder die eines Hired Sword; `payload` mit dem Namen. Eine zweite Markierung derselben Schlacht ersetzt die erste (`superseded_by`), die alte bleibt |

### Kampagne

| Tabelle | Spalten | Hinweise |
| --- | --- | --- |
| `campaigns` | `id`, `name`, `round`, `house_rules` (JSON), `created_by`, `created_at`, `updated_at`, `archived_at` | seit Migration 5. `round` 0 ist die Gründung (Setup). Anlegen nur mit Authenticator; wer anlegt, leitet |
| `members` | `campaign_id`, `user_id`, `role` (`leader` · `player` · `viewer`), `joined_at`, `left_at`, `added_by` | seit Migration 5; mindestens ein Leiter (409 `last_leader`). Ein Leiter handelt als Leiter nur mit Authenticator (ADR 0008). Ausgetreten: `left_at`, die Zeile bleibt |
| `enrolments` | `id`, `campaign_id`, `warband_id`, `player_id`, `status` (`pending` · `active` · `declined` · `left`), `from_round`, `created_at`, `confirmed_by`, `confirmed_at`, `ended_by`, `ended_at` | seit Migration 5; eine offene (`pending`, `active`) Einschreibung je Warband. Eintragen legt immer eine Kopie an (eine neue Warband des Spielers, `source` `copy` mit Herkunft, sonst `import`, Notiz „entered in …“); ein Leiter bestätigt (`active`, `from_round` = aktuelle Runde, Tag `start`) oder lehnt ab; die Warband eines Leiters gilt sofort. Zurückziehen (Spieler) oder Herausnehmen (Leiter, auch mit dem Mitglied) setzt `left`, die Warband ist wieder frei |
| `campaign_docs` | `campaign_id`, `kind` (`style` · `canon_extra`), `text`, `updated_by`, `updated_at` | Stilvorgaben (Leiter) |
| `battles` | `id`, `campaign_id`, `round`, `title`, `scenario_id`, `district`, `played_at`, `status` (`open` · `closed`), `turn`, `result` (JSON), `created_by`, `created_at`, `updated_at`, `closed_at`, `seq` | seit Migration 6. `id` vom Gerät (doppelt gesendet: eine Schlacht). `round`: Schlacht N ist Runde N (Vorgabe: Runde der Kampagne + 1). `district`: ein Bezirk aus `data/campaign.json` oder leer; `scenario_id` vorerst ein freier Name (Szenarien kommen mit der Welt, 4b). `turn`: der Spielzug, bei dem der Leiter gerade ist. `seq`: `audit_log.seq` der letzten Änderung an Schlacht, Protokoll oder Vorschlägen – mit `?since=` fragt ein Gerät nur nach Neuem (`{ unchanged: true }`). Anlegen und Ändern nur ein Leiter; ein Leiter schließt sie (`closed_at`; seit 4a4): danach ändert sich nichts mehr (409 `closed`), die für sie versiegelten Notizen öffnen sich (ihr `seq` springt mit), und der Server legt einen Snapshot `battle-<runde>` an. Die Runde der Kampagne schaltet ein Leiter weiter, wenn alle Schlachten der nächsten Runde geschlossen sind. In der Liste der Schlachten (Kampagnenansicht, `GET …/battles`) trägt jede seit 4a4 `warbandIds` (wer kämpfte) und `marked` (wessen Warband nach ihr markiert ist); die Ansicht einer Schlacht trägt `marks` (je Warband Version, Kennzahlen, Zahl der Änderungen und der unerklärten) |
| `battle_participants` | `battle_id`, `warband_id`, `rev_before`, `rev_after`, `outcome` (`victory` · `defeat` · `draw` · `routed` · leer) | seit Migration 6; nur Warbands mit bestätigter Einschreibung. `rev_before`: Version beim Anlegen; `rev_after` mit dem Tag `after_battle` (4a4). Die Ergebnisse heißen wie im Roster Builder (Victory, Defeat, Draw, Routed) |
| `protocol_entries` | `id`, `battle_id`, `turn`, `kind` (`casualty` · `event`), `payload` (JSON), `author_id`, `created_at`, `updated_at`, `status` (`pending` · `resolved`), `deleted_at` | seit Migration 6; nur ein Leiter schreibt (ADR 0010); entspricht den `casualties` der alten App. `id` vom Gerät: offline gesammelt, doppelt gesendet, ein Eintrag; dieselbe ID noch einmal korrigiert ihn (`protocol.correct` mit der alten Fassung im Log). `casualty`: `{ victim, attacker, note }`, eine Seite `{ warbandId?, uid?, idx?, fallenIdx?, name, grade?, wb?, env? }` (`warbandId` nur eine teilnehmende Warband; `env`: die Umgebung; ohne `warbandId`: jemand außerhalb der Roster); `event`: `{ text }`. Herausgenommen: `deleted_at`, die ID bleibt verbraucht (409 `removed`) |
| `proposals` | `id`, `campaign_id`, `battle_id`, `target_type` (`battle` · `protocol_entry`), `target_id`, `author_id`, `payload` (JSON: `text`, optional `change` = der Eintrag, wie er lauten soll), `status` (`open` · `accepted` · `rejected`), `decided_by`, `decided_at`, `created_at` | seit Migration 6: Korrekturvorschläge von Spielern und Leitern (nicht Zuschauern), ID vom Gerät; offen darf der Autor ihn umformulieren. Ein Leiter nimmt an (eine `change` wird auf den Eintrag angewandt) oder lehnt ab |
| `events` | `id`, `campaign_id`, `warband_id`, `battle_id`, `round`, `type`, `text`, `data` (JSON), `actor_id`, `created_at` | Aktions-Log (heute `logEvent`): `recruit`, `death`, `injury`, `advance`, `promote`, `xp`, `item`, `income`, `district`, `round`, `reputation` |

### Erzählung

| Tabelle | Spalten | Hinweise |
| --- | --- | --- |
| `notes` | `id`, `campaign_id`, `battle_id`, `turn`, `author_id`, `kind` (`general` · `scene` · `quote` · `dice` · `hook`), `text`, `lang`, `visibility` (`public` · `sealed` · `leader`), `sealed_until_battle`, `mentions` (JSON: `[{ warbandId, uid, name }]`), `protocol_entry_id`, `created_at`, `updated_at`, `deleted_at`, `seq` | seit Migration 7. `id` vom Gerät (doppelt gesendet: eine Notiz; dieselbe ID ändert sie). Höchstens 20 KB Text. `sealed`: nur mit `sealed_until_battle` = eine offene Schlacht der Kampagne; bis sie geschlossen ist, bekommen alle außer dem Autor – auch Leiter und Admin – nur einen Platzhalter (`id`, `battleId`, Autor, `sealedUntil`, `createdAt`; kein Text, keine Art, keine Erwähnungen); danach liest sie jeder (`opened`) und sie bleibt offen. `leader`: nur Leiter mit Authenticator schreiben und lesen sie, Spieler und Zuschauer bekommen sie gar nicht. Bei einem Zitat ist die erste Erwähnung der Sprecher. `lang`: `de` · `en` · leer (wird gewählt). Ein Leiter darf den Text einer fremden Notiz korrigieren (`note.edit_other`), nie eine noch versiegelte und nie, wer sie lesen darf. `seq`: mit `?since=` fragt ein Gerät nur nach Neuem |
| `note_revisions` | `note_id`, `text`, `edited_by`, `edited_at` | seit Migration 7: die frühere Fassung bei jeder Textänderung |
| `timeline_positions` | `campaign_id`, `item_type`, `item_id`, `segment`, `pos`, `turn`, `moved_by`, `moved_at` | siehe Abschnitt 5 |
| `attachments` | `id`, `campaign_id`, `battle_id`, `note_id`, `uploader_id`, `path`, `mime`, `bytes`, `width`, `height`, `caption`, `visibility`, `created_at` | Bilder, im Client verkleinert |
| `questions` | `id`, `campaign_id`, `battle_id`, `asked_by`, `to_user_id`, `text`, `answer_note_id`, `status` (`open` · `answered` · `withdrawn`) | |
| `chapter_drafts` | `id`, `campaign_id`, `segment`, `ref_key`, `lang`, `text`, `source` (`ai` · `manual`), `status` (`draft` · `approved` · `published`), `created_at` | Entwürfe für die Chronik |

### Hintergrund (nur Leiter)

| Tabelle | Spalten | Hinweise |
| --- | --- | --- |
| `background_entries` | `id`, `campaign_id`, `kind` (`thread` · `figure` · `place` · `scenario` · `gm_note`), `title`, `truth`, `players_know`, `status` (`planned` · `active` · `resolved`), `reveal` (`hidden` · `hint` · `revealed`), `hint_limits`, `reveal_from_battle`, `refs` (JSON), `battle_id`, `updated_by`, `updated_at` | `visibility` ist immer `leader` |
| `background_revisions` | `entry_id`, `snapshot` (JSON), `edited_by`, `edited_at` | |

### Welt

| Tabelle | Spalten | Hinweise |
| --- | --- | --- |
| `factions` | `id`, `campaign_id`, `name_de`, `name_en`, `public_status` | |
| `npcs` | `id`, `campaign_id`, `faction_id`, `name_de`, `name_en`, `public_status`, `statline_tts` | Wahrheit gehört in `background_entries` |
| `reputation_events` | `id`, `campaign_id`, `warband_id`, `faction_id`, `delta`, `reason`, `battle_id`, `actor_id`, `created_at` | aktueller Wert = Summe |
| `district_control` | `campaign_id`, `district_id`, `warband_id`, `status`, `since_battle` | |
| `scenarios` | `id`, `campaign_id`, `title`, `body`, `npc_statlines`, `visibility`, `played_in_battle` | `leader`, bis gespielt |

### Betrieb

| Tabelle | Spalten | Hinweise |
| --- | --- | --- |
| `bugs` | `id`, `reporter_id`, `kind` (`bug` · `wish` · `rules`), `title`, `text`, `source_ref`, `severity` (`S1`–`S4`), `area`, `status` (`new` · `confirmed` · `in_progress` · `fixed` · `closed` · `duplicate`), `app_version`, `device`, `view`, `js_errors` (JSON), `context` (JSON), `warband_id`, `rev`, `consent_attach`, `fixed_in`, `created_at` | `context` (Rob, 09.10.2026): was ohne Zutun mitgeht – Bildschirm und Reiter samt offenem Bereich, die letzten Schritte (ohne eingegebene Texte), Einstellungen (Theme, Layout, Flavour, Online/Sync, Rolle), Hausregeln von Warband und Kampagne; Meldende schreiben oft nur „funktioniert nicht“ (concept.md 4.12) |
| `bug_comments` | `id`, `bug_id`, `author_id`, `text`, `created_at` | Rückfragen |
| `audit_log` | `seq`, `at`, `actor_id`, `action`, `target_type`, `target_id`, `campaign_id`, `visibility` (`public` · `sealed` · `leader` · `admin`), `payload` (JSON) | seit Migration 2; jede Schreibaktion; Quelle für `seq`. `actor_id` leer: `roster-cli` (dann `payload.via`). Konto-Aktionen (`user.*`, `invite.*`, `totp.*`, `session.*`, `sessions.*`) haben `admin`; nie Passwörter, Tokens oder Codes im `payload` |
| `schema_migrations` | `version`, `name`, `applied_at` | legt der Migrationsrahmen selbst an (`server/src/migrations.ts`); eine Zeile je Datei `server/migrations/NNNN_name.sql` |
| `meta` | `key`, `value` | seit Migration 1; was der Server über sich selbst weiß: `epoch` (wechselt bei jeder Wiederherstellung, siehe [architecture.md](architecture.md#6-synchronisation)), `created_at` (Anlage der Datenbank), `restored_from` (nur in Snapshot-Kopien: Label und Zeit; ein Server, der auf der Kopie startet, nimmt eine neue Epoche und löscht den Eintrag) |

**Snapshots** (`data/snapshots/<zeit>-<label>.sqlite`, die letzten 5) sind
vollständige Kopien der Datenbank (`VACUUM INTO`) mit `restored_from` in
`meta`; Labels: `nightly`, `pre-deploy-<commit>`, `pre-migrate-v<alt>-v<neu>`,
`manual`, ab Phase 4a nach jeder Schlacht.

## 4. Änderungsdatensätze

Ein Eintrag in `changes` beschreibt eine Änderung zwischen zwei markierten
Ständen:

```json
{
  "kind": "stat",
  "uid": 17,
  "name": "Sir Honnung von Hoiser",
  "payload": { "stat": "WS", "before": 4, "after": 5 },
  "change_key": "5:17:stat:WS",
  "event_ref": "evt_…",
  "unexplained": false
}
```

- **`kind`:** `recruited`, `died`, `injury`, `stat`, `skill`, `spell`,
  `promoted`, `experience`, `gear_added`, `gear_removed`, `rare_added`,
  `rare_removed`, `group_size`, `hired`, `released`, `renamed`, `gold`,
  `rating`, `worth`, `district`, `house_rules`.
- **`change_key`:** `<round>:<uid|wb>:<kind>:<detail>` – stabil, damit die
  Erklärung des Spielers (`story.explain[changeKey]`) auch nach einer
  Korrektur des Tags an der richtigen Änderung hängt. Der Schlüssel entsteht
  aus dem Inhalt, nie aus Positionen: `detail` ist der Wert, die Fertigkeit,
  das Ding oder die Verletzung; Wiederholungen tragen `#2`, `#3`, Wegfälle ein
  vorangestelltes `-`; der n-te Tod eines Kriegers bzw. einer Gruppe ist `n`.
  Bei Hired Swords steht statt der Krieger-`uid` die `uid` des Eintrags.
- **`event_ref`:** zugehöriges Ereignis (`evt:<id>`) oder Protokolleintrag
  (`cas:<id>`); jeder Beleg erklärt höchstens eine Änderung, ein Wert +2
  braucht zwei Aufstiege. Fehlt er, ist `unexplained = true`. Nie ohne
  Anlass sind freie Entscheidungen und Summen: Umbenennen, Ausrüstung,
  verkaufte Rare Items, Anheuern und Entlassen, Gold, Rating, Worth. Eine
  kleinere Gruppe ist durch ihre Toten und Beförderten erklärt.
- **Erklärungen:** Das Briefing zählt fehlende Erklärungen für die Arten, aus
  denen eine Geschichte besteht (`STORY_KINDS`: neu, gefallen, gegangen,
  befördert, Werte, Fertigkeiten, Zauber, Verletzungen, erworbene Rare Items,
  Anheuern, Bezirke) – nicht für Erfahrung, Einkäufe oder Summen. Dass
  Erfahrung keine Erklärung braucht, hat Rob am 28.09.2026 bestätigt: In
  vielen Szenarien gibt schon das Ausschalten eines Gegners einen Punkt.
- Die Datensätze werden beim Markieren eingefroren. Die Rohversionen bleiben
  erhalten, sodass sich ein Vergleich jederzeit nachrechnen und mit dem
  eingefrorenen Stand abgleichen lässt.

## 5. Zeitleiste

- **Segmente:** `pre` (vor der Kampagne), je Schlacht `b<id>:before`,
  `b<id>:battle`, `b<id>:after`, danach `i<n>` (Zwischenspiel N).
- **`pos`:** fraktionaler Sortierschlüssel (Zeichenkette), der sich zwischen
  zwei bestehende setzen lässt. Verschieben ändert genau eine Zeile, nichts
  wird neu durchnummeriert.
- **Feste Anker:** Schlachten und Tags haben keine verschiebbare Position.
- **`turn`:** optionaler Spielzug zur Vorsortierung innerhalb von
  `b<id>:battle`.
- Neue Bausteine bekommen eine Standardposition (Notiz → Segment ihrer
  Schlacht, am Ende; Zwischenspiel → `i<n>`).

## 6. Pflege

- Neue Tabelle, Spalte oder Endpunkt: dieses Dokument im selben Commit
  anpassen.
- Ab Phase 3 prüft ein Test, dass jede Tabelle aus den Migrationen hier
  vorkommt und umgekehrt.
