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
| `format` | ja | Formatnummer; `core/format` migriert ältere Stände beim Laden |
| `appVersion` | ja | App-Version (Commit), die den Stand erzeugt hat |
| `canon` | ja | `{ name_de, name_en }` der Warband (z. B. *Die Silberne Karavane* / *The Ardent Caravan*) |
| `uidSeq` | ja | nächste freie Krieger-`uid`; verhindert, dass eine `uid` nach Entfernen oder Tod wiederverwendet wird (setzt `normalizeState` beim Laden) |
| `campaign.logSeq` | ja | zuletzt vergebene ID der Chronik; Log, Schlachten, Verluste und Erfahrungseinträge teilen sich diese Folge |
| `story` | ja | `{ prologue, interludes: { [round]: text }, explain: { [changeKey]: text } }` |
| `models[].profile` | ja | `{ name_de, name_en, title_de, title_en, voice, origin, text }` |
| `wb`, `subtype`, `name`, `budget`, `models`, `stash`, `fallen`, `hired`, `dp`, `mark`, `house`, `leaderUid`, `goldNow` | nein | wie heute |
| `models[]`: `uid`, `uid_def`, `name`, `names`, `qty`, `exp`, `adv`, `skills`, `spells`, `inj`, `eq`, `rare`, `mut`, `promoted`, `promoCats`, `xpPaid`, `heirloom`, `caster`, `lore`, `magic`, `miss`, `missWhy` | nein | wie heute |
| `campaign` | geändert | siehe unten |

- Schlüssel mit `_` am Anfang sind Bedienzustand und werden vor dem Speichern
  entfernt (bestehende Konvention `_stripTransient`).
- **Gefallene** (`fallen[]`, in der Reihenfolge ihres Todes):
  `{ kind: 'hero'|'hench', m, uid_def, exp, memberIdx, memberName, lostValue,
  casualtyId, casFromDeath }`. `m` ist der Krieger, wie er fiel (bei
  Henchmen genau ein Mann der Gruppe, mit der `uid` der Gruppe);
  `lostValue` ist das Gold, das dafür aus der Kasse ging und bei Rücknahme
  zurückkommt.
- **Verluste** (`campaign.casualties[]`): `{ id, round, battleId, victim,
  attacker, result: 'pending'|'recovered'|'injured'|'dead', detail,
  fallenId, note, code, applied, xpId }`; `victim`/`attacker` =
  `{ uid, name, wb, grade, value, memberIdx, uid_def }`, `uid` nur bei
  eigenen Kriegern. `fallenId` ist ein Index in `fallen`.
- **Gehaltene Erfahrung** (`campaign.xp[]`): `{ id, round, uid, name,
  amount, reason, applied }`; `applyPendingXp` schreibt sie auf die Krieger.
- **`uid` eines Kriegers ist unveränderlich** und die Grundlage für Vergleich,
  Lebenslauf und Erwähnungen.
- **`campaign`:** In der Quick-Build-Variante und in der Kampagnendatei bleibt
  `S.campaign` wie heute (Runde, Schlachten, Verluste, Log, Snapshots,
  Bezirke). Auf dem Server liegen diese Daten in eigenen Tabellen; in der
  Version steht nur noch `{ campaignId, round }`. `core/format` übersetzt in
  beide Richtungen (Import alter Stände, Export als Kampagnendatei).

## 3. Tabellen

### Nutzer und Anmeldung

| Tabelle | Spalten | Hinweise |
| --- | --- | --- |
| `users` | `id`, `username` (eindeutig), `display_name`, `pw_hash`, `is_admin`, `totp_secret_enc`, `totp_enabled_at`, `created_at`, `disabled_at` | TOTP-Geheimnis verschlüsselt mit Schlüssel aus der `.env` |
| `sessions` | `id`, `user_id`, `token_hash`, `device_label`, `created_at`, `last_seen_at`, `expires_at`, `revoked_at` | nur Hash des Tokens |
| `invites` | `id`, `token_hash`, `kind` (`register` · `reset`), `created_by`, `for_user_id`, `campaign_id`, `expires_at`, `used_at` | einmal gültig; Register 7 Tage, Reset 24 Stunden |
| `login_attempts` | `id`, `username`, `ip`, `at`, `ok` | für Bremse und Fail2Ban |

### Warbands

