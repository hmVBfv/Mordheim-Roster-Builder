/* Parität: die MODULARE Version und das gebaute SINGLE-FILE müssen für dieselbe
   Aktionssequenz identische Ergebnisse liefern. Fängt ab, wenn der Build (z. B.
   deModule/Reihenfolge) das Verhalten gegenüber den Quellen verändert.
   Setzt voraus, dass dist/mordheim-roster.html aktuell gebaut ist. */
import * as fs from 'fs';
import assert from 'assert';

const DIST = new URL('../dist/mordheim-roster.html', import.meta.url).pathname;

function mkDom(){
  const el=()=>({style:{},className:'',textContent:'',value:'',checked:false,
    set innerHTML(v){},get innerHTML(){return '';},appendChild(){},addEventListener(){},
    getBoundingClientRect:()=>({left:0,top:0,right:0,bottom:0}),querySelectorAll:()=>[],click(){},focus(){},select(){}});
  return {getElementById:el,createElement:el,addEventListener(){},body:{appendChild(){}},querySelectorAll:()=>[]};
}

/* Deterministic scenario. Returns a snapshot of observable outputs. */
function scenario(app){
  app.chooseWb('carnival');
  app.addUnit('master');
  app.addUnit('tainted');
  const tainted=app.S.models.find(m=>m.uid_def==='tainted');
  app.toggleMut(tainted.uid,'Fliegenschwarm',true);
  app.toggleMut(tainted.uid,'Mal des Nurgle',true);
  app.addUnit('cbreth');
  const breth=app.S.models.find(m=>m.uid_def==='cbreth');
  app.setEqQty(breth.uid,'Schwert',1);
  return {
    totalModels:app.totalModels(), totalHeroes:app.totalHeroes(), warbandMax:app.warbandMax(),
    totalSpent:app.totalSpent(), goldCurrent:app.goldCurrent(), totalRating:app.totalRating(),
    taintedCost:app.modelUnitCost(tainted), brethCost:app.modelUnitCost(breth),
    mutCost:app.mutCost(tainted), masterName:app.unitDef('master').name,
    eqParts:app.eqDisplayParts(breth).join('|'),
  };
}

async function runModular(){
  globalThis.document=mkDom();
  globalThis.window={addEventListener(){},scrollTo(){},innerWidth:1000,matchMedia:()=>({matches:false,addEventListener(){}}),storage:{list:async()=>({keys:[]})}};
  globalThis.Blob=function(){}; globalThis.URL.createObjectURL=()=>'';
  globalThis.fetch=async(u)=>{const p=decodeURIComponent(new URL(u).pathname);
    return {ok:fs.existsSync(p),json:async()=>JSON.parse(fs.readFileSync(p,'utf8')),arrayBuffer:async()=>fs.readFileSync(p).buffer};};
  const app=await import(new URL('../js/app.js', import.meta.url).href);
  return scenario(app);
}

function runBundle(){
  const html=fs.readFileSync(DIST,'utf8');
  const scripts=[...html.matchAll(/<script>\n([\s\S]*?)\n<\/script>/g)].map(m=>m[1]);
  const src=scripts.reduce((a,b)=>b.length>a.length?b:a,'');
  const g={addEventListener(){},scrollTo(){},innerWidth:1000,matchMedia:()=>({matches:false,addEventListener(){}}),storage:{list:async()=>({keys:[]})}};
  g.document=mkDom(); g.window=g; g.Blob=function(){}; g.URL={createObjectURL:()=>''};
  new Function('window','document','Blob','URL',src)(g,g.document,g.Blob,g.URL);
  return scenario(g);
}

const A=await runModular();
const B=runBundle();
const diffs=Object.keys(A).filter(k=>JSON.stringify(A[k])!==JSON.stringify(B[k]))
  .map(k=>`${k}: modular=${JSON.stringify(A[k])} bundle=${JSON.stringify(B[k])}`);
assert.strictEqual(diffs.length, 0, 'Modular/Single-File weichen ab:\n'+diffs.join('\n'));
console.log(`Parity modular vs single-file: OK (${Object.keys(A).length} Werte identisch, u.a. totalSpent=${A.totalSpent} gc, rating=${A.totalRating})`);
