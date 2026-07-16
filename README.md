# Mordheim Roster Builder

A warband builder for Mordheim (the Games Workshop skirmish game), with a
campaign layer, Tabletop Simulator export, and official roster-sheet PDF
export. Built for actual play with a regular group, not as a demo.

**Not affiliated with Games Workshop or with the original designers/publishers
of any of the community rules referenced below.** This is a fan-made tool.
Mordheim and all associated names are the property of Games Workshop.

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
HTML file to a modular, tested codebase — including the bugs that turned up
along the way and why certain design decisions were made.

## Structure

```
index.html            Markup + CSS (no logic)
js/state.js             Warband state (S), model-id counter, house-rule defaults
js/engine.js            Pure rules, cost & armour-save calculation (no DOM)
js/info.js              Name -> tooltip lookups (item/ability/spell/skill) + HTML
js/app.js               Rendering + UI actions (still to be split further)
js/pdf.js               PDF export (official roster sheet)
js/tts.js               Tabletop Simulator export
data/*.json            Game data as JSON — language-independent, readable by
                       other tools too (e.g. a TTS Lua script)
data/index.js            Loader: fetches the JSON, revives regex fields
data/_util.js            small helpers (profile constructor)
vendor/                 pdf-lib
assets/sheet.pdf         official roster sheet (template for the PDF export)
build.js                 bundles everything into ONE self-contained HTML file
dist/                    build output
test/                    automated regression tests (see below)
```

**The files in `data/` and `js/` are the source of truth.** `dist/` is
generated — never edit it by hand.

`js/app.js` imports `S` and the house-rule helpers from `js/state.js`, and
`js/state.js` imports `render` back from `js/app.js` — a circular import,
same as the existing one between `app.js`/`pdf.js`/`tts.js`. This works
because `render` is only ever called from inside a function body, never at
module-evaluation time. **`S` itself must never be reassigned (`S = {...}`)
from outside `state.js`** — ES module imports are live but read-only
bindings, so that throws. Use `replaceState(newState)` instead; it swaps the
contents of `S` while keeping the same object reference alive for every
module that imported it. Everyday property mutation (`S.foo = …`) is fine
from anywhere.

Register any new logic module in `build.js` under `JS_FILES` — `state.js`
must stay first in that list, then `engine.js` and `info.js`, since the
single-file build
concatenates everything into one flat script and `let S`/`let uid` and the
pure engine functions need to be declared before app.js's own top-level code
runs.

`js/engine.js` holds the pure rules & cost calculation (unit lookup,
equipment/mutation/rare-item costs, totals, gold, rating) — no DOM. It
imports a few helpers back from `app.js` (item-family lookup, campaign
district effects, Hired-Sword totals); `app.js` in turn imports the engine
functions and re-exports them so the inline `onclick` handlers still reach
them. Same live-binding circular-import pattern as everywhere else.

## Running the tool — two equally valid ways

**The modular version and the single-file build behave identically** (a test,
`parity.mjs`, enforces this). Use whichever fits the moment:

### A) Modular, straight from `data/` and `js/` — no build step

This is the "edit a stat in JSON, reload, done" workflow. Start any static
web server in the repo root and open it in a browser:

```bash
python3 -m http.server 8000      # then open http://localhost:8000
```

Change a value in `data/*.json`, save, **reload the page** — the change is
live. No `node build.js` needed; the browser fetches the JSON fresh each load.

Why a server and not just double-clicking `index.html`? The modular version
loads its data with `fetch(...)`, and browsers block `fetch` over the
`file://` protocol for security. A local server serves everything over
`http://localhost`, which is allowed. Any static server works (Python above,
`npx serve`, VS Code "Live Server", etc.) — nothing gets installed or
uploaded, it's purely local.

### B) Single-file build — runs by double-click, no server

```bash
node build.js                    # -> dist/mordheim-roster.html
```

`dist/mordheim-roster.html` opens by double-click (`file://` is fine here,
because the data is baked in as a constant instead of fetched) and can be
handed to someone as one file — Discord, USB stick, email. Rebuild it after
editing data if you want the standalone file to reflect the change. The
GitHub Actions workflow builds it automatically on every push.

