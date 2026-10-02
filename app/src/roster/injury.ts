/* What the injury sheets ask and show (phase 3c, V1; mockup roster.html
   "Serious injury"): the rows of the Heroes' chart with the follow-up each
   asks for, and the answers turned into the roll core's `injure` takes.
   Kept apart from React so it can be tested. */
import * as core from '@mordheim/core';
import type { HeroCode, HeroRoll, Model } from '@mordheim/core';

/** One answer to a follow-up question. */
export interface Option { key: string; label: string }

/** A row of the chart as the sheet shows it. */
export interface ChartRow { code: HeroCode; label: string; how: string }

export const CHART: Record<HeroCode, ChartRow> = {
  '11-15': { code: '11-15', label: 'Dead', how: 'Removed from the roster; all his equipment is lost.' },
  '16-21': { code: '16-21', label: 'Multiple Injuries', how: 'Roll a D6 for how many more results; Dead, Captured and Multiple Injuries are rolled again.' },
  '22': { code: '22', label: 'Leg Wound', how: 'Movement −1.' },
  '23': { code: '23', label: 'Arm Wound', how: 'Roll a D6:' },
  '24': { code: '24', label: 'Madness', how: 'Roll a D6:' },
  '25': { code: '25', label: 'Smashed Leg', how: 'Roll a D6:' },
  '26': { code: '26', label: 'Chest Wound', how: 'Toughness −1.' },
  '31': { code: '31', label: 'Blinded in One Eye', how: 'Ballistic Skill −1. Blinded in both eyes, he must retire from the warband.' },
  '32': { code: '32', label: 'Old Battle Wound', how: 'Before every battle: on a 1 on a D6 he cannot fight.' },
  '33': { code: '33', label: 'Nervous Condition', how: 'Initiative −1.' },
  '34': { code: '34', label: 'Hand Injury', how: 'Weapon Skill −1.' },
  '35': { code: '35', label: 'Deep Wound', how: 'He misses the next D3 games:' },
  '36': { code: '36', label: 'Robbed', how: 'All his weapons, armour and equipment are lost; nothing comes back.' },
  '41-55': { code: '41-55', label: 'Full Recovery', how: 'No lasting harm.' },
  '56': { code: '56', label: 'Bitter Enmity', how: 'He hates, on a D6:' },
  '61': { code: '61', label: 'Captured', how: 'What became of him?' },
  '62-63': { code: '62-63', label: 'Hardened', how: 'Immune to fear from now on.' },
  '64': { code: '64', label: 'Horrible Scars', how: 'Causes fear from now on.' },
  '65': { code: '65', label: 'Sold to the Pits', how: 'A fight against a Pit Fighter:' },
  '66': { code: '66', label: 'Survives Against the Odds', how: '+1 experience.' },
};

/** The answers as the sheet holds them, nested like the roll. */
export interface RollDraft {
  /** The D66 as typed. */
  dice: string;
  /** The answer to the row's own question. */
  pick?: string;
  /** A district's or the Peg Leg's question: 'save' or 'stands'. */
  save?: string;
  /** 61 ransomed: gold as typed. 56: whom he hates, as typed. */
  gold?: string;
  hates?: string;
  /** 16–21: the further results. 65 lost: the roll on 11–35. */
  more?: RollDraft[];
  then?: RollDraft;
}

export const emptyDraft = (dice = ''): RollDraft => ({ dice });

/** What the sheet knows about the warrior and his warband. */
export interface InjuryEnv {
  districts: core.InjuryDistricts;
  pegLeg: boolean;
  /** Who put him out of action, from his open casualty record. */
  attacker: { name: string; wb: string } | null;
  /** He is already blind in one eye. */
  oneEye: boolean;
}

export function injuryEnv(ctx: core.Ctx, m: Model): InjuryEnv {
  const open = core.pendingCasualtyFor(ctx, m.uid);
  const a = open?.attacker;
  return {
    districts: core.injuryDistricts(ctx),
    pegLeg: core.hasPegLeg(m),
    attacker: a && (a.name || a.wb) ? { name: a.name, wb: a.wb ? core.wbName(ctx, a.wb) : '' } : null,
    oneEye: (m.inj ?? []).some((j) => j.code === '31'),
  };
}

/** The question a row asks, with its answers (none: nothing to ask). */
export function questionOf(code: HeroCode, env: InjuryEnv): { label: string; options: Option[] } | null {
  switch (code) {
    case '23': return { label: 'D6', options: [{ key: '1', label: '1 — arm amputated: one single-handed weapon from now on' }, { key: '2-6', label: '2–6 — misses the next game' }] };
    case '24': return { label: 'D6', options: [{ key: '1-3', label: '1–3 — Stupidity' }, { key: '4-6', label: '4–6 — Frenzy' }] };
    case '25': return { label: 'D6', options: [{ key: '1', label: '1 — may not run any more (but may charge)' }, { key: '2-6', label: '2–6 — misses the next game' }] };
    case '35': return { label: 'D3', options: [{ key: '1', label: '1 game' }, { key: '2', label: '2 games' }, { key: '3', label: '3 games' }] };
    case '56': {
      const a = env.attacker;
      return {
        label: 'D6', options: [
          { key: '1-3', label: `1–3 — ${a?.name || 'the one who put him out of action'}` },
          { key: '4', label: `4 — ${a?.wb ? `the leader of that ${a.wb} warband` : 'the leader of that warband'}` },
          { key: '5', label: `5 — ${a?.wb ? `that whole ${a.wb} warband` : 'that whole warband'}` },
          { key: '6', label: `6 — ${a?.wb ? `every ${a.wb} warband` : 'every warband of that kind'}` },
        ],
      };
    }
    case '61': return env.districts.gaol ? null : { label: 'His fate', options: [{ key: 'held', label: 'Held for now — he stays on the roster but does not fight' }, { key: 'exchanged', label: 'Exchanged' }, { key: 'ransomed', label: 'Ransomed' }, { key: 'lost', label: 'Never returned (sold, killed or sacrificed)' }] };
    case '65': return env.districts.amphitheatre ? null : { label: 'The fight', options: [{ key: 'won', label: 'Won — +50 gc, +2 experience' }, { key: 'lost', label: 'Lost — loses his weapons and armour, then rolls 11–35' }] };
    case '16-21': return { label: 'D6: how many more', options: ['1', '2', '3', '4', '5', '6'].map((k) => ({ key: k, label: k })) };
    default: return null;
  }
}

