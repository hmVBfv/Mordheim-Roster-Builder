# Glossar

Deutsch (Chat, Konzept) ↔ Englisch (Oberfläche) ↔ Code. Wer einen neuen
Begriff einführt, trägt ihn hier ein.

## Rollen und Organisation

| Deutsch | Englisch (UI) | Code |
| --- | --- | --- |
| Admin | Admin | `users.is_admin` |
| Kampagnenleiter, Leiter | Campaign leader | `role: 'leader'` |
| Spieler | Player | `role: 'player'` |
| Zuschauer | Viewer | `role: 'viewer'` |
| Einladung | Invite | `invites`, `kind: 'register'` |
| Reset-Link | Reset link | `invites`, `kind: 'reset'` |
| Sitzung, Gerät | Session, device | `sessions` |
| Zweiter Faktor, Authenticator | Authenticator (TOTP) | `totp_*` |

## Warbands

| Deutsch | Englisch (UI) | Code |
| --- | --- | --- |
| Warband | Warband | `warbands` |
| Version | Version | `warband_versions`, `rev` |
| aktuelle Version | Latest version | `head_rev` |
| Autosave-Platz | Autosave | `warband_autosaves` |
| markierter Stand | Tagged state | `tags` |
| Start | Start | `kind: 'start'` |
| nach Schlacht X | After battle X | `kind: 'after_battle'` |
| ausgesetzt | Sat out | `kind: 'sat_out'` |
| Änderung | Change | `changes` |
| Vergleich | Diff | `core/changes` |
| Abgleich | Reconciliation | `event_ref`, `unexplained` |
| Anlass | Cause | `event_ref` |
| ohne Anlass | Unexplained (no recorded cause) | `unexplained` |
| Beleg | Evidence | `evt:<id>`, `cas:<id>` |
| Ereignis | Event | `events` |
| Änderungsschlüssel | Change key | `change_key` |
| Kanon | Canon | `canon`, `profile.name_de/_en` |
| Profil (eines Kriegers) | Profile | `models[].profile` |
| Lebenslauf | Service record | abgeleitet in `core/narrative` |
| Formatnummer | Format version | `format` |
| Gründung (bis zur ersten Schlacht) | Founding | `warbandHasFought()` ist falsch |
| Gründungspreis | Founding price | Listenzeile `[name, preis, {start: true}]`, `startOnlyRow()`, `UPGRADES[…].start` |
| Trading Post | Trading Post | `rareEligibleItems()`, `CATALOG` |
| nur für Helden (Listenzeile) | Heroes only | `{heroes: true}` |
| einer Warband vorbehalten (Katalog) | – | `CATALOG[…].only`, `catalogAllowed()` |
| nur für eine Variante (Stadt, Stamm) | – | `{sub: ['midd']}` |
| gesperrter Skill einer Warband | – | `WARBANDS[…].noSkills` |
| Post-Battle-Hilfe | Post-battle | `postBattleHelp()`, `data/postbattle.json` |
| umbenannter Gegenstand | – | `RENAMED` in `data/equipment.json` |
| Kassenbuch (geplant, V7) | Ledger | – |
| Suchwurf nach Seltenem | Search (rare) | – (Mockup `trading-post.html#search`) |
| Veteranenwurf (Männer mit Erfahrung anwerben) | Veterans roll | `henchRecruitSurcharge()`, `m.xpPaid` |
| Mann (einer Henchmen-Gruppe) | Man | `m.names[]`, `memberName()` |
| Beförderung | The lad's got talent · Promoted | `promoteHench()`, `m.promoted`, `m.promoCats` |

## Kampagne und Schlacht

| Deutsch | Englisch (UI) | Code |
| --- | --- | --- |
| Kampagne | Campaign | `campaigns` |
| Einschreibung | Enrolment | `enrolments` |
| Runde | Round | `round` |
| Schlacht | Battle | `battles` |
| Schlachtprotokoll | Battle log | `protocol_entries` |
| Verlust (Out of Action) | Casualty | `kind: 'casualty'` |
| Korrekturvorschlag | Correction proposal | `proposals` |
| Spielzug | Turn | `turn` |
| Spielabend-Modus | Game night | `/game-night` |
| Post-Battle-Sequenz | Post-battle sequence | `core/campaign` |
| Hausregeln | House rules | `house_rules`, `S.house` |
| Stilvorgaben | Style guide | `campaign_docs`, `kind: 'style'` |

## Erzählung

