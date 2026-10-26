# History

Not a changelog — an account of how this thing actually grew, and why it looks
the way it does. Kept in the repo instead of scattered across chat logs,
because "why is it built this way" is usually more useful than "what changed".

## Why this exists

My group plays Mordheim on Tabletop Simulator. Mordheim is a game from 2000
whose rules survived through community effort: mordheimer.net keeps the
canonical compilation, two big FAQs patch the arguments, and half the useful
tooling is abandoned or predates the compiled rules. What I wanted didn't
exist: a roster tool that treats those community sources as strict authority
(with the FAQs overriding everything), tracks a whole campaign rather than a
single list — experience, injuries, deaths, gold that actually adds up — and
exports straight to the table: TTS description cards, the official PDF sheet,
a readable text that carries its own save. And because we're a group of
friends playing a twenty-year-old game, house rules had to be a feature, not
a fork: toggles that are off by default and get declared on export, never
silent edits to the rules data.

## How it's built (method)

This project is developed **with an AI assistant writing most of the code** —
worth stating plainly, because the interesting part is the working method
that makes that reliable rather than reckless. The division of labour: I own
the product decisions, the rules interpretation and the auditing; the
assistant implements, and nothing lands without verification. Concretely:

- **A fixed hierarchy of truth.** mordheimer.net first; the Ultimate FAQ and
  the FAQ from Toumas override it; the original rulebook fills the gaps. When
  a rule was ambiguous, we went to the source and read it — several entries
  below record cases where my own assumption (or the assistant's) lost the
  argument against the printed table.
- **Every fix arrives with its regression test.** The suite grew from 0 to 20
  files this way; each test is a bug that once existed and can never come
  back unnoticed. The build is verified too: a parity test proves the bundled
  single file behaves identically to the modular sources.
- **Changes are applied as anchored patches** — each edit asserts the exact
  code it expects to replace and refuses to run otherwise. On a codebase this
  size that discipline has repeatedly turned "silently patched the wrong
  place" into a loud, harmless error.
- **Session rhythm:** edit sources → syntax-check (`node --check`) → run the
  logic tests against a stubbed DOM → rebuild the single file → concise
  report. This file is the running record of those sessions, including the
  wrong turns — the reverted "fix", the accounting hole, the CSS that ended
  up red-on-red — because the wrong turns are where the understanding shows.

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

## July 17, 2026 — House Rules panel repaired and regrouped

The panel had drifted out of shape. Each rule row renders four items (enable
checkbox, label, control, value/hint) into a grid that only defined three
columns, so the fourth wrapped and every row looked shifted; the editable
percent field added with the slider fix then overflowed its 46px column and got
clipped.

Rebuilt the row grid with explicit columns, let hint text wrap onto its own line
under the label instead of being cut off, and gave the price rows a dedicated
layout where the value stays on the label line and the slider spans the full
width below it — so it is long enough to aim with (and an exact figure can still
be typed).

Also regrouped the rules by subject, since several sat in the wrong place:
"Warband composition" (gold, model and hero limits, ranged cap), "Leader &
advancement" (replacement leader, free skill choice), "Equipment costs",
"Equipment access" (list enforcement, free market, misc for henchmen, re-roll
limit), "Hired Swords" and "Display" (item rarity, previously filed under
Access).

`test/houserules-ui.mjs` guards it: every key in houseDefaults() must still be
rendered, rows must keep a complete structure, and the price rows must use the
wide slider layout. Suite 16/16.

## July 17, 2026 — campaign chronicle (foundation)

Groundwork for running a whole campaign in the tool rather than just holding the
current roster state.

The campaign now has a **stage** (0 = Setup, 1 = after the 1st battle, and so
on) and a **chronicle**: an event log in `S.campaign.log`, each entry stamped
with the stage current when it happened, so the campaign can be replayed in
order afterwards. The tool records automatically as you play — recruitment,
deaths, promotions, rare-item purchases, skills and stat advances — and entries
can also be written, corrected (they are then flagged as edited) or deleted by
hand. Nothing is recorded while the campaign layer is switched off, so ordinary
roster tinkering does not fill the log with noise.

**Battles** are stored in `S.campaign.battles`: several opponents per battle
(name plus warband), the map location, the outcome, and a free-text account of
how it went — the raw material for turning a campaign into a story later.

Additive and backward compatible: old saves without `round`/`log`/`battles` get
empty defaults on load (guarded by `compat.mjs` and `chronicle.mjs`).

Still open: the evaluation/narrative layer on top of this data, and sharing a
campaign between players. Worth recording for that second point — GitHub Pages
is static hosting with no server or database, so a shared live session is not
possible with Pages alone; the realistic options are exchanging export files
(works today), an external backend such as a Supabase free tier (costs the
offline-standalone property), or GitHub itself as storage (needs OAuth, as a
write token cannot safely live in a browser). The event log is required for all
three, which is why it was built first. Suite 17/17.

## July 17, 2026 — chronicle entry forms and a tidier campaign panel

Replaced the placeholder prompt() dialogs with proper forms, in the style of the
printed House-Rule notes rather than one-line prompts.

**Record battle** is now a form: one row per opponent with a free-text name and
a warband dropdown listing every warband, grouped by grade and alphabetical
within each group (leading articles ignored), exactly like the warband picker —
a select also gives type-ahead, so a warband can be found by typing. Opponents
can be added and removed; location and outcome are dropdowns; the account of the
battle is a large multi-line field, since that text is what the campaign story
will later be written from. The half-filled battle lives in a draft so it
survives the re-render each keystroke triggers.

**Chronicle entries** get the same treatment: a multi-line form instead of a
prompt.

**Locations** (the district list) now sit in their own collapsible section,
collapsed by default, so the campaign panel stays short.

Suite 17/17.

## July 17, 2026 — campaign file (several players in one document)

Fixed first: opening the note or battle form appeared to close the Campaign
section. The chronicle's `<details>` read its open state from a flag that
nothing ever wrote, so it collapsed on every re-render — and the form sits
inside it. The flag is now persisted from the chronicle's own toggle, and
opening a form forces the chronicle open so the form is visible immediately.

Then the campaign file itself: a document separate from any single warband,
holding several players' warbands, the battles and one shared chronicle.
Warband exports are taken into it and a warband already present is updated in
place, so re-importing after a game night refreshes that player rather than
duplicating them. It offers a campaign-wide history (each warband's own log
merged and ordered by stage, tagged with whose it is), both sides' accounts of
each battle kept as they were recorded, and per-warband tallies — warriors,
fallen, battles, victories, advances, items — as the basis for evaluation.

This is the file-exchange model rather than a live session, deliberately:
GitHub Pages is static hosting with no server or database, so one file passed
on after each game night keeps the tool offline-capable and free of accounts.
The alternative would be an external backend, which costs exactly that.

`test/campaign-file.mjs` added; suite 18/18.

## July 17, 2026 — casualties: who took out whom, and what became of them

Decided where a campaign phase is cut: **a phase is one battle together with
its post-battle sequence**, because purchases, hires and advances belong to the
aftermath of the game just played, not to the next one. So the cut falls at the
start of the next battle, which is also the natural point to sync rosters into
the campaign file — the roster is stable then rather than half-updated.

That has a direct consequence for recording kills. During a battle only two
things are known: who went out of action, and who put them there. Whether that
means death, a lasting injury or a full recovery is decided by the injury roll
afterwards. Casualty records therefore have two stages: they are written as
`pending` during the game and resolved later.

Applying the injury roll to one of our own warriors resolves the existing
record instead of creating a second one, retypes its chronicle entry (an
out-of-action becomes a death or a wound, and reads accordingly), and a death
is tied to its entry in the Fallen section — so casualty, roster and Fallen can
be cross-referenced. Either side of a casualty may be one of our own models,
picked from the roster (which is what makes the link possible), or a named
enemy with their warband. Tallies count what each warrior dealt out (out of
actions, kills) and suffered (out of actions, injuries, deaths).

`test/casualties.mjs` added; suite 19/19.

## July 17, 2026 — making the record answer the two questions asked of it

Checked what the chronicle could actually deliver against the two goals — a
written account good enough to be turned into a story, and real per-character
analysis — and found the record too thin for the second. Three gaps, now closed.

**No stable identity on events.** Every event carried only the unit *type*, so
two Black Skaven were indistinguishable and a renamed warrior could not be
followed. Recruitment, advances, skills, promotions, items and deaths now carry
the model id and name.

**No rank or worth on casualties.** "How many heroes did he kill" and "how much
enemy gold did he destroy" were unanswerable. Both sides of a casualty now carry
grade and gold worth — filled in from the roster for our own models, entered by
hand for enemies.

**No experience history.** Only the current value existed, so no progression
could be shown. Each stage is now snapshotted as it closes (experience,
advances, skills, worth per warrior), which gives curves cheaply without
logging every single point.

On top of that: `characterTimeline()` gives one warrior's whole story (joined,
fate, kills split by grade, gold destroyed, injuries, experience curve, every
event in order), `campaignAnalysis()` the campaign-wide figures, and
`narrativeReport()` a stage-by-stage written account — the battles with the
player's own words, casualties naming both sides, advances, and a closing roll
of the warriors with their fates. Both are exportable, the account as markdown
and the figures as JSON.

Two bugs surfaced while testing it end to end: battles were filed one stage late
(a leftover from when a stage meant "after battle N" — a phase is the battle
plus its aftermath, so the battle belongs to the current stage), and a warrior
killed through a resolved casualty had no recorded moment of death, because that
entry is keyed by casualty rather than by warrior.

`test/analysis.mjs` added; suite 20/20.

## July 17, 2026 — experience earned from casualties, and snapshot diffing

Reworked the analysis around a better idea: the difference between two stage
snapshots *is* the analysis. Trying to log every meaning separately as it
happened was the wrong approach — a warrior present at one stage and dead at
the next fell in that battle; whose characteristic is higher gained it then.

Snapshots are therefore comprehensive now: per warrior the experience, each
characteristic advance, skills, spells, injuries, equipment, rare items, count
and worth — and the fallen are kept in the snapshot too, marked dead, so a
warrior who is gone can be told apart from one who was never there.
`diffStages(a,b)` derives who joined, who fell, who left, and per warrior what
changed (experience gained, which characteristic went up, which skill or spell
was learned, what was bought). `foundingMembers()` answers who was there from
the outset.

Experience is now earned rather than typed in. Per the rules (checked against
mordheimer.net): a Hero earns +1 for each enemy put out of action, every Hero
and Henchman group earns +1 for surviving, and the leader of the winning
warband earns +1. Only Heroes earn the per-enemy point — henchmen earn as a
group by surviving. Scenarios vary the amounts (Mordheim's Burning grants +5 for
surviving), so they are arguments rather than constants. NPCs count as enemies
where the scenario treats them so, which the Necromancer's Tower does
explicitly for its Zombies.

Attributing a casualty to one of our Heroes therefore feeds an experience
ledger, which holds the points rather than writing them straight onto the
roster: the whole battle can be tallied and then applied with one button, and
the reason each point was earned is kept. That also keeps the casualty record
doing what it is for — attribution of who inflicted what on whom — while the
consequences are derived from it.

`test/experience.mjs` added; suite 21/21.

## July 17, 2026 — the snapshot is the whole warband state

Adopted a better idea than the hand-picked field list: the warband export
already contains everything there is, so that is what a stage snapshot should
be. No guessing in advance which fields an analysis might later want.

One cut is necessary, and it is not obvious. The export contains `S.campaign`,
which contains the snapshots — so a naive full copy nests every earlier snapshot
inside each new one. Measured before building it: exactly 2x per stage, turning
a 2.8 KB warband into 710 KB by stage 8 and roughly 90 MB by stage 15. The
campaign RECORDS (chronicle, battles, casualties, experience ledger, snapshots)
are therefore left out — they live centrally and only once. Growth is now linear:
31.5 KB after fifteen stages.

The districts stay in, so who held what at which stage is answerable
(`districtsAt`). Computed totals — rating, gold, warband size, fallen — are
stored as they stood rather than recomputed later: if the data files change
(an FAQ re-costs a unit), recomputing would silently rewrite history
(`totalsAt`). Transient interface state (open panels, half-filled forms) is
stripped out.

`snapRows()` reads both the new full-state snapshots and the earlier flat ones,
so campaign files written before this keep working. Everything else —
`diffStages`, character timelines, the narrative — reads through it.

`test/snapshots.mjs` added; suite 22/22.

## July 18, 2026 — defaults, the campaign table, export names, and the TTS fields

A batch of small things, each of which was a papercut in play.

**Names default instead of staying blank.** A new warband is named after its
type (so an export reads "Arabian Tomb Raiders", not "warband"), and a player
imported into a campaign file without a name is numbered rather than left as an
indistinguishable blank cell.

**The campaign table shows the warband rating**, taken from the latest stored
snapshot totals rather than recomputed — recomputing would need that warband's
full state loaded and would drift if the data files change later.

**Export file names carry the campaign stage and the date**
(`Klaue_Skaven_battle1_2026-07-18`), so a folder of exports from several game
nights can be told apart at a glance. Applies to the roster, the readable text,
the New Recruit file, the campaign export, the chronicle and the analysis.

**The TTS export gained a name field**, separate from the description, since
the two go into different boxes in TTS. Heroes (and Hired Swords and Dramatis
Personae) get a darker gold than the rank and file, so the notable models stand
out on the tabletop. The dialog now shows both fields labelled with what they
are for, each with its own copy button, plus a copy-both.

**The stat line gained Sv.** The value was already there for the PDF sheet
(`svOfModel` in engine.js): the permanent save from armour and skills,
deliberately excluding shields and bucklers, which depend on what is being
carried at the time. Heavy armour with helmet and shield therefore reads Sv 5+,
not 4+.

`test/naming-and-tts.mjs` added; suite 23/23.

## July 18, 2026 — gold that drifts: the henchman experience surcharge

The first bug found by *playing* rather than by testing: a warband's gold in
hand crept into the red as its henchmen gained experience — and nudging the
gold field by hand put it back. Classic sign of two accounting models
fighting each other.

The rule at fault (mordheimer, Trading): recruiting into an experienced
henchman group costs 2 gc per experience point the recruit adds to the
warband's total — veterans are hard to find, raw recruits are not. The first
implementation folded that surcharge into `modelUnitCost`, which *repriced
every man already in the group* each time the group earned experience. Since
gold in hand is the treasury less what the warband owns, five Verminkin
picking up 4 XP each silently pushed the gold 40 gc into the red; editing the
gold figure re-synced the treasury and hid the evidence.

The fix is conceptual, not cosmetic: the surcharge is the price of taking
*another* man on, not a revaluation of men already serving. It is now charged
once, at the moment the group grows, and recorded on the group as `xpPaid` —
never re-derived from current experience. An earlier variant of the same
disease was found in the Fallen accounting (a loss figure derived on read but
never balanced on write) and fixed the same way: record the value once, at
the moment it changes hands.

Also in this pass: the ability scanner's fuzzy regexes were claiming skill
names they had no business with (the Shooting skill "Nimble" showed a
monkey's special rule). Exact names in the curated lists now win over fuzzy
matches. `test/costs-and-tooltips.mjs` pins all of it; suite 19/19.

## July 19, 2026 — bookkeeping sweep on master

A list of in-play findings, all in the money-and-roster layer, fixed together
because they share one principle: **experience is not gold, and death is not
income.**

- **Fallen losses show real gold only.** The "gc lost" figure is recomputed
  from the death snapshot — the man, his gear, any recruit surcharge actually
  paid for him — never a revaluation of his experience (records written by
  older versions displayed the inflated figure). Lost experience is reported
  separately, and only the part *earned in play*: a leader who starts at 20 XP
  and dies at 23 lost 3 XP, not 23.
- **The surcharge dies with the last man.** When a henchman group emptied,
  its `xpPaid` vanished from the books and gold in hand *rose* — the tool was
  refunding the veteran premium at the funeral. The remaining surcharge now
  leaves with the last casualty (settled against the treasury), and the LIFO
  undo brings it back. A test asserts that no death, and no undo, ever moves
  gold in hand.
- **Saved gold is adopted verbatim.** Every export now carries `goldNow`, the
  figure as displayed when saving; import sets it directly instead of
  re-deriving it from the imported models — so a data or price change between
  versions can never shift a saved warband's money. (We trust the importer's
  file; we're friends.)
- **The roster sidebar tells the truth about ranks.** A Lad's-Got-Talent
  promotion now files under Heroes as "Hero Verminkin" instead of hiding in
  the henchman tally, and vehicles get their own section — in the sidebar and
  the readable text export alike (the PDF was already correct). Vehicles also stopped adding +5 to the Warband Rating: a wagon is
  equipment, not a warrior.
- **Assorted honesty in the UI:** the Rare/Trading-Post section no longer
  snaps shut on every change (its open state was never remembered), the
  promote button and chosen skill-category chips are no longer dark-red text
  on a dark-red ground, henchman subtotals show the group's veteran value
  with a tooltip explaining that gold still counts what was paid, and the
  last German strings left the UI (the project language is English).

`test/master-fixes.mjs` added; suite 20/20.

## July 20, 2026 — injuries that act, and a second number for the warband

Two things a paper roster quietly relies on the player to get right, now done
by the tool.

**Serious injuries with consequences actually execute them.** Until now,
"Robbed" was a text chip — and the natural next step, unticking the stolen
equipment, *refunded its price*, because removing gear normally returns its
cost to hand. Robbery-by-checkbox was profitable. The fix is a settled strip:
the gear goes AND the same amount leaves the treasury in the same breath, so
gold in hand doesn't move a single coin. On that foundation, the acting
results of the injury chart (verified against mordheimer's Campaigns page)
now play out when applied: **Robbed** takes everything; **Sold to the Pits**
asks how the pit fight went — a win pays 50 gc and +2 XP, a loss strips
weapons and armour only (miscellaneous gear survives, per the actual rule)
and reminds you to roll 11–35 separately; **Captured** offers ransom (paid
from the treasury), exchange, or the settled one-way trip to the Fallen;
**Deep Wound** asks for the D3 and books the missed games; **Survives Against
the Odds** grants its +1 XP instead of just saying it would.

**Warband Worth.** The official Rating counts heads and experience — by
design it ignores equipment entirely, so a naked warband and a
gromril-armoured one can rate identically. The sidebar now shows a second
figure alongside it: everything the warband is worth in gold. Warriors with
all their gear and rare items (henchmen at veteran value, 2 gc per XP earned
in play, per model), the investment in Hired Swords and Dramatis Personae,
plus gold in hand; wyrdstone excluded, since its sale price depends on when
you sell. The pleasing property that makes it trustworthy — and testable:
buying equipment doesn't change Worth. The gold simply turns into gear.
Vehicles, worthless to the Rating, are of course worth their price here.

Tests extended for every injury path (each asserted gold-neutral or
correctly priced) and for Worth's conservation property; suite 20/20.

Also cut in this commit: the **Newrecruit/BattleScribe JSON export**. It was
always best-effort — the schema fit, but Newrecruit.eu's importer expects its
internal per-warband catalogue IDs, so a direct import was never guaranteed —
and an export that *might* work is a support question waiting to happen. The
tool now offers exactly two formats, both fully owned: the tool's own JSON
and the readable text (which embeds that JSON anyway). Less surface, no
half-promises.

## July 20, 2026 — Worth, second draft: from wealth to market value

The first cut of Warband Worth summed *paid* prices plus gold in hand — a
wealth figure with a pleasing conservation property (buying gear didn't move
it, gold merely changed form). Then the actual question it exists to answer
was put more sharply: **is this matchup fair?** Two warbands of equal Rating
can differ wildly in equipment, and that is the false impression the figure
should correct. Against that goal the first draft had two flaws. Paid prices:
a found sword, or a Kislevite heirloom at half price, cuts exactly as well as
one bought at list — what was paid is history, not strength. And gold in
hand: coins don't fight, so counting them let a rich naked warband look equal
to a poor equipped one — the Rating problem reproduced in a new number.

Worth is now the **market value of the fielded force**: every warrior with
all his gear, rare items and mutations at list prices (the free founding
dagger counts as a dagger, the heirloom discount is ignored, dice-priced
items like "25+2D6" count at their expected value; only upgrade-style prices
that depend on their host weapon fall back to what was paid), henchmen with
their veteran premium, Hired Swords and Dramatis Personae included, cash and
wyrdstone excluded. The conservation property flipped into the honest
version: buying a sword now *raises* Worth by the sword's list price, and
editing the gold figure doesn't move it at all — both pinned by tests.

A definition changing one day after shipping is the method working as
intended: the number existed, the group looked at it, the mismatch between
"what it measures" and "what we ask it" surfaced immediately, and the fix is
a paragraph of rationale plus a test that encodes the new meaning.

## July 20, 2026 — Worth, third draft: hands, steps, and veterans

Playgroup feedback sharpened the metric twice more, both times in the same
direction: measure *fielded power*, not inventory.

**Hands, not backpacks.** A warrior carrying a zweihander, two swords and a
spare axe was priced as if he swung all four at once. Now only the active
loadout counts fully — two one-handed melee weapons or one two-handed
(whichever combination is worth more), plus one missile weapon — and every
further weapon counts half: it is a genuine option he can switch to each
combat round, but never wielded simultaneously. Handedness isn't hardcoded;
it is read from the same rules text the tooltips show, so a weapon added to
the catalogue tomorrow sorts itself. A nice side effect: the free founding
dagger, being cheap, naturally lands in the half-counted backup pool — which
is exactly what a backup dagger is.

**Experience for everyone, steps on top.** The veteran premium (2 gc per XP
earned in play) had only been applied to henchmen, because only they have an
official market price. Heroes now borrow the same rate — and on top, every
advance *milestone* reached adds a small fixed bonus (5 gc, a named constant,
tunable). The reasoning is worth recording: the 2 gc rate already averages
advances in (a henchman group at 9 XP costs 18 gc extra and owns three
advances), so a large bonus would double-count; but power genuinely arrives
in steps, and a hero one XP past a threshold should visibly outweigh one a
point short. The bonus is deliberately modest for exactly that reason.
Hired Swords count their experience the same way; Dramatis Personae are
fixed and don't.

Known, accepted gaps — recorded so they're decisions rather than oversights:
serious injuries don't subtract yet (a hero at −1 Toughness is worth less
than his gear says), all advances are priced equally (a spell is not +1 Ld),
Hired-Sword equipment still counts at what was paid, duplicate armour isn't
deduplicated, and the Gunnery School's brace discount is ignored in Worth —
two pistols are two pistols, power-wise. Injuries-as-negatives is the most
likely next refinement.

Tests pin the new behaviour: a third sword adds exactly half its price, the
dual-wield-vs-zweihander choice picks the better pair, one missile weapon is
active, and crossing a milestone is worth the XP point plus the bonus while
starting experience stays free. Suite 20/20.

## July 20, 2026 — Worth, fourth draft: points, outcomes, and half a shield

Three more turns of the same crank, all from playgroup review of the third
draft.

**Points, not gold.** Worth prices things in terms of market gold but
measures fielded power — so it is now a unitless points figure like the
Rating, not a gc amount. Small change, honest label.

**Outcomes, not progress.** The exp-plus-milestone pricing was replaced
wholesale: advancement now counts by what actually landed on the profile.
Each applied stat advance is +5 points; each acquired skill or spell +10 —
hero privileges, chosen rather than rolled and never wasted on a capped
stat, hence double weight; each stat point lost to a serious injury is −5,
which quietly closes the biggest gap flagged in the last entry (a hero at −1
Toughness is finally worth less than his gear says). Raw experience dropped
out entirely: it is progress toward power, not power, and pricing both the
XP and its outcomes double-counts. Deliberately coarse on purpose — Ld on a
close-combat brute is still a stat; chasing battle-situational precision was
explicitly not the goal. A henchman group advance multiplies by group size
on its own, since Worth is per model × qty: +1 S for three swordsmen is
three improved warriors.

**Half a shield, whole a horse.** Shields and bucklers joined the hand-slot
logic — with the lowest carry priority. The first cut counted them flat half;
review immediately produced the counter-example: a warrior with only a dagger
*has* a free arm, and the shield on it is no backup. So weapons claim the two
hand slots first (best pair or zweihander, as before), and only if a hand
remains free does the most expensive shield slot in at full value — dagger +
shield full, dagger + sword + shield half, zweihander + shield half, and
never more than one shield on an arm. Shields deliberately bypass the price
ordering: a warrior does not leave his sword sheathed because his shield cost
more. Mounts and vehicles count at full price:
their abilities are what the listing price buys. And the rounding question
got the obvious answer: everything sums unrounded (backup weapons and
shields carry exact halves) and one single round happens at the very end —
per-item rounding would compound.

Tests: dagger-plus-two-swords counts 21 not 22, the shield slot logic is
pinned case by case (dagger+shield full, sword pair+shield half, zweihander
half, one arm only), outcome pricing (±5/10/10) is pinned including the
injury-cancels-advance case, a group advance pays per man, a mount found
dynamically in the warband data counts full, the wagon is worth its 180, and
Worth is always a whole number produced by a single final round. Suite 20/20.

## July 20, 2026 — the wagon that was a Large Creature

A one-line bug report from the printed sheet — "Large Creature (1): 20" on a
warband whose only oversized possession is a cart — that unravelled into
three fixes, a nice illustration of why bug reports deserve a look past the
symptom.

The sheet counted Large creatures by text-matching /large/i against each
unit's rules blurb. That caught the Trade Wagon (whose rules discuss it as a
Large *target*) — and, on inspection, also the Ogre Maneaters' Youngblood and
Half-grown, whose rules say, verbatim, "is NOT a Large Target". Text-matching
a rules paragraph for a boolean is asking for exactly this. The count now
uses the same `def.large` flag the rating engine has always used
(`totalLarge()`), so the sheet and the rating can never disagree again.

