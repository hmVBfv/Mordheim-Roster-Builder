/* Types for the audited game data in data/*.json.
 *
 * The data predates TypeScript and is only partly regular, so these types are
 * precise where the rules code depends on a field and deliberately open
 * (`[key: string]: unknown`) elsewhere. Tighten a type when code starts to rely
 * on another field, not before.
 */

export type StatKey = 'M' | 'WS' | 'BS' | 'S' | 'T' | 'W' | 'I' | 'A' | 'Ld';
/** Profile values can be numbers or strings such as "3(4)", "D6" or "—". */
export type Profile = Partial<Record<StatKey, number | string>>;

/** Marks on a list row. `start`: the price holds only while the warband is
    founded; afterwards the item is found at the Trading Post under `later`
    (the catalogue item, by default the row's own name). */
export interface EntryFlags { start?: boolean; later?: string }
/** One entry of an equipment list: [German item name, price in gc, marks]. */
export type EquipmentEntry = [name: string, price: number, flags?: EntryFlags];
/** An equipment list by category: "Nahkampf", "Fernkampf", "Rüstung", "Besonderes", … */
export type EquipmentList = Record<string, EquipmentEntry[]>;

export interface UnitDef {
  id: string;
  /** 'hero' or 'hen' (henchman group). */
  t: 'hero' | 'hen';
  name: string;
  cost: number;
  exp?: number;
  /** Maximum number of models; `null`/missing means unlimited. */
  max?: number | null;
  min?: number;
  /** The warband's leader. */
  req?: boolean;
  /** null for entries that are not fighters (Plague Cart, Trade Wagon). */
  profile: Profile | null;
  /** Key into LISTS. */
  eq?: string;
  sk?: string[];
  /** Special rules text. */
  sp?: string;
  /** Mutation set key ('chaos' | 'nurgle'). */
  mut?: string;
  large?: boolean;
  vehicle?: boolean;
  noArmour?: boolean;
  noMissile?: boolean;
  noHeavy?: boolean;
  /** Fixed gear that counts for the catalogue eligibility rule. */
  gear?: string[];
  /** A fixed armour save, if the unit has one. */
  sv?: number;
  /** Gains no experience (animals, vehicles). */
  noxp?: boolean;
  /** Skill lists by subtype, instead of `sk`. */
  skSub?: Record<string, string[]>;
  /** Profile changes by subtype, e.g. { midd: { S: 1 } }. */
  profSub?: Record<string, Partial<Record<StatKey, number>>>;
  /** Skill lists a promoted henchman of this type always gets. */
  promoCatsFixed?: string[];
  /** Warband skill set not available to this unit. */
  noWbSkills?: boolean;
  /** Extra attack shown as "1+1" (e.g. Saurus bite). */
  bite?: number | string;
  magic?: string;
  [key: string]: unknown;
}

export interface WarbandSubtype {
  key: string;
  name?: string;
  gold?: number;
  [key: string]: unknown;
}

export interface WarbandDef {
  name: string;
  grade: string;
  min: number;
  max: number;
  gold?: number;
  subtypeLabel?: string;
  subtypes?: WarbandSubtype[];
  rules?: string;
  units: UnitDef[];
}

export type CatalogCategory = 'cc' | 'missile' | 'bp' | 'armour' | 'misc';

/** A result of the Heroes' Serious Injuries chart (D66). */
export interface InjuryDef {
  code: string;
  name: string;
  text: string;
  /** Lasting characteristic change, e.g. { M: -1 }. */
  mod?: Partial<Record<StatKey, number>> | null;
  /** Games he misses (a temporary injury). */
  miss?: number | null;
  [key: string]: unknown;
}

export interface CatalogItem {
  /** German name (the key used in rosters). */
  de: string;
  en: string;
  cat: CatalogCategory;
  /** A number, or a string for variable prices ("25+2D6", "+20", "4× Preis"). */
  cost: number | string;
  rare: string;
  wb: string;
}

export interface UpgradeDef {
  en?: string;
  /** Weapon families this upgrade can be applied to. */
  fams: string[];
  heroesOnly?: boolean;
  /** Warbands the upgrade is restricted to. */
  wb?: string[];
  /** Price multiplier of the host weapon (material upgrades); 0/absent = flat price. */
  mult?: number;
  base?: number;
  /** The price while the warband is founded, for the warbands listed. */
  start?: { mult?: number; base?: number; wb?: string[] };
  note?: string;
}

export interface ItemInfo {
  name: string;
  line?: string;
  text: string;
  [key: string]: unknown;
}

export interface HireRule {
  type: string;
  wbs?: string[];
  tags?: string[];
  flags?: string[];
  except?: string[];
  xsub?: [string, string][];
  xwbs?: string[];
  noChaos?: boolean;
  subtype?: string;
}

export interface Persona {
  name: string;
  rule?: HireRule;
  eq?: string;
  sk?: string[];
  [key: string]: unknown;
}

/** A Hired Sword or a Dramatis Personae entry. */
export interface HireEntry {
  name: string;
  grade: string;
  src?: string;
  hire?: number;
  upkeep?: number;
  rating?: number;
  sizeBonus?: number;
  slot?: boolean;
  rule?: HireRule;
  grudge?: { tag: string; upkeep: number; note?: string };
  conflict?: unknown;
  profile?: Profile;
  eq?: string;
  eqBase?: string;
  sp?: string;
  opts?: { label: string; choices: string[] };
  personas?: Persona[];
  sk?: string[];
  /** Race key into MAXPROF (racial maxima). */
  race?: string;
  /** Spell list key into SPELLS, for casters. */
  magic?: string;
  /** Skills only this character can learn: [name, text]. */
  hsSpecial?: [string, string][];
  [key: string]: unknown;
}

