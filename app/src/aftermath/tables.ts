/* The tables of the post-battle sequence, built from the rules data (N1, docs/plan-postbattle.md): one place for the aftermath page and the
   overview of the rules, so a table is never typed twice. Nothing here is computed from a warband. */
import * as core from '@mordheim/core';
import type { GameData } from '@mordheim/core';

export interface TableData {
  id: string;
  title: string;
  /** The column headings. */
  head: string[];
  rows: string[][];
  /** A short line under the table. */
  note?: string;
  /** Where the rule is written (mordheimer.net). */
  link?: string;
}

export interface LocationGroup { id: string; title: string; table: TableData }

const TOOLS = 'https://mordheimer.net/docs/tools';
const INCOME = 'https://mordheimer.net/docs/campaigns/income';

/** The Serious Injuries chart: a result with a die inside it is held as two rows (23a "Arm Wound (1: arm amputated)", 23b "… (2–6: …)"),
    shown as one row whose last column lists the parts. */
function heroInjuries(data: GameData): string[][] {
  const out: string[][] = [];
  for (const j of data.INJURIES) {
    const m = /^(\d+)[ab]$/.exec(j.code);
    if (!m) { out.push([j.code, j.name, j.text]); continue; }
    const part = /^(.*?)\s*\((.*)\)\s*$/.exec(j.name);
    const label = part ? `${part[2]}: ${j.text}` : j.text;
    const last = out[out.length - 1];
    if (last && last[0] === m[1]) last[2] = `${last[2]} · ${label}`;
    else out.push([m[1] as string, part ? (part[1] as string) : j.name, label]);
  }
  return out;
}

export function injuryTables(data: GameData): { hero: TableData; hench: TableData } {
  return {
    hero: { id: 'injuries-hero', title: 'Heroes: Serious Injuries (D66)', head: ['D66', 'Result', 'What happens'], rows: heroInjuries(data), link: 'https://mordheimer.net/docs/campaigns#serious-injuries' },
    hench: { id: 'injuries-hench', title: 'Henchmen (D6)', head: ['D6', 'Result', 'What happens'], rows: data.PB_HENCH_INJURY.map((r) => [...r]), link: 'https://mordheimer.net/docs/campaigns#serious-injuries' },
  };
}

export function experienceTables(data: GameData): { awards: TableData; underdog: TableData; hero: TableData; hench: TableData } {
  return {
    awards: { id: 'xp-awards', title: 'Experience for the battle', head: ['For', 'Exp', 'Who'], rows: data.PB_XP_AWARDS.map((r) => [...r]), link: `${TOOLS}#2-allocate-experience` },
    underdog: {
      id: 'xp-underdog', title: 'Underdog bonus (per fighter)', head: ['Difference in warband rating', 'Experience bonus'],
      rows: data.PB_UNDERDOG.map(([from, to, bonus]) => [to == null ? `${from}+` : `${from} – ${to}`, bonus ? `+${bonus}` : 'None']),
      note: 'Fighting a warband with a higher rating. Each warband takes the largest gap to a higher-rated opponent.', link: 'https://mordheimer.net/docs/campaigns/experience#underdogs',
    },
    hero: { id: 'adv-hero', title: 'Heroes: advance (2D6)', head: ['2D6', 'Advance', ''], rows: data.PB_HERO_ADVANCE.map((r) => [...r]), link: 'https://mordheimer.net/docs/campaigns/experience#advance-rolls' },
    hench: { id: 'adv-hench', title: 'Henchmen: advance (2D6)', head: ['2D6', 'Advance', ''], rows: data.PB_HENCH_ADVANCE.map((r) => [...r]), note: data.PB_ADVANCE_NOTES.join(' '), link: 'https://mordheimer.net/docs/campaigns/experience#advance-rolls' },
  };
}

export function shardsTable(data: GameData): TableData {
  return { id: 'shards', title: 'Wyrdstone found', head: ['Dice total', 'Shards'], rows: data.PB_EXPLORE_SHARDS.map(([t, n]) => [t, String(n)]), link: `${INCOME}#exploration-procedure` };
}

/** The price of selling a lot of wyrdstone: rows are the shards (1 … 8+), columns the size of the warband. */
export function wyrdPriceTable(): TableData {
  return {
    id: 'wyrd-prices', title: 'Wyrdstone prices (gold for the whole lot)', head: ['Shards', ...core.WYRD_BANDS.map((b) => `${b[1]} warriors`)],
    rows: core.WYRD_PRICE.map((row, i) => [i === core.WYRD_PRICE.length - 1 ? `${i + 1}+` : String(i + 1), ...row.map(String)]),
    note: 'The price is for the whole lot, not per shard. Selling can be done once per post-battle sequence.', link: `${TOOLS}#4-sell-wyrdstone`,
  };
}

const KIND_TITLE: Record<number, string> = { 2: 'Doubles', 3: 'Triples', 4: 'Four of a kind', 5: 'Five of a kind', 6: 'Six of a kind' };

/** The Exploration chart, one table for each kind of multiple. */
export function locationGroups(data: GameData): LocationGroup[] {
  const groups = new Map<number, string[][]>();
  for (const [dice, name, text] of data.PB_LOCATIONS) {
    const n = dice.split(' ').length;
    groups.set(n, [...(groups.get(n) ?? []), [dice.split(' ').join(' · '), name, text]]);
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([n, rows]) => ({
    id: `locations-${n}`, title: KIND_TITLE[n] ?? `${n} of a kind`,
    table: { id: `locations-${n}`, title: KIND_TITLE[n] ?? `${n} of a kind`, head: ['Dice', 'Place', 'What you find'], rows, link: `${INCOME}#exploration-chart` },
  }));
}

/** The ten steps with their sentence and link. */
export function sequenceTable(data: GameData): TableData {
  const text = Object.fromEntries(data.PB_SEQUENCE);
  return { id: 'sequence', title: 'The post-battle sequence', head: ['#', 'Step', 'What to do'], rows: core.PB_STEPS.map(([key, title], i) => [String(i + 1), title, text[key] ?? '']), link: TOOLS };
}
