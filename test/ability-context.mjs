/* A tooltip shows the rule this warrior has, not the first of that name.
 *
 * Skills and special rules share names across warbands with different
 * effects. Looked up by the bare name, "Infiltration" of a Skaven showed the
 * Cursed Cavalcade's text, "Bellowing Roar" of a Beastman Chief the Ogre
 * version, "Swashbuckler" the Buckler; chips appeared for rules a unit only
 * mentions ("Witch-Hunter's" gave a Cleric the Hunter skill) or is exempt from
 * (All Alone on Bretonnian Knights). docs/rules-audit.md, part A.
 */
import assert from 'assert';
import * as fs from 'fs';

const el=()=>({style:{},className:'',textContent:'',value:'',checked:false,set innerHTML(v){},get innerHTML(){return '';},
  appendChild(){},addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,right:0,bottom:0}),querySelectorAll:()=>[],click(){},focus(){},select(){}});
globalThis.document={getElementById:el,createElement:el,addEventListener(){},body:{appendChild(){}},querySelectorAll:()=>[]};
globalThis.window={addEventListener(){},scrollTo(){},innerWidth:1000,matchMedia:()=>({matches:false,addEventListener(){}}),storage:{list:async()=>({keys:[]})}};
globalThis.Blob=function(){}; globalThis.URL.createObjectURL=()=>''; globalThis.confirm=()=>true; globalThis.alert=()=>{};
globalThis.fetch=async(u)=>{const p=decodeURIComponent(new URL(u).pathname);
  return {ok:fs.existsSync(p),json:async()=>JSON.parse(fs.readFileSync(p,'utf8')),arrayBuffer:async()=>fs.readFileSync(p).buffer};};

const app=await import(new URL('../js/app.js', import.meta.url).href);
const state=await import(new URL('../js/state.js', import.meta.url).href);
const data=await import(new URL('../data/index.js', import.meta.url).href);
const tts=await import(new URL('../js/tts.js', import.meta.url).href);

/* A fresh warband with one warrior; the warrior. */
function warrior(wb,unit,skills){
  app.chooseWb(wb); app.addUnit(unit);
  const m=state.S.models[state.S.models.length-1];
  if(skills) m.skills=skills;
  return m;
}
/* The tooltip keys of a warrior's chips, and what one of them shows. */
const chips=(m)=>[...app.abilitySection(app.unitDef(m.uid_def),m).matchAll(/toggleItip\(event,this,'((?:[^'\\]|\\.)*)'\)">([^<]*?) ⓘ/g)]
  .map(x=>({key:x[1].replace(/\\'/g,"'"),label:x[2]}));
const tipOf=(m,label)=>{ const c=chips(m).find(x=>x.label===label); return c&&app.itipBuild(c.key); };

// skills: the warrior's own list first
let m=warrior('skaven','adept',['Infiltration']);
const skavenInf=data.SKILLSETS.skavenSkills.skills.find(x=>x[0]==='Infiltration')[1];
assert.ok(tipOf(m,'Infiltration').includes(skavenInf), 'a Skaven\'s Infiltration is the Skaven skill');
m=warrior('beastmen','chief',['Bellowing Roar']);
assert.ok(tipOf(m,'Bellowing Roar').includes(data.SKILLSETS.beastmenSkills.name), 'a Beastman Chief roars the Beastmen way');
m=warrior('pirates','pcaptain',['Swashbuckler']);
assert.ok(/itip-l">Skill · /.test(tipOf(m,'Swashbuckler')), 'Swashbuckler is a skill, not the Buckler');

// abilities: the rule as the unit defines it
m=warrior('caravans','knight');
assert.ok(/When charged, strikes first/.test(tipOf(m,'Lightning Reflexes')), 'Knights Vanguard: their own Lightning Reflexes');
m=warrior('gunnery','sgo');
assert.ok(/12"/.test(tipOf(m,'Leader')), 'the Senior Gunnery Officer leads within 12"');
m=warrior('nightgoblins','nightgob');
assert.ok(/Only Night Goblins are affected/.test(tipOf(m,'Animosity')), 'Night Goblins squabble their own way');

// no chip for a rule a unit only mentions or is exempt from
assert.ok(!chips(warrior('outlaws','ocleric')).some(c=>c.label==='Hunter'), 'no Hunter skill from "Witch-Hunter\'s"');
assert.ok(!chips(warrior('reavers','shadow')).some(c=>c.label==='Hunter'), 'no Hunter skill from "Silent Hunter"');
assert.ok(!chips(warrior('forestgoblins','fgchief')).some(c=>c.label==='Ride'), '"May Ride" is not the Outriders\' Ride');
assert.ok(!chips(warrior('bretonnian','paladin')).some(c=>c.label==='All Alone'), 'Knights take no All Alone test');
assert.ok(!chips(warrior('hochland','blackheart')).some(c=>c.label==='All Alone'), 'a Blackheart is immune to All Alone');

// the exports carry the warrior's own skill text
m=warrior('beastmen','chief',['Bellowing Roar']);
const roar=data.SKILLSETS.beastmenSkills.skills.find(x=>x[0]==='Bellowing Roar')[1];
assert.ok(tts.ttsText(m).includes('Bellowing Roar: '+roar), 'the TTS card of a Beastman Chief has the Beastmen Bellowing Roar');

console.log('Rules in context: OK (skills from the warrior\'s lists, own rule texts, no chips for mentions, exports)');