## Hosting on GitHub Pages

GitHub Pages serves everything over `https://`, so the **modular version runs
there directly** — no build required, the browser fetches the JSON just like
against a local server. Live URL shape:
`https://<user>.github.io/<repo>/`. The freshly built single file is also
reachable, at `.../<repo>/dist/mordheim-roster.html`.

The workflow in `.github/workflows/pages.yml` tests, rebuilds, and deploys on
every push to `main`. To switch it on once:

1. **Settings → Pages → Build and deployment → Source: "GitHub Actions".**
2. Push to `main` (or run the workflow manually). Done.

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
node build.js             # builds the single file
```

| File                | Checks |
| ------------------- | ------ |
| `smoke.mjs`          | The modular version loads cleanly (catches duplicate declarations, imports of non-exported names — errors the single-file build hides, because a classic `<script>` silently lets the last declaration win where an ES module would reject it). |
| `data-integrity.mjs` | Every warband/Hired Sword/Dramatis Personae entry resolves; no duplicate unit ids within a warband; regex fields are revived to real `RegExp` objects. |
| `blessings.mjs`      | Blessing of Nurgle / Chaos Mutation English names match the official mordheimer.net names, and every one resolves to an ability tooltip. |
| `pdf-order.mjs`      | PDF export lists heroes/henchmen in the warband's fixed roster order, not recruitment order. |
| `state-module.mjs`   | The `S`/`uid` live-binding contract between `state.js` and `app.js` (replaceState, nextUid, resyncUid) actually holds. |
| `rare-items.mjs`     | The Trading Post eligibility rule: a unit may only take a rare item whose base category is in its start list (verified for a heavy-armour hero vs. an armour-less unit); `rareEligibleItems` never offers forbidden categories; `rareCost` sums correctly. |
| `catalogue-complete.mjs` | Every item on the mordheimer.net weapon/armour/equipment reference pages (checked in under `test/fixtures/`) is present in the catalogue; known name-variants are allow-listed with notes. |
| `engine.mjs`         | `app.js` re-exports the exact engine functions from `engine.js`; the cost pipeline (unitDef → eqCost → modelUnitCost → totals) produces the right numbers end-to-end, and the armour-save maths (svFromText/svOfModel/svLabel) parse saves correctly (incl. not mistaking a stun save for an armour save). |
| `info.mjs`           | `app.js` re-exports the info-lookup functions from `info.js`; item/ability/spell/skill names resolve to their tooltips (incl. the Blessing of Nurgle rules) and `itipBuild` composes the tooltip HTML. |
| `parity.mjs`         | The modular version and the built single-file produce identical results for the same action sequence — so the build (deModule, concatenation order) never silently changes behaviour vs. the sources. `test/run.mjs` rebuilds `dist/` first so this always checks a current bundle. |

Earlier development also relied on a larger set of ad-hoc logic tests run
directly against the built single-file HTML during working sessions (audit
checks per warband, cost calculations, etc.). Those never made it into the
repo as files — this `test/` folder is where new regression tests belong from
now on, so fixes stay verifiable and don't silently regress.

## House rules

The tool follows official rules strictly by default, but is built with house
rules in mind: `data/houserules.json` and the house-rule checkboxes in the UI
let deviations be toggled per group and get recorded automatically on export,
rather than being hard-coded into the rules logic.

## Status & roadmap

Done:

- All 49 warbands audited against mordheimer.net (no pending entries)
- Rare Items / Trading Post implemented — a 243-item catalogue with rarity
  values and the category-eligibility rule (a unit may only take a rare/magic
  item whose base category is in its starting equipment list), audited for
  completeness against the mordheimer.net weapon/armour/equipment pages
  (see `test/catalogue-complete.mjs`)
- GitHub Pages hosting of the modular version (auto-deployed on push)

Open / possible next steps:

- Further Tabletop Simulator export refinements
- Dice-cost items (e.g. "20 + 4D6 gc") are stored as strings; the roster total
  currently can't evaluate them numerically — a future improvement could roll
  or range them
- Surfacing the rarity value in the Trading Post UI (currently stored but not
  shown), and an availability-roll helper for campaign play
