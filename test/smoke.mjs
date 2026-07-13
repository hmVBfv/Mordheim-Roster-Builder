/* Smoke-Test der MODULAREN Version: laedt app.js + data/index.js wie im Browser.
   Faengt Fehler, die im Single-File-Build nicht auffallen (z. B. doppelte
   Deklarationen oder Importe auf nicht exportierte Namen). */
// Minimal-DOM, damit app.js durchläuft
const el = () => ({ style:{}, className:'', textContent:'', value:'', checked:false,
  set innerHTML(v){}, get innerHTML(){return '';}, appendChild(){}, addEventListener(){},
  getBoundingClientRect:()=>({left:0,top:0,right:0,bottom:0}), querySelectorAll:()=>[], click(){}, focus(){}, select(){} });
globalThis.document = { getElementById: el, createElement: el, addEventListener(){}, body:{appendChild(){}}, querySelectorAll:()=>[] };
globalThis.window = { addEventListener(){}, scrollTo(){}, innerWidth:1000,
  matchMedia:()=>({matches:false,addEventListener(){}}), storage:{ list:async()=>({keys:[]}) } };
globalThis.Blob = function(){}; globalThis.URL.createObjectURL = ()=>'';

// fetch für die JSON-Dateien (Browser-Äquivalent)
import * as fs from 'fs';
globalThis.fetch = async (u) => {
  const p = decodeURIComponent(new URL(u).pathname);
  return { ok: fs.existsSync(p), json: async () => JSON.parse(fs.readFileSync(p,'utf8')),
           arrayBuffer: async () => fs.readFileSync(p).buffer };
};

const app = await import(new URL('../js/app.js', import.meta.url).href);
console.log('Modul geladen.');
console.log('  WARBANDS:', Object.keys(globalThis.window.WARBANDS || {}).length || '(nicht global)');
// Daten über den Loader prüfen
const D = await import(new URL('../data/index.js', import.meta.url).href);
console.log('  WARBANDS:', Object.keys(D.WARBANDS).length, 'Warbands');
console.log('  HIREDSWORDS:', Object.keys(D.HIREDSWORDS).length, 'HS');
console.log('  DRAMATIS:', Object.keys(D.DRAMATIS).length, 'DP');
console.log('  Regex revived?', D.ABILITYINFO[0][0] instanceof RegExp);
console.log('  Profil-Objekt:', JSON.stringify(D.HIREDSWORDS.ogre.profile));
