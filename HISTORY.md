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
