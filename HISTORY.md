# History

Not a changelog — a short account of how this thing actually grew, and why it
looks the way it does. Kept in the repo instead of scattered across chat logs,
because "why is it built this way" is usually more useful than "what changed".

## June 2026 — a single HTML file

The project started as one self-contained HTML file with warband data and
logic embedded directly in a `<script>` tag. The rule, from day one: **only
mordheimer.net is authoritative.** If a rule couldn't be found and confirmed
there, it was marked "pending" rather than filled in with a guess from a
random fan blog or an old homebrew variant. That distinction mattered early —
some of the more obscure Grade 1a warbands turned out to have unofficial
"fan fix" versions circulating online with different, non-canonical costs;
those were deliberately excluded rather than silently absorbed.

## Late June – early July 2026 — the warband audits

Every warband, Hired Sword, and Dramatis Personae entry got checked, one by
one, against mordheimer.net, with the Ultimate FAQ and the FAQ from Toumas
as the final word whenever they overrode the base text. This is where most of
the game-accuracy bugs were actually found and fixed — wrong skills on named
characters (a persona had "Eagle Eyes" where the rules say "Evil Eye"),
missing racial maxima for non-human warbands, an Arabian Tomb Raiders
Champion cap that got "corrected" from the table value based on a
misread prose sentence and had to be reverted once the annotation was found.
The lesson that stuck: **when the summary table and the prose text disagree,
the table plus its annotation wins**, not whichever reads more naturally.

Racial Maxima, the Hired Sword and Dramatis Personae systems, the leader
selection logic, and warband-specific hiring/skill restrictions were all
built and audited during this stretch.

## Mid July 2026 — splitting the monolith

By this point the single HTML file had grown to roughly 1.4 MB and was
getting unwieldy to edit safely. It was split into a proper source tree:
data as JSON, logic across `app.js` / `pdf.js` / `tts.js`, and `build.js` to
bundle everything back into one offline-capable HTML file for distribution.

The split paid for itself immediately: running the (at the time, ad-hoc)
regression checks against both the original monolith and the newly built
output turned up **two real bugs that the single-file version had been
silently masking** — a duplicate `skillInfo` declaration and a dead import —
because a classic `<script>` tag just lets the last declaration win, where an
ES module correctly refuses to load. That difference is now captured
permanently in `test/smoke.mjs`, specifically so it keeps catching this
class of bug rather than relying on someone noticing during a review.

## July 16, 2026 — cleanup pass

A few loose ends from the split:

- The README still referenced a rostersheet source (freebooters.org) that
  isn't part of this project's source hierarchy; corrected to point only at
  mordheimer.net / Broheim.net / the FAQs / the rulebook, with a proper
  non-affiliation note.
- The regression tests that had been run ad-hoc during working sessions
  (against the built single-file HTML, never committed) were formalized into
  `test/`, so they run the same way locally and in CI.
