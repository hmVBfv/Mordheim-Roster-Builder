/* Tabletop-Simulator-Export: Beschreibungstexte für Modell-Karten. */
import { DRAMATIS, HIREDSWORDS, INJEN } from '../data/index.js';
import { S, aDisp, attachedBlocks, casterLore, dpList, effProfile, enRules, eqDisplayParts, rareDisplayParts, hsChosenEq, hsEffProfile, hsEqParts, hsEquipOn, hsList, hsPersona, isHeroModel, markRulesFor, noteLines, skillInfo, spellEffDiff, spellEffect, spellLabel, svOfModel, svOfEntry, uid, unitDef } from './app.js';

/* The model's name as its own field, so it can be pasted into the TTS Name box
   separately from the description. Heroes get a darker gold than the rank and
   file, which makes them stand out on the tabletop at a glance. */
const TTS_GOLD_HERO='B8860B', TTS_GOLD_HENCH='E8C26B';
function ttsName(m){ const def=unitDef(m.uid_def);
  const nm=(m.name||'').trim()||def.name;
  const hero=(typeof isHeroModel==='function')?isHeroModel(m):(def.t==='hero');
  return `[${hero?TTS_GOLD_HERO:TTS_GOLD_HENCH}]${nm}[-]`; }
function ttsNameFor(name,hero){ return `[${hero?TTS_GOLD_HERO:TTS_GOLD_HENCH}]${String(name||'').trim()}[-]`; }
/* The permanent armour save - the one that is always there, from armour and
   skills, excluding shields and bucklers, which depend on what is being
   carried. The same value the PDF sheet prints. */
function ttsSv(sv){ return sv==null?'-':(sv+'+'); }

function ttsAttached(def,m){
  const blocks=(typeof attachedBlocks==='function')?attachedBlocks(def,m):[];
  if(!blocks.length) return '';
  const k=["M","WS","BS","S","T","W","I","A","Ld"];
  return blocks.map(a=>{
    const q=(a.qty&&a.qty>1)?` \u00d7${a.qty}`:'';
    const p=a.profile||{};
    const line=p&&Object.keys(p).length? k.map(x=>x+' '+String(p[x]!==undefined?p[x]:'-')).join('   ') : '(no profile)';
    const note=a.note?String(a.note).replace(/<\/?b>/g,'').replace(/<br\s*\/?>/gi,' ').trim():'';
    const noteLines=note?note.split(/(?<=\.)\s+/).map(x=>x.trim()).filter(Boolean).map(x=>'\u2022 '+x).join('\n'):'';
    return `\n[E8C26B]\u25B8 ${a.label}${q}:[-]\n[7AD1A4]${line}[-]`+(noteLines?`\n${noteLines}`:'');
  }).join('');
}

function ttsText(m){
  const def=unitDef(m.uid_def); const p=effProfile(m)||{};
  const k=["M","WS","BS","S","T","W","I","A","Ld"];
  const hasProf=p&&Object.keys(p).length>0&&!def.vehicle;
  const statline=hasProf?(k.map(x=>x+' '+(x==='A'?String(aDisp(m,p)):String(p[x]!==undefined?p[x]:'-'))).join('   ')
    +'   Sv '+ttsSv((typeof svOfModel==='function')?svOfModel(m):null)):'';
  const rules=enRules(def.sp);
  if(typeof markRulesFor==='function'){ markRulesFor(m).forEach(x=>rules.push(x[0]+': '+x[1])); }
  (m.skills||[]).forEach(s=>{ const d=skillInfo(s); const t=d&&(typeof d==='object'?d.text:d); rules.push(t?`${s}: ${t}`:s); });
  (m.inj||[]).forEach(j=>rules.push(INJEN[j.code]||j.name));
  const rulesTxt=rules.length?rules.map(r=>'• '+r).join('\n'):'None';
  const eq=eqDisplayParts(m).concat((typeof rareDisplayParts==='function'?rareDisplayParts(m):[])); const eqTxt=eq.length?eq.join(', '):'None';
  const spx=(m.spells||[]).map(s=>{ const d=spellEffDiff(s); const e=spellEffect(s.name,casterLore(m)); return `${spellLabel(s.name)}${d!=null?` (${d})`:''}${e?': '+e:''}`; });
  const spLine = spx.length? `\n[5ACFFF]Spells:[-]\n${spx.map(x=>'• '+x).join('\n')}` : '';
  const missLine=(Number(m.miss)||0)>0?`\n[FF6961]⚑ Misses next ${m.miss} game${m.miss>1?'s':''}[-]`:'';
  const atLine=ttsAttached(def,m);
  const statBlock=statline?`[7AD1A4]${statline}[-]${missLine}\n`:(missLine?missLine.replace(/^\n/,'')+'\n':'');
  return `${statBlock}[5ACFFF]Special Rules:[-]\n${rulesTxt}\n[5ACFFF]Equipment:[-] ${eqTxt}${spLine}${atLine}`;
}

