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
});
