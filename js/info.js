/* ===================== INFO / TOOLTIP LOOKUPS =====================
 * Resolve a name (item, ability, spell or skill) to its tooltip content, and
 * build the tooltip's HTML string. Pure lookups over the game data — no DOM,
 * no state. The actual tooltip *mechanics* (positioning, pinning, event
 * listeners) stay in app.js; this module only answers "what does this name
 * mean?" and "what HTML shows that?".
 *
 * Step 3a of splitting app.js (after state.js, engine.js). itipBuild builds an
 * HTML string but touches no live DOM, so it belongs with the lookups it
 * composes. spellLabel (a small normaliser) stays in app.js and is imported
 * back — same live-binding circular-import pattern used elsewhere.
 */
import { ABILITYINFO, ITEMINFO, SKILLLISTS, SKILLSETS, SPELLS } from '../data/index.js';
import { spellLabel } from './app.js';

export function itemInfo(nm){ const s=String(nm); for(const [re,info] of ITEMINFO){ if(re.test(s)) return info; } return null; }
export function abilityInfo(nm){ const s=String(nm); for(const [re,info] of ABILITYINFO){ if(info.name===s) return info; } for(const [re,info] of ABILITYINFO){ if(re.test(s)) return info; } return null; }
export function spellInfo(nm){ const lbl=spellLabel(nm); for(const k in SPELLS){ for(const s of SPELLS[k].spells){ if(String(s[0])[0]==='▸') continue; if(spellLabel(s[0])===lbl) return {name:lbl,line:'Spell · '+SPELLS[k].name,text:s[1]}; } } return null; }
export function skillInfo(nm){ const lists=[]; for(const k in SKILLLISTS) lists.push(SKILLLISTS[k]); for(const k in SKILLSETS) lists.push(SKILLSETS[k]);
  for(const L of lists){ const e=(L.skills||[]).find(x=>x[0]===nm); if(e) return {name:e[0],line:'Skill · '+L.name,text:e[1]}; } return null; }
export function itipBuild(nm){
  const i=itemInfo(nm)||abilityInfo(nm)||spellInfo(nm)||skillInfo(nm); if(!i) return null;
  return `<div class="itip-h">${i.name||nm}</div>`+
         (i.line?`<div class="itip-l">${i.line}</div>`:'')+
         `<div class="itip-b">${i.text}</div>`;}
