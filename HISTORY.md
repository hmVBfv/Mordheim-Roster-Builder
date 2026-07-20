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