While in there, the sheet's arithmetic got reconciled with the rulebook.
Mordheimer, Warband Rating: rating is warriors ×5 plus experience, and
"Large creatures such as Rat Ogres are worth 20 points" — worth 20 *instead
of* 5, which the engine already implemented. But the sheet printed ALL
members ×5 and then Large ×20 on top, so its line items summed to 5 more per
Large creature than the printed total. The members line now excludes Large
creatures; the breakdown adds up to the rating again.

Tests pin all three: the wagon and the not-Large youths count zero, a
genuinely flagged Large creature counts per model, and Large rates 20 flat.
Suite 20/20.

## July 20, 2026 — reading the word "NOT"

Same day, same bug family, one layer up. The Ogre Maneaters' Half-grown was
still being shown as a Large Target — this time not by the PDF but by the
ability scanner, the thing that reads each unit's free rules text and offers
keyword chips for the terms it finds. The unit's rules say, in full: "Causes
Fear but is NOT a Large Target." The scanner matched the words and ignored
the sentence.

The fix is a general one rather than another special case — and the state of
the code argued for it: the Hired-Sword scanner had already accumulated
hand-patched exceptions ("not a wizard", "immune to fear"), which is what a
missing rule looks like when you keep treating its symptoms. Rules text is
now split into clauses and a keyword only counts if at least one clause
mentioning it does not deny it. Three details decide whether this helps or
hurts:

* **Contrast conjunctions split.** "Causes Fear but is NOT a Large Target"
  must keep Fear and drop Large Target. Splitting on "but", "however",
  "although" and friends is what makes that possible; naive per-sentence
  handling would have dropped both.
* **Dashes split.** The Clan Skryre Rat Ogre reads "Not truly alive - immune
  to psychology". Without treating the dash as a boundary, the denial in the
  first half would have suppressed a rule the model genuinely has — the fix
  would have introduced a worse bug than the one it repaired.
* **"never" is not a denial.** The Gigantic Spider "never gains experience
  (animal)" — it *is* an Animal. Only "not" and "n't" count. Likewise
  "immune to X" is a rule *about* X worth showing, not a claim that X is
  absent, so immunity chips survive.

Measured against the full data set before shipping: 21 chips removed out of
689, 668 untouched. Every removal was inspected by hand. The list is
satisfying — the Orc Nuttaz who "does not suffer Animosity", the Chaos Dwarf
Informer "not subject to Hard Head, Hard to Kill", the Night Goblin Fanatic
"not affected by Animosity or Hate Stunties", and Aksho'akhash, who is
pointedly "NOT immune to psychology" and was being advertised as immune.

One removal came from a bug nobody was looking for. The Foole lost "Immune
to Poison" — because two of the 178 keyword patterns use a wildcard
(`immune.*poison`), and his text contains "immune to all Psychology tests"
in one sentence and "Poison Ring" — an *attack* — in another. The wildcard
happily spanned them. Clause splitting kills that class of match as a side
effect: a pattern that only matches across a sentence boundary now matches
nothing. Six genuinely poison-immune characters kept their chip.

Tests pin all of it, including the two cases where the fix could have gone
wrong: the but-clause pair and the dash clause. Suite 20/20.

## September 27, 2026 — a server, a concept, and not a line of code

The trigger was a small discovery. "Save" and the welcome screen's
"Continue" call `window.storage` — an interface that only exists inside
claude.ai artifacts. On GitHub Pages it is simply absent, so saving has
quietly failed there all along ("Could not save – use Export instead"), and
the Continue block never appears. The campaign file carried a comment saying
a shared live session was impossible because Pages only serves static files.
Both limits disappear with a server, and the Raspberry Pi in the cupboard
already runs Jellyfin, TeamSpeak and the chronicle agents.

What started as "save warbands on the Pi" grew, over one long conversation,
into a plan for a shared campaign companion whose real purpose is to collect
material for the bilingual campaign epic: a tagged state of every warband
after every battle, an automatic diff between those states reconciled against
the event log, notes from every player (sealable before a battle), the
player's own explanation for each change, a timeline that can be reordered by
story time, and a hidden background layer for the campaign leader — hidden
narrative only, never hidden mechanics, because the leader is also a player.

This entry records a phase with no code on purpose. The plan is written down
in `docs/` — concept, architecture, data model, security, operations, UI,
glossary, roadmap and fourteen ADRs — because development will increasingly
run through Claude Code on the Pi, and an agent that doesn't know *why*
something is built a certain way will eventually "fix" it.

Turns worth remembering:

* **Svelte, then React.** Svelte looked right: smallest runtime, closest to
  plain HTML. It lost on the criterion that matters most here — fewest
  mistakes in agent-written code. Svelte 5 changed its syntax fundamentally;
  React's patterns have been stable for years and come with lint rules that
  catch its typical errors. The performance difference is invisible for a
  roster of a few hundred elements, and a PWA caches the runtime anyway.
* **Watchtower is not a deploy tool for this.** It runs weekly and ignores
  locally built images; more importantly, a stateful app with migrations
  should never update unattended. Deploys are a script: backup, pull,
  health check, automatic rollback.
* **"Roter Faden" had to be renamed.** The chronicle repo already has a public
  `notes/roter-faden.md`. Checking also confirmed that both repositories are
  public — which turned "hidden data never leaves the server" from a nice
  principle into a hard rule with a CI leak test.
* **The escaping problem mostly dissolved.** The legacy app builds HTML from
  strings and would have needed an audit before sharing data between users.
  The React rewrite escapes by default and has no inline handlers, so a
  strict Content Security Policy is possible from day one.
* **Redundancy became fault tolerance.** No second server; instead an app
  that works offline, a server "epoch" that makes devices re-offer anything
  written after the last backup, an amd64 image so the desktop can stand in,
  and a cloned SD card.

Next is phase 1: pulling the logic out of `js/app.js` into a shared `core/`,
guarded by the existing tests and a parity check across all 49 warbands.

## September 27, 2026 — phase 1 begins: every rule, computed twice

The first code of the new platform is not new behaviour but old behaviour,
moved. `core/` is a TypeScript workspace with no DOM, no Node APIs and no
globals; its first slice is everything `engine.js` computes — costs, gold,
rating, Worth, armour saves — plus what it reached back into `app.js` for:
Hired Swords and Dramatis Personae, district price effects, the catalogue
rule.

The decision that shaped the work: **the legacy app is not rewired onto
core.** It stays exactly as it is, live, until the new builder replaces it.
Core is proven against it instead. A generator builds warbands for all 49
warband types, every subtype and three house-rule presets — random but
seeded equipment, mutations, rare items (eligible or not), injuries,
promotions, hired swords with options and personas, campaign footholds — 348
of them. For each, the legacy functions (loaded in Node with DOM stubs) and
the core functions answer the same questions, and the answers must be
identical, down to the unrounded halves of Worth.

They were, on the first run, except for a test bug: two units (the Plague
Cart and the Trade Wagon) have `profile: null`, which the test had assumed
away. Passing on the first try is exactly when a test deserves suspicion, so
three bugs were planted in core by hand — a henchman surcharge of 3 instead
of 2, an off-by-one in the shield slot, a Hired Sword rule that ignores
alignment. The suite caught all three (288, 290 and 54 failing warbands).
A coverage test now fixes minimums for every priced feature the fixtures
exercise, so a future generator change cannot make parity vacuous.

Two smaller guards: `createGameData` deep-freezes the data, and a purity test
runs the rules on frozen warbands — any write throws. ESLint forbids `window`,
`document`, Node imports, `Math.random` and `Date.now` in `core/src`.

TypeScript 7 (the native port) was out, but typescript-eslint supports only
up to 6.0, so the workspace pins TypeScript 6.0.

## September 27, 2026 — actions, and two ids that must never come back

The second slice ports roster building: recruiting, equipment, rare items,
mutations, gold and stash, subtypes, districts, Hired Swords and Dramatis
Personae, house rules. In core every action takes a state and returns a new
one. Immer settles open decision C: inside a recipe the code writes the draft
exactly as the legacy app wrote its global `S`, so a port stays line for line
comparable, and the result is immutable anyway.

Parity for actions is a random walk. The same seeded sequence of 80 actions
runs through the legacy functions (which mutate `S` and re-render) and through
core, from a fresh roster of every warband type — with and without the
campaign switched on — and from generated states; after every single step the
two must agree. Two lessons from making that comparison fair:

* **Legacy normalised its state while drawing it.** Rendering filled in
  missing house-rule defaults, created the campaign lists, and even rewrote a
  Dramatis Personae's persona if the chosen one was not allowed for the
  warband. Whether that had happened depended on what was on screen. Core
  does it explicitly in `normalizeState`, and the comparison normalises both
  sides.
* **A removed warrior's uid came back.** Legacy kept a counter in the running
  page, so within a session it never reused a uid; core, computing
  "highest uid + 1", handed out the uid of a warrior just removed. With
  versions and diffs keyed on `uid`, a reused uid would silently graft one
  warrior's history onto another. The state now remembers its counters
  (`uidSeq`, and `campaign.logSeq` for chronicle ids), set on load.

The walk is checked for its own coverage — each action must actually change a
state at least 15 times — after a planted bug (a repeated rare item counting
double) slipped through the first version of the walk unnoticed, because the
walk almost never bought the same rare item twice.

## September 27, 2026 — the walk finds two bugs in the live app

The third slice ports advancement: profiles and racial maxima, experience,
stat advances, skills and spells, the Marauder marks, promotions, individual
henchman names, the leader, and the same for Hired Swords. The walk grew to
seventy actions, and two of its findings were not porting mistakes but bugs
in the app the group is using today:

* **The promotion entry could name the wrong warrior.** Its uid was read off
  whichever model was last in the roster — right in the common cases, wrong
  when a lone henchman further up was promoted in place while another
  promoted Hero stood at the end.
* **A promoted Hero shared objects with the group he left.** Injuries and
  spells were copied shallowly, so lowering the Hero's spell difficulty
  lowered the group's too, until the next reload.

Both are fixed in the legacy app as well, each with a regression test that
fails on the old code. `docs/behaviour-changes.md` now registers every
difference between core and the legacy app, and is where Rob's wishes for the
new builder go — to be built one at a time once the port is complete, so the
parity net stays clean until then.

The walk had become slow — nearly all of its time is the legacy app
re-rendering its whole page after every action. It now runs from four files
in parallel, and its coverage is checked by replaying the same walks with
core alone, which takes two seconds.

## September 27, 2026 — the dead, and the questions the app used to ask

The fourth slice ports what happens to warriors after a fight: the whole
Serious Injuries chart, deaths and the Fallen list with its undo, the
casualty records a battle leaves behind and the dice rolled for them, and
experience held until it is applied. These are one knot rather than three
features: a death moves the warrior into the Fallen *and* settles the
casualty record of the battle he fell in, and resolving a casualty's roll
applies it to the roster exactly as the unit card would. So they were ported
together.

The legacy app asked questions in the middle of these actions — was he
robbed, did he win the pit fight, is the captive coming back and for how
much, what did the D3 say. Core cannot open a dialog, so the answers became
arguments, with defaults that match what the legacy app did when it could not
ask. The parity walk answers them at random on the legacy side and passes the
same answers to core.

Random walks are good at reaching common paths and poor at the ones that need
a particular roster: a Kislev heirloom lost in a pit fight only shows if the
captain carries one. A second suite now applies every result of the chart,
with every answer, to prepared warbands (heirloom, Gromril weapon, Dark Elf
venom, a named man in the middle of his group), and every casualty roll on
either table. Planted bugs in the gear-stripping rules went unnoticed by the
walk and were caught there. The walk also compares what the read-only rules
say about the Fallen and the casualties after every step, since the generated
fixtures hold none of them.

Porting turned up one more bug in the live app: after loading a save, a new
recruit could get the uid of a fallen warrior, and undoing that death then
put two models with the same uid on the roster. The loader now counts the
Fallen too, with a regression test. Two further inconsistencies are only
written down as proposals, because what to do about them is Rob's call:
rolling an injury from the casualty list skips what five results do on the
unit card (Deep Wound, Robbed, Captured, the pits, Survives Against the
Odds), and casualty records point at the Fallen by position, which breaks
when one is deleted.

## September 27, 2026 — a warband's campaign, and what "looking" used to write

The fifth slice ports a warband's own side of the campaign: the chronicle,
closing a stage (sit-outs served, the warband snapshotted, the round moved
on), battles, footholds, the post-battle checklist with its wyrdstone sale,
the comparison of two stages and the per-warrior analysis the chronicle text
is written from. The shared campaign file — several warbands, the battle
form that records a fight between them, control of districts — comes next,
because it is a second document with its own state, not part of a warband.

Two things the legacy app did in passing had to be named. Its panels create
an empty post-battle entry for the current round, and an empty snapshot
list, simply by being looked at; core does not, and the parity comparison
treats an untouched entry as absent. And a snapshot is stamped with the
date: legacy read the clock, core takes the date as an argument, since core
never reads a clock. The walk compares snapshots as whole earlier states,
in the same canonical form as the live one.

For once the port found nothing wrong. Every planted bug in the new code
was caught by the walk — the one that was not turned out to change nothing
at all.

## September 27, 2026 — the campaign file becomes a value

The sixth slice ports the campaign file — the document one player collects
everybody's warbands into and passes on after a game night — together with
control of districts across all warbands and the forms that record a battle
or a casualty. In the legacy app the open file sat in a module variable and
the half-filled forms lived inside the save, so importing campaign data
quietly threw away a form in progress. In core both are values the interface
holds and hands in; an action that touches a warband and the file at once (a
battle moves footholds for every side) returns both.

These got a walk of their own over three things at once — the warband, the
file and the open forms — with ordinary roster actions mixed in, comparing
all three and what the territory, statistics and merged history say after
every step. The first round of planted bugs showed its limits: half of them
sat in branches a random walk hardly ever reaches (a warband re-imported
under a differently cased name, a battle both sides wrote down with the
sides in another order, a casualty naming the third side when the first is
removed). Seven short scenarios now cover those; afterwards every planted
bug was caught except one that, on inspection, cannot change any result.

## September 27, 2026 — the exports, and a PDF drawn twice

The seventh slice ports everything that leaves the builder as text or
paper: the readable roster that ends in its own save, the Tabletop Simulator
cards, the chronicle written out for the campaign story, the district
report, file names, the English rule and equipment texts behind all of them,
and the official roster sheet.

The sheet was the interesting one to test. It is drawn onto the
freebooters.org template with pdf-lib, and two PDFs are never byte-for-byte
equal (they carry the time they were made). So both implementations are
handed the same stand-in for pdf-lib that writes down every text and box it
is asked to draw, with its page, position, size and font, and the two lists
must match. One more test fills the real template with the real library, to
know core works with what it will be given. Core itself imports neither: the
library and the template are passed in, as the architecture document said
they would be.

The planted bugs were all caught once the sheet test also printed warbands
hired in reverse order — the sheet sorts warriors by the warband's own list
(a Chieftain before a Seer hired earlier), and generated warbands happen to
be built in that order already.

## September 27, 2026 — every old file still loads, and phase 1b's port is complete

The eighth slice ports loading and writing saves, which finishes moving the
legacy app's logic into core. The legacy loader is a list of defaults — an
empty Fallen list for files from before it existed, house rules filled in
from the defaults, the gold in hand adopted exactly as the file states it —
and core's loader is the same list, checked against the legacy app on every
generated warband, on its exports, on the frozen old save that
test/compat.mjs pins, and on copies with keys torn out at random.

Saves now carry a format number (a file without one is format 0, written
by the legacy app) and the version of the app that wrote them. The Zod
schemas the architecture called for describe the format, but loading does
not refuse a file that departs from them: saves are the players' data, the
legacy app never refused one, and a schema written today cannot know every
file written in July. Departures come back as notes; only a file that
cannot be a warband of a known type is turned away. The server will hold
what it stores to the same schemas.

One thing surfaced in the round trip: a treasury still at "starting gold"
comes back from a save as that amount in coins, because loading adopts the
gold in hand the file states. The legacy app does the same, and the value
does not change — only a later change to the starting-gold house rule would
no longer move it, which is arguably right for a warband already in play.

## September 27, 2026 — what changed, and why

With the port done, phase 1c adds the first logic the legacy app never had:
comparing two marked states of a warband, and matching every change with its
cause. The comparison works on the warriors' fixed ids and finds everything
— recruits, deaths, promotions, experience, characteristics, skills, spells,
injuries, gear, hires, districts, house rules, totals — however it came
about. The matching then looks for the event or battle record behind each
change. A characteristic that rose by two needs two advances; a group that
shrank is explained by its dead and its promoted; buying gear or hiring a
sword needs no cause at all, because it is the player's free choice. What
has no cause is marked for everyone to see and blocks nothing.

Each change gets a key made from its content, never its position, so a
player's explanation stays on the right change when a marked state is
corrected later. The briefing for a battle is built from all of it: who
fought, the protocol and notes, the aftermath and advances per warband with
the players' explanations and what each warrior did in that very battle,
interludes, open threads, the canon in both languages, and how many
explanations are still missing. Two choices here are open to Rob: which
changes ask for an explanation, and that experience became a change kind of
its own (it was missing from the list in the data model).

## September 27, 2026 — the rules that hid in the drawing code

The eighth slice closed with the claim that all of the legacy app's logic
now lived in core. Planning phase 1d proved that wrong. To run the legacy
test files against core, every function they call needed a counterpart, and
several of them turned out to be drawing functions with rules inside: the
sidebar decided whether a warband is legal (too few models, a missing
leader, a Seer without a Mark, one Swivel Gun per Pirate crew, bow duty for
Outlaws, the Bretonnian horse order, the house-rule caps) and wrote the
verdict straight into HTML; the recruit menu decided what may still be
hired; the abilities panel decided which keywords a warrior's rules grant,
with its careful reading of "is NOT a Large Target".

These are now rules in core — warbandWarnings, recruitStatus,
modelAbilities, unitSummary and the list filters — and the parity test reads
the legacy app's own HTML back to compare. The generated warbands never
switched on the ranged-weapon cap or the one-re-roll-item rule, so planted
bugs in those warnings went unnoticed until the modified house-rule preset
turned both on.

## September 28, 2026 — the legacy tests, run against core

Phase 1d asked for the 35 legacy test files to run against core. The plan
was a facade: a stand-in for the legacy modules that answers every call
from core. It did not survive a count. About fifteen of the files read the
HTML the legacy app draws — the sidebar, the casualty form, the tooltips —
so a facade would have had to draw them again; and the tests hold on to
legacy objects and watch them change in place, which core, handing out new
values, never does.

What runs instead is a mirror. The legacy tests run unchanged against the
legacy app; a module hook wraps every function the app exports, and each
call a test makes is repeated in core from the state legacy had just before
it, with the same answers to its dialogs and the same values in its input
fields. The warband, the campaign file and the form drafts must come out
the same; a query must answer the same; a drawing must show what core's
rule says. Whatever a test asserts about a call therefore holds for core as
well — about 1500 calls, 400 of them actions, and no difference in the
logic.

Two gaps came out of it. The tooltip decided which entry to show — an
item, then a skill from the curated lists, then the ability patterns, then a
spell — and that order, which once fixed "Nimble" showing a monkey's rule,
still lived only in the legacy tooltip code; it is now `tooltipInfo` in
core, checked against every name the app can show a tooltip for. And a fresh
legacy session hands out uid 1 first, which core refused: it pushed any
counter up to the old resync floor. Core now keeps a counter as long as it
collides with nothing.

A wrong turn on the way: the first wrappers were constants, and the legacy
modules, which import each other in a circle, touched them before they
existed. Wrapping with hoisted function declarations, as the originals are,
fixed it. Planting bugs in core showed the mirror's reach and its limit: it
caught five of six, and missed a name that was no longer trimmed, because
no legacy test types a name with spaces around it. The mirror adds the
scenarios the tests describe; the random walks stay for everything else.

## September 28, 2026 — an app that starts without the rules

Phase 1e put the new app on its feet: React with the compiler, both
flavours from one code base, the two themes, a device store, and a
read-only roster that everything shown on it takes from core. Two decisions
came out of measuring rather than planning. The rules data is about 140 KB
compressed — more than half the budget for the whole first load — so the
app shell starts without it and fetches it when a roster is first opened;
the service worker keeps it for the evening the Wi-Fi is gone. And the
Quick Build keeps its routes after a "#", because GitHub Pages cannot
answer a deep link with the app.

Playwright looks at every screen at 360 px in both themes, and it found
the first bug before anyone else could: in Chronicle, whose title font runs
wider, the header pushed the page six pixels past the edge of the screen —
enough for a phone to scroll sideways and for taps to land in the wrong
place. The grid now never grows wider than the screen, and on a narrow one
the sync state says "Saved" instead of "Saved on this device".

## September 28, 2026 — six screens drawn before they are built

