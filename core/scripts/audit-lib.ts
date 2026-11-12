/* The audit of a warband's data against its page on mordheimer.net (plan P9; docs/rules-audit.md). Reads the page's rule text and tables, reads
   a warband's data file (ADR 0031), and lists only what differs – never changes data: that is Rob's call (CLAUDE.md, Rules authority). Pure, so a
   test can run it on a small page; the fetching and the command line are in audit-warband.ts. */

export type Block =
  | { kind: 'h'; level: number; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'li'; text: string }
  | { kind: 'table'; rows: string[][] };

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', times: '×' };

export function text(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/[\u200b\u00a0]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** The page's article as headings, paragraphs, list items and tables, in order. */
export function blocksOf(html: string): Block[] {
  const start = html.search(/class="[^"]*theme-doc-markdown[^"]*"/);
  const body = start >= 0 ? html.slice(start) : html;
  const out: Block[] = [];
  const re = /<(h[1-5])\b[^>]*>([\s\S]*?)<\/\1>|<table\b[\s\S]*?<\/table>|<p\b[^>]*>([\s\S]*?)<\/p>|<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  for (let m = re.exec(body); m; m = re.exec(body)) {
    if (m[1]) out.push({ kind: 'h', level: Number(m[1][1]), text: text(m[2]!) });
    else if (m[0].toLowerCase().startsWith('<table')) {
      const rows = [...m[0].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((tr) => [...tr[0].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => text(c[1]!)));
      out.push({ kind: 'table', rows });
    } else if (m[3] !== undefined) { const t = text(m[3]); if (t) out.push({ kind: 'p', text: t }); }
    else if (m[4] !== undefined) { const t = text(m[4]); if (t) out.push({ kind: 'li', text: t }); }
  }
  return out;
}

/* ---- what the data file holds (only the fields the audit reads) ---- */

export interface DataUnit { id: string; t: 'hero' | 'hen'; name: string; cost: number; exp: number; max?: number; profile: Record<string, number>; eq: string | null; sk?: string[] }
export interface WarbandFile { warband: { name: string; min: number; max: number; gold: number; units: DataUnit[] }; race?: string; lists?: Record<string, Record<string, [string, number | string, Record<string, unknown>?][]>> }
export interface Catalog { de: string; en: string }

export const STATS = ['M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld'] as const;
const NUM_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const num = (s: string): number | null => { const v = /^\d+$/.test(s) ? Number(s) : NUM_WORDS[s.toLowerCase()]; return v ?? null; };
/** One word without its plural and its last vowel, so that the spellings of a page and of a file meet: elves → elf, ladies → lad, lady → lad,
    witches → witch, shades → shad, zombie → zomb, axes → ax, bowmen → bowman. */
const stem = (w: string) => (w.length < 4 ? w : w.replace(/men$/, 'man').replace(/ves$/, 'f').replace(/(?<!s)s$/, '').replace(/(ie|y|e)$/, ''));
/** The name of a unit or an item as two spellings meet: lower case, "The" and the brackets and what follows a slash left out, no plural. */
export const key = (s: string) => s.toLowerCase().replace(/\([^)]*\)/g, '').replace(/^the\s+/, '').split('/')[0]!.replace(/[^a-z0-9 ]/g, '').trim().split(/\s+/).map(stem).join(' ');
/** Every name an item answers to: "Tanto (Dagger)" is also "Dagger"; "Riding/Draft Horse (Border Town Burning)" is "Riding" – and the plain name. */
export const keysOf = (s: string): string[] => {
  const inner = /\(([^)]*)\)/.exec(s)?.[1];
  return [...new Set([key(s), ...(inner && !/only|burning|setting|first|1st/i.test(inner) ? [key(inner)] : [])])];
};

export interface Finding { area: string; what: string; page: string; data: string }

export interface PageUnit { name: string; heading: string; cost: number | null; max: number | null; profile: Record<string, number> | null }

