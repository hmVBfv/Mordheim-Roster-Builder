/* The warband save format — what the legacy app keeps in `S` and exports as
   JSON. Fields are listed as the rules code reads them; unknown fields are
   carried along untouched. See docs/data-model.md, section 2. */
import type { StatKey } from '../data/types.ts';

/** A rare / trading-post item held by a model: quantity, price paid, and for
    weapon upgrades the weapon it sits on. */
export interface RareHolding {
  q: number | string;
  paid?: number | string;
  on?: string;
  [key: string]: unknown;
}

export interface Injury {
  code?: string;
  name?: string;
  /** Stat changes caused by the injury, e.g. { T: -1 }. */
  mod?: Partial<Record<StatKey, number>>;
  [key: string]: unknown;
}

/** A spell or prayer a caster knows; `red` lowers its difficulty. */
export interface SpellPick {
  name: string;
  red?: number;
  [key: string]: unknown;
}

export interface Model {
  /** Stable id of this roster entry. Never changes. */
  uid: number;
  /** Id of the unit definition in the warband. */
  uid_def: string;
  name?: string;
  names?: string[];
  /** Group size for henchmen; 1 for heroes. */
  qty?: number;
  exp?: number | string;
  /** Equipment: German item name → quantity. */
  eq?: Record<string, number | string>;
  rare?: Record<string, RareHolding>;
  mut?: string[];
  adv?: Partial<Record<StatKey, number | string>>;
  skills?: string[];
  spells?: SpellPick[];
  inj?: Injury[];
  promoted?: boolean;
  /** A hero who learned to cast (house rule / campaign), and his lore. */
  caster?: boolean;
  lore?: string;
  magic?: string;
  /** Games to miss (injuries). */
  miss?: number;
  promoCats?: string[];
  /** Experience surcharge actually paid when veterans joined this group. */
  xpPaid?: number;
  /** Kislev: the heirloom item bought at half price. */
  heirloom?: string | null;
  /** The player removed the free dagger. */
  _noDagger?: boolean;
  [key: string]: unknown;
}

/** A hired Hired Sword or Dramatis Personae. */
export interface HireRecord {
  key: string;
  uid: string;
  name?: string;
  exp?: number | string;
  skills?: string[];
  spells?: SpellPick[];
  adv?: Partial<Record<StatKey, number | string>>;
  inj?: Injury[];
  /** Chosen option or persona. */
  opt?: string;
  /** Extra equipment (house rule): German item name → quantity. */
  eq?: Record<string, number | string>;
  [key: string]: unknown;
}

export interface StashItem {
  name: string;
  qty: number;
  [key: string]: unknown;
}

export interface Stash {
  wyrd?: number;
  /** The treasury; `null`/'' means "starting gold". */
  gold?: number | string | null;
  items?: StashItem[];
  [key: string]: unknown;
}

export type DistrictHold = 'none' | 'foothold' | 'control';

/** An entry of the campaign chronicle (legacy S.campaign.log). */
export interface LogEntry {
  id: number;
  round: number;
  type: string;
  text: string;
  /** true = recorded by the tool as it happened; false = written by hand. */
  auto: boolean;
  data?: Record<string, unknown>;
  edited?: boolean;
  [key: string]: unknown;
}

export interface CampaignState {
  on?: boolean;
  round?: number;
  districts?: Record<string, DistrictHold>;
  log?: LogEntry[];
  battles?: { id: number; [key: string]: unknown }[];
  casualties?: unknown[];
  xp?: unknown[];
  snapshots?: Record<string, unknown>;
  /** Last log id handed out (core only; ids are never reused). */
  logSeq?: number;
  [key: string]: unknown;
}

export interface HouseRules {
  startGold: number | '';
  min: number | '';
  max: number | '';
  heroes: number;
  priceAll: number;
  priceArmour: number;
  priceBP: number;
  priceMissile: number;
  clubSurcharge: number;
  slingSurcharge: number;
  armourBodyOnly: boolean;
  freeDagger: boolean;
  miscHench: boolean;
  freeMarket: boolean;
  allSkills: boolean;
  showRarity: boolean;
  rangedCapOn: boolean;
  rangedCap: number;
  rerollOne: boolean;
  eqLimitOn: boolean;
  hireNewLeader: boolean;
  hsGrades: Record<string, boolean>;
  dpGrades: Record<string, boolean>;
  hsEquip: boolean;
  notes: string;
}

export interface WarbandState {
  /** Warband key (into WARBANDS); null before one is chosen. */
  wb: string | null;
  subtype?: string | null;
  name?: string;
  budget?: number;
  models: Model[];
  hired?: HireRecord[];
  dp?: HireRecord[];
  stash?: Stash;
  house?: Partial<HouseRules>;
  campaign?: CampaignState;
  leaderUid?: number | null;
  mark?: string | null;
  /** Fallen warriors (graveyard); typed in the injuries slice. */
  fallen?: unknown[];
  /** Next model uid to hand out (core only; see nextModelUid). */
  uidSeq?: number;
  [key: string]: unknown;
}