Phase 1f drew the six screens that decide the most: game night, the
timeline, the change view, visibility, the leader's background and the new
roster. They are plain clickable pages in `docs/mockups/`, on the app's own
design tokens, with an invented campaign in them, meant to be held in the
hand before a line of the real screens is written.

Two things only came out of trying them. The timeline's three move buttons
first sat beside each block and squeezed the text into a narrow column
that made every note twice as tall; they now share the line of the block's
details. And dragging on a phone needs a long press before anything moves —
a quick swipe must still scroll the page — which a simulated finger in
Chromium confirmed both ways. The roster mockup also carries the injury
flow agreed for the new builder: the result as rolled, then exactly the
follow-up the chart asks for.

## September 28, 2026 — rules as written, unless mordheimer.net says otherwise

The Augur of the Sisters of Sigmar is blind, yet the Serious Injuries chart
can still cost her an eye. Tuomas' FAQ says that as written the result
applies to her and that it was probably meant not to. The question was left
open until Rob settled it with a rule for all such cases: a ruling by
intent is adopted only where mordheimer.net makes it. For the Augur it
does not — neither her entry nor result 31 mentions an exception — so she
loses a point of Ballistic Skill like anyone else. Legacy and core already
counted it that way; a test now holds the ruling so that no later cleanup
"fixes" it quietly.

## September 28, 2026 — ready for the real saves

The last part of phase 1d compares the two apps on the saves the group
actually plays with, because generated warbands only come in the shapes the
generator knows. Those files are not here yet, so the way in was built
first. `npm run sanitize-save` takes a warband save, the leader's campaign
file or the readable text export and cleans it for a public repository: the
story, backgrounds, chronicle notes, battle accounts, casualty remarks,
house-rule notes and the players' names go; warband and warrior names stay,
since the chronicle already prints them. Text that was there stays non-empty
as a placeholder, so a cleaned save still takes the same branches.

Trying it on a doctored copy turned up the first gap at once: a player can
correct the text of a chronicle entry the app wrote, and the cleaner only
looked at notes. Corrected entries are cleaned too now. Cleaning is
idempotent, so the suite's first check is simply that cleaning a committed
file changes nothing — a file that slipped in raw fails the build. Two
invented saves, built with core and written by the legacy app, keep the
suite honest until the real ones arrive.

## September 28, 2026 — the rule this warrior has

Rob asked whether the units' abilities were right, adding that the tool
often showed different abilities under the same name. A comparison of all
49 warbands with mordheimer.net found the units themselves mostly correct,
and the fault in the tool: every tooltip was looked up by its bare name, and
the first entry of that name won. A Skaven's Infiltration showed the Cursed
Cavalcade's text, a Beastman Chief's Bellowing Roar the Ogre version,
"Swashbuckler" the Buckler, because items were searched before skills. The
ability chips came from patterns run over a unit's rules text, so a Cleric
got the Hunter skill from the words "Witch-Hunter's", and Bretonnian Knights
were shown the All Alone test they are exempt from.

A chip now carries a key that says whose rule it is. Its tooltip takes the
unit's or warband's own definition first, then a skill of that name from the
unit's own lists, then the general entry; rules that belong to one unit only
appear where they are defined or explicitly allowed. The first attempt
treated only "not" as a denial, as the old comment in app.js insisted
("immune to X is a rule ABOUT X worth showing"); the audit showed that this
is exactly what misled players, so "immune to", "never has to" and "no …
test" deny as well. Before and after over every unit of every warband: 22
chips disappear, all of them false, and none are gained.

## September 28, 2026 — thirty corrections, six false alarms

The same comparison with mordheimer.net listed some forty errors in the
rules data itself. Before changing anything, each was read again on its
page, asking for the exact wording — and six did not hold: Black Dwarfs'
Tyrant, Dark Elves' Infiltration, the Cavalcade's silk armour, the Norse
Berserker's armour, the Night Goblin Troll's injury rolls and the
Outriders' cavalry skills were all right already. The summaries a fetch
returns are a lead, not a source.

Thirty values were corrected, among them some that change games: a
Middenheim warband's Captain and Champions had been fighting at Strength 3
because the city rule was only a note; Reikland's Marksmen lacked their +1
BS; Ostlander Ruffians, blind drunk and therefore Ld 10, had Ld 7; the
Cursed Cavalcade could learn the Dark Elves' skills instead of its own; an
Outlaw's double-handed weapon cost 30 gc instead of 15. Ten further points
need more than a line of data (a Wolfcloak only for Middenheim, markings
bought at recruitment for Lizardmen) and are listed as open.

One test went red for an unrelated reason: the campaign-file walk takes
random steps over the data, and with the new lists it re-added its own
side to a battle only four times, one short of the minimum. The walk now
tries that step when it can matter, and walks the group's own warbands too.

## September 28, 2026 — pressing every button

Rob asked for every button to be tried the way a player would: Back on a
phone, notices that sit in the way, things that overlap, and a desktop
screen that should use its room. In the new app, Back with the import
sheet open left the screen — on the first screen, the app itself. A sheet
now adds a history entry, so Back closes it, and Cancel takes the entry
away again. Moving on to an imported warband waits until that entry is
gone; otherwise the next Back would land on a closed sheet. The undo notice stayed eight seconds, could not be
closed and swallowed every tap on its strip — right above the bottom
navigation. It now goes after five, has a dismiss button, and passes taps
through except on its buttons. On a desktop the roster was a phone-wide
column; the warrior cards now stand side by side.

The legacy app, which the group plays with until the switch, was tried
with the real warbands at 360 px: the page scrolled sideways by 180 px.
The cause took three attempts. The emulated phone zoomed out to fit the
wide page, so the first measurement looked fine; a grid column sized
`1fr` grows to its widest content unless told it may shrink; and the
first phone rules were silently overridden by an `.addrow` rule further
down the stylesheet. Its "Saved." notices swallowed taps in the same way
as the new app's. Both are fixed and covered by a Playwright project that
loads the group's saves into the legacy app.

## September 29, 2026 — founding prices, a helper for after the battle

Rob answered the ten rules questions, and most answers came down to one
distinction the tool did not make: a price in a warband list can be a
*founding* price. The Nightmare costs the Cursed Cavalcade 30 gc when the
warband is founded and 95 gc when a Hero finds one later; the same pattern
turned up, once looked for, in the Mechanical Suit, the Engine of Chaos,
the Dwarfs' gromril and the Shadow Warriors' Ithilmar. The tool had the
Nightmare at 95 in the list, and whatever stood in a list never appeared
at the Trading Post. List rows can now say "founding only"; the campaign
stage decides which price applies. The obvious measure of "has fought" —
recorded battles — would have missed the whole group: their saves have
the campaign mode off and stand at "Setup". So outside the campaign mode
nothing changes, and the new builder will ask for the stage on import.

The Sons of Hashut's obsidian weapon became the Zharr obsidian weapon,
after the Chaos Dwarfs' city, because it shared a name — and with it the
tooltip — with the obsidian upgrade of Border Town Burning. Old saves are
renamed on loading, in both apps.

A subagent pressed every control of the legacy app, 4,801 of them in ten
states at two widths. One was broken outright (a house-rule panel whose
handler referred to a variable it could not reach); a static test now
checks every name in every inline handler. The rest were layout: a
campaign file that widened the phone page by 296 px, name fields 23 px
wide, a sidebar taller than the window that hid the Stash.

Rob asked for a post-battle helper like mordheimer.net's, with tables and
no dice. The campaign checklist existed but only linked out, and only in
the campaign mode the group does not use; the helper now opens from the
top bar, with every table in our own short words. A WebFetch will not
quote the exploration chart at length, so each location was read twice
in different ways and the few disagreements settled by a narrow third
question. The first test counted 36 special locations; there are 30.

## September 29, 2026 — buttons that looked finished

Rob opened the mockups on his phone and found buttons that did nothing,
and experience shown as a bare number on some cards. The first was worse
than it looked: on the roster page the experience stepper and the cards
shared an attribute (`data-xp`), so a tap anywhere on a card did not open
its sheet but doubled the warrior's experience — invisible on a warrior at
0 exp, which is why a crawler found only Wilhelm dead. The same crawler,
clicking every control of every page from a fresh load and every control
inside every sheet one of them opens, is now a Playwright project; it
also caught a "Roll for me" button that did nothing whenever the dice
repeated the old value. The dice buttons went, since the app reads tables
and does not roll.

Looking closely also turned up rule slips in the mockups themselves: the
Reikland Marksman at BS 3 instead of 4, the Hired Sword on the Heroes'
experience steps instead of the Henchmen's, a Mercenary Youngblood with a
club his list does not have. Mockups are read as the rules by the people
who test them.

The Trading Post (V6) came next: buy, search, sell, give and the ledger
in one view, and a merchant drawn as 32×24 pixel art in three frames —
idle, a blink, a coin held up — who stands still when the phone asks for
less motion. Writing the sell sheet raised a question the rules never
answer: half of 5 gc.

The parity checklist answers "does the new app do at least what the old
one does?" honestly: all of the logic, tested; of the screens, only
import and a read-only roster so far.

## September 29, 2026 — every tab a place

Rob's second look at the mockups on his phone: the ← sometimes did nothing
or came late, "Notes" in the bottom bar led into game night — a full-screen
mode without a bar, so there was no way back — and the campaign's tabs
pointed at "#". The crawler had counted a click on "#" as a reaction,
because the address changed; it now calls such a link what it is, checks
that every link leads to a page that exists, and follows sheets opened from
sheets.

The late ← was a race, and only a fast thumb shows it: closing a sheet
takes its entry out of the history with a step back, and the dialog's close
event — which triggers that step — arrives a moment after the tap. A link
followed in that moment started loading, and then the step back cancelled
it. Playwright's own clicks are too polite to hit this; the regression test
closes the sheet and follows the link in the same instant. Links now wait
for the step back to finish.

Seven pages were missing for the bar and the tabs to lead anywhere: Home,
Warbands, Campaign, World, Manage, Story, More. The roster gained what Rob
asked for from the Henchmen: "+ Man" with the price the rules give (the
unit, the same gear, 2 gc per experience point, the veterans roll, five to
a group), names for each man, and "The lad's got talent" turning one of
them into a Hero with his own card. The merchant got grimmer, and Home a
skyline of Mordheim under the comet.

Rob also asked whether the example warband could really look for only six
rare items. It could look for seventy; the mockup had shown a sample. While
generating the full list from the catalogue, the Roster Builder turned out
to offer Mercenaries items the catalogue reserves for other warbands — the
Dwarf axe, the Pestilens censer, the Starblade. Its Trading Post checks the
weapon family, not the restriction text.

## September 29, 2026 (cont.) — the desktop as a workspace

Rob liked the phone mockups better now and asked to see the desktop: "with
several, perhaps movable windows … a good overview without clutter". Free
floating windows were the first idea and the first thing dropped: they
overlap, they get lost, and every session ends with tidying up. What
`desktop.html` proposes instead is a workspace of panels — the phone's
screens, several at a time — standing in columns, as many as the width
holds, plus a row across the top. A panel moves by its title bar or,
without a mouse, through its ⋯ menu; it can fill the workspace or wait in a
dock. The panels are linked: pick a Hero in the Roster and the Warrior panel
shows him and the Trading Post searches for him. Arrangements for a task are
"views" (Roster, After battle, Trading, Campaign, your own).

The first layout was a plain grid, and a short panel next to a long one left
a hole under it; columns fixed that. Dragging worked by hand but not under
Playwright: the page changed the layout inside `dragstart`, and Chromium
quietly cancels a drag whose source moves in that moment. The styling now
waits a tick, and the drop zone that appeared above the columns — the
source of the jump — is gone; the top row takes drops only once it holds a
panel.

Home got its comet: on one visit in three the twin-tailed comet comes down
on the city — seven frames once, a flash, fire, smoke, then the crater
smoulders and the wyrdstone burns. Tests never get it by chance
(`navigator.webdriver`), and less motion means no flash at all. The three
warbands of the invented campaign got portraits drawn from their
descriptions: a Reikland marksman with plume and slow match, a Sister of
Sigmar with hammer and comet, an Eshin assassin with a dripping blade.

Rob also settled the open questions: selling rounds down but always brings
at least 1 gc, and the catalogue's "Dwarfs only" includes Dwarf Hired
Swords.

## September 30, 2026 — what things do, and the rest of the desktop

Rob wanted to see what an item does when he looks for it. Following that
thread showed the data, not the screen, was short: 58 items of the
catalogue had no rules text at all, in either app — the lantern, the banner,
the maps and tarot cards, poisons, ladders, vehicles. They got short texts
from mordheimer.net's equipment pages (a pull request of their own, since
they are rules data), and the mockups now show them: on the Trading Post a
tap on the name, while searching the text of the chosen item. On the way the
sword breaker's text turned out to lack half its rule (the trap blade).

The same question for skills: the example Advance offered three. It now
offers every skill of the warrior's lists with its text, as the builder
will — Ulrich, a Captain, has thirty-three to choose from.

The desktop got its other places: Home, Warbands, Campaign, Notes and More
are workspaces of their own, each keeping its arrangement, and the phone's
tabs became panels and views. The warbands' pictures became emblems — Rob
preferred heraldry to figures. They are our own, from plain elements: a
shield with an eagle for the Empire's mercenaries, the comet and hammer for
the Sisters, a rag with a rat's skull for Clan Eshin; nothing copied from
the game's own symbols. The city at night moved into a script of its own so
Home on the desktop shows it too.

## September 30, 2026 (cont.) — the Pi's side, before the Pi

Rob chose to go on with phase 2 rather than split phase 3 for an earlier
offline test. Nobody works on the Pi itself (ADR 0015), so phase 2 in this
repository means everything the Pi will run, tested somewhere else: the
`server/` skeleton, the image, and `ops/` — and a CI that does on a GitHub
runner what Rob will do on the Pi, drills included.

The server does little yet, but what it does is what the rest will stand on.
It refuses to start without the marker file on the SSD and creates nothing
then. It checks the database's integrity, takes a snapshot before any
migration of a database that has a schema, and migrates forward in one
transaction per file. If the database is damaged, unreadable or newer than
the code, it still answers health — with 503 — so `roster-deploy` rolls back
and the dead man's switch complains, instead of a container restarting in a
loop without saying why. Every route names its action for `can()`, and a
route without one cannot be registered: the rule "every endpoint goes
through `can()`" is enforced before there is a single endpoint worth
guarding. It also serves the app's campaign build, so installing the PWA on
a phone — still open from phase 1 — can be tried at the real address.

Three things in the plan turned out wrong on contact:

- **The epoch.** The plan said the server's epoch changes on every restore.
  Kept in the database, it would not: a restored file carries the epoch it
  had when it was backed up, which is exactly the one the devices already
  know. Every snapshot copy now carries a mark; a server that starts on a
  marked file takes a new epoch and removes the mark. The live database never
  has it, and restoring the same snapshot twice still gives two epochs.
- **The client address.** The plan had Fastify trust `X-Forwarded-For` only
  from 127.0.0.1. But Caddy reaches the app through Docker's published port,
  and inside the container that connection comes from the Docker network's
  gateway. With the plan's setting every request would have come "from the
  gateway", and ten failed logins by anyone would have had Fail2Ban ban…
  the gateway. The server now also trusts its own default gateway, and the
  smoke test checks it with the real image.
- **npm and SQLite.** `npm ci` tried to compile better-sqlite3 with node-gyp,
  although the package ships prebuilt binaries for every platform we need —
  from a lock file, npm does not see the package's `gypfile: false`. Here
  that failed outright (no Node headers to download); on CI it would have
  cost a minute of compiling on every run. `.npmrc` now switches off install
  scripts for all dependencies, which is also one less way for a compromised
  package to run code. None of ours needed one.

The Fail2Ban filter got stricter than planned: `"event":"login_failed","ip":`
must stand side by side, which the logger guarantees, so nothing a user types
can come between them. A test tries to smuggle another address in through the
account name; CI then writes real lines into the journal and watches the jail
ban the address.

`roster-deploy` pulls first (a failed pull changes nothing), then backs up,
switches, and waits for the container to run exactly the new image *and* to
report healthy. On failure it goes back, and if the schema moved in between
it puts the pre-deploy snapshot back and keeps the failed database next to
it. Both kinds of failure are drills in CI: `:drill-broken` exits at once;
a second test image migrates one step and then fails the next. `roster-restore`
replaces the manual restore steps. The image builds everything on the
runner's own platform and only copies files for arm64, so there is no slow
emulation.

Docker Hub was not reachable from this session, so the image could not be
built here. The scripts were tested anyway: a base image assembled from the
session's own Node binary, the runtime stage recreated around it, and then
deploy, both rollbacks, backup and restore test with a real restic, and the
restore — before the first push. The real image is built and tested by CI.

CI still had its say. Its shellcheck is older and stricter about an unused
function argument. The job log could not be read from the session, so the
end-to-end test now reports its failures as GitHub annotations, which the
API does return — and they showed the timers' services failing with
"dependency": they require the SSD's mount, and on the runner a test
"SSD" under `/mnt` depends on a disk systemd cannot start. The mount point
is now a setting (`ROSTER_MOUNT`, `/mnt/ssd` by default) that the
emergency setup on the desktop needed anyway, and the test mounts its SSD
as a proper mount unit under `/srv`.

## September 30, 2026 (cont.) — before the Pi: who can reach what

Rob asked for the commands for the Pi, and for a check that nothing in the
repository could be used against the Pi or against him. Going through it
command by command changed three things.

The plan had Rob run `sudo ops/install.sh` in the clone the agent base
already keeps under `/mnt/ssd/agent/repos/`. That directory is mounted into
the agent containers, so anything able to steer an agent could have edited a
script that root runs next. The clone now lives in Rob's home, and
`install.sh` refuses to run from the agent directory or from files others
could change. It also stopped *sourcing* `site.env` as root; it reads the
known keys line by line and checks their values. The scripts refuse to run
as root, so a restored database cannot end up owned by root.

The repository itself holds no secret, hostname or address: every revision
was searched. It did hold the Pi's account name, host name and the ports of
the other services, now placeholders or gone from the current docs. And the
cloud sessions had committed under Rob's full name and university address,
while his own commits use a shortened name and GitHub's no-reply address.
Commits from now on use the latter (`CLAUDE.md` says so). The older commits
were a question for Rob: rewriting published history can only be partly
undone, and GitHub keeps the old commits of merged pull requests.

The check caught its author first. On the Pi, `install.sh` refused Rob's
fresh clone as "writable by others": Raspberry Pi OS, like Debian, gives each
user a private group of the same name and the umask 002, so every clone is
group-writable – by a group only he is in. The check now counts such a group
as the user's own, and in exchange also looks at the directories above the
clone, since whoever can write one of them can swap the clone underneath.
`ops/test/install-guard.sh` creates throwaway users on the CI runner and
tries each case.

## October 2, 2026 — the Pi online, and the first edit

Stages 1 and 2 of the setup went through on the Pi: the app answers under its
hostname with a certificate, the encrypted backup reaches the desktop, and
the app installed on Rob's phone from there – the one item phase 1 could not
check. Two things in the runbook were wrong. There was no rsync job on the
desktop to extend, only a Samba mount of the media share, which is the wrong
road for a backup copy: it can write, and a careless target lands on the very
SSD it should protect. The desktop now pulls the repository with a key that
`rrsync -ro` confines to reading that one directory. And `rpi-clone` is
reported not to work on Trixie, so the SD clone became a `dd` image taken on
the desktop – and then waited, at Rob's choice.

Rob started phase 3 before the drills of stage 3, builder first. Step 3a
makes the roster editable: a warband is started from the list grouped by
grade, warriors are recruited from the Roster Builder's own list (with the
reason when one may not be), named, let go, given experience one step at a
time, a Hero made leader. Every change is a core action on the state the
screen shows, saved on the device at once; the notice after it offers Undo
instead of a question, and a later change takes the notice away, so Undo
never reverts more than its own change. Only one piece of logic is new:
dismissing one particular man of a group (`dismissMember`) – the Roster
Builder could only shrink a group from its end, losing the wrong man's name.

Building it found a fault in the sheets. Choosing "Name" in the ⋯ menu
closed the menu and opened the name sheet – which shut again at once. The
menu's step back in the history is one `popstate` event, and every open
sheet listens for it: the name sheet, opened by the menu's listener, heard
the same event a moment later and took it for Back. What a closing sheet
runs afterwards now waits until every listener has seen the event.

Step 3b began in `core/`, before any screen: trading after the first
battle (V4–V7). The ledger turned out simpler than planned. Instead of a new
save format, the actions of the Roster Builder run as they are and a booking
records what they did to gold in hand; the treasury is then set so that the
old formula – treasury less what the warband owns – shows the same figure. A
save with a ledger still reads correctly in the old app, and a price change
no longer moves the gold, which was the point of V7. Buying, selling at half
price, giving between warriors and the stash, searching for rare items and
dismissing after the first battle all keep gold in hand and the ledger in
step. The search modifiers are only those the audited data states; the rest
is a number the player enters, until Rob decides otherwise.

The Trading Post followed on the same day. Before the first battle a
warrior's ⋯ menu opens his list – a stepper per item, the free dagger
first, rare items from the catalogue – exactly the Roster Builder's
choices. From the first battle on the same menu leads to the Trading Post,
and every edit of the roster goes through the ledger: recruiting a man is
booked under the notice the player sees, dismissing one sends his gear to
the stash and refunds nothing. The search sheet takes the roll as the
table rolled it; the app only says what is needed and what the odds were.

Step 3c opened with advances. The sheet takes the 2D6 as rolled and shows
the row of the rulebook's table it lands on – a characteristic, offered
only while below the race's maximum; a skill from the warrior's own lists,
or for a wizard a spell instead, a known one becoming easier; for a group,
"The lad's got talent" with the man and his two lists. The app never rolls.
Mistakes are taken back from the ⋯ menu, each with its Undo.

Injuries (V1) came next, as the second piece of new logic. The Roster
Builder had two ways to the same chart – the roll in the casualty list and
"+ Injury" on the card – and five results did different things depending on
which was used: a Deep Wound became lasting, Robbed took nothing, the pit
fight and a capture asked nothing, Survives Against the Odds gave no
experience. Rather than bend those ports and teach the parity tests a
string of exceptions, `injure` is new: one action for both ways, taking the
roll with every follow-up already answered – the D6 of an Arm Wound, the D3
of a Deep Wound, whom he now hates, what became of the captive, the pit
fight and the roll after losing it, the further results of Multiple
Injuries. The legacy ports stay exactly as they were, for parity; the new
app simply never calls them.

The sheet asks those questions in the chart's order and nests where the
chart rolls again, so a lost pit fight inside Multiple Injuries is three
inputs deep and still one roll for core. Districts that change an injury ask
their own D6 or decide by themselves. Unlike the advance sheet, this one
offers "Roll the dice": the spec asks for both, and a dead Hero should not
depend on someone finding a D66 in Tabletop Simulator. The dice come from
the screen, never from core.

Rob answered the open points the same day. The Peg Leg ignores a leg
wound only on a 4+ – which leg was hit is a coin toss – and the source
says so too; the data's tooltip had shortened it to "may ignore … and
never suffers further leg injuries", and is now corrected. Robbed is a loss
of equipment, not an injury. And a captive is now a state rather than an
answer the player must give at once: he stays on the roster, counted but
not fighting, until an exchange, a ransom or his loss is entered.

