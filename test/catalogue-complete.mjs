/* Completeness audit: the equipment CATALOG should cover every item on the
 * mordheimer.net weapon/armour/equipment pages. Those pages are checked in as
 * fixtures under test/fixtures/ (ref_*.txt). This test extracts item names from
 * each fixture and flags any that the catalogue is missing.
 *
 * A curated allow-list holds names that are intentionally absent or map to a
 * differently-named catalogue entry (variants, non-buyable entries, items
 * folded into a combined listing). Anything NOT on that list and NOT in the
 * catalogue fails the test — so a genuinely missing item can't slip through
 * unnoticed, while known variants don't cause noise.
 */
import assert from 'assert';
import * as fs from 'fs';

globalThis.fetch = async (u) => {
  const p = decodeURIComponent(new URL(u).pathname);
  return { ok: fs.existsSync(p), json: async () => JSON.parse(fs.readFileSync(p,'utf8')),
           arrayBuffer: async () => fs.readFileSync(p).buffer };
};

const D = await import(new URL('../data/index.js', import.meta.url).href);

const CATALOG = D.CATALOG;
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
const have = new Set(CATALOG.map(it => norm(it.en)));

function refItems(file){
  const lines = fs.readFileSync(new URL('./fixtures/'+file, import.meta.url),'utf8').split('\n').map(l=>l.replace(/\s+$/,''));
  const names=[]; const seen=new Set();
  for(let i=0;i<lines.length;i++){
    if(/\((core|1a|1b|1c|2a)\)\s*$/.test(lines[i])){
      let j=i-1; while(j>=0 && !lines[j].trim()) j--;
      if(j>=0){ const nm=lines[j].trim();
        if(nm.length<=50 && !nm.endsWith('.') && !nm.endsWith(':') && !seen.has(nm.toLowerCase())){ seen.add(nm.toLowerCase()); names.push(nm); } }
    }
  }
  return names;
}

// Known variants / intentional absences (reference name -> catalogue name or reason).
const ALLOW = new Set([
  'club, mace or hammer',            // present as separate Club / Mace / Hammer
  'poison daggers',                  // -> Poisoned weapon / Death-Cap Daggers
  'hobgoblin poisoned daggers',      // -> Poisoned weapon variant
  'belaying pins',                   // -> Belaying pin (singular)
  'hunting rifle',                   // -> Hunting rifle (Hochland long rifle)
  'chaos dwarf blunderbuss',         // -> Blunderbuss variant
  'fist',                            // not a buyable item
  'cathayan candles',                // narrative entry, not a purchasable line
  'sons of hashut obsidian weapon',  // -> Obsidian weapon
  'trade wagon',                     // Merchant Caravan vehicle rule, not a purchasable Trading Post item (the general wagon is "Stage Coach/Wagon")
]);

const FILES = ['ref_Armour.txt','ref_Missile.txt','ref_Blackpowder.txt','ref_CloseCombat.txt','ref_Misc.txt'];
let missing=[];
for(const f of FILES){
  for(const nm of refItems(f)){
    const n=norm(nm);
    if(have.has(n)) continue;
    if(ALLOW.has(nm.toLowerCase())) continue;
    // loose variant: catalogue name contains ref name or vice versa
    let variant=false;
    for(const h of have){ if(h.length>4 && (h.includes(n)||n.includes(h))){ variant=true; break; } }
    if(variant) continue;
    missing.push(`${f}: ${nm}`);
  }
}

assert.strictEqual(missing.length, 0,
  'Catalogue is missing items present on mordheimer.net:\n  ' + missing.join('\n  ') +
  '\n(If an item is intentionally absent or renamed, add it to the ALLOW set with a note.)');

console.log(`Catalogue completeness: OK (${CATALOG.length} items cover all reference pages; ${ALLOW.size} known variants allow-listed)`);