/** The units of the "Heroes" and "Henchmen" sections: "### 0 – 2 Lordlings", the price line under it, and its profile table. */
export function pageUnits(blocks: Block[]): PageUnit[] {
  const units: PageUnit[] = [];
  let inUnits = false;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    if (b.kind === 'h' && b.level === 2) inUnits = /^(heroes|henchmen|hired swords)$/i.test(b.text);
    if (!inUnits || b.kind !== 'h' || b.level !== 3) continue;
    const m = /^(?:(\d+)\s*[–-]\s*)?(\d+|any number|one)?\s*(?:of\s+)?(.+)$/i.exec(b.text);
    const name = (m?.[3] ?? b.text).trim();
    let cost: number | null = null, profile: Record<string, number> | null = null;
    for (let j = i + 1; j < blocks.length && !(blocks[j]!.kind === 'h' && (blocks[j] as { level: number }).level <= 3); j++) {
      const x = blocks[j]!;
      if (cost === null && x.kind === 'p') { const c = /(\d+)\s*(?:gold crowns?|gc)\b/i.exec(x.text); if (c) cost = Number(c[1]); }
      if (!profile && x.kind === 'table' && x.rows[0]?.some((h) => h === 'WS')) {
        const head = x.rows[0]!, row = x.rows[1] ?? [];
        profile = {};
        for (const s of STATS) { const at = head.indexOf(s); const v = at >= 0 ? Number((row[at] ?? '').replace(/[^\d]/g, '')) : NaN; if (!Number.isNaN(v)) profile[s] = v; }
      }
    }
    const top = m?.[2] ? num(m[2]) : null;
    units.push({ name, heading: b.text, cost, max: top ?? (m?.[1] ? null : null), profile });
  }
  return units;
}

/** The three figures of "Choice of warriors": the fewest models, the gold to start with and the most warriors. */
export function pageMeta(blocks: Block[]): { min: number | null; gold: number | null; max: number | null } {
  const all = blocks.filter((b): b is Extract<Block, { kind: 'p' }> => b.kind === 'p').map((b) => b.text).join(' ');
  const min = /minimum of (\w+) models/i.exec(all)?.[1];
  return {
    min: min ? num(min) : null,
    gold: Number(/(\d+) gold crowns to (?:recruit|start|set up|form|build)/i.exec(all)?.[1] ?? NaN) || null,
    max: Number(/(?:may never exceed|maximum number of warriors[^.]*?(?:is|of)|up to) (\d+)/i.exec(all)?.[1] ?? NaN) || null,
  };
}