function ttsTextHS(hs,disp,rec){ const k=["M","WS","BS","S","T","W","I","A","Ld"];
  const _sv=(typeof svOfEntry==='function')?svOfEntry(hs,rec):null;
  const p=(rec&&typeof hsEffProfile==='function'&&HIREDSWORDS[rec.key])?hsEffProfile(rec,hs):(hs.profile||{});
  const _ex=(rec&&typeof hsEqParts==='function'&&typeof hsEquipOn==='function'&&hsEquipOn())?hsEqParts(rec):[];
  const _pers=(rec&&hs.personas&&typeof hsPersona==='function')?hsPersona(rec,hs):null;
  const _opt=(rec&&rec.opt&&!hs.personas)?`\nChosen: ${rec.opt}`:(_pers?`\nPersona: ${_pers.name}`:'');
  const _xp=(rec&&rec.exp)?`\nXP: ${rec.exp}`:'';
  const _adv=(rec&&rec.adv&&Object.keys(rec.adv).length)?`\nAdvances: ${Object.entries(rec.adv).map(([k2,v])=>'+'+v+' '+k2).join(', ')}`:'';
  const _sk=(rec&&(rec.skills||[]).length)?`\nSkills: ${rec.skills.join(', ')}`:'';
  const _spl=(rec&&(rec.spells||[]).length)?`\nSpells: ${rec.spells.map(x=>spellLabel(x.name)).join(', ')}`:'';
  const _psp=(_pers&&_pers.sp)?`\n${_pers.sp}`:'';
  const extraEq=_ex.length?(', '+_ex.join(', ')):'';
  const statline=k.map(x=>x+' '+String(p[x]!==undefined?p[x]:'-')).join('   ')+'   Sv '+ttsSv(_sv);
  const rules=String(hs.sp||'').replace(/<\/?b>/g,'').replace(/<br\s*\/?>/gi,' ').split(/(?<=\.)\s+/).map(x=>x.trim()).filter(Boolean);
  const rulesTxt=rules.length?rules.map(r=>'\u2022 '+r).join('\n'):'\u2022 None';
  const title=(disp&&disp!==hs.name)?`${disp} \u2014 ${hs.name}`:hs.name;
  return `${title}  [Hired Sword \u00b7 ${hs.grade}]\n${statline}${_opt}${_xp}${_adv}${_sk}${_spl}\n\nEquipment: ${(rec&&typeof hsChosenEq==='function')?hsChosenEq(rec,hs):hs.eq}${extraEq}${_psp}\n\nSpecial Rules:\n${rulesTxt}`; }

function _ttsShow(nameField,body){
  const nf=document.getElementById('ttsname'); if(nf) nf.value=nameField;
  const ta=document.getElementById('ttstext'); ta.value=body;
  document.getElementById('ttsmodal').style.display='flex';
  setTimeout(()=>{ try{ta.focus();ta.select();}catch(e){} },30); }
function ttsOpen(u){ const m=S.models.find(x=>x.uid===u); if(!m) return;
  _ttsShow(ttsName(m), ttsText(m)); }

function ttsOpenHS(uid){ const h=hsList().find(x=>x.uid===uid); if(!h) return; const hs=HIREDSWORDS[h.key]; if(!hs) return;
  // Hired Swords and Dramatis Personae count as the notable sort, so they take
  // the darker gold as Heroes do.
  _ttsShow(ttsNameFor(h.name||hs.name,true), ttsTextHS(hs,h.name,h)); }

function ttsOpenDP(uid){ const d=dpList().find(x=>x.uid===uid); if(!d) return; const dp=DRAMATIS[d.key]; if(!dp) return;
  _ttsShow(ttsNameFor(d.name||dp.name,true), ttsTextHS(dp,d.name,d)); }

export { ttsAttached, ttsText, ttsTextHS, ttsName, ttsNameFor, ttsOpen, ttsOpenHS, ttsOpenDP };