| Deutsch | Englisch (UI) | Code |
| --- | --- | --- |
| Notiz | Note | `notes` |
| Szene | Scene | `kind: 'scene'` |
| Zitat | Quote | `kind: 'quote'` |
| Würfelmoment | Dice moment | `kind: 'dice'` |
| offener Faden | Hook | `kind: 'hook'` |
| versiegelt | Sealed | `visibility: 'sealed'`, `sealed_until_battle` |
| Sichtbarkeit | Visibility | `visibility` |
| Prolog | Prologue | `story.prologue` |
| Zwischenspiel | Interlude | `story.interludes`, Segment `i<n>` |
| Erklärung (einer Änderung) | Explanation | `story.explain` |
| fehlende Erklärung | Missing explanation | `missingExplanations`, `STORY_KINDS` |
| Frage an Spieler | Question | `questions` |
| Zeitleiste | Timeline | `timeline_positions` |
| Abschnitt | Segment | `segment` |
| Erzählzeit | Story order | `pos` |
| Erfassungszeit | Recorded at | `created_at` |
| Briefing | Briefing | `core/narrative` |
| KI-Paket | AI pack | `ai-pack` |
| Kapitelentwurf | Chapter draft | `chapter_drafts` |

## Verborgene Ebene und Welt

| Deutsch | Englisch (UI) | Code |
| --- | --- | --- |
| Hintergrund | Background | `background_entries` |
| Handlungsstrang | Plot thread | `kind: 'thread'` |
| Figur | Figure | `kind: 'figure'` |
| GM-Notiz | GM note | `kind: 'gm_note'` |
| Enthüllungsstufe | Reveal level | `reveal: 'hidden' · 'hint' · 'revealed'` |
| Enthüllen | Reveal | Aktion, erzeugt öffentliche Notiz |
| Fraktion | Faction | `factions` |
| NPC | NPC | `npcs` |
| Ruf | Reputation | `reputation_events` |
| Bezirk | District | `district_control` |
| Szenario | Scenario | `scenarios` |

**Achtung Namensgleichheit:** `notes/roter-faden.md` im Chronik-Repo ist eine
*öffentliche* Zusammenfassung der Kapitel. Der verborgene Bereich der App
heißt deshalb **Hintergrund / Background**, nicht „Roter Faden“.

## Technik und Betrieb

| Deutsch | Englisch | Code / Ort |
| --- | --- | --- |
| Kampagnenserver | Campaign app | Variante `campaign`, `server/` |
| Schnellbau | Quick Build | Variante `quickbuild`, GitHub Pages |
| Variante (der App) | Flavour | Build-Modus `campaign` / `quickbuild`, `app/src/flavour.ts` |
| Offen für dich | Open for you | Startseite, `app/src/routes/Home.tsx` |
| Auf diesem Gerät gespeichert | Saved on this device | `app/src/app/SyncState.tsx` |
| Neue Version – neu laden | New version available · Reload | `app/src/app/UpdateBanner.tsx` |
| Gerätespeicher | Device store | Dexie-Datenbank `mordheim`, `app/src/db/db.ts` |
| Spiegel (Legacy-Tests gegen `core/`) | Mirror | `core/test/mirror/` |
| Warteschlange | Outbox | Dexie-Tabelle `outbox` |
| Synchronisation | Sync | `GET /api/v1/sync` |
| Epoche | Epoch | `meta.epoch`; neu bei jedem Start auf einer Snapshot-Kopie (`server/src/db.ts`) |
| Testinstanz | Staging | Container `roster-staging`, `roster-deploy --staging` |
| Markerdatei | Marker file | `/data/.roster-volume` (`server/src/volume.ts`) |
| Snapshot (der Datenbank) | Snapshot | `data/snapshots/<zeit>-<label>.sqlite`, `roster-cli backup` |
| Wiederherstellungstest | Restore test | `roster-restore-test.timer` |
| Rollback-Übung | Rollback drill | Image `:drill-broken` |
| SSD-Übung | SSD drill | ohne Markerdatei startet nichts |
| Aktion (für `can()`) | Action | `server/src/policy.ts` |
| Totmannschalter | Dead man's switch | healthchecks.io |
| Leak-Test | Leak test | CI-Matrix Rolle × Endpunkt × Sichtbarkeit |
| Schweregrad | Severity | `S1`–`S4` |
| Regelfehler | Rules issue | `bugs.kind: 'rules'` |
| Wunsch | Wish | `bugs.kind: 'wish'` |
| Prüf-Agent | Reviewer agent | `.claude/agents/reviewer.md` |
| Cloud-Sitzung | Cloud session | Claude Code im Code-Tab bzw. claude.ai/code |
| Betriebsdateien | Ops files | `ops/`, eingespielt mit `ops/install.sh` |
| Standortdatei | Site config | `~/server/roster/site.env` (nur auf dem Pi) |

## Oberfläche

| Deutsch | Englisch (UI) | Code |
| --- | --- | --- |
| Arbeitsfläche (Desktop) | Workspace | Vorschlag: `docs/mockups/desktop.html` |
| Panel | Panel | ein Bildschirm des Handys als Kachel der Arbeitsfläche |
| Ansicht (gespeicherte Anordnung) | View | `VIEWS` im Mockup; nur auf dem Gerät |
| Dock | Dock (Minimised panels) | Leiste der minimierten Panels |
| Bereich von unten | Sheet | `<dialog class="sheet">`, `app/src/ui/useSheet.ts` |
| Wappen der Warband | – | `docs/mockups/warband-art.js` (`data-art`) |
