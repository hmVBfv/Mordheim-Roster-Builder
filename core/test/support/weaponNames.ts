/* Intended difference (docs/behaviour-changes.md, "Aufwertungen auf mehreren Waffen", reports #109/#110): core names the weapon of a
   weapon upgrade – "Dagger (Gromril)" – where legacy writes "Gromril weapon". For the comparison with legacy the core text is read
   back into legacy's words, for these labels and nothing else. */
const LABEL = /(^|, |: |\[5ACFFF\]Equipment:\[-\] |\n)(?:[A-Z][\w'’-]*(?: [\w'’-]+)*?) \((Gromril|Ithilmar|Obsidian)\)/g;

export function legacyWeaponNames<T>(v: T): T {
  if (typeof v === 'string') return v.replace(LABEL, (_m, pre: string, mat: string) => `${pre}${mat} weapon`) as T;
  if (Array.isArray(v)) return v.map(legacyWeaponNames) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, legacyWeaponNames(x)])) as T;
  return v;
}

/* Intended difference (docs/behaviour-changes.md, "Aufgewertete Waffe nicht doppelt gezählt", report #211): the copy that carries such an upgrade
   is not among the plain ones any more ("Dagger" and "Dagger (Gromril)", where legacy has "2× Dagger" and "Gromril weapon"; a lone upgraded
   dagger is only the upgrade line). In a Tabletop Simulator text that names such an upgrade the equipment line is left out of the comparison,
   on both sides, and nothing else. */
export function withoutCounts<T>(v: T): T {
  if (typeof v === 'string') return (/(Gromril|Ithilmar|Obsidian) weapon/.test(v) ? v.replace(/(\[5ACFFF\]Equipment:\[-\] )[^\n]*/g, '$1…') : v) as T;
  if (Array.isArray(v)) return v.map(withoutCounts) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, withoutCounts(x)])) as T;
  return v;
}
