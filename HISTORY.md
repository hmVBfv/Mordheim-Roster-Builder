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