| Tabelle | Spalten | Hinweise |
| --- | --- | --- |
| `warbands` | `id`, `owner_id`, `name`, `wb_type`, `head_rev`, `created_at`, `archived_at` | `head_rev` = aktuelle Version |
| `warband_versions` | `warband_id`, `rev`, `data` (JSON), `format`, `app_version`, `source` (`save` · `import` · `migration`), `created_by`, `created_at`, `note` | Primärschlüssel (`warband_id`, `rev`); nur anhängen |
| `warband_autosaves` | `warband_id`, `user_id`, `base_rev`, `data`, `updated_at` | ein Platz je Nutzer und Warband |
| `tags` | `id`, `warband_id`, `rev`, `kind` (`start` · `after_battle` · `sat_out`), `campaign_id`, `battle_id`, `round`, `totals` (JSON, eingefroren), `created_by`, `created_at`, `superseded_by` | Korrektur = neuer Tag, alter bekommt `superseded_by` |
| `changes` | `id`, `tag_id`, `warband_id`, `battle_id`, `seq_in_tag`, `kind`, `uid`, `change_key`, `payload` (JSON), `event_ref`, `unexplained` | eingefroren beim Markieren, siehe Abschnitt 4 |

### Kampagne

| Tabelle | Spalten | Hinweise |
| --- | --- | --- |
| `campaigns` | `id`, `name`, `round`, `house_rules` (JSON), `created_by`, `created_at`, `archived_at` | |
| `members` | `campaign_id`, `user_id`, `role` (`leader` · `player` · `viewer`), `joined_at`, `left_at` | mindestens ein Leiter |
| `enrolments` | `id`, `campaign_id`, `warband_id`, `player_id`, `status` (`pending` · `active` · `left`), `from_round`, `confirmed_by` | eine aktive Einschreibung je Warband |
| `campaign_docs` | `campaign_id`, `kind` (`style` · `canon_extra`), `text`, `updated_by`, `updated_at` | Stilvorgaben (Leiter) |
| `battles` | `id`, `campaign_id`, `round`, `title`, `scenario_id`, `district`, `played_at`, `status` (`open` · `closed`), `result` (JSON), `created_by`, `closed_at` | |
| `battle_participants` | `battle_id`, `warband_id`, `rev_before`, `rev_after`, `outcome` | Stände vor und nach der Schlacht |
| `protocol_entries` | `id`, `battle_id`, `turn`, `kind` (`casualty` · `event`), `payload` (JSON: Opfer, Angreifer, Detail), `author_id`, `created_at`, `status` (`pending` · `resolved`) | nur Leiter schreibt; entspricht heute `casualties` |
| `proposals` | `id`, `target_type`, `target_id`, `author_id`, `payload`, `status` (`open` · `accepted` · `rejected`), `decided_by` | Korrekturvorschläge |
| `events` | `id`, `campaign_id`, `warband_id`, `battle_id`, `round`, `type`, `text`, `data` (JSON), `actor_id`, `created_at` | Aktions-Log (heute `logEvent`): `recruit`, `death`, `injury`, `advance`, `promote`, `xp`, `item`, `income`, `district`, `round`, `reputation` |

### Erzählung

| Tabelle | Spalten | Hinweise |
| --- | --- | --- |
| `notes` | `id`, `campaign_id`, `battle_id`, `author_id`, `kind` (`general` · `scene` · `quote` · `dice` · `hook`), `text`, `lang`, `visibility`, `sealed_until_battle`, `mentions` (JSON: `uid`, `warband_id`), `protocol_entry_id`, `created_at`, `updated_at`, `deleted_at` | `lang` wird erkannt oder gewählt |
| `note_revisions` | `note_id`, `text`, `edited_by`, `edited_at` | |
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
| `bugs` | `id`, `reporter_id`, `kind` (`bug` · `wish` · `rules`), `title`, `text`, `source_ref`, `severity` (`S1`–`S4`), `area`, `status` (`new` · `confirmed` · `in_progress` · `fixed` · `closed` · `duplicate`), `app_version`, `device`, `view`, `js_errors` (JSON), `warband_id`, `rev`, `consent_attach`, `fixed_in`, `created_at` | |
| `bug_comments` | `id`, `bug_id`, `author_id`, `text`, `created_at` | Rückfragen |
| `audit_log` | `seq`, `at`, `actor_id`, `action`, `target_type`, `target_id`, `campaign_id`, `visibility`, `payload` (JSON) | jede Schreibaktion; Quelle für `seq` |
| `schema_migrations` | `version`, `applied_at` | |

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
  `promoted`, `gear_added`, `gear_removed`, `rare_added`, `rare_removed`,
  `group_size`, `hired`, `released`, `renamed`, `gold`, `rating`, `worth`,
  `district`, `house_rules`.
- **`change_key`:** `<round>:<uid|wb>:<kind>:<detail>` – stabil, damit die
  Erklärung des Spielers (`story.explain[changeKey]`) auch nach einer
  Korrektur des Tags an der richtigen Änderung hängt.
- **`event_ref`:** zugehöriges Ereignis oder Protokolleintrag; fehlt er, ist
  `unexplained = true`.
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
