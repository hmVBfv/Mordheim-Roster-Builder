/* A small seeded PRNG (mulberry32) so generated fixtures are the same on
   every run and a failing case can be reproduced from its seed. */
export interface Rng {
  next(): number;
  int(lo: number, hi: number): number;
  chance(p: number): boolean;
  pick<T>(arr: readonly T[]): T;
  sample<T>(arr: readonly T[], n: number): T[];
}

export function rng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1));
  return {
    next,
    int,
    chance: (p) => next() < p,
    pick: (arr) => {
      if (!arr.length) throw new Error('pick from empty array');
      return arr[int(0, arr.length - 1)] as (typeof arr)[number];
    },
    sample: (arr, n) => {
      const copy = arr.slice();
      const out: (typeof arr)[number][] = [];
      while (copy.length && out.length < n) out.push(copy.splice(int(0, copy.length - 1), 1)[0] as (typeof arr)[number]);
      return out;
    },
  };
}
