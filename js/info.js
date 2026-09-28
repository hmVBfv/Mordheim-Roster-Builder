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
import { ABILITYINFO, DRAMATIS, HIREDSWORDS, ITEMINFO, SKILLLISTS, SKILLSETS, SPELLS, WARBANDS, WBEXTRA } from '../data/index.js';
import { spellLabel } from './app.js';

/* ---- which rule a name means, for this warrior ----
   Skills and special rules share names across warbands with different
   effects ("Infiltration", "Animosity", "Bellowing Roar"). A tooltip looked up
   by the bare name showed whichever came first in the data. So a chip carries
   a key that says whose rule it is ("abil|<warband>|<unit>|<n>",
   "abil|hs|<key>|<persona>|<n>", "skill|<list>|<name>"), and the tooltip
   resolves it the way the chip was chosen: the unit's own definition first,
   then a skill from the unit's own lists, then the general entry.
   Same algorithm as core/src/rules/abilities.ts. */
export function ruleDefs(text,line){ const out=[];
  const segs=String(text||'').replace(/<br\s*\/?>/gi,' ').split(/(?<=[.!?)"\u201d;]|<\/b>)\s+(?=(?:<b>)?[A-Z][^:<>.]{1,36}:)/);
  for(const sg of segs){ const t=sg.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    const m=t.match(/^([A-Z][^:<>.]{1,36}):\s*([\s\S]+)$/); if(m) out.push({name:m[1].trim(),text:m[2].trim(),line}); }
  return out; }
export function ruleKey(name){ return String(name).toLowerCase().replace(/\([^)]*\)/g,' ').replace(/[^a-z']+/g,' ').trim().replace(/men$/,'man').replace(/s$/,''); }
const STD_LISTS=['combat','shooting','academic','strength','speed'];
function ownerDefs(o){
  if(o.kind==='unit'){ const W=WARBANDS[o.wb]; const def=W&&W.units.find(u=>u.id===o.id); if(!W||!def) return [];
    return [...ruleDefs(def.sp,'Special rule · '+def.name),...ruleDefs(W.rules,'Warband rule · '+W.name)]; }
  const e=(o.kind==='hs'?HIREDSWORDS:DRAMATIS)[o.key]; if(!e) return [];
  const pers=(e.personas||[]).find(p=>p.name===o.persona);
  return [...ruleDefs(pers&&pers.sp,'Special rule · '+e.name),...ruleDefs(e.sp,'Special rule · '+e.name)]; }
export function unitSkillLists(wb,def){ const out=[];
  const add=k=>{ if(k&&!out.includes(k)&&(SKILLSETS[k]||SKILLLISTS[k])) out.push(k); };
  for(const c of (def&&def.sk)||[]) if(!STD_LISTS.includes(c)) add(c);
  const ex=wb?WBEXTRA[wb]:null; add(ex&&ex.skills);
  for(const c of (def&&def.sk)||[]) add(c);
  return out; }
function skillIn(list,name){ const L=SKILLSETS[list]||SKILLLISTS[list];
  const e=L&&L.skills.find(x=>x[0].toLowerCase()===String(name).toLowerCase());
  return L&&e?{name:e[0],line:'Skill · '+L.name,text:e[1]}:null; }
export function skillKey(wb,def,name){
  const lists=[...unitSkillLists(wb,def),...Object.keys(SKILLLISTS),...Object.keys(SKILLSETS)];
  for(const k of lists) if(skillIn(k,name)) return 'skill|'+k+'|'+name;
  return name; }
function ownerSkillLists(o){ if(o.kind!=='unit') return [];
  const W=WARBANDS[o.wb]; return unitSkillLists(o.wb,W&&W.units.find(u=>u.id===o.id)); }
const ownerKey=o=>o.kind==='unit'?o.wb+'|'+o.id:o.kind+'|'+o.key+'|'+o.persona;
export function abilityFor(o,idx){ const entry=ABILITYINFO[idx]; if(!entry) return null;
  const info=entry[1]; const key='abil|'+ownerKey(o)+'|'+idx;
  const own=ownerDefs(o).find(d=>ruleKey(d.name)===ruleKey(info.name));
  if(own) return {name:info.name,line:own.line,text:own.text,key};
  for(const l of ownerSkillLists(o)){ const sk=skillIn(l,info.name); if(sk) return {...sk,name:info.name,key}; }
  if(info.own){ const scope=info.wb||[]; const here=o.kind==='unit'?o.wb:o.kind+':'+o.key; if(!scope.includes(here)) return null; }
  return {...info,key}; }
export function keyedInfo(key){ const p=String(key).split('|');
  if(p[0]==='skill'&&p.length>=3) return skillIn(p[1],p.slice(2).join('|'));
  if(p[0]!=='abil') return null;
  const idx=Number(p[p.length-1]);
  const o=p.length===4?{kind:'unit',wb:p[1],id:p[2]}:(p.length===5&&(p[1]==='hs'||p[1]==='dp'))?{kind:p[1],key:p[2],persona:p[3]}:null;
  if(!o) return null;
  const c=abilityFor(o,idx); if(c){ const {key:_k,...rest}=c; return rest; }
  return (ABILITYINFO[idx]&&ABILITYINFO[idx][1])||null; }

export function itemInfo(nm){ const s=String(nm); for(const [re,info] of ITEMINFO){ if(re.test(s)) return info; } return null; }
export function abilityInfo(nm){ const s=String(nm); for(const [re,info] of ABILITYINFO){ if(info.name===s) return info; } for(const [re,info] of ABILITYINFO){ if(re.test(s)) return info; } return null; }
export function spellInfo(nm){ const lbl=spellLabel(nm); for(const k in SPELLS){ for(const s of SPELLS[k].spells){ if(String(s[0])[0]==='▸') continue; if(spellLabel(s[0])===lbl) return {name:lbl,line:'Spell · '+SPELLS[k].name,text:s[1]}; } } return null; }
export function skillInfo(nm){ const lists=[]; for(const k in SKILLLISTS) lists.push(SKILLLISTS[k]); for(const k in SKILLSETS) lists.push(SKILLSETS[k]);
  for(const L of lists){ const e=(L.skills||[]).find(x=>x[0]===nm); if(e) return {name:e[0],line:'Skill · '+L.name,text:e[1]}; } return null; }
export function itipBuild(nm){
  /* A skill is looked up before the ability scanner. The scanner matches by
     regular expression, so a loose pattern claimed names it had no business
     with: the Shooting skill "Nimble" showed the Barbary Monkey's special rule,
     and "Skink Hunter" or "Wyrdstone Hunter" showed the Hunter skill. An exact
     name in a curated skill list is the better answer than a fuzzy match. A
     chip's key ("abil|…", "skill|…") says whose rule it is and comes first. */
  const i=keyedInfo(nm)||itemInfo(nm)||skillInfo(nm)||abilityInfo(nm)||spellInfo(nm); if(!i) return null;
  return `<div class="itip-h">${i.name||nm}</div>`+
         (i.line?`<div class="itip-l">${i.line}</div>`:'')+
         `<div class="itip-b">${i.text}</div>`;}
