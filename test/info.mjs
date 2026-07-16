/* Regression test for the app.js -> info.js split (step 3a).
 *
 * info.js holds the pure name->tooltip lookups (itemInfo, abilityInfo,
 * spellInfo, skillInfo) and itipBuild (HTML string, no live DOM). Verifies:
 *  1. app.js re-exports the same function objects (one implementation).
 *  2. The lookups resolve known names — including the Blessing of Nurgle
 *     tooltips added earlier, which must remain reachable through this module.
 *  3. itipBuild composes the expected tooltip HTML.
 */
import assert from 'assert';
import * as fs from 'fs';

const el=()=>({style:{},className:'',textContent:'',value:'',checked:false,set innerHTML(v){},get innerHTML(){return '';},appendChild(){},addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,right:0,bottom:0}),querySelectorAll:()=>[],click(){},focus(){},select(){}});
globalThis.document={getElementById:el,createElement:el,addEventListener(){},body:{appendChild(){}},querySelectorAll:()=>[]};
globalThis.window={addEventListener(){},scrollTo(){},innerWidth:1000,matchMedia:()=>({matches:false,addEventListener(){}}),storage:{list:async()=>({keys:[]})}};
globalThis.Blob=function(){}; globalThis.URL.createObjectURL=()=>'';
globalThis.fetch=async(u)=>{const p=decodeURIComponent(new URL(u).pathname);
  return {ok:fs.existsSync(p),json:async()=>JSON.parse(fs.readFileSync(p,'utf8')),arrayBuffer:async()=>fs.readFileSync(p).buffer};};

const info=await import(new URL('../js/info.js', import.meta.url).href);
const app=await import(new URL('../js/app.js', import.meta.url).href);

// 1) app.js re-exports the identical function objects.
for (const fn of ['itemInfo','abilityInfo','spellInfo','skillInfo','itipBuild']) {
  assert.strictEqual(app[fn], info[fn], `app.${fn} must be the same function object as info.${fn}`);
}

// 2) The Blessing of Nurgle tooltips (added earlier) resolve via abilityInfo.
const cloud=info.abilityInfo('Cloud of Flies');
assert.ok(cloud && /-1 to hit/i.test(cloud.text), 'Cloud of Flies tooltip must resolve with its rule text');
const rot=info.abilityInfo("Nurgle's Rot");
assert.ok(rot && /poison/i.test(rot.text), "Nurgle's Rot tooltip must resolve");

// 3) itipBuild composes header/line/body HTML for a known ability.
const html=info.itipBuild('Cloud of Flies');
assert.ok(html && html.includes('itip-h') && html.includes('itip-b'),
  'itipBuild must produce header + body tooltip HTML');
assert.strictEqual(info.itipBuild('___no_such_thing___'), null,
  'itipBuild returns null for an unknown name');

console.log('Info split: OK (re-exports identical, Blessing tooltips resolve, itipBuild composes HTML)');
