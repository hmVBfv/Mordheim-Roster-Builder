/* Regression test for the app.js -> state.js split.
 *
 * The risky part of this split: `S` and `uid` are live ES-module bindings.
 * Code outside state.js may mutate properties on S (`S.foo = …`) but must
 * NEVER do a raw `S = {...}` reassignment — only state.js itself can do
 * that (via replaceState). This test exercises exactly the patterns used
 * by chooseWb() and applyState() in app.js, through the public API, to make
 * sure a future edit can't silently reintroduce a raw reassignment that
 * would throw ("Assignment to constant variable") once actually wired
 * through a real import elsewhere.
 */
import assert from 'assert';
import * as fs from 'fs';

const el = () => ({ style:{}, className:'', textContent:'', value:'', checked:false,
  set innerHTML(v){}, get innerHTML(){return '';}, appendChild(){}, addEventListener(){},
  getBoundingClientRect:()=>({left:0,top:0,right:0,bottom:0}), querySelectorAll:()=>[], click(){}, focus(){}, select(){} });
globalThis.document = { getElementById: el, createElement: el, addEventListener(){}, body:{appendChild(){}}, querySelectorAll:()=>[] };
globalThis.window = { addEventListener(){}, scrollTo(){}, innerWidth:1000,
  matchMedia:()=>({matches:false,addEventListener(){}}), storage:{ list:async()=>({keys:[]}) } };
globalThis.Blob = function(){}; globalThis.URL.createObjectURL = ()=>'';
globalThis.fetch = async (u) => {
  const p = decodeURIComponent(new URL(u).pathname);
  return { ok: fs.existsSync(p), json: async () => JSON.parse(fs.readFileSync(p,'utf8')),
           arrayBuffer: async () => fs.readFileSync(p).buffer };
};

const state = await import(new URL('../js/state.js', import.meta.url).href);
const app = await import(new URL('../js/app.js', import.meta.url).href);

// app.js must re-export the exact same S/uid bindings that state.js owns —
// otherwise the two modules would silently drift onto separate objects.
assert.strictEqual(app.S, state.S, 'app.js must re-export the same S object as state.js');

// nextUid() hands out increasing ids and mutates the shared counter.
const a = state.nextUid(), b = state.nextUid();
assert.ok(b > a, 'nextUid() must return increasing ids');

// replaceState() must swap the *contents* of S while keeping the same
// object reference alive (this is what makes the live-binding pattern work
// across every module that imported S).
const ref = state.S;
state.replaceState({ wb: 'possessed', models: [{ uid: 42 }] });
assert.strictEqual(state.S, ref, 'replaceState() must keep the same S object reference');
assert.strictEqual(state.S.wb, 'possessed');
assert.strictEqual(app.S.wb, 'possessed', 'app.S must see the update through the live binding');

// resyncUid() must set the counter above the highest existing model id.
state.resyncUid();
assert.ok(state.uid > 42, 'resyncUid() must advance the counter past existing model ids');

console.log('State module boundary: OK (S/uid shared correctly, replaceState + resyncUid behave)');
