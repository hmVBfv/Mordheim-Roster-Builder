/* The surroundings of a banner's motif (report #33: "only the middle moves, the rest is static background"). A banner is WB columns
   wide; the motif of a scene stands in the middle and, to both sides, the place goes on in the same spirit: more houses and
   crooked towers for Mordheim, more tents and fires for the camp, more stalls for the Trading Post, shelves for the books …
   Props are scattered by a seeded generator along the ground, so a banner is the same picture on every visit. Besides the lights
   of the motif (windows, fires, stars) three things move over the whole width: smoke and embers rise, bats flock across the
   sky, a bank of cloud drifts through the haze; reduced motion holds all of it still. */
import { GROUND, Grid, WB, W, backdrop, candle, crate, fire, house, pole, rng, rubble, ruin, tent, torch, tower } from './draw.ts';
import { SCENES, type SceneId } from './scenes.ts';

type Rand = () => number;
/** a thing to put on the ground: the room it needs, and how to draw it at x (returns the width it took) */
interface Prop { need: number; draw: (g: Grid, x: number, rand: Rand) => number }

const between = (rand: Rand, lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = <T,>(rand: Rand, xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;

/** smoke that drifts up (the letter X moves, x does not) */
function smokeUp(g: Grid, x: number, y: number, rows: number, rand: Rand): void {
  let dx = 0;
  for (let i = 0; i < rows; i++) {
    dx += between(rand, -1, 1);
    g.px(x + dx, y - i * 2, 'X');
    g.px(x + dx + 1, y - i * 2 - 1, 'X');
  }
}

/** embers over a fire (the letter E rises and fades) */
function embers(g: Grid, x: number, y: number, rand: Rand, n = 4): void {
  for (let i = 0; i < n; i++) g.px(x - 3 + between(rand, 0, 6), y - between(rand, 2, 9), 'E');
}

// ---- props ----

const houseP: Prop = {
  need: 13,
  draw(g, x, rand) {
    const w = between(rand, 7, 11), h = between(rand, 6, 13);
    house(g, x, GROUND, w, h, rand() < 0.5 ? 'r' : 'R', between(rand, 1, 999));
    if (rand() < 0.5) { g.rect(x + w - 3, GROUND - h - 3, 2, 3, 'B'); smokeUp(g, x + w - 3, GROUND - h - 4, 4, rand); }
    return w + 1;
  }
};
const ruinP: Prop = { need: 11, draw(g, x, rand) { const w = between(rand, 7, 10); ruin(g, x, GROUND, w, between(rand, 6, 10), between(rand, 1, 999)); return w; } };
const towerP: Prop = { need: 9, draw(g, x, rand) { const w = between(rand, 5, 7); tower(g, x, GROUND, w, between(rand, 9, 17)); return w; } };
const rubbleP: Prop = { need: 15, draw(g, x, rand) { const w = between(rand, 10, 14); rubble(g, x, GROUND + 2, w, between(rand, 1, 999), 3); return w; } };

const tentP: Prop = {
  need: 24,
  draw(g, x, rand) {
    const half = between(rand, 6, 10);
    const [a, b] = pick(rand, [['p', 'P'], ['u', 'U'], ['z', 'q'], ['n', 'N']] as const);
    tent(g, x + half + 1, GROUND + 2, half, a, b);
    return half * 2 + 3;
  }
};
const flagP: Prop = { need: 11, draw(g, x, rand) { const [a, b] = pick(rand, [['p', 'P'], ['u', 'U'], ['z', 'q']] as const); pole(g, x, GROUND + 3, between(rand, 13, 19), a, b); return 9; } };
const fireP: Prop = {
  need: 12,
  draw(g, x, rand) {
    fire(g, x + 5, GROUND + 5, rand() < 0.5 ? 2 : 1);
    embers(g, x + 5, GROUND - 1, rand, 5);
    return 11;
  }
};
const cratesP: Prop = { need: 11, draw(g, x) { crate(g, x, GROUND + 3, 5); crate(g, x + 5, GROUND + 3, 4); crate(g, x + 2, GROUND - 1, 3); return 10; } };
const treeP: Prop = {
  need: 11,
  draw(g, x, rand) {
    const h = between(rand, 10, 16);
    g.rect(x + 4, GROUND + 1 - h, 1, h, 'N');
    for (let i = 0; i < 4; i++) {
      const y = GROUND + 3 - h + i * Math.floor(h / 4), dir = i % 2 ? 1 : -1, len = between(rand, 3, 5);
      g.line(x + 4, y, x + 4 + dir * len, y - between(rand, 1, 3), 'N');
    }
    return 10;
  }
};
const pineP: Prop = {
  need: 9,
  draw(g, x, rand) {
    const h = between(rand, 9, 15), cx = x + 3;
    g.rect(cx, GROUND - 1, 1, 3, 'N');
    for (let i = 0; i < 3; i++) g.tri(cx, GROUND - h + i * 4, GROUND - h + i * 4 + 5, i % 2 ? 'G' : 't', 1);
    return 8;
  }
};
const sentryP: Prop = {
  need: 8,
  draw(g, x) {
    g.sprite(x, GROUND - 9, ['..hh.', '.hhhh', '.hiih', '..zz.', '.uuuu', 'puuuu', '.u.u.', '.N.N.', '.N.N.']);
    g.rect(x + 5, GROUND - 12, 1, 12, 'N');
    return 7;
  }
};
const sitterP: Prop = { need: 8, draw(g, x) { g.rect(x, GROUND - 1, 6, 5, 'b'); g.disc(x + 3, GROUND - 4, 2, 'b'); g.rect(x + 6, GROUND, 1, 4, 'b'); return 8; } };

const stallP: Prop = {
  need: 26,
  draw(g, x, rand) {
    const w = between(rand, 18, 22), red = rand() < 0.5;
    g.rect(x, GROUND - 14, 1, 16, 'N');
    g.rect(x + w - 1, GROUND - 14, 1, 16, 'N');
    for (let i = 0; i < w; i++) g.rect(x + i, GROUND - 14, 1, 3, Math.floor(i / 3) % 2 ? 'z' : red ? 'p' : 'u');
    for (let i = 0; i < w; i += 3) g.rect(x + i, GROUND - 11, 3, 1, Math.floor(i / 3) % 2 ? 'z' : red ? 'p' : 'u');
    g.rect(x, GROUND - 15, w, 1, red ? 'P' : 'U');
    g.rect(x + 1, GROUND - 2, w - 2, 4, 'n');
    g.rect(x + 1, GROUND - 2, w - 2, 1, 'N');
    // what is for sale: coins, bottles, bolts of cloth
    const ware = pick(rand, [0, 1, 2]);
    for (let i = 0; i < w - 6; i += 4) {
      if (ware === 0) { g.rect(x + 3 + i, GROUND - 4, 3, 2, 'f'); g.rect(x + 3 + i, GROUND - 3, 3, 1, 'F'); }
      else if (ware === 1) { g.rect(x + 3 + i, GROUND - 6, 2, 4, i % 8 ? 'g' : 'W'); }
      else g.rect(x + 3 + i, GROUND - 5, 3, 3, i % 8 ? 'u' : 'p');
    }
    return w + 3;
  }
};
const lanternP: Prop = {
  need: 5,
  draw(g, x) {
    g.rect(x, GROUND - 10, 1, 12, 'N');
    g.rect(x - 2, GROUND - 11, 5, 1, 'N');
    g.rect(x - 2, GROUND - 10, 1, 2, 'w');
    g.rect(x + 2, GROUND - 10, 1, 2, 'v');
    return 5;
  }
};
const barrelP: Prop = {
  need: 7,
  draw(g, x) {
    g.rect(x, GROUND - 5, 5, 7, 'n');
    g.rect(x, GROUND - 4, 5, 1, 'N');
    g.rect(x, GROUND, 5, 1, 'N');
    g.rect(x + 1, GROUND - 6, 3, 1, 'N');
    return 7;
  }
};
const cartP: Prop = {
  need: 16,
  draw(g, x) {
    g.rect(x + 2, GROUND - 5, 11, 4, 'n');
    g.rect(x + 2, GROUND - 5, 11, 1, 'N');
    g.disc(x + 4, GROUND, 2, 'N'); g.px(x + 4, GROUND, 'n');
    g.disc(x + 11, GROUND, 2, 'N'); g.px(x + 11, GROUND, 'n');
    g.line(x + 13, GROUND - 4, x + 16, GROUND - 1, 'N');
    return 16;
  }
};

const dieP: Prop = {
  need: 9,
  draw(g, x, rand) {
    const y = GROUND - 5;
    g.rect(x, y, 5, 5, 'z');
    g.rect(x, y + 4, 5, 1, 'Q');
    for (const [px, py] of pick(rand, [[[1, 1]], [[0, 0], [2, 2]], [[0, 0], [1, 1], [2, 2]]] as const)) g.px(x + 1 + px, y + 1 + py, 'i');
    return 7;
  }
};
const miniP: Prop = {
  need: 9,
  draw(g, x, rand) {
    g.rect(x, GROUND - 1, 6, 2, 'N');
    g.sprite(x, GROUND - 9, rand() < 0.5
      ? ['.hhh.', 'hhhhh', 'hiiih', '.zzz.', 'uuuuu', 'u.u.u', '.u.u.', '.N.N.']
      : ['.ppp.', '.zzz.', '.zzz.', 'ppppp', 'p.p.p', '.p.p.', '.N.N.']);
    return 8;
  }
};
const moundP: Prop = {
  need: 22,
  draw(g, x, rand) {
    const w = between(rand, 14, 20);
    for (let i = 0; i < w; i++) {
      const hgt = Math.round(Math.sin((i / (w - 1)) * Math.PI) * 5);
      g.rect(x + i, GROUND - hgt, 1, hgt + 1, hgt > 3 ? 'B' : 'b');
    }
    return w;
  }
};

const shelfP: Prop = {
  need: 18,
  draw(g, x, rand) {
    const w = 15, top = GROUND - 22;
    g.rect(x, top, w, 24, 'N');
    for (let shelf = 0; shelf < 3; shelf++) {
      g.rect(x, top + 7 + shelf * 7, w, 1, 'n');
      let bx = x + 1;
      while (bx < x + w - 2) {
        const bw = between(rand, 2, 3), bh = between(rand, 4, 6);
        g.rect(bx, top + 7 + shelf * 7 - bh, bw, bh, pick(rand, ['p', 'u', 'G', 'f', 'P', 'U', 'F']));
        bx += bw;
      }
    }
    return w + 2;
  }
};
const standP: Prop = {
  need: 9,
  draw(g, x) {
    g.rect(x + 3, GROUND - 12, 1, 14, 'F');
    g.rect(x, GROUND + 1, 7, 1, 'F');
    for (const dx of [0, 3, 6]) { g.rect(x + dx, GROUND - 14, 1, 3, 'z'); g.px(x + dx, GROUND - 16, 'y'); g.px(x + dx, GROUND - 15, 'o'); }
    g.rect(x, GROUND - 11, 7, 1, 'F');
    return 9;
  }
};
const candleP: Prop = { need: 5, draw(g, x, rand) { candle(g, x, GROUND + 2, between(rand, 6, 12)); return 4; } };
const stackP: Prop = {
  need: 12,
  draw(g, x, rand) {
    for (let i = 0; i < 4; i++) g.rect(x + (i % 2), GROUND + 1 - (i + 1) * 2, between(rand, 7, 10), 2, pick(rand, ['p', 'u', 'G', 'f']));
    return 11;
  }
};
const deskP: Prop = {
  need: 22,
  draw(g, x) {
    g.rect(x, GROUND - 2, 20, 3, 'n');
    g.rect(x, GROUND - 2, 20, 1, 'f');
    g.rect(x + 1, GROUND + 1, 2, 8, 'N'); g.rect(x + 17, GROUND + 1, 2, 8, 'N');
    g.rect(x + 3, GROUND - 5, 11, 3, 'q');
    g.rect(x + 5, GROUND - 4, 6, 1, 'i');
    g.rect(x + 16, GROUND - 5, 2, 3, 'i');
    candle(g, x + 14, GROUND - 2, 4);
    return 22;
  }
};

const mountainP: Prop = {
  need: 26,
  draw(g, x, rand) {
    const h = between(rand, 12, 21), half = Math.floor(h * 0.9);
    g.tri(x + half, GROUND - h, GROUND, 'b', 1);
    for (let y = GROUND - h; y < GROUND; y++) g.px(x + half + 1 + Math.floor((y - GROUND + h) / 2), y, 'B');
    g.tri(x + half, GROUND - h, GROUND - h + 3, 'M', 1);
    return half * 2 + 1;
  }
};
const riverP: Prop = {
  need: 22,
  draw(g, x, rand) {
    const w = between(rand, 12, 20);
    for (let i = 0; i < w; i++) { g.px(x + i, GROUND + 2 + Math.round(Math.sin((x + i) / 3)), 'u'); g.px(x + i, GROUND + 3 + Math.round(Math.sin((x + i) / 3)), 'U'); }
    return w;
  }
};
const pinP: Prop = { need: 5, draw(g, x, rand) { g.rect(x + 1, GROUND - 8, 1, 10, 'Y'); g.disc(x + 1, GROUND - 9, 1, rand() < 0.5 ? 'p' : 'u'); return 5; } };

const wallP: Prop = {
  need: 28,
  draw(g, x, rand) {
    const w = between(rand, 16, 26), h = between(rand, 9, 13);
    g.rect(x, GROUND - h, w, h + 1, 'b');
    g.rect(x, GROUND - h, w, 1, 'B');
    for (let i = 0; i < w; i += 2) g.rect(x + i, GROUND - h - 2, 1, 2, 'b');
    for (let i = 4; i < w - 3; i += 7) torch(g, x + i, GROUND - 3, 4);
    return w;
  }
};
const torchP: Prop = { need: 4, draw(g, x, rand) { torch(g, x, GROUND + 2, between(rand, 6, 9)); return 4; } };
const doorP: Prop = {
  need: 14,
  draw(g, x) {
    g.rect(x, GROUND - 12, 12, 14, 'b');
    g.rect(x + 2, GROUND - 9, 8, 11, 'n');
    g.rect(x + 2, GROUND - 6, 8, 1, 'Y'); g.rect(x + 2, GROUND - 1, 8, 1, 'Y');
    g.rect(x + 5, GROUND - 5, 3, 3, 'f'); g.px(x + 6, GROUND - 4, 'i');
    return 14;
  }
};
const chestP: Prop = {
  need: 11,
  draw(g, x) {
    g.rect(x, GROUND - 4, 9, 6, 'N');
    g.rect(x, GROUND - 5, 9, 2, 'n');
    g.rect(x, GROUND - 2, 9, 1, 'Y');
    g.rect(x + 4, GROUND - 3, 2, 2, 'f');
    return 10;
  }
};
const keyP: Prop = { need: 8, draw(g, x) { g.disc(x + 1, GROUND + 2, 1, 'f'); g.rect(x + 3, GROUND + 2, 5, 1, 'f'); g.rect(x + 6, GROUND + 3, 1, 2, 'f'); return 8; } };
const swordP: Prop = {
  need: 6,
  draw(g, x, rand) {
    g.rect(x + 1, GROUND - 9 + between(rand, 0, 2), 1, 10, 'h');
    g.rect(x - 1, GROUND - 3, 5, 1, 'f');
    return 6;
  }
};

/** what each scene's surroundings are made of, in the order of its character */
const WINGS: Readonly<Record<SceneId, { props: readonly Prop[]; gap: readonly [number, number] }>> = {
  city: { props: [houseP, houseP, ruinP, towerP, rubbleP], gap: [1, 5] },
  camp: { props: [tentP, tentP, flagP, fireP, cratesP, treeP, sentryP, ruinP], gap: [2, 8] },
  market: { props: [stallP, stallP, lanternP, barrelP, barrelP, cartP, cratesP], gap: [1, 6] },
  dice: { props: [miniP, miniP, dieP, moundP, ruinP, treeP, pineP, candleP], gap: [3, 9] },
  tome: { props: [shelfP, shelfP, standP, standP, stackP, candleP], gap: [2, 7] },
  map: { props: [mountainP, mountainP, pineP, pineP, treeP, riverP, pinP], gap: [1, 6] },
  scribe: { props: [shelfP, deskP, standP, stackP, candleP], gap: [2, 7] },
  fire: { props: [tentP, fireP, sitterP, treeP, ruinP, sitterP], gap: [3, 9] },
  gate: { props: [wallP, towerP, torchP, ruinP, flagP], gap: [1, 5] },
  battle: { props: [ruinP, fireP, swordP, swordP, flagP, rubbleP, fireP], gap: [2, 7] },
  lock: { props: [wallP, doorP, chestP, keyP, torchP, torchP], gap: [2, 6] }
};

function scatter(g: Grid, from: number, to: number, rand: Rand, props: readonly Prop[], gap: readonly [number, number]): void {
  let x = from;
  let last: Prop | undefined;
  for (;;) {
    const fit = props.filter((p) => p.need <= to - x);
    if (!fit.length) break;
    // never the same thing twice in a row, unless it is all there is
    const other = fit.filter((p) => p !== last);
    last = pick(rand, other.length ? other : fit);
    x += last.draw(g, x, rand) + between(rand, gap[0], gap[1]);
  }
}

/** bats in two flocks, and a bank of cloud in the haze: the sky moves over the whole width */
function sky(g: Grid, rand: Rand, free: readonly [number, number]): void {
  for (let i = 0; i < 10; i++) {
    const x = between(rand, 6, WB - 12), y = between(rand, 2, 11);
    if (x > free[0] - 4 && x < free[1] + 2) continue; // not in front of the motif
    g.sprite(x, y, i % 2 ? ['T.T', '.T.'] : ['V.V', '.V.']);
  }
  for (let i = 0; i < 5; i++) {
    const x = between(rand, 0, WB - 40), y = between(rand, 6, 16), w = between(rand, 22, 40);
    g.rect(x, y, w, 1, 'C');
    g.rect(x + 3, y + 1, w - 8, 1, 'C');
  }
}

const seedOfId = (id: SceneId) => id.length * 97 + 11;

/** a banner drawn from scratch: the night, the surroundings in both wings, then the motif in the middle */
export function renderWide(id: SceneId): string[] {
  const scene = SCENES[id];
  const g = new Grid(WB);
  backdrop(g, seedOfId(id), Math.round((scene.stars * WB) / W));
  const rand = rng(seedOfId(id) * 31 + 7);
  // the motif's room (its span, plus a little air) stays free for it
  const mid = Math.floor((WB - W) / 2);
  const [x0, x1] = motifColumns(id);
  sky(g, rand, [x0, x1]);
  const w = WINGS[id];
  scatter(g, 2, x0 - 4, rng(seedOfId(id) * 17 + 1), w.props, w.gap);
  scatter(g, x1 + 4, WB - 2, rng(seedOfId(id) * 13 + 5), w.props, w.gap);
  scene.draw(g.shifted(mid));
  return g.rows();
}

/** the night of a banner without surroundings and motif (to see what they add) */
export function backdropWide(id: SceneId): string[] {
  const g = new Grid(WB);
  backdrop(g, seedOfId(id), Math.round((SCENES[id].stars * WB) / W));
  return g.rows();
}

const cache = new Map<SceneId, string[]>();

/** the banner picture of a scene, drawn once */
export function paintWide(id: SceneId): string[] {
  let rows = cache.get(id);
  if (!rows) { rows = renderWide(id); cache.set(id, rows); }
  return rows;
}

/** the motif's own columns in the banner (nothing of the wings reaches in) */
export function motifColumns(id: SceneId): [number, number] {
  const mid = Math.floor((WB - W) / 2);
  const x0 = mid + Math.floor((W - SCENES[id].span) / 2);
  return [x0, x0 + SCENES[id].span];
}