/** Per-warband hiring metadata (alignment, tags, overrides). */
export interface WarbandHireInfo {
  align?: 'good' | 'neutral' | 'evil';
  tags?: string[];
  none?: boolean;
  only?: string[];
  except?: string[];
  noElfHS?: boolean;
  noChaosHS?: boolean;
  /** Derived at load time (see createGameData). */
  human?: boolean;
  chaos?: boolean;
  dwarf?: boolean;
  [key: string]: unknown;
}

export interface DistrictEffect {
  kind: string;
  tier?: 'foothold' | 'control';
  keys?: string[];
  map?: Record<string, number>;
  label?: string;
  [key: string]: unknown;
}

export interface District {
  id: string;
  name: string;
  area?: string;
  effects: DistrictEffect[];
  [key: string]: unknown;
}

export interface SkillList {
  name: string;
  note?: string;
  skills: [name: string, text: string][];
}

export interface SpellList {
  name: string;
  note?: string;
  spells: [name: string, text: string][];
}

/** The complete game data, as exported by legacy data/index.js. */
export interface GameData {
  MAXPROF: Record<string, Profile>;
  RACELABEL: Record<string, string>;
  RACE_EN: Record<string, string>;
  ARMOUR_SV: Record<string, number>;
  BRACE_HIDE: Record<string, number>;
  BRACE_PLURAL: Record<string, string>;
  CATALOG: CatalogItem[];
  EQEN: Record<string, string>;
  GSN_BRACE: Record<string, number>;
  ITEMINFO: [RegExp, ItemInfo][];
  LISTS: Record<string, EquipmentList>;
  MOUNTS: Record<string, unknown>;
  STD_CATS: string[];
  UPGRADES: Record<string, UpgradeDef>;
  /** Items that changed their name, per warband: old → new, in the equipment
      bought from the list (`eq`) and at the Trading Post (`rare`). */
  RENAMED: Record<string, { eq?: Record<string, string>; rare?: Record<string, string> }>;
  _ALLCC: string[];
  _CCFAM: string[];
  /** Item-name patterns → weapon/armour family (null = no family). */
  _FAM: [RegExp, string | null][];
  SKILLLISTS: Record<string, SkillList>;
  SKILLSETS: Record<string, SkillList>;
  STATKEYS: StatKey[];
  SV_SKILL_BASE: Record<string, number>;
  SV_SKILL_BONUS: Record<string, number>;
  SPELLS: Record<string, SpellList>;
  ABILEN: Record<string, string>;
  ABILITYINFO: [RegExp, ItemInfo][];
  BLESSINGS: EquipmentEntry[];
  MUTATIONS: EquipmentEntry[];
  MUTEN: Record<string, string>;
  MUTLABEL: Record<string, string>;
  MUTSETS: Record<string, EquipmentEntry[]>;
  INJEN: Record<string, string>;
  INJURIES: InjuryDef[];
  NAMEEN: Record<string, string>;
  NR_CAT: Record<string, string>;
  NR_T: Record<string, string>;
  TERMEN: [string, string][];
  HR_LABELS: Record<string, string>;
  MARAUDER_MARKS: [string, string, string][];
  MARK_RULES: Record<string, unknown>;
  SHEET: Record<string, unknown>;
  DISTRICTS: District[];
  PENDING_1A: unknown[];
  UNITRACE: Record<string, string>;
  WARBANDS: Record<string, WarbandDef>;
  WBEXTRA: Record<string, Record<string, unknown>>;
  WBRACE: Record<string, string>;
  HIREDSWORDS: Record<string, HireEntry>;
  HS_GRADE_ORDER: string[];
  WBHIRE: Record<string, WarbandHireInfo>;
  DP_GRADE_ORDER: string[];
  DRAMATIS: Record<string, HireEntry>;
  /* The reference tables of the post-battle sequence (data/postbattle.json):
     rows of [roll, result, text]; the shards table [dice total, shards]. */
  PB_SOURCE: string;
  PB_HENCH_INJURY: [roll: string, result: string, text: string][];
  PB_XP_AWARDS: [what: string, exp: string, who: string][];
  PB_HERO_ADVANCE: [roll: string, result: string, text: string][];
  PB_HENCH_ADVANCE: [roll: string, result: string, text: string][];
  PB_ADVANCE_NOTES: string[];
  PB_EXPLORE_SHARDS: [total: string, shards: number][];
  PB_LOCATIONS: [dice: string, name: string, text: string][];
}

/** The data files, in the order legacy data/index.js loads them. */
export const DATA_FILES = [
  'races', 'equipment', 'skills', 'spells', 'abilities', 'mutations', 'injuries', 'i18n',
  'houserules', 'marks', 'sheet', 'campaign', 'warbands', 'hiredswords', 'dramatis', 'postbattle',
] as const;
export type DataFile = (typeof DATA_FILES)[number];

/** Raw file contents: file name → parsed JSON object. */
export type RawGameData = Partial<Record<DataFile, Record<string, unknown>>>;