V2 followed: fixed ids for the Fallen. A casualty record had pointed at its
dead warrior by position, so deleting one Fallen entry quietly moved every
later record onto the wrong man. The failing test came first, as the spec
asked; the fix gives each entry an id from the chronicle's sequence at the
moment of death and links by it, keeping the old position in step for the
old app. The format number rose to 2 for the first time, with the migration
in `normalizeState`, so that a state already in the app's store is mended
just like a file. Writing the parity exceptions turned up a second case of
the same fault in the old app: a death taken back left its record on a
position the next death would fill. Both are now named rules in the parity
suite rather than silent differences.

## October 2, 2026 (cont.) — a name of our own

The service moved from DuckDNS to a domain of its own: DuckDNS sometimes took
seconds to resolve. The first registrar fell through, the second worked; the
DynDNS did not. Debian's `ddclient` speaks to `porkbun.com`, while Porkbun's
API lives at `api.porkbun.com`, and the answer is an HTML 403 that says
nothing about why. Rob also pasted its debug log into the chat, keys
included, so the keys were replaced before anything else. A forty-line
script now does the job: ask Porkbun for the address it sees, compare,
change a record only when it differs. It runs from a timer as a throwaway
user, takes its keys on stdin, and `install.sh` puts it in place once the
key file exists – and refuses while anyone but root could read that file.

The switch itself showed a gap in `install.sh`. It rewrites the Caddyfile
from `site.env` but rightly never touches `app.env`, so the app kept the old
origin and would have refused every write from the new one – a fault that
only shows once there is something to write. It now warns whenever
`PUBLIC_ORIGIN` and `ROSTER_HOST` disagree, with the line that fixes it.

The veterans roll closed the list of 3c's rules. The rulebook lets new men
join an experienced Henchman group only as far as a 2D6, rolled once
between battles, covers their combined experience; the Roster Builder
explained this in its post-battle helper and left the arithmetic to the
player. Now "+ Man" opens the "More men" sheet of the mockup – how many,
the price line by line, their names – and from the first battle on, for a
group with experience, the roll of the round: entered once, kept with the
round's post-battle state, and spent down as men join, so a second group
sees what the first left over. The editor tests had to learn to open a
sheet for this, with a few lines of <dialog> that jsdom lacks.

The last pieces of 3c were the Chaos ones: Mutations and the Blessings of
Nurgle on a warrior's ⋯ menu, each with its price and rule text and the
sum the rulebook asks for (the dearest at its price, every further one
double), and for the Marauders of Chaos the Mark the Seer must bear and the
Chieftain may take. Both are a list and a pick from patterns the app
already has, so, as the roadmap allows, the app itself is their mockup.
Writing them turned up two questions for Rob: the FAQ allows the same
mutation more than once, which neither builder does, and the rule that
mutations are bought only on recruitment cannot be enforced while nobody
records when a warrior was recruited.

Rob's answers on mutations changed more than mutations. Citing the
Ultimate FAQ – newly hired warriors are always equipped from the
warband's list – he moved the line drawn on 29 September: the list is not
closed for the whole warband after its first battle, but for each warrior
after his own. So a warrior hired mid-campaign now carries the round he
joined in, buys from his list at its prices until he has fought (common
items freely, rare ones only by searching, as the rulebook adds), and buys
his mutations as he is hired; a recruit who never fought can be taken off
the roster at his price. The same mutation may now be taken more than once
where the effects add up, as the FAQ allows, with one constraint Rob gave:
a claw or tentacle needs an arm to grow from.

## October 2, 2026 (cont.) — what the mockups were missing

Rob went through the Hire mockup and the desktop and came back with six
things, none of them about rules. The Hire button sat below a Hired Sword's
long profile, so every hire began with scrolling, and after it the list
stayed where it was, half way down; the buttons of a sheet now stay at its
bottom edge and the list returns to its filters. The desktop jumped to a
phone page on some clicks and had no way back: it had been linking to the
phone pages for everything it did not draw itself. Now such a page opens in
a large panel inside the workspace, and the layout is chosen by hand, per
device, under More – the app never decides by itself (the crawl now fails
any click that leaves the desktop). The bubbles with an item's or a skill's
rules, which the Roster Builder always had and the mockups had only in the
Trading Post, are now on every card; Rob called them essential. And there
was no visible way to start a warband at all – the app has one, the
mockups had forgotten it.

The other two were new ideas. The concept had an "AI pack" for the
chronicle pipeline; Rob asked how the timeline would actually get a battle
written, so the timeline now builds that package as one prompt to copy,
with each part switchable and the hidden background marked with its reveal
rules. What comes back needed a home: a Chronicle tab with the whole story,
where a chapter is imported as text and checked for hidden names before a
leader publishes it. Making the import's sample text consistent showed the
mockups' own campaign had drifted – chapter 4 sat at the Old Mill, which is
battle 5 – and a new check found a sheet wider than the phone, which the
page-width test could not see.
## October 2, 2026 (cont.) — the bubbles come back

The Roster Builder put a small ⓘ next to every item and every special rule,
and hovering it showed what the thing does. The new roster had dropped them
on the cards – only the Trading Post kept its texts, and only as a `title`,
which a phone never shows. Rob: "essential and must be in". So every word
on a card that names a rule is now a word you can tap: the bubble shows the
rule's name, what kind of rule it is and its text, and a mouse resting on
the word opens it too. The lookups are the Roster Builder's own, already
ported to core, so the Captain's Leader rule reads 12" in Reikland rather
than the general 6", and a skill is the one from the warrior's own lists.
What core had no way to give was the item behind "Brace of Pistols" or
"Sword [Dark Elf blade]": the card's labels were strings, so core now
returns each entry with the items it stands for, and the old functions
are those labels (the parity suite holds them to the Roster Builder's).
The cards gained a "Rules" line on the way – special rules had no place on
them – and a Hired Sword's card lists the skills he comes with, as the old
roster did. The bubble lets taps through like the Undo notice, and the
words are the one exception to the 44-pixel rule: a word in a sentence
cannot be a finger high.

## October 2, 2026 (cont.) — hiring

Step 3d turned the Hire mockup into the app's own screen. Core already had
the Roster Builder's hiring – who may join, the fees, a district halving
one, the grudges that raise an upkeep – but only as a menu of those who
may, with weapons and personas chosen after the fact. The new screen lists
everyone, says in words why someone may not join, and asks for the Ogre's
weapons or the Emissary's Mark before he is hired; core got `hireProblem`
and `hire` for that, around the old actions.

Looking the rules up for the screen turned up a mistake of my own: the
mockup said Hired Swords count towards the warband's models, and refused a
hire when the warband had fifteen. The rulebook, as corrected by the
official errata, says the opposite – they count towards neither warriors
nor Heroes – and the Roster Builder had it right. The one exception comes
from a Hired Sword's own text: a Priest of Morr "replaces one of a
Mercenary warband's Heroes", so he needs a free place. Gold, as with
recruits, is not a reason to refuse; the roster warns when the warband
spends more than it has.

## October 3, 2026 — house rules, a first base

Rob saw the house-rules mockup and asked for it in the app straight away:
a rough base first, improvements later. The screen is the mockup's first
case, a warband on its own, because until the campaign server every
warband keeps its own rules. Core already had every setter; what the
screen adds is the reading of them: each rule with what the rules as
written say for this warband (its own starting gold, its own maximum),
off always meaning as written – so "Enforce equipment list", the one rule
on by default, appears the other way round – and a value that starts
somewhere sensible and moves in steps. Prices never move gold already
booked in the ledger; before the first battle they change what the
warband spent, as in the Roster Builder. The declaration at the bottom is
the one the exports print, from core.

## October 3, 2026 (cont.) — what leaves the device

The exports were the last part of 3e, and the easiest: core had ported
every one of them, so the work was the screen and the plumbing. Rob plays
on Tabletop Simulator, so its cards come first on the export screen – a
Name and a Description for every model, each man of a group with his own
name as the Roster Builder does it – and a card's ⋯ menu leads straight to
its entry. The readable text and the tool file both import back. The
official roster sheet needed pdf-lib in the app; it is pinned to the
version the Roster Builder vendors, and it and the template are loaded
only when a sheet is made, so the first load stays as small as it was.
Printing, for now, goes through the PDF.

## October 3, 2026 (cont.) — the builder's last gaps

Phase 3f is the switch of GitHub Pages from the Roster Builder to the new
app, and its precondition is a complete checklist. Three small gaps of the
builder remained, each something the old app did in one click: jumping
the experience to a step of the track (now a tap on "Exp n", with the
steps as buttons big enough for a thumb), changing what was paid for a
rare item (a price rolled at the table), and printing the roster. Printing
found a bug on the way: the print colours were meant to be light whatever
the theme, but a bare :root lost to the theme's attribute selector, so a
dark theme printed dark. What still holds the switch back is not the
builder but the campaign: the group plays its campaign in the Roster
Builder today, and those rows of the checklist belong to phase 4a.

## October 3, 2026 (cont.) — who is asking

Phase 3g starts on the server, because the app's sign-in screens need
something to talk to. The accounts follow ADR 0008 to the letter – invite
only, an authenticator required for the admin – and Rob added one wish on
the way: he wants to see who signed in when, and what was changed. So every
attempt to sign in is kept for half a year, and every write lands in the
audit log; both have their admin endpoint already.

A few choices are worth the record. Node's own scrypt instead of an argon2
package: no native module to trust beyond better-sqlite3, and the
parameters travel with each hash so the cost can rise later. At most two
hashes run at once, because each needs 32 MiB and the Pi shares its memory
with Jellyfin and TeamSpeak. The authenticator secret is encrypted with a
key that lives in app.env and not in the backups, so a copy of the
database alone gives no codes away; install.sh makes that key once and
never replaces it, since a new key would lock out every account with an
authenticator. The links carry their token in the fragment – the part of
a URL a browser never sends – and the API takes it in the body, so no log
line anywhere can hold a working link. The first draft had the token in
the path, where Caddy, a proxy or a stray debug line could have kept it.

The brake had a wrong turn too: a try refused by the brake first counted
as another failure, so a player who kept tapping "Sign in" during the wait
made the wait longer. Now only real failures count, and waiting always
works; the attacker still gets the same 429 and Fail2Ban still sees every
line. The code after the password is braked as well – six digits are quick
to guess otherwise.

The leak-test matrix grew from a list of fields into the test it was meant
to be: every route has a probe request, every probe is sent as nobody, as
someone halfway through signing in, as a player and as the admin, and an
answer may carry only the fields its row allows – and never a hash or a
secret, at any depth. A second test now fails when a table or a column the
migrations create is missing from data-model.md.

## October 3, 2026 (cont.) — the old app stays as it is

With the builder complete, the question was when GitHub Pages switches
from the Roster Builder to the new app. Rob's answer: not before the
campaign runs in the new app (phase 4a), because the group plays its
campaign in the Roster Builder today – and until then the Roster Builder
stays exactly as it is. No more fixes there; a bug found on the way is
fixed in core and recorded as a behaviour change. That ends the habit of
fixing both apps, which had made every legacy quirk twice the work.

## October 3, 2026 (cont.) — signing in, on the phone

The screens for 3g follow the patterns the app already has – a form, a
sheet from the bottom, a list – so the app is its own mockup here, as the
roadmap allows for small screens. Signing in is two steps when an
authenticator is set up, and the second step offers a recovery code in the
same place. The invite and reset links take their token out of the address
bar the moment the page opens, so it is neither in the history nor in a
bookmark. Setting up the authenticator draws its QR code with a small
encoder that is loaded only then; on the phone itself the same link opens
the authenticator app directly. The ten recovery codes can be copied or
saved as a file, and the sheet does not close until the player says they
are kept.

The admin's view is what Rob asked for this morning: the users, with what
can be done for each (a reset link, removing a lost authenticator, signing
out everywhere, disabling); the open invites; every sign-in and failed try
with its address; and the audit log in words – "Rob made an invite", "kai
joined with an invite", "roster-cli on the Pi made an invite · an admin
account". On a wide screen the users stand side by side.

Nothing of it reaches the Quick Build: the account section in More is a
separate part loaded only by the campaign app, and the Quick Build has no
sign-in route at all. The builder never waits for the server either – who
is signed in is asked once in the background, and the warbands stay on the
device until 3h.


## October 4, 2026 — one key for both instances

The first plan gave the test instance a TOTP_KEY of its own. Rob asked
whether an account made on staging would need making again in production,
and the answer turned up a flaw: every night the restore test puts a copy of
production into the test instance, and with a key of its own none of that
copy's authenticators could be read there – codes would simply never work
on staging. Separate keys protected nothing, since staging holds the same
data anyway. install.sh now keeps staging.env's key equal to app.env's,
replacing a different one it finds (never the other way round).

## October 4, 2026 (cont.) — warbands that live on the server

Rob asked whether warbands could be kept apart from any campaign and used
as a blueprint for a campaign start – build one for fun now, play it later.
The concept already said so: a warband belongs to one user and at most one
campaign; a free one is a draft, and a campaign starts with a copy of it, so
the blueprint stays as it was. Phase 3h starts with that on the server.

A warband arrives as the app wrote it and is kept as a version; the server
checks it against the same tolerant schema the app loads saves with and
otherwise does not compute (ADR 0005). Every version builds on the one
before, and a save built on an older one is refused rather than overwriting
(ADR 0003). Between versions, a draft per user keeps the work of the last
minutes; a second device of the same user may only replace a draft it has
seen. Drafts change every few seconds while someone edits, so the audit log
keeps just the latest line of each – the log is for changes, not
keystrokes. A copy remembers the warband and version it came from.

Free warbands are their owner's alone: for anyone else, the admin included,
they do not exist, and the server answers 404 rather than 403 so that not
even their existence shows. The leak-test matrix tries every warband route
with someone else's warband. Sync hands a device everything of its owner
that changed since its cursor, removals included, with the epoch that tells
it when the server was restored and it must start over.

## October 4, 2026 (cont.) — the same warband on every device

The app keeps working on the device's own store, as it always has; the
sync only carries what changed. The first plan was a queue of operations
to send – an outbox in the classic sense – but every operation in it would
have had to be replayed in order and reconciled with whatever the server
had meanwhile. Marking what waits on the warband itself turned out simpler
and sturdier: a warband the server has never seen, edits newer than the
last sent, a removal waiting for its Undo. A round of sync first takes the
server's changes, then sends what is marked, and it comes out the same
whether the phone was offline for a minute or a week.

When both sides changed, nothing is overwritten. The warband carries the
conflict, stops being sent, and the roster asks which one to keep – the
other device's draft, a newer version saved elsewhere, or a removal
elsewhere. Warbands made before signing in stay on the device until the
player takes them into the account; a phone that is shared does not show
another account's warbands. And after a restore of the server, the devices
give back what the backup missed.

The header says where things stand. One wrong turn on the way: offline it
went on saying "Saved and synced" after a change, because the count of what
waits came from the last successful round; now the device counts it itself.


The sync also showed a hole in a check. The first-load budget was measured
by file name – every `index-*.js` – and the sync, sharing the device store
with the entry, made the bundler split the store into a chunk of its own.
The measurement dropped by 16 KB while the page loaded the same. Now a
small script reads what index.html actually loads and adds it up: 124 KB of
the 200 allowed.

## October 4, 2026 (cont.) — versions, copies, and the way from the Quick Build

With the sync in place, versions became what ADR 0003 meant them to be:
marks made on purpose. Every change is kept as a draft anyway, so a version
is the state worth keeping – before a battle, after the post-battle
sequence – with a note. Bringing back an older one does not rewrite
anything; it becomes the newest as a new version, and the history shows
what happened.

Rob's blueprint idea is a button on every roster: Make a copy. The copy is
a warband of its own and, in the account, remembers which warband and
version it came from, so a campaign started from a blueprint can always
say where it began. A copy can also start from any older version.

The Quick Build got the way to the server the concept sketched: its address
once under More, then "Send to campaign server" on the Export screen opens
the campaign app with the warband compressed into the link's fragment.
Nothing passes through a server on the way, and the campaign app takes the
fragment out of the address bar before anything else, shows the warband,
and adds it as a new one or as the next version of one of the player's own.


## October 5, 2026 — the test instance speaks plain http

Rob's first round on the test instance found two failures with one cause:
importing a warband said "crypto.randomUUID is not a function", and "Start
the warband" did nothing at all. The browser offers randomUUID only in a
secure context – https, or localhost, which is where every test ran – and
the test instance is served over plain http in the home network. New ids
now come from a small helper that falls back to getRandomValues, which
every context has, and a lint rule keeps randomUUID out of the app. An
end-to-end test runs both actions with randomUUID taken away.

## October 5, 2026 (cont.) — sharing a warband without a file

Rob asked whether warbands could go from one player to another without
exporting a file, sending it and pasting it in. Two ways now, both on the
roster under "Share…": a copy straight to another player, which waits on
their Home under "Open for you" until they take or decline it; or a short
code – eight characters like K7M2-Q9XD, without the ones that are easily
misread – that anyone signed in enters under Warbands. Rob preferred a
code over a link: easier to say across the table or type from a chat.

Both are always a copy. The recipient gets a warband of their own, with
"shared by" on its first version; the sender's warband stays private, as
ADR 0011 wants every warband to be. A code serves several players (a
whole group can take the same starting list), lasts seven days and can
be taken back. The server keeps only its hash, and because a short code
can be guessed, wrong ones are braked: ten in fifteen minutes per account,
then a wait.

One wrong turn on the way: the server first answered a wrong share code
with the same error as a wrong authenticator code, and the app would have
told the player to check the time on their phone. Different errors now.

Rob also asked for a dedicated security review before the first real game
night – from outside and signed in. It is on the roadmap after 4a.

## October 5, 2026 (cont.) — the campaign arrives on the server

Phase 4a is the one the whole project was for: the next real game night
should run entirely in the new system. It is cut into five steps, each its
own pull request; the first brings the campaign itself. Someone with the
authenticator starts one and leads it; a leader adds the other players and
gives them roles; a player enters a warband. Entering is always a copy –
Rob's blueprint idea from the day before, now used as the concept meant
it: the free warband stays as it is, the copy belongs to the campaign. A
leader confirms it, and its latest version is marked "start".

That mark is the first place where the server computes rules. ADR 0005
said the client computes and the server keeps – except for the binding
comparison when a warband is marked, so that a history can never be
rewritten by a client. The totals frozen in the "start" tag are therefore
computed on the server with the same core code as in the app, and the
rules data is bundled into the server so the image needs no data
directory. The overview shows those frozen numbers; reading a warband
computes the rest on the device, as before.

Every member reads every warband entered, including the player's changes
since the last version: the mechanics are open to all (ADR 0002). Someone
outside the campaign gets a 404 for all of it, the admin included, and the
leak matrix now has campaign roles – the test user is a player in one
campaign the admin is not part of, and in one the admin leads.

On the way, the leaving sheet lost its notice in the browser test though
not in the unit test: freeing the warband re-rendered the roster before
the sheet had closed, and the sheet that should have shown the notice was
already gone. It closes first now.

Rob's first look at it found the dead end at once: a player new to the
group has no warband yet, and "Enter a warband" told them to go and make
one elsewhere first. Now the sheet offers "New warband for this campaign".
It is the usual form; the warband is made as always, free under Warbands,
and its copy goes into the campaign straight away – campaigns stay apart
from the warbands themselves. The free one is sent to the account first,
so the copy can name it as its source. With two warbands of the same name
side by side, the list now says which campaign the copy is in.

## October 5, 2026 (cont.) — the game night

The second step of 4a is the evening itself. A leader sets up the battle –
who fights, where on the map, a title – and the game night opens: full
screen on the phone, the turn on top, the protocol as it grows, big
buttons below. Who went out of action is picked from the real rosters of
the warbands that fought, henchmen man by man and the Fallen too, the same
list the Roster Builder's battle form offered; the attacker can also be
the surroundings, or someone outside every roster. Only a leader writes
the protocol (ADR 0010). Everyone else sees it within a few seconds and
can suggest a correction, which the leader takes over or not.

Everything entered goes to an outbox on the device first and is sent from
there – by the game night every few seconds and by every round of the
sync. Each entry carries the id the server keeps it under, so an entry
sent twice after a lost answer is there once, and correcting it is
sending it again under the same id. A table without a connection loses
nothing; the header counts what waits.

The first version of the screen had a bug the unit tests found at once:
its sheets never closed with their result. The sheets hook their dialog
when the screen first renders, and the screen first rendered "Loading the
battle…" without any dialog. The game night now mounts once the battle is
there.

## October 5, 2026 (cont.) — notes, and what stays sealed

Rob looked at the desktop on the way and found too many buttons and the
equipment purchase too hidden; on a wide screen there is room for a second
pane beside the roster. He put it after the campaign setup – the
workspace from the desktop mockup is the proposal – and the roadmap says so.

The third step brings notes. Everyone writes at the same time, each note
with one author (ADR 0010); a note is a scene, a quote with its speaker
picked from the rosters, a dice moment, an open thread, or just a note.
Who may read it is chosen when writing: everyone, leaders only, or sealed
until the battle is closed – then its author alone, not the leader, not
the admin, until it opens for all. The server decides this for the one
who asks (ADR 0011): a sealed note of someone else's arrives as a
placeholder without words, kind or names, a leaders' note does not
arrive at all. The leak matrix now plants a sealed and a leaders' note
with marker words that no answer to any role may contain.

At the game night the notes stand in the protocol by turn, with "+ Note"
and "+ Quote" for everybody, and they wait in the same outbox offline.

Two small lessons. The author's own sealed note first said "opened after
the battle" – the server marked every sealed note as opened for its
author; only a closed battle opens one now. And the game night briefly
lost an entry just taken out: an answer asked for before the change came
back after it and was shown. Every change made on the screen now counts
up, and an answer asked for before the last one is not shown.

## October 9, 2026 — after the battle

The fourth step of 4a closes the loop of a game night. A leader closes the
battle: the protocol is fixed, the notes sealed for it open, the server
takes a snapshot. Then each player does the aftermath of their warband.

The question that decided the shape was where a warband's campaign lives.
The data model had planned to move it – round, battles, casualties, log,
stage snapshots, the post-battle progress – into server tables. But every
rule that runs after a battle is already in `core`, ported one to one and
checked against the old app, and all of it works on exactly that part of
the save. Moving it would have meant writing the mechanics a second time
with nobody checking them. So the campaign stays in the save (ADR 0016,
proposed): the server keeps what everyone shares – the battle, its
protocol, the notes, the marks – and the app takes a closed battle over
into the warband once, through the old app's own battle form
(`saveBattleDraft`), so the Fallen link and the map follow as they always
did. The player sees what is taken over before it is.

From there it is the Roster Builder's post-battle sequence, step by step:
injuries rolled for whoever went out of action, the battle's experience
granted once and written onto the roster, the exploration dice, wyrdstone
into the stash and sold, then hiring and buying where those screens
already are. Beside it, what changed since the last mark – found and
explained exactly as the server will freeze it, because the app and the
server call the same `core` function for the evidence. "Mark after battle
N" saves a version and marks it; marked again, the newer mark corrects the
older, which stays. The campaign overview shows each player what is open
for them, and a leader moves the campaign on once the round's battles are
closed; whoever fought none sat it out.

Two things found on the way. The marking route imported a function it
never used – the lint caught it only now, because the server part had been
committed without the full check; the full check runs before every push
again. And a disabled button looked exactly like one that could be
pressed: "Move on to After battle 2" stood bright green with no battle to
move on to. Every disabled button in the app now looks it.

Rob, looking ahead: after the campaign setup, the whole interface gets an
overhaul, the desktop workspace part of it.

## October 9, 2026 (cont.) — one set of rules for the campaign

House rules were a warband's own until now. In a campaign they belong to
the campaign: its leaders switch them, for every warband at once, on the
same screen a warband uses for its own. The question was what "the
campaign's rules count" should mean for a warband whose file says
otherwise. Working the roster out with rules the save does not carry would
have meant swapping them in everywhere the app computes – and the server,
which freezes totals from the save, would have counted differently. So a
warband takes the campaign's rules into its file, with one tap and Undo;
until it does, everyone in the campaign sees that its own differ. The
server reads that – and the districts each warband holds – straight from
the newest version with `json_extract`, without loading the whole save. A
copy entered in a campaign plays by its rules from the start.

The districts came along: the Roster Builder's campaign panel, every
district of Mordheim by area with what a foothold or control there gives,
set by hand where a battle did not already move the map. In a campaign the
other warbands' footholds stand beside each district, and the overview
draws the map – a sole foothold is control, as the old campaign file
worked it out.

Rob, for phase 4c: whoever reports a bug will mostly write "does not
work". So the report carries its context on its own – the screen and tab,
the last steps, the settings, the house rules – and shows it before it is
sent.

## October 9, 2026 (cont.) — pictures

The game night's last missing button was "+ Screenshot": a picture of the
table from Tabletop Simulator, or a photo, at the turn it was taken. A
picture is the first thing the server keeps that is not JSON, so it got a
small path of its own. The phone draws the picture anew, at most 1600
pixels wide, and encodes it as WebP – only the pixels leave it, nothing of
what the file carried (a photo's GPS coordinates among them). It then says
what it is going to send – type, size, where it hangs, who may see it – and
sends the bytes raw to a route that alone accepts pictures, with its own
limit. The server believes neither the type nor the size it is told: it
looks at the first bytes and counts. The file lands under a name made only
of the campaign's and the picture's ids, and goes out with a fixed type and
a sandbox. Without a connection the picture waits in the same outbox as the
notes, bytes and all, and shows from the phone until it is sent.

A leaders' picture follows a leaders' note: a player's phone gets neither
its row nor its bytes. The leak matrix now plants one.

Two small things on the way. Every API answer was sent with "no-store",
which would have made the browser fetch the same picture again on every
screen; a route may now say otherwise, and a picture's bytes, which never
change under their id, may be kept by the browser. And the app's service
worker would have answered a picture opened in its own tab with the app
itself; the API is now never the app.

## October 9, 2026 (cont.) — the timeline

The story of a campaign is not the order in which things were typed. An
intention is written before the battle and belongs before it; a scene
remembered the next morning belongs in the turn it happened. The timeline
now shows the campaign as a story: fixed anchors – before the campaign,
each battle's before, course and aftermath, an interlude after each round
– with the battle reports and the marks, and between them every note,
picture and protocol entry the user may see. Blocks stand where their
battle and time put them, ordered by turn; anyone moves their own up, down
or to another part of the story, a leader any block, the protocol only a
leader. Moving changes only the place in the story, never when something
was recorded, and it is logged.

The server keeps only the places blocks were moved to – one row per moved
block, its key a fraction of digits: between two keys there is always
another, so a move never renumbers anything. The rest of the order the app
works out from what it already has, and the server gives what it does not:
every battle's protocol, who fought, the marks. A place only reaches who
may see its block; a leaders' note's place never reaches a player.

One mistake the test caught: the first block of the story could not move
up, even with empty anchors above it – the button asked "is this the first
block?" instead of "is there anywhere to go?".

Dragging blocks with a long press waits for the overhaul of the interface.

## October 9, 2026 (cont.) — a campaign that began elsewhere

The group's campaign did not start in the app: four battles and their
chapters are behind it, played with the Roster Builder. To go on in the
app, it needs that past – not every wound and coin of it, which the saves
carry anyway, but which battles were fought, by whom, and how they ended.

The plan said to rebuild the marks from the stage snapshots in the saves.
Looking at the real saves settled that quickly (Decision E): the group never
switched the Roster Builder's campaign mode on, so the saves stand at
"Setup" with no snapshots, no battles and no log. There is nothing to
rebuild, and so the history is simple: a leader records each earlier
battle by hand – number, title, district, the day, who fought and how it
ended – and that is all such a battle holds. It is closed from the start,
with no protocol, no aftermath, nothing to mark. It can be corrected until
the campaign's first battle in the app; then it is fixed, so it can never
interleave with what the app records. The campaign stands after the last
of those battles, and each warband's start mark moves there, on the same
version with the same frozen totals – the first "What changed" runs from
the takeover to the next battle.

The saves still believe they are at "Setup", which matters: before a
warband's first battle it buys from its lists, afterwards at the Trading
Post. Rob decided on 29 September that the new builder should ask where a
running campaign stands rather than guess; here the campaign answers. A
warband that fought in the history takes the campaign's stage on its
roster with one tap – without closing the stages in between, because the
aftermath of a battle would otherwise serve a wounded warrior's missed
game once for every stage it skipped. The aftermath of the first battle
in the app does the same if the tap was missed.

On the way, the leak matrix turned out to have probed with a warband type
that does not exist: every enrolment it tried to confirm failed quietly,
and the probes that need a confirmed warband were answered with refusals
it accepts for an allowed role. It probes with a real one now.

## October 9, 2026 (cont.) — the chapters come along

The campaign's story so far is not in any save: it is in the chronicle, a
prologue, a chapter per battle and the interludes, German and English. The
timeline should hold the whole story, so the published chapters come in
too – the chronicle's own files, imported by a leader in one go. A German
and an English file with the same `ref` are one chapter, side by side, and
each stands at the head of the part of the story it tells: the prologue
before the campaign, `battle-1` at battle 1, `interlude-1` in its
interlude. One the ref does not place – the chronicle has a
`pits-interlude` – goes after the last battle published before it. The
leader sees every place before the import and can change it.

The reader shows the text as the chronicle writes it – headings, the rules
between scenes, names in bold – as plain pieces built in the app, never as
HTML from the file. The list in the timeline carries no texts (the longest
chapter is over 50,000 characters, and the timeline is asked again every
fifteen seconds); a chapter's text comes when someone opens it, and stays
on the phone until it changes.

A chapter's place is a timeline position like a note's. SQLite cannot
change a CHECK constraint, so letting "chapter" in meant building the
positions table anew and carrying its rows over; a test does exactly that
from the schema before.

Before writing the reader, the parser ran over all sixteen real files of
the chronicle (not copied into this repository – the tests use files made
up in the same form): every one read, every language guessed right from
its prose, the long folded `victor` of the fourth battle included.

## October 10, 2026 — the security review

Before the first real game night in the new app, Rob asked for one thing:
that nothing can be exploited, from outside or signed in. Five reviews ran
side by side, each blind to the others – sign-in and sessions, rights and
visibility, inputs and resources, the app in the browser, the Pi itself –
and each proved what it claimed with a test against the real server before
deleting it. The findings, what was fixed and what stays open are in
`docs/security-review.md`.

Three were serious. Any push to any branch could put an image under a tag
Rob deploys, because a branch runs its own copy of the workflow and the
package hangs off the repository – branch protection on `master` never
applied to the registry. Production now takes only images that master's CI
signed with Sigstore for the very commit asked for (ADR 0017), and CI
proves on every push that this check passes for master and refuses a
branch. On a shared phone, the next account read the previous one's
leaders' notes and sealed words straight from the device's cache; every
cache now belongs to an account and goes when it signs out. And one
request could stop the server for good: an advance of 1e15, then "mark",
and the matching of advances with their events counted to 1e15. That
report reached us cut off mid-sentence – the review of inputs had been
blocked – so its second half was redone by hand, which found two more
ways for a member to fill the 256 MB (a body of empty objects, and nine
warbands of 2 MB in one sync).

Wrong turns. A first test for a race – a reset link revoked while its
hash was queued – only asserted when the race happened to go one way;
"tests are unconditional" meant replacing it with a test of the one
statement that settles it. Filtering the battle outbox by account inside
the Dexie query cost the instant update the protocol relied on (a filter
with a function cannot be applied optimistically); filtering after the
query kept it. And the path check in `install.sh` first refused the root
mount the guard test uses, because it put a slash in front of a path that
already had one.

Two decisions were Rob's: check where images come from (rather than only
stopping branches from publishing, which a branch's own workflow could
undo), and swap the test instance's credentials after every nightly
restore instead of moving it behind TLS – it keeps real data for trying
things, but nothing that signs in to production works there any more.

Then a further review, blind to how the fixes were made, read them the way
an attacker would – and found the seams. A second tab still acting for the
account that had signed out in the first one sent its sync and its unsent
notes with the new account's cookie; an answer on its way across a change of
account was filed under the next one's key. Requests now say whose they are,
and the server refuses one made for somebody other than its cookie's. The
account cap counted characters, so 113 small saves full of empty lists fit
it and still overflowed the sync; objects count now too. A failed swap of
the test credentials left the production copy where the next staging deploy
would have started it. And the case-insensitive match that was meant to
forgive GitHub's spelling of the owner also forgave a branch called
"Master" – only owner and repository match loosely now.

## October 12, 2026 — the background

With the security review merged and deployed, Rob's direction for the rest
of the roster builder was short: leave the chronicle for now, finish what is
left so that afterwards only polish remains. The first piece is the one the
whole story layer hangs on – the leaders' background: the threads the world
is spinning behind the players' backs, who pays the ferryman and why.

A background entry holds three things apart: the truth, what the players
know, and how much of it the story may show – hidden, a hint within a limit
written down, or revealed from a battle on. Only a leader with the
authenticator reads or writes any of it; for everyone else the route does not
exist as far as the answer goes (the outsider is told the campaign is not
there), and the leak matrix plants a marker in the truth of a campaign the
probing users do not belong to. Revealing is a deliberate step and the only
way something leaves: the leader writes the words, the server makes them a
public note, puts it in the timeline and raises the level – the truth is never
copied. The step is idempotent by the note's id, so a phone that retries after
a dropped answer does not publish twice, and a reveal that fails halfway
changes nothing. Entries keep their last fifty wordings, and a change made
from a stale state is refused instead of overwriting another leader.

"View as player" is the same idea turned around: the notes and pictures routes
take `?as=player` and answer exactly as they would for someone who is not a
leader and not the author – so a leader can see what the table sees, their
own sealed notes included as placeholders. It can only narrow what comes back,
never widen it, and the app does not keep the answer.

Wrong turns. The first reveal in the app test came back "Public." instead of
"Public since battle 1": the default place was the interlude after the
battle, and an interlude belongs to no battle in the timeline's keys – so the
note had none either. An interlude now belongs to the last battle of its
round. Before that, the new PR chain went wrong in a way that is worth
writing down: two fixes were opened against the branch they were stacked on
instead of `master`, merged there, and never arrived; they came in as one PR
afterwards. And a share test failed on CI for no reason in the code: the stand-in
server had a hard-coded expiry date that passed on October 11, so every share
in the tests counted as expired from then on. It now counts seven days from the
moment it is made, like the real server.

## October 12, 2026 (cont.) — the story of a warband

The second piece of the story layer is the one the players write
themselves: a prologue, an interlude after every round, the warband's name in
German and English, a short profile for each warrior – and, behind every
change the after-battle marks freeze, a line of what actually happened.

The first thing I checked was where this lives, and it turned out to need no
server work at all. ADR 0016 had already put it in the player's own save
(`story`, `canon`, `profile`), so it travels with every export and the server
only has to refuse what is too big. The pieces are therefore core actions
(`setPrologue`, `setInterlude`, `setExplanation`, `setProfile`, `setCanon`),
limits that the save schema enforces for the server too, and a page. An
emptied text leaves no trace – a warband that never wrote a word has no
`story` key – and every action returns the very state it was given when
nothing changed, which is what the editor's undo relies on.

A warrior's life is not stored anywhere. `lifeOf` reads it: the changes a mark
froze for him, each with the explanation its player gave, the protocol entries
he took part in, and the notes that mention him – in the order they happened,
the campaign's own notes last. Without a mark (a warband outside a campaign, or
a phone that cannot reach the server) the save's own chronicle stands in for
the changes, so the page is never empty just because it is offline.

