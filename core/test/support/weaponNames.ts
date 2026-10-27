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