const SIGMAR: readonly HeroCode[] = ['22', '23', '24', '25', '26', '31', '32', '33', '34', '35'];

/** A district's or the Peg Leg's question before the row applies. */
export function saveQuestionOf(code: HeroCode, env: InjuryEnv): { label: string; note: string; options: Option[]; saved: 'morr' | 'sigmar' | 'peg' } | null {
  if (code === '11-15' && env.districts.morr) return { label: 'Temple of Morr', note: 'Your foothold there: roll a D6, on 5+ he recovers fully.', options: [{ key: 'stands', label: '1–4 — dead' }, { key: 'save', label: '5–6 — Full Recovery' }], saved: 'morr' };
  if ((code === '22' || code === '25') && env.pegLeg) return { label: 'Peg Leg', note: 'His Peg Leg: roll a D6, on 4+ the hit struck the peg and is ignored.', options: [{ key: 'stands', label: '1–3 — it stands' }, { key: 'save', label: '4–6 — ignored' }], saved: 'peg' };
  if (SIGMAR.includes(code) && env.districts.sigmar) return { label: 'Temple of Sigmar', note: 'Your foothold there: roll a D6, on 5+ he recovers fully.', options: [{ key: 'stands', label: '1–4 — it stands' }, { key: 'save', label: '5–6 — Full Recovery' }], saved: 'sigmar' };
  return null;
}

/** What a draft of 56 names as hated, before the player changes it. */
export function hatesDefault(pick: string | undefined, env: InjuryEnv): string {
  const a = env.attacker;
  if (pick === '1-3') return a?.name ?? '';
  if (pick === '4') return a?.wb ? `the leader of the ${a.wb}` : '';
  if (pick === '5') return a?.wb ? `the ${a.wb}` : '';
  if (pick === '6') return a?.wb ? `every ${a.wb} warband` : '';
  return '';
}

/** Who holds a captive, from his casualty record. */
export function captors(env: InjuryEnv): string {
  const a = env.attacker;
  return a?.wb ? `the ${a.wb}` : a?.name ?? '';
}

const D6_OF: Record<string, number> = { '1': 1, '2-6': 2, '1-3': 1, '4-6': 4, '4': 4, '5': 5, '6': 6 };

/** The roll the answers make, or null while something is missing. */
export function rollFromDraft(d: RollDraft, env: InjuryEnv, allowed: readonly HeroCode[] = core.HERO_CODES): HeroRoll | null {
  const code = core.heroCodeOf(d.dice);
  if (!code || !allowed.includes(code)) return null;
  const sq = saveQuestionOf(code, env);
  if (sq) {
    if (!d.save) return null;
    if (d.save === 'save') return { code, saved: sq.saved };
  }
  switch (code) {
    case '23': case '24': case '25':
      return d.pick ? { code, d6: D6_OF[d.pick] } : null;
    case '56': {
      const hates = (d.hates ?? hatesDefault(d.pick, env)).trim();
      return d.pick && hates ? { code, d6: D6_OF[d.pick], hates } : null;
    }
    case '35': return d.pick ? { code, games: Number(d.pick) } : null;
    case '61':
      if (env.districts.gaol) return { code };
      if (d.pick === 'exchanged' || d.pick === 'lost') return { code, captured: { fate: d.pick } };
      if (d.pick === 'held') return { code, captured: { fate: 'held', by: captors(env) } };
      if (d.pick === 'ransomed' && /^\d+$/.test((d.gold ?? '').trim())) return { code, captured: { fate: 'ransomed', gold: Number(d.gold) } };
      return null;
    case '65': {
      if (env.districts.amphitheatre) return { code };
      if (d.pick === 'won') return { code, pit: { won: true } };
      if (d.pick !== 'lost') return null;
      const then = d.then ? rollFromDraft(d.then, env, core.AFTER_PIT) : null;
      return then ? { code, pit: { won: false, then } } : null;
    }
    case '16-21': {
      const n = Number(d.pick);
      const more = (d.more ?? []).slice(0, n).map((x) => rollFromDraft(x, env, MULTIPLE));
      return n >= 1 && more.length === n && more.every(Boolean) ? { code, more: more as HeroRoll[] } : null;
    }
    default: return { code };
  }
}

export const MULTIPLE: readonly HeroCode[] = core.HERO_CODES.filter((c) => !core.NOT_IN_MULTIPLE.includes(c));

/** A D66 as two dice, tens first ("Roll the dice"). */
export function randomD66(rand: () => number): string {
  const d = () => 1 + Math.floor(rand() * 6);
  return `${d()}${d()}`;
}