- The Carnival of Chaos's *Blessings of Nurgle* had two mistranslated English
  names (a literal, un-checked translation from the German working data —
  "Swarm of Flies" instead of the official "Cloud of Flies", "Bloated
  Putrefaction" instead of "Bloated Foulness"). Fixed against mordheimer.net,
  and wired up so Blessings and Chaos Mutations now show as proper tooltip
  chips next to the units that carry them — including the ones like Plague
  Bearers and Nurglings that start with some of these abilities built in,
  rather than only for the ones a player buys.
- Found and fixed a PDF export bug: heroes and henchmen were printed in
  *recruitment* order instead of the warband's fixed roster order, so e.g. a
  Marauder Chieftain recruited after a Seer would print below him instead of
  above, as the roster listing requires.

## What's next

See the Roadmap section in `README.md` — remaining warband audits, the Rare
Items / Trading Post feature, and further Tabletop Simulator export work.

## July 16, 2026 (cont.) — splitting app.js: state & engine

Began breaking the ~2,400-line `app.js` into focused modules, one careful step
at a time (each step: extract, re-import, re-export for the inline handlers,
run the tests, rebuild).

- **`state.js`** — the warband state object `S`, the model-id counter, and the
  house-rule defaults. The subtlety: ES module imports are live but read-only,
  so the couple of places that used to do a raw `S = {...}` (choosing a
  warband, loading a saved roster) can't anymore. They now call
  `replaceState()`, which swaps the object's *contents* while keeping the same
  reference every other module holds. `test/state-module.mjs` pins this
  contract down.
- **`engine.js`** — the pure rules & cost calculation (unit lookup,
  equipment/mutation/rare-item costs, weapon-upgrade pricing, warband totals,
  gold, rating). No DOM, so it's directly unit-testable; `test/engine.mjs`
  checks the whole cost pipeline end-to-end on a known warband and confirms
  `app.js` re-exports the identical function objects (not divergent copies).

Rendering and UI actions still live in `app.js` — that's the next split.

## July 16, 2026 (cont.) — GitHub Pages hosting

Wired up Pages deployment so the modular version can be used online without
building the single file — the browser fetches the JSON over `https://`, the
same way it does against a local dev server.

Two Pages-specific traps, found by actually serving the repo under a subpath
rather than assuming it would work:

- Pages runs Jekyll by default, and **Jekyll silently drops files starting
  with an underscore** — which would have made `data/_util.js` return 404 and
  break the app on load. Fixed with an empty `.nojekyll` file.
- Pages serves under a `/<repo>/` subpath, so any absolute path (`/data/...`)
  would 404. The app already used relative paths
  (`new URL('./x', import.meta.url)`) everywhere, confirmed by serving under a
  simulated subpath before deploying.

The two GitHub Actions workflows (a CI-only build and the Pages deploy) were
merged into one, to avoid them both firing on `main` and racing each other.

## July 16, 2026 (cont.) — splitting app.js: info lookups

Started peeling the rendering layer off `app.js` in small, individually
tested slices rather than one big cut (the render code is far more
interwoven than state or engine were — functions call each other, call the
engine, and get called back by UI actions).

First slice: **`info.js`** — the pure name→tooltip lookups (`itemInfo`,
`abilityInfo`, `spellInfo`, `skillInfo`) plus `itipBuild`, which builds the
tooltip HTML string but touches no live DOM. The tooltip *mechanics*
(positioning, pinning, the `itipPinned` flag and its event listeners) stayed
in `app.js`; this module only answers "what does this name mean, and what
HTML shows it". `test/info.mjs` checks the Blessing of Nurgle tooltips still
resolve through the new module.

(A small extraction snag worth remembering: removing the functions left one
orphaned `}` behind — `node --check` accepted the file, but the ESM compiler
rejected it at load with a bare "Unexpected token '}'". `vm.SourceTextModule`
pinpointed the line where `--check` wouldn't.)

## July 17, 2026 — armour-save maths to engine.js; pausing the render split

Looked at extracting the Hired-Swords / Dramatis rendering next, but that
region turned out to interleave three concerns line by line — the HS engine
helpers (already imported back by engine.js), stat/save helpers, and the
actual HTML rendering — with no clean block boundary. Forcing a render module
out of it would have meant a dozen names shuttled back and forth for little
gain, and exactly the kind of tangle that produced a stray-brace slip earlier.

So instead of a shaky render split, took the one clean cut available there:
the pure armour-save maths (`svFromText`, `_svCombine`, `svOfModel`,
`svOfEntry`, `svLabel`, `statNum`) moved to `engine.js`, where they belong
thematically — no HTML involved. `test/engine.mjs` now also checks the save
parser (e.g. light armour → 6+, and deliberately not reading a "3+ to avoid
being stunned" as an armour save).

With state, engine, info and the save maths extracted, `app.js` is now down to
rendering + UI actions — and those two are genuinely interwoven (render calls
actions, actions call render). Splitting them further would be high-effort,
low-reward, so the modularization pauses here by choice rather than pushing a
split that costs more than it returns. Future energy goes to features (e.g.
the Rare Items / Trading Post work on the roadmap).

## July 17, 2026 — Rare Items: test coverage + catalogue audit

Turned attention from restructuring to hardening the most complex existing
feature. The Rare Items / Trading Post system (a catalogue with an eligibility
rule) was implemented but untested and, it turned out, incomplete.

- **Eligibility test** (`test/rare-items.mjs`): pinned down the core rule —
  a unit may only take a rare item whose base category is in its starting
  equipment list — against real warband data (an Averland Captain with heavy
  armour + spear may take those rare items; a Carnival Brute with only
  two-handed + flail may not take heavy armour), plus the misc-is-heroes-only
  gate and the cost summation.

- **Catalogue audit**: extracted every item from the mordheimer.net
  weapon/armour/equipment reference pages and diffed against the catalogue.
  After filtering out name-variants (Belaying Pins ↔ Belaying pin, etc.), 20
  genuine gaps remained — almost all from the Border Town Burning (1c)
  supplement (ladders, smoke bombs, wolfcloak, wyrdstone pendulum, and so on,
  plus Lamellar Armour). Added all 20 with their cost/rarity/warband
  restrictions, reusing the existing string-cost format for the dice-based
  prices ("20+4D6"). Catalogue went 224 → 244 items.

- **Completeness guard** (`test/catalogue-complete.mjs`): the reference pages
  are now checked in as fixtures, and the test fails if the catalogue ever
  drops below them — with a curated allow-list for intentional variants so it
  doesn't cry wolf.

- **Verification pass** against the live mordheimer.net Border Town Burning
  "Spoils of War" price chart (Jun 2026) caught four mistakes in the freshly
  added items before they were committed: Spider Spittle's dice cost
  (30+1D6 → 30+D6), Winter Furs' restriction wording, Wolfcloak's rarity
  (it's "Special", not a numbered Rare value) and warband list, and Trade
  Wagon — which turned out not to be a purchasable Trading Post item at all
  but a Merchant-Caravan vehicle rule, so it was removed and allow-listed in
  the completeness test. Catalogue settled at 243 items.

Test suite: 10 files, all green.

## July 17, 2026 — bug sweep + Fallen warriors

A round of in-play bug reports, fixed together.

Three bugs (two of them modularization regressions):
- The warband special-skill list showed up twice when a unit's own `sk` list
  already named the warband skill set — it got appended a second time via
  WBEXTRA. Now only appended if not already present.
- Adding a skill to a hero froze the UI: `advSection` called `skillText(sk, e)`
  with an undefined `e`, throwing a ReferenceError that aborted `render()`
  mid-pass, so nothing updated afterwards. Dropped the stray argument.
- The official-sheet PDF export silently did nothing: `loadSheetTemplate`
  assigned to `_sheetBytes`, which `pdf.js` had come to import from `app.js`
  as a read-only binding ("Assignment to constant variable"). Made
  `_sheetBytes` module-local to `pdf.js`. (Also cleaned a stale freebooters.org
  reference out of the PDF button tooltip.)

New feature — **Fallen warriors**: applying the Dead (11-15) serious injury now
moves the warrior out of the active warband into a collapsed "Fallen" section
instead of adding a text note. A fallen warrior no longer counts toward the
warband size, hero count, gold spent or rating, and is excluded from the PDF
and shareable-text exports. Their equipment stays visible as a read-only record.

The first cut flagged models in place (m.fallen); a follow-up reworked it to a
central `S.fallen` list (fallen units leave `S.models` entirely, so totals and
exports exclude them with no per-model filters). This also handles henchmen
correctly: a henchman death removes ONE model from the group (qty-1, the group
vanishes when the last model dies) rather than wiping the whole group. Fallen
henchmen are grouped in the UI by type, then by identical exp+equipment
(e.g. "3× Verminkin, total 15 XP" expanding to per-exp detail rows), while
being stored one-record-per-death so a single LIFO "Undo last death" button can
walk back through the history — restoring a hero, or returning a henchman to its
living group (recreating the group if it had been wiped). Deleting a fallen
record asks for confirmation when equipment would be lost with it. The whole
section and each entry are collapsed by default; `S.fallen` is part of the tool
JSON save, so the graveyard survives a reload.

Tests: `ui-bugs.mjs` and `fallen.mjs` added; suite now 12 files, all green.

## July 17, 2026 — Fallen polish + roster-order fix

Follow-up tweaks after playtesting the Fallen feature:

- **Confirmation logic flipped to match reversibility.** "Died" (killHero /
  killHench) no longer asks to confirm — it's undoable via the LIFO undo. The
  genuinely destructive action, the unit "remove" button, now asks for
  confirmation when the unit has equipment (there is no undo for it); "remove
  record" on a fallen entry keeps its confirmation too.
- **Fallen summaries aggregate equipment**, e.g. "3× Dagger" across the whole
  group rather than one model's worth, and the free (1st-gratis) dagger is
  marked "(free)" so it's clear no gold was lost on it.
- **Total gold lost** through the fallen is shown (unit cost + equipment; the
  free dagger counts as 0), both per type-group and in the section header.
- **Heroes are now grouped by type too**, like henchmen — but their detail
  table lists each hero individually by name (never merged), with a Name
  column instead of a count, since heroes are unique individuals even when two
  share a type. Henchmen still merge identical models by exp + equipment.
- The Fallen section now renders **even when no living warriors remain** (all
  dead) instead of showing the empty "no warriors recruited" state.
- **Name field falls back to the default.** Clearing a custom unit name now
  shows the unit's default type name (as the field placeholder) instead of a
  generic "Name" prompt.
- **Roster-order bug fixed.** The right-hand roster *summary* listed heroes and
  henchmen in recruitment order; it now follows the warband's unit-listing
  order (leader pinned first), matching the main roster and the PDF. So a Seer
  recruited before the Chieftain no longer sorts above it.

Tests extended (fallen hero grouping, aggregate/free-dagger/gold-lost, sidebar
order); suite 12/12.

## July 17, 2026 — Fallen grouping fix for promoted henchmen

A promoted henchman ("The Lad's Got Talent") is a Hero but keeps the uid_def of
the group it came from. The Fallen section grouped purely by unit type, so when
such a hero died it was lumped in with — and merged into — regular dead
henchmen of the same base type. Fixed by grouping first by grade (hero vs
henchman, taken from the death kind, which already respects promotion) and only
then by unit type. A promoted Verminkin who dies now shows in its own Hero
group (listed by name) rather than merging into the dead-Verminkin henchman
tally. Regression test added.

## July 17, 2026 — leader succession when the leader is slain

Implemented the Mordheim rule for a slain warband leader. Previously the
"a leader is required" validation kept firing after the Chieftain died, a new
one could be recruited, and succession just took the first hero.

Now, once the warband's leader unit (the req unit — Chieftain, Vampire,
Magister, Carnival Master, …) is in Fallen:
- the "<unit> is required" validation no longer applies (and the message names
  the unit rather than saying "a leader (X)"),
- recruiting a new one is blocked in both addUnit and the recruit picker (with
  an explanatory tooltip) — you may not hire a new leader,
- the eligible Hero with the highest Leadership takes command, ties broken by
  most Experience (a remaining D6 tie is left to manual choice via the existing
  leader radio). The successor already gains the Leader ability through the
  existing leaderUid()/isLeaderModel() path.

Warband-specific successions: Undead go specifically to the Necromancer, with a
"warband collapses" warning if none remains (a Vampire may be bought after the
next game); Possessed and Carnival show a reminder that the successor may learn
a spell/prayer instead of their first Advance roll.

Not yet done (flagged): granting the new leader access to the *leader's*
equipment list — that needs equipment-list merging and will be a separate,
careful change. Regression test `leader-death.mjs` added; suite 13/13.

## July 17, 2026 — replacement-leader house rule + Merchant Caravans

- **House rule "Allow hiring a replacement leader".** Off by default (standard
  Mordheim: you may not hire a new leader). When enabled, it lifts the block so
  the leader unit can be recruited again after the original is slain — both in
  addUnit and the recruit picker — and it's recorded as a deviation on export.
- **Merchant Caravans succession.** The existing logic already fit (only the
  Merchant is the req unit, so buying an Apprentice was never blocked), but the
  succession reminder is now warband-aware: if a model can take command it's
  noted to count as the Merchant and gain the Merchant special skills; if no
  model may lead (the Knight and Magician are hirelings that never can), the
  tool prompts to buy an Apprentice to take over — matching the rule that the
  Apprentice is the fallback leader, purchasable after the next game. Tests
  extended; suite 13/13.

## July 17, 2026 — playtest bug sweep (House Rules, TTS, advances, rare items)

Six issues found in play:

- **House Rules panel collapsed on every click.** The section-open flags
  (hrOpen/hsOpen/dpOpen/campOpen) were exported `let`s reassigned by inline
  `ontoggle` handlers — in the modular build those handlers run in a different
  scope than the module, so the write never reached the value `renderHouse`
  reads (the live-binding trap). Added a bound `setSecOpen(which,v)` that
  reassigns the module variable, and pointed all section toggles at it, so the
  open state now survives a re-render.
- **Price sliders too coarse.** The equipment/armour cost sliders stepped by 5
  and were hard to land on exactly. The slider is now step 1 and the % readout
  is an editable number field, so a precise value like 50% can simply be typed.
- **Rare items missing from the TTS export.** `eqDisplayParts` only covers
  regular gear, so standalone rare/magic items never reached the TTS card. Added
  `rareDisplayParts(m)` and appended it to the TTS equipment line.
- **TTS showed "Haggle: [object Object]".** `skillInfo` returns an object; the
  TTS card interpolated it directly. It now uses the skill's text field.
- **Chosen rare items hidden when the Rare/Trading Post section was collapsed.**
  A compact, always-visible "Rare / Trading Post: …" summary now sits above the
  collapsible section, next to the equipment list.
- **"Advance due!" stuck on.** The flag fired whenever XP sat on a threshold,
  even after the advance was applied (e.g. a Merchant Caravans Apprentice at 2
  XP with its advance taken). It now compares earned vs applied advances, the
  same measure the Advances & Stats panel already uses.

Regression test `tts-and-adv.mjs` added; suite 14/14.

## July 17, 2026 — save-format compatibility guarded by a test

Audited the recent changes (fallen list, rare items, new house rules) against
older save files, since exports are the user's data and must keep loading.

Result: all additions were already additive and defaulted — `applyState` fills
in a missing `fallen` list, `Object.assign(houseDefaults(), data.house)` fills
in house rules absent from the file, and the newer code paths tolerate models
without a `rare` field. Old JSON exports and old readable-text exports (the
embedded `MORDHEIM-DATA` block) both still import, and round trips preserve
everything.

To keep it that way, `test/compat.mjs` pins a frozen old-format save fixture and
asserts it loads, defaults fill in, round trips are lossless, and every legacy
key is still written. The rule (add keys, never rename or remove; every new key
needs a default) is documented in the README.

Known caveat, documented rather than fixed: a save containing fallen warriors
opened in a build from before that feature loads its living warriors correctly
but silently drops the fallen record. Suite 15/15.