One decision is worth writing down. The mockup had a visibility choice on each
interlude. It is not there: the story sits in the save, the save is readable by
the campaign once it is on the server, and a switch that only hides a text in
the app would promise something the data does not keep. The page says so in
one sentence at the top, and the place for something only one player should
know before a battle remains the sealed note.

Wrong turns. The first version of the life sheet opened itself from the
`?who=` link by setting its state in an effect; the linter was right that this
renders twice for nothing, and the initial state now comes from the link
directly. The first Aftermath test for explanations "found no changes" for a
reason that had nothing to do with the new code: the test wrote a change into
the store as if from another tab, but the editor keeps its own newer state
and rightly ignores an older write – the test now stamps it as newer, the way
a real second tab would. And a test run hung for five minutes because I
started the test runner with `-w`, which for Vitest means *watch*.

## October 12, 2026 (cont.) — questions, and what waits for you

The third piece of the story layer is a conversation: a leader can ask one
player a pointed question – "How did Robba spend the night after the ferry?" –
and the player answers it, as a note of their own, with the visibility they
choose. The same step gave the players one place that says what is waiting:
"Open for you".

4b3 was two features in one row of the roadmap, so I split it. This is the
first half (questions and "Open for you"); the world – factions, NPCs,
reputation, scenarios – is the second and gets its own pull request.

The thing to get right was who may see what. A question is read by the leaders
and by the one it is asked of, and by nobody else – not the viewers, and a
withdrawn one not even by the player. The answer is a different matter: it is
an ordinary note, so it follows the note rules (sealed only for a battle that
is still open, "leaders only" only for a leader), and the server makes it in
one step under the answering player's id. That one step is deliberate. With
two steps (write a note, then mark the question answered) a lost connection in
between leaves a note with no question and a question that still asks. The
question's words are never copied into the note or the log; the audit entry
carries only who was asked and which battle. Every route has its row in the
leak matrix, as ADR 0011 demands, and a probe that reads the question text out
of everything a bystander can fetch.

"Open for you" is a pure function of what the screens already have – the
campaign's view, the questions, the player's own warbands on the device – so
the campaign overview and Home share it and Home does not load the campaign
screens. It lists questions, aftermaths still to mark and the interlude of the
latest round. I left out an entry for missing explanations on purpose: the
aftermath already shows them ("Not told yet"), nothing waits on them, and an
entry would cost a request per warband just to nag.

Wrong turns. The first version of the tab put its sheets directly in the
screen; the linter (rightly) refused reading a sheet's ref while rendering,
and the other screens already keep each sheet in a component of its own, so
this one does too. The first end-to-end run failed the touch-target check
for a small "Read the notes" text link inside a card – it is a button-sized
link now. And two older tests bit back. A campaign test timed out at the five-second
default on the CI runner after taking 128 ms here, so the limit is now raised
for the whole app suite instead of file by file. The first story test, which I
had blamed on load too, turned out to be a real race of its own: right after
Save, the closed sheet still held the new prologue in its field while the page
already showed it, so `findByText` saw two matches and kept failing until the
timeout. Looking for it in the prologue's own region fixed it; raising a
timeout would only have hidden that.

## October 12, 2026 (cont.) — the world, in the open

The world of a campaign – factions, the people around them, and what each
warband has earned with each faction – is the first piece of the story layer
that every player reads. That is the point of it: reputation and who holds what
are mechanics, and the table rule from the start is that mechanics are open
(ADR 0002). So where the Background had to be built around who may not see
something, the world is built around who may *write*: a leader with the
authenticator, nobody else. A member reads everything, a viewer too; someone
outside the campaign gets a 404, the admin included.

I split 4b3 once more. Scenarios are a different animal – hidden until played,
with rules and NPC values in the TTS format – and they overlap with the
"scenario" kind of the Background, which is planning and ideas. That is a
question of its own, so they are 4b3c. And one table from the data model never
got built: `district_control`. Who holds which district already lives in each
warband's own save (ADR 0016) and the campaign overview works the map out from
it; a second table would have kept the same mechanic twice and let them
disagree.

Reputation is a log, not a number. An event has a warband, a faction, a step
(never nothing), a reason and optionally a battle; the standing is the sum, and
the app does the sum. An event is never edited – sent twice it is the same
event, sent again with other content it is a conflict – a mistake is taken out
and the log says who did. Removing a faction hides its people's affiliation and
its events with it, but touches nothing else. The one thing that is easy to get
wrong is what a leader puts into the open: a leader adds an NPC when the
players may know it exists, the truth about it stays in the Background, and
every form says so in one sentence at the top. The log of the server carries
ids, never the words.

On a phone the step of a reputation event cannot be a number field with a
minus sign: Android's numeric keyboard often has none. The form asks "gains" or
"loses" and an amount from 1 to 100 instead.

Wrong turns. The first draft of the tab had three buttons named "Remove" in one
card – the faction's and each person's – which is a test failure and also what a
screen reader would have read out; the buttons now carry the name of what they
remove. The first end-to-end run expected a standing of −3 where a warband
already had +2; the test, not the app, had picked the wrong warband.

## October 12, 2026 (cont.) — scenarios, hidden until played

A scenario is the one thing in the story layer that changes sides: before the
table plays it, it is the leaders' secret (the ambush waits on the far bank);
after, it is mechanics every player needs (the rules, the values of the NPCs
at the ferry). So it is neither the Background, which is only ever for leaders,
nor the world, which is open from the first line. It starts as a draft that a
leader with the authenticator reads alone – not in a list, not as a number –
and a leader *releases* it by assigning it to a battle of the campaign. From
then on every member reads it, and that is not undone: otherwise a leader could
make a text the players had read "never have been there". A released scenario
may still be corrected, the earlier wording kept; it cannot be taken out. A
draft can.

The distinction to the Background is now written down instead of left to be
guessed: a scenario is the leader's playable package; the plans, ideas and
notes around it stay in the Background under the kind "Scenarios", and nothing
is copied from one to the other behind anyone's back. The log carries ids and
the battle, never a title or a word; a draft's entries are visible to leaders
only. The leak matrix puts a draft with a marker word into a campaign no role
of the matrix leads and checks that no player ever reads it.

The NPC values are plain text in the form of the Tabletop Simulator export, and
the app has one button for what the table needs: "Copy statlines" puts the
title and the values on the clipboard. Without clipboard access the notice says
so and the text can be selected.

I pulled the sheet pieces both leader screens needed (the saving state that
keeps a form open with its words when the server refuses, the Save/Cancel row,
the dialog, the removal prompt) out of the world tab into `ui/FormSheet.tsx`
instead of copying them a second time.

Wrong turns. The world tab's test for a refused write clicked "Record
reputation" as soon as the button existed – but it exists, disabled, before
the world has arrived, and the extra request of the new section moved the
timing enough to make the click land on a disabled button. That was a race in
the test all along, not in the app; it now waits for the faction card first.
In the new copy test I stubbed `navigator.clipboard` and then called
`userEvent.setup()`, which installs its own clipboard over it; the test now
reads back from that one.

## October 12, 2026 (cont.) — the pack for whoever writes the chapter

The chronicle's chapters are written by Claude from the material of a battle,
and until now somebody had to gather that material by hand: the protocol, who
died, which advance the player explained, what the background forbids to tell.
The AI pack is that gathering, as one prompt: a leader opens "AI pack…" on the
Timeline, picks the battle, the parts and the language, and copies the prompt
(or downloads it as a `.md`) into a chat. The app still calls no AI (ADR 0004).

Where it is built was the first question. The briefing that already lived in
`core` wants a before and an after state of each warband, but a leader's device
only holds the head state of other players' warbands. What it does hold is the
list of changes frozen into each warband's mark (ADR 0003: tagged states freeze
what was computed, history is never recomputed). So `buildPack` takes those
frozen changes plus the explanations and profiles from each warband's save, and
the old briefing function stays where it was, untouched and unused. The pack is
made on the leader's device from reads the app already makes (ADR 0005), so
there is no new route and nothing for the leak matrix except the one new thing
the server stores.

What the writer is told is chosen in one place (`gather.ts`), not piece by piece
by the leader, because "I forgot to untick the plan" is exactly the leak the
background's levels exist to prevent. Leaders' own notes, GM notes, the
background's scenario plans, entries that have not started and pictures only
leaders see stay out. Background goes in with its rule written as a rule:
HIDDEN (say nothing, hint at nothing), HINT ONLY (within the limit the leader
wrote), REVEALED. A truth that becomes public only from a later battle goes in
as hidden for this one. The summary of earlier chapters is not an AI summary –
nobody should have to trust a summary of a summary – but the list of chapters
and the last one in full. What is missing (a warband not marked, nothing
recorded of the battle) is listed in the sheet as a gap instead of being left
out silently.

The only new server data is the style guide: one text per campaign in a new
table `campaign_docs` (migration 19), read and written by leaders with the
authenticator, `baseSeq` against two leaders overwriting each other. The log
says that it changed, never what it says.

Wrong turns. The sheet first read the Timeline's data on every render, and the
Timeline polls every 15 seconds – the prompt would have changed under a leader's
hands while she read it. The sheet now keeps the stand of the Timeline from the
moment it opened. The "AI pack…" button first enabled as soon as the campaign
had a battle, which let a quick tap build a pack from an empty timeline and
report "nothing recorded"; it now waits for the timeline, the notes and the
pictures. The style editor first let what arrived from the server overwrite what
the leader had already typed (a stale closure on a `loaded` flag); the text now
counts as the leader's once she types, and a copy from the device that arrives
after the server's is dropped. In the first version of the test the textarea
was clicked while it was still disabled for loading, which showed the last
point for real: the field waits for what the server has before it takes text.

## October 12, 2026 (cont.) — by hand, not by pipeline

The plan was that the server drops each AI pack into the agent's inbox on the Pi
and `chronik N` picks it up. Rob decided against wiring anything to automated
writing for now: he wants cleanly assembled notes, events, equipment and
warband changes that he hands over himself. The pack from the Timeline is
exactly that, so the drop-off, its route and the `ops/` change are gone from the
plan (ADR 0018; ADR 0004 stays otherwise). It also settles the worry behind
the old rule that the pipeline must never write the background into the public
chronicle repo: nothing leaves the server unless a leader copies or downloads
the pack, and every background piece in it carries its rule.

Looking at what "equipment and warband changes" the pack really carried turned
up a gap: gear taken up or given up, and gold, were frozen into every mark but
never listed by the pack (the old briefing left them out as bookkeeping). They
now have their own section, "Equipment and gold", found by a failing test first.

## October 16, 2026 — the whole story in one place

The chapters of the chronicle already stood in the Timeline, each at the head of
the part of the story it tells. The Chronicle tab reads them the other way
round: the story as a book, chapter after chapter, for everyone including
viewers (published means public, ADR 0002). It needs nothing new from the
server: the order is the Timeline's own (built without notes and pictures,
which a reader of the story does not need), and the text of a chapter is
fetched when it is opened, kept on the device like before. A chapter that
exists only in the other language is shown in that one and says so, rather
than disappearing from a language the reader chose; the downloaded `.md` marks
the same chapters the same way.

