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
  mod?: Partial<Record<StatKey, number>> | null;
  text?: string;
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
  /** Why he misses them, for the chronicle ("Arm Wound …"). */
  missWhy?: string;
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

/** One death (legacy S.fallen). Heroes keep their whole model; a henchman
    record holds a snapshot of ONE man of the group. */
export interface FallenRecord {
  kind: 'hero' | 'hench';
  m: Model;
  uid_def?: string;
  exp?: number;
  /** Which member of the group fell, and his own name if he had one. */
  memberIdx?: number;
  memberName?: string;
  /** What was taken out of the treasury for him (given back on undo). */
  lostValue?: number;
  /** The casualty record this death belongs to. */
  casualtyId?: number;
  /** The casualty record was created by the death itself. */
  casFromDeath?: boolean;
  [key: string]: unknown;
}

/** Victim or attacker of a casualty; `uid` is set when he is in this roster. */
export interface CasualtySide {
  uid: number | null;
  name: string;
  wb: string;
  grade: string;
  value: number | null;
  memberIdx?: number | null;
  uid_def?: string;
  [key: string]: unknown;
}

export type CasualtyResult = 'pending' | 'recovered' | 'injured' | 'dead';

/** A warrior put out of action in a battle (legacy S.campaign.casualties). */
export interface Casualty {
  id: number;
  round: number;
  battleId: number | null;
  victim: CasualtySide;
  attacker: CasualtySide;
  result: CasualtyResult | string;
  detail: string;
  /** Index into `fallen` once the death has been applied. */
  fallenId: number | null;
  note: string;
  /** The injury roll it was resolved with. */
  code?: string;
  /** The result has been written onto the roster. */
  applied?: boolean;
  /** The experience entry granted to the attacker. */
  xpId?: number;
  [key: string]: unknown;
}

/** Experience earned and held until applied (legacy S.campaign.xp). */
export interface XpEntry {
  id: number;
  round: number;
  uid: number;
  name: string;
  amount: number;
  reason: string;
  applied: boolean;
  [key: string]: unknown;
}

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
  casualties?: Casualty[];
  xp?: XpEntry[];
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
  /** Fallen warriors, in the order they fell. */
  fallen?: FallenRecord[];
  /** Next model uid to hand out (core only; see nextModelUid). */
  uidSeq?: number;
  [key: string]: unknown;
}
