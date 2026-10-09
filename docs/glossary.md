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
| Wiederherstellungscode | Recovery code | `totp_recovery`, `newRecoveryCodes()` |
| Anmeldung, Code steht aus | Sign in; code needed | `sessions.stage` (`totp` · `full`), `Actor.pending` |
| Bremse | (429 „Too many attempts“) | `brakeWait()`, `login_attempts` |
| Anmelde-Log | Sign-ins | `login_attempts`, `GET /admin/logins` |
| Audit-Log | Audit log | `audit_log`, `GET /admin/audit` |

## Warbands

| Deutsch | Englisch (UI) | Code |
| --- | --- | --- |
| Warband | Warband | `warbands` |
| Version | Version | `warband_versions`, `rev` |
| Version speichern | Save a version | `saveVersion`, `POST /warbands/:id/versions` |
| ältere Version zurückholen | Bring back (make it the newest) | `restoreVersion`, `source: 'restore'` |
| Kopie (Blaupause) | Make a copy | `makeCopy`, `origin: 'copy'`, `copiedFrom` |
| Kampagne anlegen | Start a campaign | `POST /campaigns`, `createCampaign` |
| Mitglied, Leiter, Spieler, Zuschauer | Member; Leader, Player, Viewer | `members.role` (`leader` · `player` · `viewer`) |
| Warband eintragen | Enter a warband (Enter a copy) | `POST /campaigns/:id/enrolments`, `enrolments`, `enterWarband` |
| neue Warband für die Kampagne | New warband for this campaign | `/warbands/new?campaign=<id>`: frei unter Warbands, die Kopie sofort eingetragen |
| wartet auf einen Leiter | Waiting for a leader | `enrolments.status = 'pending'` |
| bestätigen / ablehnen | Confirm / Decline | `confirmEnrolment`, `declineEnrolment` |
| Kampagne verlassen | Leave the campaign… | `DELETE …/enrolments/:eid`, `withdrawEnrolment`, `status = 'left'` |
| Verwaltung | Manage | `/campaign/:id/manage`, `campaign.manage` |
| Gründung (Runde 0) | Setup | `campaigns.round = 0`, `roundName` |
| Schlacht anlegen | New battle → Start the game night | `POST /campaigns/:id/battles`, `NewBattleSheet` |
| Spielabend | Game night | `/campaign/:id/battles/:bid`, `Battle.tsx` |
| Schlachtprotokoll | Protocol | `protocol_entries` |
| Verlust (aus dem Gefecht) | Casualty, “Out of action” | `kind: 'casualty'` |
| Ereignis | Event | `kind: 'event'` |
| Ergebnis | Outcome: Victory, Defeat, Draw, Routed | `battle_participants.outcome` |
| Korrekturvorschlag | Suggest a correction; Take over / Reject | `proposals` |
| Postausgang (auf dem Gerät) | “on this phone”, “N waiting” | `db.outbox`, `flushOutbox` |
| Notiz; Arten: Notiz, Szene, Zitat, Würfelmoment, offener Faden | Note; Note, Scene, Quote, Dice moment, Open thread | `notes.kind`: `general`, `scene`, `quote`, `dice`, `hook` |
| Wer darf es lesen: alle · versiegelt · nur Leiter | Who can read this? Everyone · Sealed until battle N is closed · Leaders only | `notes.visibility`: `public`, `sealed`, `leader` |
| Sprecher (eines Zitats) | Who says it? | erste Erwähnung (`mentions[0]`) |
| Krieger nennen | Who is in it? / Name a warrior… | `notes.mentions` |
| Teilen (eine Kopie an andere) | Share… | `ShareSheet`, `warband_shares`, `POST /shares` |
| Kopie schicken | Send a copy | `sendCopy`, `to_user` |
| Teilen-Code | Share code | `makeCode`, `code_hash`, `POST /shares/peek`, `POST /shares/redeem` |
| Teilen-Code eingeben | Enter a share code | `CodeSheet`, `redeemCode` |
| Kopie annehmen / ablehnen | Take it / Decline | `acceptShare`, `declineShare` |
| Teilen zurücknehmen | Take back | `revokeShare`, `DELETE /shares/:id` |
| An Kampagnenserver senden | Send to campaign server | `app/src/share/link.ts`, Route `/import` |
| aktuelle Version | Latest version | `head_rev` |
| Entwurf (Autosave) | Draft | `warband_autosaves`, `PUT /warbands/:id/autosave` |
| freie Warband, Blaupause | Free warband; copy | ohne Kampagne; Kopie: `source: 'copy'`, `copied_from` |
| Abgleich, wartet | Sync; n waiting | `app/src/sync/`, `syncOnce`, `countPending` |
| Konflikt (anderswo auch geändert) | Changed on another device as well; Check | `StoredWarband.conflict` (`draft` · `behind` · `removed`) |
| nur auf diesem Gerät | Only on this device; Keep in my account | `StoredWarband.ownerId` leer, `keepInAccount` |
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
| Söldner, Hired Sword | Hired Sword | `hired`, `HIREDSWORDS` |
| Dramatis Personae (benannte Figur) | Dramatis Personae | `dp`, `DRAMATIS` |
| Anheuern | Hire | `core` `hire`, `hireProblem`, `hireChoices`; Bildschirm `/warbands/:id/hire` |
| Anheuergebühr / Unterhalt | Hire fee / Upkeep | `hsHireCost`, `hsUpkeepFor` |
| Wanderer (bleibt eine Schlacht) | Wanderer | `wanderer` |
| Lebenslauf | Service record | abgeleitet in `core/narrative` |
| Formatnummer | Format version | `format` |
| Gründung (bis zur ersten Schlacht) | Founding | `warbandHasFought()` ist falsch |
| Gründungspreis | Founding price | Listenzeile `[name, preis, {start: true}]`, `startOnlyRow()`, `UPGRADES[…].start` |
| Trading Post | Trading Post | `/warbands/:id/trade`, `rareEligibleItems()`, `CATALOG` |
| Ausrüstung aus der Liste (bis zur ersten Schlacht) | Equipment & rare items | `EquipmentSheet`, `setEqQty()`, `addRare()` |
| nur für Helden (Listenzeile) | Heroes only | `{heroes: true}` |
| einer Warband vorbehalten (Katalog) | – | `CATALOG[…].only`, `catalogAllowed()` |
| nur für eine Variante (Stadt, Stamm) | – | `{sub: ['midd']}` |
| gesperrter Skill einer Warband | – | `WARBANDS[…].noSkills` |
| Post-Battle-Hilfe | Post-battle | `postBattleHelp()`, `data/postbattle.json` |
| umbenannter Gegenstand | – | `RENAMED` in `data/equipment.json` |
| Kassenbuch (V7) | Ledger | `s.ledger`, `ledgerBalance()`, `settle()`, `keepGold()`, `bookGold()` |
| Suchwurf nach Seltenem | Search (rare) | `searchOdds()`, `searchBlock()`, `recordSearch()` |
| Veteranenwurf (Männer mit Erfahrung anwerben) | Veterans roll | `setVeteransRoll()`, `veteransOf()`, `postbattle[round].veterans`, `henchRecruitSurcharge()`, `m.xpPaid` |
| Mutationen, Segnungen des Nurgle | Mutations · Blessings of Nurgle | `MutationSheet`, `mutationView()`, `toggleMutation()`, `mutCost()` |
| Mal des Chaos (Marauder) | Mark of Chaos | `MarkSheet`, `markView()`, `setMark()`, `setCaster()` (Häuptling nimmt das Mal) |
| Rekrut (vor seiner ersten Schlacht) | recruit | `m.joined`, `recruitUnit()`, `isNewRecruit()`, `warriorHasFought()`, `setListQty()` |
| Mehr Männer für eine Gruppe | More men · + Man | `MoreMenSheet`, `addMen()`, `moreMenMax()` |
| Handel gesperrt (ab der ersten Schlacht) | – | `tradeLocked()` |
| Kaufen (Trading Post) | Buy | `buyItem()`, `commonPrice()` |
| Verkaufen | Sell | `sellItem()`, `sellPrice()` |
| Geben, Umverteilen (V4) | Give | `giveItem()`, `canReceive()` |
| Lager (Truhe) | Stash | `s.stash.items[]` (`key`, `rare`, `paid`) |
| Mann (einer Henchmen-Gruppe) | Man | `m.names[]`, `memberName()` |
| einen Mann entlassen | Dismiss him | `dismissMember()` |
| Mann nachrekrutieren | + Man | `setQty()`, `henchRecruitCost()` |
| Warband anlegen | New warband · Start the warband | `createWarband()`, `/warbands/new` |
| Anwerben | Recruit | `addUnit()`, `recruitStatus()`, Sheet `RecruitSheet` |
| aus dem Roster nehmen | Remove from the roster | `removeUnit()` |
| Anführer bestimmen | Lead the warband | `setLeader()`, `canBeLeader()` |
| Hinweis mit Rückgängig | Undo (notice) | `UndoToast`, `useEditor().notice` |
| Beförderung | The lad's got talent · Promoted | `promoteHench()`, `m.promoted`, `m.promoCats` |
| Aufstieg (Wurf nach der Tabelle) | Advance | `AdvanceSheet`, `HERO_TABLE`, `HENCH_TABLE`, `addAdvance()`, `addSkillFromList()` |
| Aufstiege korrigieren | Advances taken – correct | `TakenSheet`, `removeAdvance()`, `removeSkill()` |
| Schwere Verletzung (Wurf nach der Tabelle) | Injury · Serious injury | `InjurySheet`, `injure()`, `HeroRoll`, `HERO_CODES` |
| Folgeentscheidung (Nachwurf, Wahl) | follow-up (D6, D3, fate, fight) | `HeroRoll.d6`, `.games`, `.captured`, `.pit`, `.more` |
| Endgültig außer Gefecht | Out of action for good | `injure()` mit `11-15` |
| Verletzungen korrigieren | Injuries – correct | `InjuriesSheet`, `removeInjury()`, `adjustMiss()` |
| Gefangener, Gefangenschaft | Captive · Captivity | `m.captive`, `CaptiveSheet`, `releaseCaptive()` |

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
| Post-Battle-Sequenz | Post-battle sequence (After the battle) | `core/campaign`, `PB_STEPS` |
| Schlacht schließen | Close the battle | `POST …/battles/:bid/close`, `closeBattle()` |
| Nachbereitung (einer Warband) | Aftermath (Your aftermath) | `/warbands/:id/aftermath/:bid`, `app/src/aftermath/` |
| Schlacht übernehmen | Take the battle over (Take it over) | `takeOverBattle()`, `campaign.battles[].serverId` |
| Erfahrung der Schlacht | The battle’s experience (Grant …) | `awardBattleXp()`, `campaign.battles[].xpAwarded` |
| Markieren „Nach Schlacht N“ | Mark after battle N | `POST …/battles/:bid/marks`, Tag `after_battle` |
| Was sich geändert hat | What changed | `diffWarbands()`, `reconcile()`, Tabelle `changes` |
| ohne Anlass | no cause found (without a cause) | `unexplained` |
| ausgesetzt (Runde) | Sat out battle N | Tag `sat_out` |
| Runde weiterschalten | Move on to After battle N | `POST /campaigns/:id/rounds/advance` |
| Offen für dich | Open for you | `openAftermaths()` in der Übersicht der Kampagne |
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
| Chronik (Reiter der Kampagne: die ganze Geschichte) | Chronicle | `chapters` |
| Kapitel importieren | Import a chapter | Entwurf aus Text oder .md/.txt |

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
| Layout auf diesem Gerät | Layout on this device (Phone / Desktop) | von Hand gewählt, nur auf dem Gerät; die App wechselt nie von selbst |
| Regeltext-Blase | – (Antippen eines unterstrichenen Worts) | App: `TipWord` (`app/src/ui/Tip.tsx`), Texte aus `app/src/roster/tips.ts`; Mockup: `.tip`, `window.mockTips` |
| Neue Warband | New warband | App: `/warbands/new` |