The tab was planned together with the import of new chapters as drafts. I split
it: reading and downloading are done and need no migration; drafts, with the
check for words from hidden background and a leader's approval before anything
becomes public, come next as their own step, because a draft is exactly the kind
of text that must not be readable by players.

## October 16, 2026 (cont.) — drafts, and a check that only warns

A chapter that comes in as text is exactly the kind of thing players must not
read yet: it may name the ferryman the story has kept hidden for four battles.
So it waits as a draft that only leaders with the authenticator see — for
everyone else the routes answer 403, outside the campaign 404, and the leak
matrix probes all four actions with a marker word in a foreign campaign. The
draft is one row per language of a chapter; publishing puts its language into
the chapter of the same `ref` (the other language stays, the same one is
replaced, and the sheet says which before anyone clicks), or creates the
chapter and needs its place in the story.

The check for hidden words runs in the client, like the pack (ADR 0005), and
shares one function with it: `ruleAtRound` now says when a revealed piece is
public, and the pack's gather uses it instead of its own copy of the
condition, so the two cannot drift apart. It finds words — a hidden piece's
title and the names in its truth that neither "players know" nor the public
names cover — not meaning, so it can only warn. A name at the start of a
sentence and an ordinary German noun look the same to it; I accepted some noise
over missing a leak, and made the leader read the excerpt and tick a box before
"Publish anyway" is possible. Every background piece is held against the text,
planned ones and the leaders' own notes included: the pack leaves those out
because they are not truth yet, but a chapter must not give them away either.

Wrong turns: my first ceiling test counted the published draft against the
hundred open ones (it no longer counts); the first excerpts reached back into
the title because the title and text are checked as one block, so the excerpt
now stops at the paragraph. The mockup had the check in the import form, my
first plan only in the review sheet — the form now checks as you type too,
from the background read once when it opens.

## October 17, 2026 — names for the linter

The canon export was planned as "the spellings for `spielbegriffe.txt`". Reading
the chronicle's linter showed that was the wrong target: that file holds the game
terms that must stay out of the prose (Wurf, Probe, Henchmen), which have nothing
to do with the canon. What the canon can give the linter is the other thing it
keeps by hand: `NUR_DEUTSCH` and `NUR_ENGLISCH`, the names that may stand in only
one language version. So the file is those two lists, generated — whatever
differs between the German and the English name of a warband, a warrior, a
title, a faction or a person, without the article, sorted — plus the names that
are the same in both languages, the ones still missing a language, and every
pair for reading.

It stays names only, on purpose: the chronicle's repository is public, and a
profile's voice and origin, the background and the notes have no business in a
file that may end up there. And it refuses to save at all when a warband could
not be read, because a list that silently lacks a warband is worse than no list.
The reserved `canon_extra` text was not needed; it waits until someone wants
extra spellings in the file.


## October 17, 2026 — report a problem

The first half of the bug tracker: a button in the header of every page, a
sheet that asks for a sentence, and a status the reporter can read later under
More. Rob's note from the planning (people mostly write "it doesn't work")
decided the shape: the report has to carry its own context, and the context has
to be safe to carry.

So the context is built from structure only. The app keeps a small in-memory
trail — which screen (as a pattern, no ids), which sheet opened or closed, that
a change was made (not which), the sync and network state, failed calls as
`METHOD /pattern → status`, the last five script errors — and nothing anyone
typed. A warband name or a hidden title in a heading must not travel into a
report (ADR 0002), and the cheapest way to be sure is that the trail has no
place to put them; the tests plant secrets in names, notes and tokens and check
none arrives. The form shows all of it before sending. The warband itself goes
along only with its own tick, as a copy taken at report time, and is thrown
away when the report is closed or marked a duplicate.

Hand-over stays by hand (ADR 0018, and Rob's "no direct connection for now"):
the admin gets "Copy for Claude", a .md of the report and the warband as .json.
The token route for a cloud session comes in the second pull request.

Wrong turns: I first put the open sheet's name into the context as its own
field, then found the header button sits behind the modal and cannot be tapped
while a sheet is open — the field could never hold anything, so it went, and the
sheets live in the trail instead. A `bug_comments` table was planned and dropped:
follow-up questions happen at the table or in the chat, and a comment list would
have been one more place for words to leak. For the attachment I started with a
reference to the warband and a new admin read path; that would have given the
admin a way into other players' warbands, so the report carries a copy instead.
And the list of "your reports" did not update after sending on the same page,
because nothing told it — now the sender notifies it.

## October 17, 2026 — the bug token

The second half of the bug tracker: how a cloud session reads the reports
without being able to read anything else. A bug token is its own kind of
access, not a session and not an account: `Authorization: Bearer rbt_…`, made
only by `roster-cli bug-token create` on the Pi, shown once, stored as a hash,
good for 60 days, at most five at a time. `policy.ts` gives `token: true` to
exactly two actions, `bugs.read` and `bugs.write`; the request hook turns a
token away with 403 on every other route before a handler runs, and a test
walks every registered route to prove it. A cookie next to a token is never
read, and a token needs no `Origin`: no browser sends that header by itself, so
there is nothing to forge.

The reports are text from the players and may contain instructions, so the
interesting question was less what the token may do than who gets to see it.
My first plan put it in an environment variable of the cloud environment. The
documentation says plainly that anyone using the environment can read those
values, and a session that holds the token can be talked into printing it. The
environment also has "network secrets": the proxy attaches the header to
requests for the server's host and the session never holds it. That is the
documented route now; the variable `ROSTER_BUG_TOKEN` stays as a weaker
fallback, in case the form a team plan shows has no such section.
The script that reads the reports (`npm run bugs`) therefore works without a
token of its own and only sends one when it has it.

Wrong turns: Node's built-in `fetch` ignores `HTTPS_PROXY`, so the first run of
the script died with "fetch failed" and no hint why; `NODE_USE_ENV_PROXY=1` in
the npm script fixes it, and the error text now says what to look at. The
script also printed the report as a plain block, which let a line of the text
look like part of the script's own output; reports are now fenced with a
longer fence than any run of backticks inside them, control codes removed, and
labelled as data. And the numbers: ADR 0012 wanted `Fix #N` in the commit, but
the reports only had uuids, so a migration gave them numbers (backfilled in the
order they arrived) and `/bugs/:id` takes either.

`/bugs` and the reviewer agent are plain files under `.claude/`; a test reads
them and checks that every npm script and subcommand they name exists and that
the reviewer has no tool that writes. The acceptance for 4c, a real bug from
report to "fixed in <version>", waits for the first real report.

## October 18, 2026 — live updates

The question that started it was a simple one: if Ben writes a note, does Anna
have to reload to see it? Until now, yes, or wait. Every screen polled on its
own clock (the sync every ten seconds, notes and pictures ten, the background
twenty, the timeline fifteen, the battle five), and half the screens, the
campaign, the chronicle, the world, scenarios, questions and the lists, only
loaded when you opened them. Nothing was wrong with writing — the server is
the single writer and every change carries its base revision — it was only
that nobody heard about it.

The shape is Server-Sent Events, but with one hard rule: the stream carries
signals, never content. "Campaign X has news", "your warbands have news", and
that is all; no title, no name, not even a sequence number (it counts every
campaign's activity, which would tell one campaign's members how busy another
is). The app asks the same endpoints it always asked, so everything about who
may see what stays in `can()` and the filters, and a bug in the live code can
make an app reload for nothing but cannot leak a note. Who gets a signal is
decided by the visibility the audit log already records: public entries reach
the active members, leader entries the leaders, a sealed note only its author,
admin entries nobody. I considered WebSocket (a second write path next to the
endpoints with their conflict checks, for no gain) and sending the content
(a second place to get filtering wrong), and dropped both.

Things that bit me on the way:

- Fastify's `onClose` does not end a stream, so `app.close()` hung; the hook
  that runs before the server stops listening is `preClose`.
- After a client aborts a stream, Node 22 does not treat the next keep-alive
  connection as idle, so `server.close()` waited for the client's own keep-alive
  timeout. I reproduced it in plain Node, then made the tests use a plain
  `http` client without keep-alive and gave `start.ts` a grace period after
  which it cuts what is left.
- A heartbeat sent as an SSE comment never reaches JavaScript, so the app could
  not tell a dead line from a quiet one. It is an `event: ping` now, and the
  app reconnects after seventy seconds of silence.
- The first full run of the server tests was reported green while the real run
  was still going in the background (my wrapper returned at once) and the
  leak matrix was red because of the shutdown issue above. I said so and ran it
  again properly.
- The old timers stay as the fallback and only thin out while the stream is
  open, so a browser or proxy that refuses the stream costs nothing but the
  old wait. Signals that arrive while the app is away are not replayed; the
  app asks for everything it shows when the stream opens, when it comes back to
  the front and after a long silence, which is what makes losing a signal
  harmless.

## October 18, 2026 — the roster as a list

Rob approved the second roster mockup (PR #70) and asked for two things in
the real app: the desktop matters more than the phone, so use the whole width
and show the information at once; and with many units nobody should be buried
under a wall of text. The old roster was a card per warrior with everything
inside and a ⋯ menu behind it for the rest, which is exactly the wall.

The shape now: one row per warrior – name, the whole profile, experience as a
number and as a bar of its steps, up to four marks, what he carries. The row
is a button. On a phone it opens in place under itself with four tabs
(Overview, Gear, Skills & injuries, Story & more); from 860 px of workspace it
selects the warrior into a pane beside the list with every section open, no
tabs; from 1560 px the warband's own functions (house rules, districts, story,
versions, copy …) stand in a third column as a plain list. Everything the ⋯
menu held has a visible place now, and the menu sheet is gone.

Decisions worth remembering:

- **The width that counts is the workspace's, not the window's.** The sidebar
  and the page padding are already gone from it, so a media query on the
  window said "desktop" for a workspace that was still phone-sized. A
  ResizeObserver on the board itself picks `stack`, `split` or `triple`; the
  table-like rows and the header use container queries for the same reason.
  In jsdom, without a ResizeObserver, it stays on `stack`, so the unit tests
  read the phone layout.
- **The print sheet exists only while printing.** Paper wants every warrior
  in full, the screen wants rows; a hidden second copy would have put the
  whole list in the page twice (for screen readers, for tests, for the
  budget). `beforeprint` mounts the sheet (with `flushSync`, the browser lays
  out right after the event) and `afterprint` removes it.
- **One board for both own and foreign warbands.** The read-only campaign
  view passes no actions and gets the same list; it cannot drift from the
  editable one.
- **A row says the same to a screen reader as to an eye**: the button is named
  "name, N men, type" and describes experience, profile, marks and equipment.
  The steppers and buttons inside kept their old labels, which is what let
  most of the e2e flows survive with an `unit(page, name, tab)` helper in
  front.

Things that bit me on the way:

- The toolbar would not stay on top: `position: sticky` inside a grid cell
  sticks only within that cell. The page had to become a flex column (and
  then it needed its `gap` back – the first screenshots showed everything
  touching, which I only saw because the checklist says to look at them).
- A type label ("Henchman group") wrapped into two lines in a narrow row;
  `nowrap` on that span only, not on the row.
- Pressing Esc in the name field still saved what was typed, because leaving
  the field commits. The unit test for the field caught it; a flag set by Esc
  and read by the commit fixed it.
- The first e2e run with the old tests failed all of them at 7–30 s each. I
  stopped it and rewrote the flows instead of waiting for the timeouts.
- Status marks appear twice on an opened warrior (in the row, which shows four,
  and in Overview, which shows all). I left it: the row must stay short, and
  the card must not make you look for what the row cut off.

## October 19, 2026 — deleting a campaign, and an archive of one's own

Rob asked for two things that sound alike and are not: a leader deleting a
campaign, and every player filing campaigns away. The first changes what
everybody sees, the second only one person's list.

Deleting is a tombstone, as everything else that is deleted here: the row
gets `deleted_at`, and because every campaign route already loads the
campaign through `campaignById`, one more condition there makes every route
answer 404 at once – notes, timeline, pictures, the world – without touching
twenty handlers. Rob chose that the warbands stay with their players: their
`campaign_id` goes back to NULL with a new `seq`, so the devices pick it up on
the next sync. The enrolments stay as they were, which is what lets the
admin bring a campaign back with `roster-cli campaign restore`; a warband
that was entered somewhere else in the meantime stays where it is.

Campaigns already had an `archived_at` column from migration 5 that nothing
used. I did not reuse it for deleting: "archived" now means the player's own
list, and a column named archived that means deleted would mislead the next
reader. It stays unused and says so in the data model.

The archive is `members.archived_at`, one row per player. The list shows the
archived ones in their own section. One wrong turn: the list jumps straight
into the only campaign one plays, and after archiving one of two it did just
that – the player was carried off the list they were sorting. It now jumps
only on arrival.

The leak matrix probes the delete with a campaign of its own that the
admin's probe (the last role) deletes, so no later probe stands on a
tombstone.

## October 19, 2026 — a side navigation that opens, and an account that is a person

Rob found the three dots of "More" confusing – three dots usually mean a menu
or settings – and wanted the entries on the left to open into what is under
them. The last entry is now "Account" with a person in the campaign app and
"Settings" with a gear in the Quick Build, which has no account; the address
stays /more so no link breaks.

From 900 px on, Warbands opens into one's newest warbands and Campaign into
one's campaigns, and under the campaign one is in, its sections. Which
sections a player sees was written out in the campaign page itself; it is a
small function now (`campaign/tabs.ts`) that the page and the side share, so
the two cannot drift apart.

Two things decided the shape. The side entries are only rendered when the
screen is wide (a media query in script, not only in CSS): in jsdom and on a
phone the campaign keeps its own tabs and no link appears twice, which kept
every existing test that looks for "Manage" or "Timeline" by name. And the
open campaign is read from the device's own copy (a live query on the cached
view), so an archived campaign or one whose list has not come yet still has
its sections at the side – otherwise hiding the page's tabs on a desktop
would have left no way to them.

## 19.10.2026 – Pixelart auf jeder Seite

Rob: die Seiten wirkten leer, es fehle immer etwas, und er wollte auf jeder
Seite passende Pixelart. Entschieden: ein Banner im Seitenkopf plus eine große
Szene im leeren Zustand, auch bei „weniger Bewegung“.

- **Im Code gezeichnet statt als Bilddateien.** Elf Szenen aus einem kleinen
  Pixelmaler (`app/src/art/`), ein SVG mit einem Pfad je Farbe. Das bleibt
  klein (die App liegt bei 193,5 von 200 kB beim ersten Laden), scharf in
  jeder Größe und lässt sich im Test prüfen: feste Palette, kein Zufall, das
  Motiv bleibt in seiner Breite.
- **Das Banner ist nur in der Mitte gezeichnet.** Der erste Versuch war ein
  Bild über die ganze Breite; am Desktop (1600 px) wäre es entweder gestreckt
  oder abgeschnitten gewesen. Jetzt stehen Himmel und Boden als harte Bänder
  daneben (derselbe Verlauf wie im Bild), und das Motiv sitzt in der Mitte.
- **Der Test der Motivbreite fand echte Fehler:** ein Streifen über die ganze
  Breite in der Stadt, eine Kerze und ein Dolch außerhalb der Karte, ein
  Schlüssel weit rechts neben der Tür.
- Der Komet schlägt nicht ein (anders als im Mockup): in der App soll das Bild
  ruhig stehen; Wappen der Warbands kommen später, wenn Rob sie dort will.
- Im leeren Zustand bleibt der bisherige Satz als Titel stehen, weil Tests
  und E2E ihn genau abfragen; die Erklärung steht darunter.

## October 19, 2026 — which version goes into a battle

Rob wanted the versions of every warband checked before and after each
battle: the player confirms the one that goes in, the leader sees it beside
the one that comes out. The "after" half already existed (the mark after the
battle, ADR 0016); the "before" half was only a number, `rev_before`, which
the server guessed as the newest version when the battle began – so nobody had
ever said which version it was.

The confirmation is now a fact of the participant: who confirmed which
version, when, and the totals frozen at that moment (`stageTotals`, the same
function the tags use, so before and after compare like with like). The
player confirms by saving the warband as a version "before battle N" – the
number on the table is then the one the player saw – and a leader may confirm
for them with what stands on the server. A confirmation can be repeated while
the battle is open; each one replaces the last. It never blocks anything: a
battle with an unconfirmed warband is fought as before and says so.

The server refuses one thing: marking a warband after the battle with a
version older than the one confirmed before it (409 `older`). That can only
be a stale device saving over a newer state. The diff of the changes still
starts at the previous tag, not at the confirmed version – ADR 0016 stands –
so a warband improved between the tag and the confirmation reports those
improvements as changes of this battle, as it did before.

Wrong turns: the first client tests looked for rows by the warband's name,
which also stands in selects and headings; they now ask the "Who fought"
region. The stand-in server had only the entered data of other players'
warbands and answered 403 to a leader's confirmation for them – it now treats
that as version 1, as the real server does.

## October 19, 2026 — a battle number of one's own, and the backstory

Two wishes that belong together: start a campaign in the app at battle 4
without entering battles 1–3 one by one, and still have the group's old
chronicle in the app.

The number was the easy half. The server already took a `round` when a battle
was created and only refused the ones the history before the app had taken;
only the sheet insisted on "round + 1". The catch is the round of the
campaign: "move on" looks for the battles of round + 1, so a campaign that
starts at battle 4 would wait forever for a battle 1. Creating battle N now
brings the campaign to N − 1 (never backwards, no sat-out marks for rounds
nobody played here) and writes it in the log as skipped.

The backstory is not a chapter and not history. Chapters are prose with a
place on the timeline; the history is a list of battles with who fought and
how it ended; the backstory is the group's old text, cut into sections, which
everybody reads and the AI pack carries. I made it a table of its own with
the sections as one JSON list that is replaced as a whole – the same shape as
the style guide, with the same stand check against two leaders – because a
section-by-section merge would only invent conflicts. Unlike the style guide
it is readable by every member, viewers included: it is the story the players
lived. That is why the import sheet holds each section, at its own battle,
against the hidden background before saving and wants a knowing tick when it
finds something.

The pack says "format 2" now: a new heading, and the format is meant to rise
whenever a heading does. Only the sections before the battle go in – what a
section tells of this battle or a later one is what the chapter is about to
say.

Wrong turns: the first splitter took "Battle 3 was the worst of them all." for
a heading; a line that ends like a sentence is not one now. And the worktree's
`node_modules` was a link to the main checkout, so the app resolved `core` from
there and did not see the new pack input until the worktree got its own
`@mordheim/*` links.

## October 19, 2026 — the leaders' plan for a battle

Rob wanted to set the red thread of a coming battle in advance – for the
write-up and as his own note. The background already had threads and GM
notes, but the AI pack leaves planned threads and GM notes out on purpose:
they are what may not slip into the prose. A plan is different: it is
direction, not a secret to keep consistent with. So it became its own small
table, keyed by the battle's number rather than its id, because the plan is
written before the battle is set up. The pack carries the plan of its battle
only, as "The leaders' plan ⚑", with an instruction never to contradict what
was recorded; it is a part the leader can switch off like the others. The
format number stays 2 – it rose with the backstory in the same series of
changes, none of them released yet.

At the battle a leader sees the plan folded, so it is not on the screen by
accident when the table looks over. The first test for that was green for the
wrong reason and then red for a wrong one: the player's device in the test
still held the leader's cached campaign view from the step before, saw itself
as leader for a moment and asked for the plans (and got a 403). A real device
changes accounts with its cache cleared; the test now does the same.

## October 19, 2026 — opponents

Rob wanted to build opponents ahead of a battle: profiles with the usual
characteristics, copied from any model of the game or invented, grouped,
changed, with skills from the game or of his own, and on the TTS table. He
chose that they stay leaders' only – no release to the players, unlike
scenarios.

The templates come from everything the rules data already holds – every
model of every warband, the Hired Swords, the Dramatis Personae – plus the
warriors of the campaign's warbands as they stand, read through the same
core functions the TTS export uses, so a copied veteran carries his advances,
skills and kit. Animals were the gap: the data had six mounts, the project's
bestiary doc fourteen creatures. They went into a new `data/bestiary.json`
that only the new app loads (legacy keeps its own file list); it is template
data for leaders' opponents, never a warband's entry, and still Rob's to
audit like any rules data.

A copy is never a link: a profile is the leader's from the moment it is made,
characteristics as text ("3(4)", "D6") because opponents are not bound to a
rules engine. A skill on a profile carries its tooltip text with it, so a
card still reads right after the campaign's own skill was changed or taken
out.

The bestiary was checked against mordheimer.net the same day, entry by entry.
All fourteen profiles match, to the last digit, the project's copy of the
Animal Bestiary and, where the live site still shows them, its pages (the
Wardog, the horses, the Rhinox and the Temple Dog). Two things came out of it.
The Wardog lacked the note the site credits to Tuomas Pirinen: in battle it
counts for Rout tests like any warrior, in the campaign it is equipment and
costs no upkeep – now a rule line of its own, with a test; the site marks
whether it counts towards the maximum warband size as unclear, and the line
says so. And the live Border Town Burning page has moved Skull of Iron and
Staggered, but not down from the Rhinox and the Temple Dog into the
introduction of the section, where they apply to every mount: same effect, so
the entries keep them. The Blazing Saddles mounts and the Gnoblar no longer
have a page of their own on the live site (only their prices survive on the
spoils page), so for them the project's copy is the only check there is.

Wrong turns: the first search results said "Hired Sword · Hired Sword · 1a ·
1a" – the source repeated the type and the grade; hires now name their book.
And the first client test waited a second for the model search, which in
jsdom needs several the first time the rules data is read; the pickers now
have their own Suspense boundary, so the group form never blanks while the
rules load.

## October 19, 2026 — opponents at the game table

Rob asked whether an opponent can be made while the battle is already running.
It could not: the groups lived under Background, a full-screen game night away
from the table, so a leader who needed a stray ogre now had to leave the
protocol, find the tab and come back.

The Opponents section is now one component with two homes. On the game night's
page a leader with the authenticator gets it under "Who fought" while the battle
runs – the groups, "New group", "Edit" and the TTS cards; the campaign's own
skills stay with the tab, but a skill typed into a profile can still be kept
among them on the spot. It takes a list of warbands instead of a whole campaign
view, so the battle page, which has none, can offer "Our warriors" from the
campaign's enrolments the device already kept (the fighters otherwise). The panel
is loaded on demand, so the battle page's start costs nothing more; and for a
player, a leader without the authenticator or a closed battle it is not
rendered and the server is not asked.

A wrong turn in the test, not in the code: the second case showed the panel in a
closed battle because the device still held the first case's cached view under
the same ids. A real device changes accounts with its cache cleared; the test
now does the same between its cases.

## October 19, 2026 — the desktop overview

Rob's focus for the campaign is the desktop, and Home and a campaign's overview
were still the phone's one column stretched wide. A picture of each at 1440 px
showed it: on Home, a card and two rows as wide as the screen, and more than
half of the page empty; on the overview, the warbands on the left with nothing
under them, and everything else – four member cards, the battles, a poster-size
picture for "no district yet" – piled up on the right.

