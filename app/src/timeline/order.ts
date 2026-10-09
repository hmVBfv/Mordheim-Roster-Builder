/* The order of the story (phase 4a3, part 2; docs/data-model.md section 5):
   a block's place within its segment is a key of digits, read as the
   decimal fraction 0.<key>. Between two keys there is always another, so
   moving a block changes its own key and nothing else. A block that was
   never moved has a key from its turn and the time it was recorded. */

/** A key strictly between `a` and `b` (null: the start, the end); it never ends in 0, so no two keys mean the same place. */
export function between(a: string | null, b: string | null): string {
  const lo = a ?? '';
  let hi: string | null = b;
  // two equal neighbours (recorded at the same moment): just after the first
  if (hi !== null && hi <= lo) hi = null;
  let out = '';
  for (let i = 0; ; i++) {
    const da = i < lo.length ? Number(lo[i]) : 0;
    const db = hi === null ? 10 : i < hi.length ? Number(hi[i]) : 0;
    if (db - da > 1) return out + String(Math.floor((da + db) / 2));
    out += String(da);
    // one apart: this digit of the lower key, and above it nothing bounds the rest
    if (db - da === 1) hi = null;
  }
}

/** The key of a block never moved: its turn (two digits), then when it was recorded. */
export function defaultKey(createdAt: string, turn: number | null = null): string {
  return `${String(Math.max(0, Math.min(99, turn ?? 0))).padStart(2, '0')}${createdAt.replace(/\D/g, '').padEnd(17, '0')}`;
}
