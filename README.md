# Mordheim Roster Builder

A complete warband builder and campaign companion for **Mordheim** — Games
Workshop's classic skirmish game of treasure hunting in a ruined city — built
for a real gaming group that plays on **Tabletop Simulator**. It runs entirely
in the browser, works offline as a single HTML file, follows the official
rules strictly, and still leaves room for the house rules every twenty-year-old
game inevitably accumulates.

**Not affiliated with Games Workshop** or with the original designers and
publishers of any community rules referenced below. This is a fan-made tool;
Mordheim and all associated names are the property of Games Workshop.

---

## What it does

**Build a warband.** All 49 warbands, audited unit by unit against the
authoritative community reference (see *Sources of truth* below): stats,
costs, equipment lists, racial maxima, warband-specific skill lists, leader
rules, Chaos marks, personas. Equipment is picked from each unit's actual
allowed list; the first dagger is free where the rules say so; armour saves
are calculated for you. Hired Swords (72 of them) and Dramatis Personae (30)
come with their hiring restrictions enforced.

**Run a campaign.** Experience, advances and skill picks per warrior;
"The Lad's Got Talent" promotions (six-hero cap enforced); serious injuries —
including the ones that *do* something: **Robbed** strips a hero's gear
without refunding a single coin, **Sold to the Pits** plays out the pit fight
(win: +50 gc and +2 XP; lose: weapons and armour gone, no refund), **Captured**
walks you through ransom, exchange, or the sad third option. The fallen leave
the roster into a graveyard section that remembers what they were worth — in
real gold and in experience earned in play — with an undo for hasty deaths.
A chronicle logs recruitment, deaths, promotions and battles as you play, and
a campaign file merges several players' warbands into one shared document for
the group.

**Get it onto the table.** Three export paths:

| Export | What you get |
| ------ | ------------ |
| **Tabletop Simulator** | Colour-tagged description card text per model — statline, rules, gear, spells — ready to paste into TTS |
| **Official roster sheet (PDF)** | The classic sheet, filled in, in roster order |
| **Readable text** | A shareable listing with the full save embedded (`MORDHEIM-DATA`), so the text *is* the backup |

**Bend the rules deliberately.** House rules are first-class: toggles for
composition limits, price adjustments, equipment access, replacement leaders
and more — off by default, and every deviation is recorded on export so
opponents can see exactly what was changed.

## Quick start

The fastest way: grab **`dist/mordheim-roster.html`** and double-click it.
One file, no install, no server, works offline — hand it around on Discord or
a USB stick.

Or use the hosted version (GitHub Pages, always current with `main`):
`https://<user>.github.io/<repo>/` <!-- replace with your Pages URL -->

Or run the modular source locally:

```bash
python3 -m http.server 8000      # then open http://localhost:8000
```

## How the numbers work

Three figures describe a warband, and they deliberately measure different
things:

**Gold** is cash in hand: the treasury less everything the warband currently
owns. Buying a sword moves gold into equipment; selling it back (at the
house-ruled rate, if any) moves it out. Deaths and robberies are *settled* —
the loss is booked against the treasury in the same breath the items vanish,
so dying never mints money.

**Warband Rating** is the official matchmaking number: 5 points per warrior
(20 for Large creatures) plus every point of experience, plus each Hired
Sword's own rating. Equipment doesn't count, and a Trade Wagon is equipment
with wheels — vehicles add nothing.

