/* Spieldaten-Loader.
 *
 * Die Daten liegen als JSON in data/*.json — sprachunabhängig, damit sie auch
 * von anderen Werkzeugen gelesen werden können (z. B. einem TTS-Lua-Skript).
 *
 * Zwei Modi:
 *   - modular (GitHub Pages): JSON wird per fetch geladen (top-level await).
 *   - Single-File (build.js): die Daten liegen bereits als __MH_DATA vor;
 *     der Build entfernt den fetch-Block zwischen den @build-Markern, weil
 *     top-level await in einem klassischen <script> nicht erlaubt ist.
 *
 * Regex-Felder sind als {"__re": "muster", "__f": "flags"} kodiert (JSON kennt
 * keine Regex) und werden hier zurückverwandelt.
 */
const FILES = ["races", "equipment", "skills", "spells", "abilities", "mutations", "injuries", "i18n", "houserules", "marks", "sheet", "campaign", "warbands", "hiredswords", "dramatis"];

function revive(v) {
  if (Array.isArray(v)) return v.map(revive);
  if (v && typeof v === 'object') {
    if (typeof v.__re === 'string') return new RegExp(v.__re, v.__f || '');
    const o = {};
    for (const k in v) o[k] = revive(v[k]);
    return o;
  }
  return v;
}

let RAW;
if (typeof __MH_DATA !== 'undefined') {
  RAW = __MH_DATA;
} else {
  /* @build:fetch-start */
  RAW = {};
  await Promise.all(FILES.map(async (f) => {
    const res = await fetch(new URL('./' + f + '.json', import.meta.url));
    if (!res.ok) throw new Error('Datendatei fehlt: ' + f + '.json');
    RAW[f] = await res.json();
  }));
  /* @build:fetch-end */
}

const D = {};
for (const f of FILES) {
  for (const [k, v] of Object.entries(RAW[f] || {})) D[k] = revive(v);
}

export const {
  MAXPROF, RACELABEL, RACE_EN, ARMOUR_SV, BRACE_HIDE,
  BRACE_PLURAL, CATALOG, EQEN, GSN_BRACE, ITEMINFO,
  LISTS, MOUNTS, STD_CATS, UPGRADES, _ALLCC,
  _CCFAM, _FAM, SKILLLISTS, SKILLSETS, STATKEYS,
  SV_SKILL_BASE, SV_SKILL_BONUS, SPELLS, ABILEN, ABILITYINFO,
  BLESSINGS, MUTATIONS, MUTEN, MUTLABEL, MUTSETS,
  INJEN, INJURIES, NAMEEN, NR_CAT, NR_T,
  TERMEN, HR_LABELS, MARAUDER_MARKS, MARK_RULES, SHEET,
  DISTRICTS, PENDING_1A, UNITRACE, WARBANDS, WBEXTRA,
  WBRACE, HIREDSWORDS, HS_GRADE_ORDER, WBHIRE, DP_GRADE_ORDER,
  DRAMATIS
} = D;