Home now has two columns from 900 px: what waits and the warbands (as a grid,
six instead of three) on the left, and a new card with the campaigns in play on
the right, one line each. The list comes from one hook, `useCampaigns`, that the
side navigation already needed in its own copy; it answers `null` until a list
has come, so "none in play yet" cannot flash up first. The overview sorts who
(warbands, members) to the left from what happened (battles, the map) to the
right, which also keeps the column that grows with the campaign – the battles –
apart from the one that grows with the players. Members are a line each with
their role as a chip instead of a card each, and an empty part of a page shows
its scene small beside the sentence (`Empty compact`); the large picture stays
for an empty screen. On a phone the order is what it was.

A wrong turn that the picture caught and the tests did not: the campaign's own
tabs came back on the desktop, next to the side navigation that carries them.
They hide with a rule in `Campaign.module.css` that has the same specificity as
the `.tabs` of `Account.module.css`, and which one wins was decided by which
stylesheet the bundler put first. Home now imports the campaign's styles, which
moved them ahead of the account's. The rule is `nav.pageTabs` now, so it wins
either way. I saw it only because I looked at the screenshot; the new checks
were green with the tabs doubled.

The cost, measured: first-load JavaScript went from 195.6 to 196.2 kB in the
campaign app and from 194.4 to 196.0 kB in the Quick Build, which shows no
campaigns at all – the card, the shared hook and the compact scene come in with
the entry in both. Loading the card lazily or giving it the shared list styles
instead of the campaign's own saved 0.1 to 0.2 kB each, so the second is what
stayed (it also keeps Home from importing the campaign's stylesheet). The Quick
Build has 4 kB left under its 200 kB; it is the flavour that will hit its limit
first (ADR 0021, proposed in #88).

Left alone on purpose: from 1920 px the content stays 1320 px wide. Stretching
rows of three words across the whole screen would be worse than a measured
column; a third column would be the next step, if Rob wants one.

## October 19, 2026 — a budget per flavour

Rob asked whether the 200 kB first-load budget should grow: the campaign is
played mostly on a desktop, where more than 200 kB should be fine. The budget
had two uses in the same number – a guard against an accidental heavy import,
and a stand-in for "the app starts quickly on a phone" – and only the second
is about the player.

Measuring it came before deciding. On master the campaign loaded 190.0 kB and
the Quick Build 188.8 kB, so 4–6 kB of room; the pixel art alone had cost 5.4
kB, everything else about 0.2 kB per change. The start-up test (slow 4G, a
phone with a 4× slower CPU, 3 s) takes about 2.0 s today. I padded the
campaign build with 68 kB of throw-away code to see what more bytes cost:
2.4 s, so roughly 0.6 s per 100 kB. That put the sensible ceiling for the
campaign near 250 kB while the phone test stays what it is – more would need
a desktop profile of its own, which nobody has asked for.

So the campaign gets 250 kB and the Quick Build keeps 200 kB (ADR 0021,
accepted by Rob on October 19). The Quick Build is what a newcomer opens on a phone from a link,
without cache or account, and the two flavours share nearly all their code:
the extra room is only ever filled by code that belongs to the campaign alone.
The padding was code that mostly sat idle at start; code that runs at start
costs more CPU, which is one more reason to keep the time test the real
guard. `size.mjs` now holds one limit per flavour, and a test checks that
`docs/ui.md` names the same numbers, so the two cannot drift.

## October 19, 2026 — sheets in the middle, wide, with the page held still

Rob: the pop-ups sit badly – something is missing at the bottom, so the page
behind has to be scrolled all the way down first, though there is room above;
and on a desktop they may be much wider. The cause was one rule: `.sheet` was
a bottom sheet at every width, 640 px wide, stuck to the lower edge. docs/ui.md
had already promised "in the middle on a desktop" – the promise was never
built. From 900 px on a sheet now is a window in the middle (920 px, wider with
`sheetWide`), its fields in two columns by a rule on the form rather than by
touching every sheet, and while one is open the page behind does not scroll
(`html:has(dialog[open])`), so scrolling inside the sheet cannot drag the page
along. A phone keeps the bottom sheet.

## October 19, 2026 — NPCs as values, not as a text to type

Rob: adding an NPC to the world meant typing its statline in the Tabletop
Simulator format by hand, which gets tedious fast; the form should have a
template with Movement, WS, BS and so on, so only the numbers go in. The text
may stay, but as a fallback. And when the NPC is a monster, copy it from the
bestiary right there; and give the bigger options more room.

The pieces already existed for opponents (a profile with the nine
characteristics, a save, skills, equipment and rules; the picker over every
model of the game), so the NPC form reuses them instead of growing a second
editor – they moved into `ProfileTools.tsx`, and the picker learned to offer
the world's own NPCs as templates, so a person made once can be copied into
the next. The NPC keeps its values in a new `profile` column; the text
`statlineTts` is written from them, so the world, the older readers and the
scenarios' TTS copy keep working unchanged. An NPC written as text before this
opens as text; "Values" reads it back with `parseStatline` when it names at
least five characteristics, and otherwise says so and keeps the text rather
than silently dropping it.

One thing I weighed and did not do: storing only the values and deriving the
text on read. Older NPCs have only text, and a hand-written text may say more
than the grid holds, so the text stays a column of its own and the values are
optional.

The form is loaded when it is opened, so the first-load budget does not pay for
the picker. Also new: a `Named` flag on an NPC – a person of its own rather
than one of a crowd – which threads of the Background will refer to next.

## October 19, 2026 — a thread refers to a faction or a person, not only a battle

Rob: "Refers to" on a thread could only point at a battle, and should also
reach a faction or a Named NPC. The server already stored references as
`{ kind, id, label }`, so the change is two new kinds (`faction`, `npc`) and a
better way to choose: a dropdown that grows a section per kind gets long, so
the form asks what the reference is about first and then shows what can be
picked as tiles – a tap adds, a second tap takes it out.

Two small decisions. Only NPCs marked Named are offered: a deckhand is not
something a thread is about, and the flag Rob suggested at NPC creation is
what keeps the list short. And the card shows the current name, not the one
written down, because a renamed faction is still the same faction; the written
label is the fallback, with a "(removed)" when the world no longer has it. The
server does not check that a faction or NPC exists, as it does not for a
battle reference: a reference to something since removed is harmless, and
refusing to save an entry because of it would be worse.

## October 19, 2026 — a Warbands section under Campaign

Rob asked for a sub-entry on the left under Campaign, "like Warbands", for a
quick overview. The overview already listed the warbands in a line each, which
is a list to find one warband in, not a way to compare them. The new section
shows a card per warband that takes part, with what the last mark froze
(rating, warriors, heroes, gold, fallen), a bar against the strongest, the
districts it holds, and the ones waiting for a leader apart. The numbers come
from the enrolment's tag, so the page costs no extra request and works from
what the device kept – the price is that they are those of the last mark, not
live ones, which the page says. `EnterSheet` moved into its own file so both
the overview and this section can use it.


## October 19, 2026 — NPCs in a scenario, with parts the players cannot read yet

Rob: a scenario should take NPCs, added or made once the scenario exists, with
a tick that hides single stats or all of them (maybe the name) as "?" in the
Tabletop Simulator copy – so a scenario can be released without explaining a
creature that may come back, and the NPC can later be dragged into another
scenario.

The first answer to "hidden values" was already in the repo, and it was no:
ADR 0002 keeps mechanics open and only narrative hidden. The new case is
different in kind – a leader keeps a value from the players for a while, then
shows it – so it got its own ADR (0022) instead of bending the old one, and
the ADR names the rule that keeps the old promise: the **server** replaces a
hidden part by "?" before it answers (visibility is only ever filtered there),
a leader reads everything, and after the release a hidden part can be shown but
never changed or newly hidden. Without that last rule, "hidden" would be a way
to rewrite what the table had already seen; showing a part is logged as
`scenario.reveal` for the same reason. The free-text statlines are not
redacted – the server cannot know what a line means – and the form says so.

The form reuses the NPC grid, the model picker and the skill adder of the
world's NPCs (`ProfileEditor` only learned a `locked` list), and is loaded when
it opens. "Bring along from another scenario" copies the NPC with what was
hidden: an NPC that was still a mystery stays one until the leader decides
otherwise. A wrong turn worth keeping: the first version labelled the name
field "Name" and the hide-checkbox "Name" as well, and the test (and a screen
reader) could not tell them apart – the field is now "Name of the NPC".

## October 20, 2026 — the report button is a beetle

The "Report a problem" button had been in the header of every screen since
4c1, drawn as a flag – the same flag as the warband banner in the navigation.
Rob could not find it. A flag says nothing about bugs; a beetle does, in every
tracker people have seen. So the button is now a beetle with its word, "Bug",
next to it (an icon alone was the mistake, not only the picture), and it opens
the form with the kind "Bug" already chosen. The form keeps its name,
"Report a problem": it also takes wishes and wrong rules.

## October 20, 2026 — the authenticator's code signs in by itself

Rob asked whether the six digits could sign in without pressing Confirm, "under
realistic security assumptions". They can: the server sees the same request
and keeps checking it, and the brake counts the tries, so a form that sends a
little earlier gives a guesser nothing – a guesser does not use the form. What
changes is for the honest player: a typo at the sixth digit used to be
correctable before it was sent and is now a try, one of the five free in 15
minutes. So the wrong code stays in the field, selected, and is sent again only
once it was edited; a try on its way blocks a second one; a line under the field
says it before anybody types. The recovery codes have no length to wait for and
keep the button.

## October 20, 2026 — NPCs without a type, with an eye, and straight from the world

Rob's list after playing with the scenario NPCs: the type must never show, not
even as a "?" ("too meta for our table"); one click should hide everything; the
fold-outs under a card should look like something one can open; and the people
made under World should be addable right where the NPCs of a scenario are. The
first answer to the type was the obvious one – leave it out of the form. The
wrong turn would have been to stop there: the server still sent it to the
players (with a "?" when the name was hidden), and the Tabletop Simulator card
took its name colour from it. So `redactNpc` now sends the type empty, whoever
reads, the card does not depend on it, and a leak test carries a marker in the
type. The eye next to the password field was Rob's picture for the leader and
player views of a card; it is a toggle per card, leader's view by default, and
only NPCs with something hidden have one – on the others there is nothing to
compare. "Hide everything" is every part of `HIDABLE`, not a list of its own, so
a part added later is in it without anybody remembering.

## October 20, 2026 — equipment from the whole database, and tooltips the players do not read

Equipment in an NPC had been a line of text, typed by hand. Rob wanted every
item the database knows to be pickable – and, in the same breath, the tooltips
to be hideable: the players see the huge sickle in the enemy's hand and are not
told yet what it does. Two things came out of that. The picker reads
`data/equipment.json` (245 items, 240 of them with a description) through
`equipmentCatalog`, so there is no second list to keep in step with the audited
data; the tooltip text is the item's own line (kind, range, strength, save –
without price, rarity and who may buy it, which a tooltip for the table does not
need) followed by its rules. And the tooltips became a hidable part of their own (`equipmentTips`)
instead of a flag on the equipment, because the two are different secrets: the
name of the item is what the players see, what it does is what they do not.

The first idea was to hide the tooltips only when the equipment itself is
hidden. That would have answered half of the request. The wrong turn to avoid
on the other side: a hidden tooltip that simply disappears tells the players
that there was one – so it reads a single "?" whether the item had a tooltip or
not – and hidden *equipment* takes its tooltips with it, because their names
alone would give the item away. Both are pinned by tests in the core and in the
server's leak matrix, which carries a marker in a tooltip.

The World tab shows the tooltips to everybody: an NPC under World is open
mechanics (ADR 0002). Profiles saved before the field existed read as "no
tooltips" – the field has a default in the schema, so no migration was needed.

## October 20, 2026 — a shorter test run

The browser tests had grown to over twenty minutes, and a wobbling check could
fail a pull request that was fine (#97 failed on a unit test that read the
screen a moment before it had redrawn). Where the time went: the mockups – frozen design
sketches – were 12 of the 21 minutes. They now run on their own, only when
something under `docs/mockups/` changes, and the rest runs with several workers
(three locally, two in the CI): about seven minutes locally. The tests stay;
two that measured too early now wait for the thing they measure.

## October 20, 2026 — `/bugs` for several reports at once

`/bugs` fixed exactly one report. Rob asked for "all". The obvious version – fix
them in one branch – would have produced one pull request that nobody can merge
in parts. So the batch is a loop over the single case: S1 first, each report on
its own branch from `origin/master` and in its own pull request, never stacked
(stacked branches were what caused the merge conflicts of that day), and a
report that does not work out is skipped and named, not pushed half-done. What
stays with Rob is unchanged: rules issues, wishes, anything that needs a
decision.

## October 20, 2026 — a battle made by mistake can go again

A leader who started a battle by mistake had to keep it: the server knew no way
to take one out, and the closing, the marks and the tags all assume a battle
stays. The wish was to delete it as long as it is open. Two things made that
more than a button. First, a device that made the battle offline sends its
"create" again with the same id – sending twice must still be one battle
(ADR 0010) – so a deleted battle would have come back from the outbox; the id
is now kept in `removed_battles` and answered with 409. Second, other things
point at a battle: notes sealed until it is closed, pictures, questions. The
first idea was to let go of them all; that would have left sealed notes that
never open, so while anything alive hangs on the battle it stays (409
`in_use`), as for a battle of the history, and only what was taken out itself
lets go. The warbands' versions are not touched: before a battle is closed
there is no mark for it.

## October 21, 2026 — the Library: where ideas live

Rob wanted a place for ideas, and in the same list of wishes: factions, NPCs,
groups and scenarios that do not belong to one campaign, to be written once and
loaded into several. All of them are things a person owns, not a campaign, so
they got one home: a private store on the account, a "Library" in the
navigation with a tab for each kind, ideas first. The decisions he took – on
the server rather than on the device, a copy rather than a link when something
goes into a campaign, readable by the owner alone – are in ADR 0023.

The wrong turn to avoid was the device. A note kept in the browser is what you
lose with the phone, and an idea is exactly what you do not want to lose.
The other one was reusing the campaign tables with a null campaign: it would
have put a person's private drafts behind the rules for campaign members, and
every query would have had to remember that the campaign can be missing. A table
of its own has one rule – the owner – and one place in the leak matrix. Its
`seq` is the owner's own counter rather than the audit log's, because the audit
log is read by the admin and a private idea does not belong in it.


## October 21, 2026 — one item under two names (#20)

The Merchant Caravans' equipment list has a "Cathayan silk cloak" at 40 gc and
the price chart has "Cathayan silk clothes" at 50+2D6 gc, Rare 9. The app took
them for two items, so the cloak was "not in the price chart" and could be
bought at any time after the first battle – and its tooltip said "−1 to hit
missile weapons", which I could not find on mordheimer.net at all. A reporter
said they are one item under two names; Rob agreed, and the site backs the
effect: the FAQ's list of single-use items says "Cathayan Silk Cloak (first
rout test)", which is the clothes' re-roll. I first tried renaming the chart
entry to "Cathayan silk clothes (Cathayan silk cloak)", which the existing
bracket matching would have understood – and which would have silently broken
the Artisan Quarter's half price, because that matches the English name
exactly. So the chart entry got an `alias` instead: the German keys the lists
use for the same item.
## October 21, 2026 — lore for world building

Wish #18 asked for ready-made regions, factions and groups to start a world
from. mordheimer.net has the lore: the Empire in Flames, the City of the
Damned, the Warbands of Mordheim, the Ostermark article and the mercenary
warbands' home cities. I read those pages and wrote one short summary of
my own per entry into `data/lore.json`, each with its source link, keeping
only what has more than a subordinate clause of lore behind it – so Ostermark,
the Eerie Downs, the Freetraders and the Witch Hunters are in, while the
Skaven (one sentence, "their story is their own") and Badenhof (a name) are
not. It is not rules data, so it sits next to the audited files but outside
the loader the legacy app uses, and nothing in it is playable.

In the Library it is a read-only tab with an "Add" button that copies an entry
into one's own factions (or, for a region, into an idea about a campaign):
the catalogue stays as it is, the copy can be rewritten. The two sources of
this lore disagree about one thing – the Ostermark article has Magritta on the
throne, the core introduction has her refused – and the entry says both rather
than picking one.

## October 21, 2026 — NPCs that outlive a campaign

Wish #8: an NPC lived only inside one campaign, so a person who should turn up
in the next one had to be typed in again. The Library got a third kind, `npc`,
shaped like the world's NPC with one change: the faction is a *name*, not an id,
because a faction id means nothing outside its campaign. When a leader imports
the NPC into a world, the faction is looked up there by name and the NPC simply
has none if there is no match – better than inventing a faction in someone
else's world. The values form is the campaign's own; it only had to learn that
there may be no campaign (no own skills to keep, no warriors to copy from).

## October 21, 2026 — opponent groups in the Library

The second half of wish #13. A group of opponents is a name, a note and a list
of profiles, so the Library kind is the campaign's group minus the things that
only make sense inside a campaign: the `baseSeq` (the Library has its own) and
the links to the campaign's own skills. That last one mattered: a profile's
skill can point at a skill a leader wrote for one campaign (`ref`), and a copy
into another campaign would point at nothing. So copies in either direction
keep the skill's name and tooltip and drop the link; the other campaign shows
it like any skill that was typed in. Every profile also gets a new id on the
way into a campaign, because a profile's id is its identity inside its group.

## October 21, 2026 — scenarios in the Library

The last kind of wish #13. A scenario carries NPCs with parts hidden from the
players (ADR 0022), and the form that edits those hides, reveals and freezes
things against a campaign's release state – none of which means anything in the
Library, where nothing is ever released. So the Library keeps the whole scenario
(rules, statlines, NPCs with their `hidden` lists) and only lets one edit the
title, rules and statlines; the NPCs travel along untouched and are changed in a
campaign after the copy, as a draft, where their form already lives. That kept
the slice small and, importantly, left the visibility rules alone: a copy always
arrives as a leaders-only draft, and the Library is private to its owner.

## October 21, 2026 — groups for one's own warbands

Wish #10 wanted folders for the warbands list, assigned simply. The warbands
themselves live on the device and sync as saves, and a save has a strict format
that only rises with a migration – so a "group" field on the warband would have
touched the format, the sync and the compat test for what is really a view the
person keeps of their own list. The groups went where private, per-account,
offline-readable things already live: the Library, as a sixth kind. A group
holds the ids of its warbands, and assigning is one choice under a warband that
rewrites at most two groups (the one it leaves, the one it joins). The cost is
a table rebuild (migration 33, because SQLite cannot widen a CHECK) and that
the order of two writes is not atomic; the worst case of a failed second write
is a warband in no group, which the list shows as such.

## October 21, 2026 — a search mask for the rare items (#22)

The Hired Swords have a mask (name, grade, a characteristic compared with a
value); the rare items only had a kind switch and a name box in the search
sheet. The rare items carry their rules as prose, not as numbers, so there is
no "S >= 4" to compare: the mask finds by name *or* effect and by the words
that name a characteristic ("Movement", "Leadership", "save" …), and narrows by
the highest rarity. That is approximate by nature – an item that says "Strength"
only to say it is unaffected still matches – which is why the list now shows
the first sentence of each item's rules, so the match can be judged at a
glance. The same mask sits in the sheet a Hero's own Search button opens.
## October 21, 2026 — the Warhorse is rare (#21)

The Knights Vanguard's list offers a Warhorse at 40 gc and the app had no price
chart entry for it, so it counted as "not in the price chart" and could be
bought at any time. The Animal Bestiary on mordheimer.net gives it Rare 11,
80 gc, humans only; Rob agreed to treat it like the silk cloak. Two things the
first draft got wrong: a miscellaneous item has no category barrier, so every
Hero of the Merchant Caravans would have been offered the found Warhorse – the
list's footnote says Knights Vanguard only – and the legacy catalogue check only
knows whole warbands in `notWb`, so teaching it units would have broken the
parity suite. The unit restriction therefore lives in the trading rules
(`keptFromUnit`), which have no legacy counterpart. The second: a recruit may
not buy a rare list item, which would have shut a new Knight out of his own
Warhorse; the founding-priced row is exempt, as Rob asked ("a new Hero with
this Warhorse just pays").

## October 21, 2026 — the Trading Post without a box around every item (#23)

"Ugly, especially the boxes around the items" was fair: every row of Buy,
Search, Sell and Give – and every choice in the sheets and on the wide Give
board – was its own bordered, filled box, so a list of twelve items was twelve
boxes with gaps between them. The lists are now one panel each, with flat rows
divided by a hairline, a quiet tint under the pointer, and a bar in the accent
colour for the picked choice; the owners' names on the Give board are small
labels. Only the CSS changed (and which class the lists use): the Hired Swords
list still has its boxes, because nobody asked for that one.

## October 21, 2026 — the rare items in cells that do not break (#24, #26)

Two reports, one cause: a rare item's line was a name on the left and one
right-aligned string ("Rare 9 · 10+1D6 · 28 %") that the browser broke wherever
it ran out of room – a lone "%" on a line of its own on a phone – and the
sheet's version stacked the name, the meta and the effect in a grid that
overlapped on a narrow screen. Prices also said "gc" only when they were fixed
numbers, because the catalogue stores dice prices as text. The line is now one
component for the list and the sheet: rarity, chance and price are separate
nowrap cells (under the name on a phone, columns from tablet width), the price
always carries its unit and a dice price its average. The regression test
measures the real boxes at 468 px instead of trusting the CSS, and waits for
the fonts first – without that it failed once under load, when a late font
changed where lines broke.

## October 21, 2026 — the catalogue of every campaign and grade (#27)

A reporter could not find the Familiar. It was in the catalogue all along: the
Search tab left out every item kept for spellcasters when the warband had none,
whatever the "only what someone here may use" box said – so the box, off,
should show it, marked as unusable, and does now. The report also asked whether
only the core rules had been read. They had, nearly: the catalogue held the
Mordheim price chart and the warbands' own items, but not what the campaign
settings sell. Five readers went through the downloaded pages of mordheimer.net
(Empire in Flames, Border Town Burning, Khemri and Lustria, the warbands of
the core and of grades 1a–1c, and grade 2a) and listed what was missing; I
checked samples against the pages and merged the result. 63 items came in:
mounts and animals of the settings, the Merchant's dealings, the Wardog, and
the items of the 2a warbands – which the app does not have, so those carry
`only: { wb: [] }`: kept, with their source and grade, carried by nobody.
Each new item says where it comes from (`settings`, `grade`, `source`) so a
list can be filtered by it later. The same animal at another price in another
setting is a separate entry that names its setting. Left out on purpose: the
starting-list items that have no rarity and are already rows of their
warband's list (they would have been offered twice), and the lesser, chaos
and Lustrian artefacts, which are random rewards with no price or rarity.
Where a setting's chart disagrees with the core chart (Khemri and Lustria shift
many rarities by one), nothing was changed: the core values stand and the list
of differences went to Rob.

## October 21, 2026 — sorting the rare items (#25)

A select next to the search mask orders the list and the Hero's search sheet by
name, rarity or price, each way round. A dice price sorts by what it comes to on
average, and an item whose price is no number ("4 × price" of a weapon) goes last
whichever way prices run – putting it first on "cheapest" would be a lie and on
"dearest" a guess. Ties go by name so the order never jumps between renders.

## October 21, 2026 — a headline for every report (#28)

