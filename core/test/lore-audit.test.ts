/* The lore catalogue (data/lore.json, ADR 0023/0024): every entry names its source, places nest without loops, every link points at
   something that exists. Reports #37 to #39 (Rob, 22.10.2026): more regions, more groups, places inside places. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Entry { id: string; kind: string; name: string; de: string; status: string; text: string; source: string[]; parent?: string | null; regions?: string[] }
const lore = JSON.parse(readFileSync(new URL('../../data/lore.json', import.meta.url), 'utf8')) as { SOURCES: Record<string, { title: string; url: string }>; LORE: Entry[] };
const byId = new Map(lore.LORE.map((e) => [e.id, e]));

describe('the lore catalogue', () => {
  it('has every entry once, with its words, its German name and its kind', () => {
    expect(byId.size).toBe(lore.LORE.length);
    for (const e of lore.LORE) {
      expect(['region', 'faction', 'group'], e.id).toContain(e.kind);
      expect(e.name.trim(), e.id).not.toBe('');
      expect(e.de.trim(), `${e.id}: German name`).not.toBe('');
      expect(e.status.length, `${e.id}: status`).toBeLessThanOrEqual(110);
      expect(e.text.length, `${e.id}: text`).toBeGreaterThan(60);
      expect(e.text.length, `${e.id}: text`).toBeLessThan(900);
      expect(e.id, e.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('names a source for each entry, and every source is a page on mordheimer.net or a named public wiki', () => {
    for (const e of lore.LORE) {
      expect(e.source.length, e.id).toBeGreaterThan(0);
      for (const k of e.source) expect(lore.SOURCES[k], `${e.id}: ${k}`).toBeTruthy();
    }
    for (const [k, s] of Object.entries(lore.SOURCES)) {
      expect(s.title.trim(), k).not.toBe('');
      expect(s.url, k).toMatch(/^https:\/\/(mordheimer\.net|whfb\.lexicanum\.com|warhammerfantasy\.fandom\.com)\//);
    }
    const used = new Set(lore.LORE.flatMap((e) => e.source));
    for (const k of Object.keys(lore.SOURCES)) expect(used.has(k), `source ${k} is used by an entry`).toBe(true);
  });

  it('nests places: a parent is a region, nothing contains itself', () => {
    for (const e of lore.LORE.filter((x) => x.parent)) {
      expect(e.kind, `${e.id}: only a region has a parent`).toBe('region');
      expect(byId.get(e.parent!)?.kind, `${e.id} → ${e.parent}`).toBe('region');
      const seen = new Set([e.id]);
      for (let p = e.parent; p; p = byId.get(p)?.parent) { expect(seen.has(p), `${e.id}: a loop through ${p}`).toBe(false); seen.add(p); }
    }
  });

  it('ties factions and groups to places that exist', () => {
    for (const e of lore.LORE.filter((x) => x.regions)) {
      expect(e.kind, `${e.id}: only a faction or group comes from a region`).not.toBe('region');
      for (const r of e.regions!) expect(byId.get(r)?.kind, `${e.id} → ${r}`).toBe('region');
    }
  });

  /* #38: places far from Mordheim, for the warbands that travelled from far away, each in the place that holds it. */
  it('covers the world, not only the ruins: realms and lands far from Mordheim, nested the way the setting has them', () => {
    const chain = (id: string) => { const out: string[] = []; for (let p: string | null | undefined = id; p; p = byId.get(p)?.parent) out.unshift(p); return out; };
    expect(chain('the-pit')).toEqual(['old-world', 'the-empire', 'ostermark', 'mordheim', 'the-pit']);
    expect(chain('middenheim')).toEqual(['old-world', 'the-empire', 'middenland', 'middenheim']);
    for (const id of ['kislev', 'bretonnia', 'tilea', 'norsca', 'the-chaos-wastes', 'lustria', 'khemri', 'araby', 'cathay-and-the-east', 'ulthuan', 'naggaroth', 'albion']) {
      expect(byId.get(id)?.kind, id).toBe('region');
    }
    expect(chain('skeggi')).toEqual(['lustria', 'skeggi']);
    expect(chain('weijin')).toEqual(['cathay-and-the-east', 'grand-cathay', 'weijin']);
    // the realms stand at the top of the world; everything else lies in something
    const top = lore.LORE.filter((e) => e.kind === 'region' && !e.parent).map((e) => e.id);
    expect(top).toEqual(expect.arrayContaining(['old-world', 'lustria', 'ulthuan', 'naggaroth', 'norsca']));
    expect(lore.LORE.filter((e) => e.kind === 'region').length).toBeGreaterThan(60);
  });

  /* #37: more groups, with where they come from – the three tribes of the Marauders of Chaos first. */
  it('holds the tribes of the Marauders of Chaos and the groups that came from far away, each tied to where it comes from', () => {
    const groups = lore.LORE.filter((e) => e.kind === 'group');
    expect(groups.length).toBeGreaterThan(60);
    expect(byId.get('norse-tribes')?.regions).toEqual(['norsca']);
    expect(byId.get('kurgan-tribes')?.regions).toEqual(['the-chaos-wastes']);
    expect(byId.get('hung-tribes')?.regions).toEqual(expect.arrayContaining(['the-chaos-wastes', 'cathay-and-the-east']));
    // from far away: a group of Lustria, of Cathay, of Naggaroth, of Tilea
    for (const [id, region] of [['amazons-of-lustria', 'lustria'], ['battle-monks-of-cathay', 'cathay-and-the-east'], ['dark-elf-corsairs', 'naggaroth'], ['mazzalupo-companies', 'tilea']] as const) {
      expect(byId.get(id)?.regions, id).toContain(region);
    }
    // most groups say where they come from
    expect(groups.filter((g) => g.regions?.length).length / groups.length).toBeGreaterThan(0.9);
    // the groups of the first catalogue are tied to places as well
    for (const id of ['reikland-court', 'middenheim-court', 'lady-magritta', 'count-von-carstein', 'sisters-of-sigmar', 'master-of-the-possessed']) expect(byId.get(id)?.regions?.length, id).toBeGreaterThan(0);
  });
  /* #98 (Rob, 26.10.2026): more of the Warhammer world, only where there is lore enough behind each; each tied to the place that holds it. */
  it('has the kingdoms, cities, holds, Powers and orders added for report #98, each tied to its place', () => {
    const chain = (id: string) => { const out: string[] = []; for (let p: string | null | undefined = id; p; p = byId.get(p)?.parent) out.unshift(p); return out; };
    expect(chain('lothern')).toEqual(['ulthuan', 'eataine', 'lothern']);
    expect(chain('averheim')).toEqual(['old-world', 'the-empire', 'averland', 'averheim']);
    expect(chain('mousillon')).toEqual(['old-world', 'bretonnia', 'mousillon']);
    expect(chain('zhufbar')).toEqual(['old-world', 'worlds-edge-mountains', 'zhufbar']);
    expect(chain('hexoatl')).toEqual(['lustria', 'hexoatl']);
    for (const id of ['khorne', 'tzeentch', 'nurgle', 'slaanesh']) expect(byId.get(id)?.regions, id).toEqual(['the-chaos-wastes']);
    expect(byId.get('council-of-thirteen')?.kind).toBe('faction');
    expect(byId.get('teutogen-guard')?.regions).toEqual(['middenheim']);
  });
});