**Warband Worth** (this tool's own metric) answers the question Rating
ignores: what does the force that actually takes the field amount to, in
gold? It is a *market* value, built for comparing warbands fairly. Three
principles shape it:

*List prices, not paid prices.* A found sword or a half-price heirloom cuts
just as well as one bought at list, so what was paid is irrelevant
(dice-priced items count at their expected value).

*Hands, not backpacks.* A warrior fights with two one-handed melee weapons
or one two-handed, plus one missile weapon — that active loadout counts at
full value. Every further weapon counts **half**: it is a real option he can
switch to each combat round, but never wielded at the same time. Shields and
bucklers are melee-hand items with the *lowest carry priority*: weapons
claim the two hand slots first, and only if a hand remains free does the
shield slot in at full value — dagger + shield counts the shield full,
dagger + sword + shield counts it half, and a zweihander leaves no hand for
it at all. Armour, miscellaneous gear, **mounts and vehicles** count in
full: their abilities are priced into their listing.

*Outcomes, not progress.* Advancement counts by what actually landed on the
profile: each applied stat advance is worth **+5 points**, each acquired
skill or spell **+10** (hero privileges — chosen rather than rolled, never
wasted on a capped stat), and each stat point lost to a serious injury
subtracts the same 5 an advance would have added. Raw experience is progress
toward power, not power, and is not counted — nor does the figure try to be
battle-situationally exact (Ld, I or BS on a warrior without a missile
weapon are still stats; a stat is a stat). Hired Swords count their
advances, skills and spells the same way. Everything sums unrounded — backup
weapons and shields carry exact halves — and is rounded **once** at the end.

Worth is a **unitless points figure**, like the Rating — not gold: it prices
things *in terms of* market gold but measures fielded power, not money.

**Gold in hand is deliberately excluded** — coins don't fight, and counting
them would let a rich naked warband look equal to a poor equipped one, which
is exactly the false balance impression this figure exists to correct. Two
warbands with equal Rating can be worlds apart in Worth; now you can see it.

## Sources of truth

Rule authority, highest first:

1. **[mordheimer.net](https://mordheimer.net)** ("The New Mordheimer") — the
   primary reference for warband rosters, stats, costs and equipment lists.
   If a rule doesn't appear there, it doesn't go in this tool.
2. **Ultimate FAQ** and **FAQ from Toumas** — override mordheimer.net whenever
   they clarify or correct a rule; every change is checked against both.
3. The original Mordheim rulebook and supplements (via
   **[Broheim.net](https://broheim.net)**'s PDF archive), for anything not yet
   covered by the above.

Where mordheimer.net's unit table and its prose text disagree, the table
(plus any annotation) wins. Thanks to the maintainers of mordheimer.net and
Broheim.net for keeping these rules alive and accessible.

## Project history

See [`HISTORY.md`](HISTORY.md) for how this tool actually grew — from a single
1.4 MB HTML file to a modular, tested codebase — including the motivation,
the working method, the bugs that turned up along the way and why the design
decisions fell the way they did.

## Structure

```
index.html            Markup + CSS (no logic)
js/state.js           Warband state (S), model-id counter, house-rule defaults
js/engine.js          Pure rules, cost & armour-save calculation (no DOM)
js/info.js            Name -> tooltip lookups (item/ability/spell/skill) + HTML
js/app.js             Rendering + UI actions
js/pdf.js             PDF export (official roster sheet)
js/tts.js             Tabletop Simulator export
data/*.json           Game data as JSON — language-independent, readable by
                      other tools too (e.g. a TTS Lua script)
data/index.js         Loader: fetches the JSON, revives regex fields
data/_util.js         Small helpers (profile constructor)
vendor/               pdf-lib
assets/sheet.pdf      Official roster sheet (template for the PDF export)
build.js              Bundles everything into ONE self-contained HTML file
dist/                 Build output
test/                 Automated regression tests (see below)
```

**The files in `data/` and `js/` are the source of truth.** `dist/` is
generated — never edit it by hand.

### Module contract (worth knowing before touching the code)

`js/app.js` imports `S` and the house-rule helpers from `js/state.js`, and
`js/state.js` imports `render` back from `js/app.js` — a circular import,
same as the one between `app.js`/`pdf.js`/`tts.js`. This works because
`render` is only ever called from inside a function body, never at
module-evaluation time. **`S` itself must never be reassigned (`S = {...}`)
from outside `state.js`** — ES module imports are live but read-only
bindings, so that throws. Use `replaceState(newState)` instead; it swaps the
contents of `S` while keeping the same object reference alive for every
module that imported it. Everyday property mutation (`S.foo = …`) is fine
from anywhere.

Register any new logic module in `build.js` under `JS_FILES` — `state.js`
must stay first in that list, then `engine.js` and `info.js`, since the
single-file build concatenates everything into one flat script and
`let S`/`let uid` and the pure engine functions need to be declared before
`app.js`'s own top-level code runs.

`js/engine.js` holds the pure rules & cost calculation (unit lookup,
equipment/mutation/rare-item costs, totals, gold, rating) — no DOM. It
imports a few helpers back from `app.js`; `app.js` in turn imports the engine
functions and re-exports them so the inline `onclick` handlers still reach
them. Same live-binding circular-import pattern as everywhere else.

## Running the tool — two equally valid ways

**The modular version and the single-file build behave identically** (a test,
`parity.mjs`, enforces this). Use whichever fits the moment.

### A) Modular, straight from `data/` and `js/` — no build step

The "edit a stat in JSON, reload, done" workflow. Start any static web server
in the repo root:

```bash
python3 -m http.server 8000      # then open http://localhost:8000
```

Change a value in `data/*.json`, save, **reload the page** — the change is
live. Why a server and not just double-clicking `index.html`? The modular
version loads its data with `fetch(...)`, and browsers block `fetch` over the
`file://` protocol for security. Any static server works (Python above,
`npx serve`, VS Code "Live Server") — nothing gets installed or uploaded,
it's purely local.

### B) Single-file build — runs by double-click, no server

```bash
node build.js                    # -> dist/mordheim-roster.html
```

`dist/mordheim-roster.html` opens by double-click (`file://` is fine here,
because the data is baked in as a constant instead of fetched). Rebuild after
editing data if you want the standalone file to reflect the change. The
GitHub Actions workflow builds it automatically on every push.

## Hosting on GitHub Pages

GitHub Pages serves everything over `https://`, so the **modular version runs
there directly** — no build required. Live URL shape:
`https://<user>.github.io/<repo>/`; the freshly built single file is also
reachable at `.../<repo>/dist/mordheim-roster.html`.

The workflow in `.github/workflows/pages.yml` tests, rebuilds, and deploys on
every push to `main`. To switch it on once: **Settings → Pages → Source:
"GitHub Actions"**, then push.

Two Pages-specific details, both already handled in the repo — worth knowing
so nobody undoes them:

* **`.nojekyll`** (empty file in the repo root) disables Jekyll. Pages runs
  Jekyll by default, and Jekyll silently drops every path starting with an
  underscore — which would include `data/_util.js` and break the app on load.
* **All in-app paths are relative** (`new URL('./file.json', import.meta.url)`),
  never absolute (`/data/...`). Pages serves under a `/<repo>/` subpath, where
  absolute paths would 404. Keep new data/asset references relative.

## Editing data

Game data lives in **JSON** (`data/*.json`) — plain tables, no code.

Two conventions JSON itself can't express:

* **Regex** is stored as `{"__re": "pattern", "__f": "flags"}` and turned into
  a real `RegExp` on load (see `data/index.js`).
* **Profiles** are spelled out explicitly: `{"M":4,"WS":3,"BS":3, …}`.

## Tests

```bash
node test/run.mjs        # runs every test/*.mjs and prints a pass/fail summary
```

The suite currently stands at **20 files**. Each one exists because something
once broke — a test here is a bug that can never come back.

| File | Checks |
| ---- | ------ |
| `smoke.mjs` | The modular version loads cleanly (catches duplicate declarations and imports of non-exported names — errors the single-file build hides, because a classic `<script>` lets the last declaration win where an ES module refuses to load). |
| `data-integrity.mjs` | Every warband/Hired Sword/Dramatis Personae entry resolves; no duplicate unit ids within a warband; regex fields revive to real `RegExp` objects. |
| `blessings.mjs` | Blessing of Nurgle / Chaos Mutation English names match the official mordheimer.net names, and every one resolves to an ability tooltip. |
| `pdf-order.mjs` | PDF export lists heroes/henchmen in the warband's fixed roster order, not recruitment order. |
| `state-module.mjs` | The `S`/`uid` live-binding contract between `state.js` and `app.js` (replaceState, nextUid, resyncUid) actually holds. |
| `rare-items.mjs` | The Trading Post eligibility rule: a unit may only take a rare item whose base category is in its start list; `rareEligibleItems` never offers forbidden categories; `rareCost` sums correctly. |
| `catalogue-complete.mjs` | Every item on the mordheimer.net weapon/armour/equipment reference pages (checked in under `test/fixtures/`) is present in the catalogue; known name-variants are allow-listed with notes. |
| `ui-bugs.mjs` | Guards fixed UI bugs: no duplicate warband skill lists, render survives adding a skill, the PDF export runs, sidebar roster order follows the warband list. |
| `fallen.mjs` | Dead (11-15) removes a hero (whole model) or one henchman (group qty−1, group gone at 0) into `S.fallen`, excluded from totals and the PDF; grouping and the LIFO undo behave. |
| `leader-death.mjs` | Leader succession when the leader is slain: validation drops, re-hiring is blocked, the highest-Leadership hero takes over (XP breaks ties); Undead pass to the Necromancer or collapse. |
| `tts-and-adv.mjs` | TTS cards show skill text (not `[object Object]`) and include standalone rare items; "Advance due!" compares earned vs applied advances. |
| `compat.mjs` | A frozen old-format save still loads: missing keys default, round trips preserve data, every legacy key is still written. |
| `engine.mjs` | The cost pipeline (unitDef → eqCost → modelUnitCost → totals) end-to-end, and the armour-save maths (incl. not mistaking a stun save for an armour save). |
| `info.mjs` | Item/ability/spell/skill names resolve to their tooltips, and `itipBuild` composes the tooltip HTML. |
| `houserules-ui.mjs` | Every house-rule key renders, rows keep a complete structure, price rows use the wide slider layout. |
| `chronicle.mjs` | The campaign stage/log/battles layer records and defaults correctly. |
| `campaign-file.mjs` | The multi-player campaign document: import/update warbands in place, merged history, per-warband tallies. |
| `costs-and-tooltips.mjs` | Gold is treasury minus owned, and nothing else; the henchman experience surcharge is charged once when a group grows (never re-derived); exact skill names beat fuzzy ability-scanner matches. |
| `master-fixes.mjs` | The bookkeeping sweep: fallen losses count real gold only with earned XP reported separately, the surcharge dies with the last man of a group (and returns on undo), vehicles are ratingless, promoted henchmen file under Heroes everywhere, `goldNow` round-trips verbatim, gear-stealing injuries never refund, Warband Worth conserves value when gold turns into gear. |
| `parity.mjs` | The modular version and the built single file produce identical results for the same action sequence — so the build never silently changes behaviour. |

### Save-format rule

Save files are the user's data, so the format only ever grows:

- **Add keys, never rename or remove them.** Older builds ignore unknown keys,
  so additions are harmless; a rename silently loses data.
- **Every new key needs a default** — in `applyState` (`data.x||…`) or in
  `houseDefaults()` — so files written before it existed still load.
- `test/compat.mjs` pins a frozen old save and fails if this is broken. Don't
  edit that fixture; it stands for files already out there.

One caveat, documented rather than fixed: a save containing fallen warriors,
opened in a build from before that feature, loads its living warriors
correctly but silently drops the `fallen` record.

## House rules

The tool follows official rules strictly by default, but is built with house
rules in mind: `data/houserules.json` and the checkboxes in the UI let
deviations be toggled per group and get recorded automatically on export,
rather than being hard-coded into the rules logic.

## Status & roadmap

Done:

- All 49 warbands audited against mordheimer.net (no pending entries)
- Rare Items / Trading Post — a 243-item catalogue with rarity values and the
  category-eligibility rule, audited for completeness against the
  mordheimer.net reference pages
- Campaign layer: chronicle, battles, fallen warriors, acting serious
  injuries, multi-player campaign file
- Warband Worth as an equipment-aware companion figure to the official Rating
- GitHub Pages hosting of the modular version (auto-deployed on push)

Open / possible next steps:

- Further Tabletop Simulator export refinements
- Dice-cost items (e.g. "20 + 4D6 gc") are stored as strings; a future
  improvement could roll or range them numerically
- Surfacing the rarity value in the Trading Post UI, and an availability-roll
  helper for campaign play
