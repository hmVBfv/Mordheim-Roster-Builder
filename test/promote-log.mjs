/* The chronicle entry for a promotion must name the Hero who was made.
 *
 * It used to take its uid from whichever model happened to be last in the
 * roster. That is right when a man leaves a group (the new Hero is appended)
 * and when the last man of a group is promoted in place while being the last
 * entry - but when a lone henchman further up the list was promoted and
 * another promoted Hero stood at the end, the entry named that other warrior.
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

state.replaceState({wb:'merc',subtype:'reik',name:'T',budget:500,models:[],hired:[],dp:[],leaderUid:null,
  campaign:{on:true,districts:{}},stash:{wyrd:0,gold:null,items:[]},fallen:[],house:state.houseDefaults()});
app.addUnit('capt');
app.addUnit('warr');                          // a lone henchman, not last in the list
app.addUnit('mark');
const lone=state.S.models.find(m=>m.uid_def==='warr');
const marks=state.S.models.find(m=>m.uid_def==='mark');
app.setQty(marks.uid,2);
app.promoteHench(marks.uid,1);                // a promoted Hero now stands at the end
const heroAtEnd=state.S.models[state.S.models.length-1];
assert.ok(heroAtEnd.promoted && heroAtEnd.uid!==marks.uid, 'the marksman left his group as a new Hero at the end');

app.promoteHench(lone.uid);                   // promoted in place
const entry=state.S.campaign.log.filter(e=>e.type==='promote').pop();
assert.strictEqual(entry.data.uid, lone.uid, 'the entry names the warrior who was promoted, not the last model');
assert.ok(state.S.models.find(m=>m.uid===lone.uid).promoted, 'the lone warrior is now a Hero');

const first=state.S.campaign.log.filter(e=>e.type==='promote')[0];
assert.strictEqual(first.data.uid, heroAtEnd.uid, 'a man leaving a group is recorded under the new Hero');
console.log('Promotion entries name the right Hero: OK');