/** Starting experience: "A Noble starts with 20 experience", "Lordlings start with 8 experience". */
export function pageExp(blocks: Block[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of blocks) {
    if (b.kind !== 'p') continue;
    for (const m of b.text.matchAll(/(?:\b(?:An?|The)\s+)?([A-Z][\w' -]*?)s?\s+starts?\s+with\s+(\d+)\s+experience/g)) out[key(m[1]!)] = Number(m[2]);
  }
  return out;
}

export interface PageList { title: string; items: { name: string; cost: string }[] }

/** "### Corsair Equipment List" with its tables (the "Item | Cost" rows of each category). */
export function pageLists(blocks: Block[]): PageList[] {
  const lists: PageList[] = [];
  let cur: PageList | null = null;
  for (const b of blocks) {
    if (b.kind === 'h') cur = b.level === 3 && /equipment list/i.test(b.text) ? { title: b.text, items: [] } : (b.level <= 3 ? null : cur);
    if (cur && lists[lists.length - 1] !== cur && b.kind === 'h') lists.push(cur);
    if (cur && b.kind === 'table' && /cost|price/i.test(b.rows[0]?.[1] ?? '')) for (const r of b.rows.slice(1)) if (r[0]) cur.items.push({ name: r[0], cost: r[1] ?? '' });
  }
  return lists;
}

/** The first whole price in a cell of a page ("10 gc", "1st free/2 gc" → 2; "3 x price" → none). */
export const priceOf = (cost: string | number): number | null => {
  if (typeof cost === 'number') return cost;
  // a price that is more than a number (15 + D6, 3 x price, free) is not compared
  if (/[+×]|\bx\b|\bD\d|price|cost|free!/i.test(cost.replace(/1st free/i, ''))) return null;
  const m = /(\d+)\s*gc\b/i.exec(cost);
  return m ? Number(m[1]) : null;
};
const clean = (s: string) => s.replace(/\s*\*+\s*$/, '').replace(/\(1st free\)|\(1\. gratis\)/i, '').replace(/\(.*?only\)/i, '');

export interface AuditInput { page: Block[]; file: WarbandFile; catalog: Catalog[]; /** data/races.json MAXPROF: the racial maxima by race */ maxprof?: Record<string, Record<string, number>> }

/** Every difference between the page and the file. */
export function audit({ page, file, catalog, maxprof }: AuditInput): Finding[] {
  const out: Finding[] = [];
  const wb = file.warband;
  const meta = pageMeta(page);
  for (const [field, p, d] of [['fewest models', meta.min, wb.min], ['starting gold', meta.gold, wb.gold], ['most warriors', meta.max, wb.max]] as const) {
    if (p !== null && p !== d) out.push({ area: 'warband', what: field, page: String(p), data: String(d) });
  }
  // the maximum characteristics: the first table after the words "Maximum Characteristics" (the units' tables come later and are not it)
  const at0 = page.findIndex((b) => (b.kind === 'p' || b.kind === 'h') && /maximum characteristics/i.test(b.text));
  const maxTable = at0 < 0 ? undefined : page.slice(at0 + 1, at0 + 4).find((b): b is Extract<Block, { kind: 'table' }> => b.kind === 'table' && !!b.rows[0]?.includes('WS'));
  const want = file.race ? maxprof?.[file.race] : undefined;
  if (maxTable && want) {
    for (const st of STATS) { const at = maxTable.rows[0]!.indexOf(st); const v = Number((maxTable.rows[1]?.[at] ?? '').replace(/[^\d]/g, '')); if (at >= 0 && !Number.isNaN(v) && v !== want[st]) out.push({ area: 'maximum characteristics', what: st, page: String(v), data: String(want[st]) }); }
  }
  // the skill table: a tick per hero and skill list; "Special" stands for any list that is not one of the five
  const skillTable = page.find((b): b is Extract<Block, { kind: 'table' }> => b.kind === 'table' && !!b.rows[0]?.includes('Combat') && !!b.rows[0].includes('Shooting'));
  if (skillTable) {
    const cols: [string, string][] = [['Combat', 'combat'], ['Shooting', 'shooting'], ['Academic', 'academic'], ['Strength', 'strength'], ['Speed', 'speed']];
    for (const row of skillTable.rows.slice(1)) {
      const u = wb.units.find((x) => key(x.name) === key(row[0] ?? ''));
      if (!u || u.t !== 'hero') continue;
      const have = new Set(u.sk ?? []);
      for (const [label, id] of cols) {
        const at = skillTable.rows[0]!.indexOf(label);
        if (at >= 0 && (row[at]?.trim() !== '') !== have.has(id)) out.push({ area: `unit ${u.name}`, what: `skill list ${label}`, page: row[at]?.trim() ? 'yes' : 'no', data: have.has(id) ? 'yes' : 'no' });
      }
      const at = skillTable.rows[0]!.indexOf('Special');
      const special = (u.sk ?? []).some((x) => !cols.some(([, id]) => id === x));
      if (at >= 0 && (row[at]?.trim() !== '') !== special) out.push({ area: `unit ${u.name}`, what: 'skill list Special', page: row[at]?.trim() ? 'yes' : 'no', data: special ? 'yes' : 'no' });
    }
  }
  const exp = pageExp(page);
  const units = pageUnits(page);
  const byName = new Map(wb.units.map((u) => [key(u.name), u]));
  const seen = new Set<string>();
  for (const pu of units) {
    const u = byName.get(key(pu.name));
    if (!u) { out.push({ area: `unit ${pu.name}`, what: 'unit', page: pu.heading, data: 'none' }); continue; }
    seen.add(u.id);
    if (pu.cost !== null && pu.cost !== u.cost) out.push({ area: `unit ${u.name}`, what: 'cost', page: String(pu.cost), data: String(u.cost) });
    for (const s of STATS) {
      const p = pu.profile?.[s];
      if (p !== undefined && p !== u.profile[s]) out.push({ area: `unit ${u.name}`, what: s, page: String(p), data: String(u.profile[s]) });
    }
    if (!pu.profile) out.push({ area: `unit ${u.name}`, what: 'profile', page: 'no table', data: 'has one' });
    const e = exp[key(u.name)];
    if (e !== undefined && u.t === 'hero' && e !== u.exp) out.push({ area: `unit ${u.name}`, what: 'starting experience', page: String(e), data: String(u.exp) });
  }
  for (const u of wb.units) if (!seen.has(u.id)) out.push({ area: `unit ${u.name}`, what: 'unit', page: 'none', data: u.name });
  // the lists: each list of the page against the list of the file it is nearest to, by the items they name
  const en = new Map(catalog.map((c) => [key(c.de), c.en]));
  const lists = Object.entries(file.lists ?? {}).map(([id, cats]) => ({ id, items: Object.values(cats).flat().map(([n, c]) => ({ name: en.get(key(n)) ?? n, cost: c })) }));
  for (const pl of pageLists(page)) {
    // an item of the page is any of the names it answers to; one of the file likewise
    const pageKeys = pl.items.map((i) => keysOf(clean(i.name)));
    const near = (l: (typeof lists)[number]) => {
      const mine = l.items.map((i) => keysOf(clean(i.name)));
      const same = pageKeys.filter((k) => mine.some((m) => m.some((x) => k.includes(x)))).length;
      return { l, mine, same, score: same / (pageKeys.length + mine.length - same || 1) };
    };
    // the nearest list: most items in common relative to all the items of both (so a longer list that contains this one does not win)
    const best = lists.map(near).sort((a, b) => b.score - a.score)[0];
    if (!best || best.same < Math.ceil(pageKeys.length / 2)) { out.push({ area: `list ${pl.title}`, what: 'list', page: `${pageKeys.length} items`, data: 'no list that matches' }); continue; }
    const where = `list ${pl.title} (${best.l.id})`;
    const onlyPage: { name: string; cost: string }[] = [];
    pl.items.forEach((i, n) => {
      const at = best.mine.findIndex((m) => m.some((x) => pageKeys[n]!.includes(x)));
      const d = best.l.items[at];
      if (!d) { onlyPage.push(i); return; }
      const p = priceOf(i.cost), dp = priceOf(d.cost);
      if (p !== null && dp !== null && p !== dp) out.push({ area: where, what: `${i.name} price`, page: i.cost, data: String(d.cost) });
    });
    const onlyData = best.l.items.filter((_, n) => !pageKeys.some((k) => best.mine[n]!.some((x) => k.includes(x))));
    // an item that stands under one name on the page and another in the file, with the same price and nothing else left of that price, is one item named twice
    for (const i of [...onlyPage]) {
      const same = onlyData.filter((d) => priceOf(d.cost) !== null && priceOf(d.cost) === priceOf(i.cost));
      if (same.length === 1 && onlyPage.filter((x) => priceOf(x.cost) === priceOf(i.cost)).length === 1) {
        out.push({ area: where, what: 'named differently', page: i.name, data: same[0]!.name });
        onlyPage.splice(onlyPage.indexOf(i), 1);
        onlyData.splice(onlyData.indexOf(same[0]!), 1);
      }
    }
    // an upgrade ("3 x price": gromril, ithilmar) is not an item of the list: the game's upgrade rules carry it
    const upgrade = /[x×]\s*(price|cost)/i;
    for (const i of onlyPage) if (!upgrade.test(String(i.cost))) out.push({ area: where, what: i.name, page: i.cost, data: 'missing' });
    for (const d of onlyData) if (!/ithilmar|gromril|obsidian/i.test(d.name)) out.push({ area: where, what: d.name, page: 'not on the page', data: String(d.cost) });
  }
  return out;
}

export const render = (name: string, findings: Finding[]): string =>
  findings.length === 0 ? `${name}: no differences\n` : `${name}: ${findings.length}\n${findings.map((f) => `  - ${f.area}: ${f.what} — page ${f.page}, data ${f.data}`).join('\n')}\n`;