The admin's list showed each report by the first words of what the reporter
typed, cut off with "…", which read badly once there were two dozen of them.
A report now has a `headline`: a few words in the sorter's own voice, written
by whoever sorts it – `/bugs` writes one with `--headline` when it triages,
Rob can type one in the sorting form. The list shows it where the cut-off
words were, the sheet shows it over the report with the reporter's words
folded to four lines underneath ("Show all" opens them). Two things stayed as
they were on purpose: the admin's list still carries no words (the headline
is the only text it adds, and it is the admin's own), and the reporter never
reads it – it is part of the sorting, like the area and the severity, and
not part of what they wrote. The old reports have none yet; a report without
one shows the old way until it gets one.

## October 22, 2026 — spellcasters get the spellcaster items (#30)

A Magister could not find the Familiar. The catalogue marks it "spellcasters
only", and the check asked whether the unit has a `magic` key – a key no unit
in the data has, because the rules know who casts in another way: the
warband's spell list plus "Wizard" in the unit's rules, a Marauder's mark, or a
warrior made a caster by hand (`casterLore`). So no real caster ever passed.
The legacy app has the same hole; it is frozen, so only `core/` changed, the
difference is in `docs/behaviour-changes.md`, and the parity run leaves exactly
the caster-only items out of its comparison (a named set, not a rule).
(Pull request 137.)

## October 22, 2026 — selling from the stash what was typed in (#31)

The Sell tab listed only stash items that carried a `key`. Items typed in by
hand, or kept from the old app, have a name and a count and no key, so they
were silently skipped: a warrior's sword could be sold, the same sword in the
stash could not. The tab now looks the name up each time (price chart, then
the warband's lists, English or German, aliases included) and treats a hit
like any item; what is found nowhere is sold for a price the player names, and
the sale is refused without one. The lookup is a read, not a migration – the
saved items stay as they were typed. (Pull request 138.)

## October 22, 2026 — a dice price as a range (#29)

"20+1D6 gc ≈ 23.5 gc" showed an average, which nobody ever pays. The line now
shows what the dice allow, "= 21 – 26 gc". The average stays what orders the
lists. (Pull request 139.)

## October 22, 2026 — taking a battle out with what was written for it (#34, #35)

Two reports, one cause: nothing a leader could do removed a battle that had
notes on it, and notes of a battle of the history could not be taken out at
all – the page treats that battle as closed, and a closed battle's notes had no
button. Worse, a note that had been taken out still counted as "something
hangs on this battle": the tombstone blocked the removal it was meant to allow.
Rob's decision: a battle that was not finished and is removed never happened,
so its notes never existed. `?content=1` (leader only, asked for in the app
after the server says something belongs to the battle) removes the content too:
the rows stay as tombstones so every device hears of it, but text, earlier
wordings and picture files go, and the log names no words. Two cases still
refuse, with their own code: a note sealed until this battle and an entry
revealed from it – removing the battle would seal the first for good and show
the second at once.

The first version was reviewed independently (it touches sealed notes, so
S1) and the review found four real things: removing a history battle with a
question or background entry hanging on it failed with a server error because
only notes and pictures let go of the battle row; the second confirmation was
offered for the "waits" refusal too, where it could never succeed; rows taken
out earlier kept their words; and a file that could not be deleted after the
commit turned a finished removal into an error. All four are fixed and tested.
Reputation events about a battle that never happened go with it, which changes
the standing figures – Rob may want to look at that. (Pull request 140.)

## October 22, 2026 — Give as cards (#32)

The wide Give screen was two columns of flat boxes; the report called them too
large and clunky and asked for every warrior with their stats and abilities,
drag and drop, and giving from and to the stash. It is now a grid of small
cards, one per warrior and one for the stash, each with the profile, the rules
and the items as chips. An item is picked or dragged; every card says whether
it may take it and why not. The stash being a card was the easy part – giving
to and from it already worked, but the items typed in by hand never showed up
(#31). (Pull request 141.)

## October 22, 2026 — the banner pictures over the whole width (#33)

On a desktop the pixel picture was 160 columns in the middle of a bar that
the page filled with plain night. The banner is now 520 columns wide: the
scene stays in the middle and a seeded list of props per scene continues the
place to both sides – Mordheim's houses and towers, the camp's tents and
fires, the market's stalls, shelves and candelabras for the books, mountains
and rivers for the map. Smoke and embers rise, two flocks of bats cross the
sky, a bank of cloud drifts; reduced motion holds it still. The first
version pushed the quickbuild over its first-load budget (201.7 kB against
200), so the surroundings are a chunk of their own that loads after the first
paint. Wrong turn: a type-only `import()` in the loader failed the lint, fixed
by naming the one function the banner uses. (Pull request 142.)

## October 22, 2026 — on the way: a mismatch between merge order and tests

Several of this run's pull requests append tests to the same files (the trade
tests, the equipment tests) and conflicted before they were even opened. The
tests of #30, #31 and #32 now live in files of their own, as the `/bugs`
command asks for shared files.

## October 22, 2026 — the search list that still overlapped, and items by campaign

The overlap of #26 came back on a phone (the Hero's search sheet): the lines of
one item ran over the next. The first fix was tested at 468 px and checked only
that the cells of one row did not touch each other – which cannot see a row that
is too short for what it holds. The cause was the list itself: a grid of limited
height whose rows were squeezed to fit. It is a flex column of whole rows now,
and the test checks that what a row holds lies inside it and that rows lie one
under the other, at 468 and 390 px; written first, it failed on the old CSS.

The same day Rob asked that every item on mordheimer.net be available, chosen
by the campaign it was released with. The parsed item blocks of the whole site
were already in the catalogue; the price charts of the four campaign settings
(Empire in Flames, Border Town Burning, Khemri, Lustria) were checked item by
item, and one was missing – the Horse of Empire in Flames. Every item those
charts list now says so in `settings`, items of the core chart carry `core`,
and the search mask has "Released with" and "Warband grade". Deliberately not
done: the artefact tables (lesser, chaos, Lustrian) have no price or rarity, so
they cannot be searched for; and the Khemri/Lustria rarities that differ from
the core chart stay as they are – both went to Rob.

## October 22, 2026 — the Gold tile and the models bar (#42, #41)

Two small things on the head of a warband. The Gold tile carried a gold frame as
well as gold figures, and only it was framed; the figures are enough, so the
frame is the other tiles'. And the campaign's view of a warband showed "Models
15/15" as figures only, while the warband's own page has a bar under them – so
one warband had a bar and another none, depending on where one looked. Both
views use one component now, so they cannot drift apart again. (Pull requests
145 and 146.)

## October 22, 2026 — Cancel to the left of the main button (#40)

Rob chose the layout: the main button at the right edge, Cancel to its left, other
actions further left. The first idea was to turn the row around with CSS, which
would have left the keyboard going right to left; so about seventy rows of
buttons were reordered in the source, by a script for the regular ones and by
hand for the ten that were not (a delete button in the same row, a link as
Cancel, a button split over two lines). A test now reads the sources and checks
that Cancel stands before the main button and that no sheet's buttons sit in a
plain row; it failed on the old sources. (Pull request 147.)

## October 22, 2026 — the starting gold in three forms (#36)

The house rule could only give every warband the same gold. It has three forms
now: the same for all (as before), so much more for all, or so many percent more
for all, the last two from what each warband starts with. Percentages are rounded
up to the next full gc and worked out in whole numbers, because 500 gc and 10 %
as a decimal is 550.0000000000001, which rounded up is 551. The app keeps one
form on at a time; if a saved file has several, fixed wins, then plus, then
percent. The parity comparison broke on the first run – the legacy app does not
know the two new keys and the comparison showed the whole house rule object – so
exactly those two keys are left out of it, by name, and the mirror's entry for the
house defaults had to stop being "pure", which skips the normaliser. (Pull request
148.)

## October 22, 2026 — the world, in places (#37, #38, #39)

Three reports, one catalogue: places that lie in places, more regions, more
groups. The Lore tab shows a place's way ("In Old World › The Empire › Ostermark ›
Mordheim"), a group's origin ("From Norsca") and narrows the list to a place and
what lies in it. ADR 0024 records Rob's decision that sources outside
mordheimer.net are allowed when written in our own words. Content came from two
researchers who read the downloaded mordheimer.net pages: 60 regions and 70 groups;
I merged them after fixing the region ids they had invented differently
(`chaos-wastes` and `the-chaos-wastes`, `cathay` and `cathay-and-the-east`, `the-moot`
and `moot`), rewording seven entries that shared nine-word runs with the source
pages, and dropping the four Marauder marks, which are gods, not groups. The wikis
(Lexicanum, Fandom) were not reachable from the cloud session, so places that
mordheimer.net does not describe – the Badlands, Troll Country, Nordland,
Wissenland, Ind, the Southlands, the Ogre Kingdoms – are still missing; that is
for a session with access, or for Rob's own text. The pull requests are stacked
(149, 150, 151); each targets `master`, merge them in that order. (Pull requests
149, 150 and 151.)

## October 22, 2026 — the second run: the reports #43 to #50

Eight reports from one player in one afternoon, and Rob's answers to all of them
at once. **#45** (literal `<b>` in the Recruit list): the data marks rule names with
tags, the list printed the unit's text raw; a test now checks every unit of every
warband. **#49** (the audit log needed F5): the log hook read only when its path
changed, so clicking the open tab or going Back kept the old list; the location key
is part of the effect now. **#44** (idle devices): sessions last 30 days from their
last use instead of 90, and a sign-in on an account with more than five devices
ends those idle for seven days, longest idle first; the cookie, two tests and the
security doc had the 90 days in them. **#43** (own reports): the list shows the
admin's heading and number with an Open sheet; two server tests had said the heading
is "never shown to the reporter" – that was a choice, now reversed on purpose.
**#50**: copies sent by other players also stand on the Warbands screen. **#48**:
Henchmen groups have a profile; the core already could (`setProfile` works on any
model), the story screen hid it.

Two rules reports, decided by Rob. **#47**: a warrior who has not fought gets his
list plus what the warband gives at the start (upgrades with a founding price, like
gromril for Dwarfs); the catalogue's rare items were a founding privilege only in
the old app. It is an interface change; two e2e steps that added a rare item at the
founding now switch on the free market first. **#46**: the Orc Mob's limits
(two Goblins per Orc, Squigs not above the Goblins) live in `unitMax`, so recruiting
and group sizes obey them, and the parity suites needed a named exclusion for exactly
these two units: fixtures, the screens comparison and the walk (which now skips a step
the ratio would refuse, because core refuses what legacy accepts). Pull requests 153
to 160.

The wikis: Fandom answered through its MediaWiki API (the page URLs stay behind
Cloudflare), Lexicanum did not. A researcher wrote 28 places and 20 groups in
our own words from it; the Badlands links of two greenskin groups were dropped as
too thin. "Add to Library" now carries the place chain into the text. Pull request 161.

Rob also asked for a password-reset link an admin can hand to a player. It exists
already (Admin → Users → "Make a link", 24 hours); there is no mail to send it by.

## October 23, 2026 — the third run: #52, #53, #54 (the Trading Post)

Three reports about the Trading Post, one of them with a plain cause. **#53**: daggers
in the stash could not be given to anyone ("not in the equipment list of a …"). The
stash and the price chart call the item "Dolch", the equipment lists "Dolch (1. gratis)",
and the lookup compared names exactly. The fix treats the two spellings as one good
(also inside the stash, where they are now counted together), finds what a warrior
holds under the name he already uses, and gives under the name of his own list, so the
free dagger stays his. The reporter's other question, whether a group is charged the
right count, was checked and is right: one piece per man. Giving single daggers to
single men of a group is not possible by design; that would be a wish of its own.
**#52** (wish, confirmed by Rob): the free dagger is listed under Give as "Dagger (free)"
in a dashed chip that cannot be picked or dragged; the trade rules were not touched, it
stays impossible to sell or give it. **#54** (wish, confirmed by Rob: the card view of
Give is what is meant): on a wide screen Buy and Sell use the same cards. Sell turns
the chips into buttons that open the price sheet; Buy puts the items on sale above the
cards and a picked one says on each card whether the warrior may carry it and what it
costs there. A phone keeps the lists and sheets. Pull requests 164 to 166, stacked
(164, then 165, then 166). One e2e test of the Trading Post timed out once under load
and passed alone; no cause in the change.

## October 24, 2026 — the fourth run: #55 to #66 (the Trading Post on a phone, and a few campaign things)

Twelve reports, all fixed. **#62**: a stash line printed "0 gc each" for an item found at
no price; the price shows only above zero. **#58** looked like Give hiding a group that
lacks pieces, but the Give list already named the reason ("the group needs 3, one for
each man"); the real gap was the list of places a found item may go, which left every
group out. It is one function now and the group stands there with its reason. I first
tried to reproduce it through Give (two tests that passed) before reading the search
sheet. **#64**: entering a warband with house rules of its own now asks whether the copy
takes the campaign's rules or keeps its own, and does not enter until the player has
answered; a warband without rules of its own is not asked. **#59**: a dice price reads
"min. 21 gc, max. 26 gc, ⌀ 23.5 gc", the average to one decimal. **#55**: Created and
Updated have a line each, "Updated never" when there is no update. **#66**: a campaign
may start with a place of the lore; migration 35 adds `campaigns.place` (the key only).
**#56, #57, #61** have one cause and one pull request: the phone lists of Sell and Give
show carried items first and the stash under its own heading, and Give no longer lists
the free dagger there (the wide cards keep it). **#63**: a Stash section under the
roster with each item's text written out and Give from there.

**#60** and **#65** waited for Rob's answer and were done after it. **#60**: the rules let any
Hero search, but a Familiar says it is for Spellcasters, so a Hero is offered as searcher
only where the catalogue's `only` allows him (`searchBlockFor`; `recordSearch` refuses the
others too). **#65**: a name stands for one thing – a campaign's among a person's
campaigns, and in a campaign its battles (round and title), scenarios, factions, NPCs and
background entries. The first existing test that made two battles of one round without
titles had to get titles. Pull requests 168 to 175 and 177 and 178; the stacked one is 175
on 174. Three of them (169, 174, 175) got a merge conflict from the ones merged before them
and were merged with master; a merge made in a temporary worktree committed its
`node_modules` links (a symlink is not matched by the `node_modules/` rule), which a later
commit on each branch took out again.

One e2e run was killed by my own `timeout` and left an orphaned test web server on port
4175; the next run could not start its servers until that process was ended.

## October 25, 2026 — the fifth run: #67 to #71 (admin, addresses, spell lists)

Five reports, all fixed. **#67**: the "warband attached" mark of a report was a flex item
that stretched to the height of a wrapped title and wrapped its own text on a phone; the
cell now wraps its children and the mark is a one-line pill (the e2e test checks its
height). **#71**: the audit log's detail column was empty for everything but the account
actions; the line now names what the change was about (type and a short id) and the short
facts of the entry, never a long text. **#70**: Home is `/home` and the account `/account`
(`/settings` in the Quick Build), through one file, `app/src/app/paths.ts`; `/`, `/more`
and `/more/reports` only redirect, as Rob asked ("no old stumps"). One e2e test had
remembered the address before the redirect. **#68**: a caster's card lists the whole spell
list of his school with the casting values, the known ones marked.

**#69**, the one that touches who may see what: the admin sees the last 20 sign-ins of a
person and the first time of each device, with a rough place. Rob's conditions drove the
shape: the place comes from a database file on the Pi (`GEOIP_DB`), never from a service
and never from the repository; only a few sign-ins are kept; an account that existed before
counts its next sign-in as the first time once; only the admin with the authenticator reads
it (the leak matrix has the route). The independent review found no leak and one real risk:
the reader of the `.mmdb` file keeps it all in memory and the container has 256 MB, so a
file over 64 MB is now left alone with a warning (City Lite is larger – a smaller file or a
raised limit is Rob's call). The real reading of a database file is not exercised in CI,
only a missing, a broken and a too large file; Rob has to try it once with his file.

Two wrong turns of mine. I opened the pull request for #68 right after a check that had
exited with an error (the typecheck of the test files): the grep that printed the result
did not stop the push. The fix followed within minutes, and the pull request script now only
runs after I have read `EXIT 0`. And a worktree made to resolve merge conflicts committed
its `node_modules` links (a symbolic link is not matched by `node_modules/`); they were
removed again in the next commit of each branch. The "Give is a grid" e2e test, extended in
#63, failed twice in CI on slow runners (`scrollIntoViewIfNeeded` on a section that was
replaced meanwhile); pull request 184 takes the scrolling out. Pull requests 179 to 184.

## October 25, 2026 — the sixth run: #72 to #75 (sign-in log, Library links, the Campaign tab), and the moves of #69

Four reports. **#75**: with exactly one campaign in play the Campaign tab jumped straight into
it, so the overview could not be reached from the navigation. The redirect (and the "all"
marker that every link to the overview carried to overrule it, and a test for a race
between the device's memory and the server that only existed because of it) is gone; the tab
always shows the list. Two end-to-end tests had relied on the jump. **#72**: the sign-in log
of the admin (the attempts, not the per-person list of #69) is filtered on the server by person (part of
the name), kind and day, so the filter holds across pages; each try now records its device
(migration 38); addresses are hidden until asked for and hidden again on the next visit, in
this log and in the per-person list. My first version reset the choice in an effect and the
linter rightly refused it (a state set synchronously in an effect); the choice now belongs to
the visit it was made in.

**#73 and #74** are one cause and one pull request: places of the world (a new Library kind
with a free tag) and links between factions, NPCs, groups, scenarios and places. A link is
stored on one entry and shown on both, openly in the Library, as Rob asked; a copy into a
campaign takes none along (a test holds this for factions and NPCs), because what the Library
knows of how things belong together should stay hidden in a campaign until a leader can unlock
it, which is not built. Because the copy question touches visibility, the independent review ran
although the reports are wishes: it found no leak and one real risk of data loss. My first
version dropped, on every save, the links to entries this device did not show, which includes an
entry written on another device that had not synced yet; a save now keeps every link and the list
only hides an id it cannot find. The migration for the new kind needs the next number without a
gap, so the pull request is stacked on #72's (migration 38 and 39): merge 189 first.

A wrong turn of the check, not of the code: the mid-run edit of a test file during the full
check was avoided by not touching the tree while it runs; the e2e run found the two tests that
relied on the redirect only at the end, so a change to a route now gets a grep for its
destination in `app/e2e/` before the check. Master had also gone red on a test that read the
highlighted tab before the redirect had settled (pull request 187 waits for it). Pull
requests 188 to 190.

## October 25, 2026 — the seventh run: #76 to #78 (sign-in lands on Home, rule words in sheets, the planner and the catch-up)

**#76**: after a normal sign-in the app now goes to Home, not to the account; `?next=` still
wins, and an accepted invite still opens the account, because the authenticator is set up
there next. Four sign-in tests and one end-to-end test had the account hard-wired as the goal.

**#78**: on a phone a tap on the underlined rule words of a Hired Sword in the Hire sheet
(Scout, Cook) showed nothing. The bubble was there, but drawn into the page body, and the body
lies under the top layer of an open dialog. The fix is in the bubble, not in the card: a word
inside a dialog draws its bubble into that dialog, so every rule word in every sheet works,
which was Rob's question ("check whether it is the same elsewhere"). My first version read a
ref while rendering and the linter refused it; the dialog is now found when the word is
touched. A unit test (the bubble is inside the sheet) and an end-to-end test cover it; the
screenshot was looked at.

**#77**, the wish for a late-game warband, grew into two pull requests and ADR 0026. The answer
to "Rob: make it its own kind" was the **planner**: no gold limit, its value shown instead of
gold, the experience each model's advances would need, its own section in the list, and no
entry into a campaign as it is (the app does not offer it, the server refuses it). The harder
half was how a late player joins a running campaign without rebuilding. Rob's idea was to measure
by the median of the others. Two things in the rules shaped it: the warband rating counts
experience once per man for a Henchmen group (`totalRating`), so the gap must be closed in
rating points and the groups' share would otherwise eat it; and gold and gear do not count in
the rating at all, which is why the value gets a figure of its own. Rob's rules for the
experience (every group and Hero as many points as battles fought, the leader half as many
again, the rest evenly among the Heroes, none above one and a half times the share, chosen
advances) are in `core/src/campaign/catchup.ts` and tested with fixed numbers. The server gives
the figures of the others without names (`GET /campaigns/:id/catchup`); a leader may confirm an
entry that exceeds the plan, and the page of the warband says what it exceeds. Two fixtures were
wrong at first: the Youngbloods of the Mercenaries are Heroes, not a Henchmen group, and the
allowed value can never be below the starting gold, so "too rich" had to be tested on a plan
with a lowered allowance. Pull requests 195 and 196 (merge 195 first).

Also this run: a test of mine for the Library links (from the earlier run) read a list the
server had not yet answered and failed on a slow runner in CI; pull request 194 makes it wait.
Pull requests 192, 193, 194, 195 and 196.

## October 26, 2026 — the eighth run: #80 to #84 (starting spells, Hatred, 12(+1), the advance table)

The reports were written on the staging instance, whose database is a nightly copy of production:
the bug token of a cloud session reaches only production, so Rob entered them there again and they
got their numbers 80 to 84 afresh. Lesson for the run: staging reports do not arrive; paste them,
or write them down in production.

- **81, S2, a caster cannot choose his starting spell.** The spell list (report 68) showed the
  school but choosing was only possible in the Advance sheet, which needs earned experience. The
  count of starting spells was already in core (`spellStartCount`); the card now offers "Choose"
  on every unknown spell while fewer are known than he starts with, for a Wizard, the Warrior
  Priest and a Hired Sword who casts. Pull request 198.
- **83, S4, the table in the Advance sheet looked like text.** It had its own muted summary; the
  shared fold bar (border, turning chevron) from the report of 20.10. is used now. Pull request 199.
- **80, S4, Hatred beside Burn the Witch!.** The scan for keywords took "hates all spellcasters"
  in the rule's text for a rule of the unit. A general "a keyword only the text of a named rule
  mentions is not a rule" would have taken Fear, Immune to Psychology and more from about sixty
  units (counted in a probe over all units), so the cut is narrow: only Hatred, only where a named
  rule's text starts with "hates" and nothing outside says it. Hired Swords and Dramatis Personae
  were not looked at. Pull request 200.
- **82, wish, 12(+1).** `warbandMaxBonus` in core names what raises the printed maximum (Halfling
  Scout, the carnival's cart); the tile and the Recruit sheet show `8/12(+1)`, the limit is still
  the sum (pull request 201). I had written that the Cooking Book was not in the data as a size
  bonus; it is the Halfling cookbook, a rare item whose text says so but which nothing calculated.
  Rob gave the rule from the rare list (+1, not cumulative, +2 with a Halfling Scout, kept when the
  carrier dies, not for Undead and Carnival); `cookbookBonus` counts it on a warrior, in the stash
  and on the fallen. It is a difference from the legacy app, so the parity suites leave out exactly
  that bonus (`core/test/support/cookbook.ts`) and `docs/behaviour-changes.md` has the row; a real
  save of the campaign (Silver Caravan) carries the book, which is how the parity tests noticed.
  Pull request 204.
- **84, rules issue, second roll of a result.** The sheet already had the line ("Roll a D6: 1–3
  Strength, 4–6 Attack") but showed it only after the roll was entered; the table carries it now.
  A display change, no data change, so Rob's rule for rules issues was not touched; the source
  page could not be reached from the session to compare. Stacked on 199 (same lines), pull
  request 202.
- **79, wish, hidden NPC warbands.** Confirmed by Rob but not built: it needs decisions
  (who sees what, free starting gold) that can go either way; open as a question.
