/* A tiny pixel painter. A picture is a grid of one-letter colours; the
   letters are looked up in PALETTE when it is turned into an svg
   (art/Pixels.tsx). Nothing here is random: the stars and the lit windows
   come from a seeded generator, so a scene is the same picture on every
   visit and in every test. Original art, no Games Workshop motifs. */

export const W = 160;
export const H = 32;
/** the first row of the ground */
export const GROUND = 24;

/** colours of the night scenes; letters not listed here are never drawn */
export const PALETTE: Readonly<Record<string, string>> = {
  // sky, from the top down to the haze at the horizon
  K: '#0b0d12', k: '#10131a', j: '#151a24', J: '#1c2331', H: '#27324a',
  // ground
  e: '#2d2830', d: '#1d1a20', D: '#141217',
  // stars and the moon
  s: '#7b8294', S: '#f2fbe6', a: '#cfd8e8',
  // stone and roofs
  b: '#2a2630', B: '#3d3744', M: '#4f4d58', r: '#322a30', R: '#4a3038',
  // lit windows (two letters so they flicker one after the other), dim window
  w: '#e0a642', v: '#e0a642', W: '#6e4f1f',
  // wyrdstone and the comet
  g: '#6fe07a', G: '#2d6b36', l: '#d2ffb8', c: '#9be39b', t: '#3c6b46',
  // fire and sparks, smoke
  o: '#f0a030', O: '#b0461e', y: '#ffe08a', m: '#3a3a43', x: '#55555f',
  // cloth: red, blue, cream
  p: '#a8322a', u: '#2f5f9a', z: '#e8dcc0',
  // wood, parchment, ink, gold, steel
  n: '#8a5a2b', N: '#5c3b1c', q: '#d9c9a0', Q: '#b09e72', i: '#1d1916', f: '#d6b46a', F: '#8f7536', h: '#aab4c4', Y: '#6c7686', U: '#22476f', P: '#7e2620'
};

/** letters that move a little (docs/ui.md §4); reduced motion holds them still */
export const LIVE: Readonly<Record<string, 'flicker' | 'flickerLate' | 'pulse' | 'twinkle'>> = {
  w: 'flicker', v: 'flickerLate', g: 'pulse', a: 'twinkle', o: 'flicker', y: 'flickerLate'
};

/** the generator behind the stars: mulberry32, seeded */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Grid {
  readonly w: number;
  readonly h: number;
  private readonly cells: string[];

  constructor(w = W, h = H) {
    this.w = w;
    this.h = h;
    this.cells = new Array<string>(w * h).fill('.');
  }

  get(x: number, y: number): string {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return '.';
    return this.cells[y * this.w + x] ?? '.';
  }

  px(x: number, y: number, c: string): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || c === '.') return;
    this.cells[y * this.w + x] = c;
  }

  rect(x: number, y: number, w: number, h: number, c: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: string): void {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  disc(cx: number, cy: number, r: number, c: string): void {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) this.px(cx + x, cy + y, c);
  }

  /** an isosceles triangle: tip at (cx, top), widening by one on each side per `step` rows down to `base` */
  tri(cx: number, top: number, base: number, c: string, step = 1): void {
    for (let y = top; y <= base; y++) {
      const half = Math.floor((y - top) / step);
      this.rect(cx - half, y, half * 2 + 1, 1, c);
    }
  }

  /** a small hand-drawn picture: '.' is see-through */
  sprite(x: number, y: number, rows: readonly string[]): void {
    rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) this.px(x + i, y + j, row[i] ?? '.'); });
  }

  /** the picture as rows of letters */
  rows(): string[] {
    const out: string[] = [];
    for (let y = 0; y < this.h; y++) out.push(this.cells.slice(y * this.w, (y + 1) * this.w).join(''));
    return out;
  }
}

/** sky bands from the top to the haze, and the ground; every scene starts from this */
export function backdrop(g: Grid, seed: number, stars = 34): void {
  const bands = ['K', 'K', 'K', 'k', 'k', 'k', 'j', 'j', 'j', 'J', 'J', 'H'];
  for (let y = 0; y < GROUND; y++) {
    const band = bands[Math.min(bands.length - 1, Math.floor((y * bands.length) / GROUND))] ?? 'K';
    g.rect(0, y, g.w, 1, band);
  }
  g.rect(0, GROUND, g.w, 1, 'e');
  g.rect(0, GROUND + 1, g.w, g.h - GROUND - 2, 'd');
  g.rect(0, g.h - 1, g.w, 1, 'D');
  const rand = rng(seed);
  for (let i = 0; i < stars; i++) {
    const x = Math.floor(rand() * g.w);
    const y = Math.floor(rand() * (GROUND - 9));
    g.px(x, y, rand() < 0.3 ? 'a' : 's');
  }
}

/** the colour of the backdrop on each row (the page paints the same bands beside the picture) */
export function backdropRows(): string[] {
  const g = new Grid(1, H);
  backdrop(g, 0, 0);
  return g.rows().map((r) => PALETTE[r[0] ?? 'K'] ?? '#000');
}

// ---- parts the scenes are built from ----

export function moon(g: Grid, cx: number, cy: number, r: number): void {
  g.disc(cx, cy, r, 'S');
  g.disc(cx + Math.ceil(r / 2), cy - 1, r - 1, 'a');
  g.px(cx - 2, cy + 1, 's');
  g.px(cx - 1, cy - 2, 's');
}

/** the twin-tailed comet: a bright head, two tails of green dust trailing to the upper right */
export function comet(g: Grid, x: number, y: number, len = 18): void {
  for (let i = 3; i < len; i++) {
    const fade = i < len / 2 ? 'c' : 't';
    const rise = Math.floor(i * 0.38);
    if ((i + 1) % 3) g.px(x + i, y - rise, fade);
    if (i % 4 !== 1) g.px(x + i, y - rise + 2 + Math.floor(i / 7), fade === 'c' ? 't' : 't');
  }
  g.disc(x, y, 2, 'l');
  g.px(x, y, 'S');
  g.px(x + 1, y - 1, 'c');
}

/** a house with a pitched roof; `lit` windows glow */
export function house(g: Grid, x: number, base: number, w: number, h: number, roof: string, seed: number, lit = 0.45): void {
  g.rect(x, base - h, w, h, 'b');
  g.rect(x, base - h, 1, h, 'B');
  g.tri(x + Math.floor(w / 2), base - h - Math.ceil(w / 2) - 1, base - h - 1, roof);
  g.rect(x - 1, base - h - 1, w + 2, 1, roof);
  const rand = rng(seed);
  for (let wy = base - h + 2; wy < base - 3; wy += 4) {
    for (let wx = x + 2; wx < x + w - 2; wx += 3) {
      const r = rand();
      g.rect(wx, wy, 1, 2, r < lit ? (r < lit / 2 ? 'w' : 'v') : 'W');
    }
  }
  g.rect(x + Math.floor(w / 2), base - 3, 1, 3, 'D');
}

/** a stone tower with a battlement and a slit of light */
export function tower(g: Grid, x: number, base: number, w: number, h: number): void {
  g.rect(x, base - h, w, h, 'b');
  g.rect(x, base - h, 1, h, 'B');
  g.rect(x + w - 1, base - h, 1, h, 'r');
  for (let i = 0; i < w; i += 2) g.rect(x + i, base - h - 2, 1, 2, 'b');
  g.rect(x - 1, base - h, w + 2, 1, 'B');
  g.rect(x + Math.floor(w / 2), base - h + 3, 1, 3, 'w');
}

/** a broken wall: stone with a ragged top */
export function ruin(g: Grid, x: number, base: number, w: number, h: number, seed: number): void {
  const rand = rng(seed);
  for (let i = 0; i < w; i++) {
    const top = h - Math.floor(rand() * Math.min(5, h - 2));
    g.rect(x + i, base - top, 1, top, i % 5 === 0 ? 'B' : 'b');
  }
  for (let i = 0; i < w * 2; i++) g.px(x + Math.floor(rand() * w), base - Math.floor(rand() * (h - 1)) - 1, 'r');
}

export function tent(g: Grid, cx: number, base: number, half: number, cloth: string, shade: string): void {
  const top = base - half - 2;
  for (let y = top; y <= base; y++) {
    const reach = y - top;
    g.rect(cx - reach, y, reach + 1, 1, cloth);
    g.rect(cx + 1, y, reach, 1, shade);
  }
  g.tri(cx, base - 4, base, 'D');
  g.px(cx, top - 1, 'N');
  g.px(cx, top - 2, 'N');
}

export function pole(g: Grid, x: number, base: number, h: number, flag: string, flagShade: string): void {
  g.rect(x, base - h, 1, h, 'N');
  g.px(x, base - h - 1, 'f');
  g.rect(x + 1, base - h + 1, 7, 4, flag);
  g.rect(x + 1, base - h + 4, 7, 1, flagShade);
  g.px(x + 8, base - h + 2, flag);
  g.px(x + 8, base - h + 3, flagShade);
}

export function fire(g: Grid, cx: number, base: number, size = 1): void {
  g.line(cx - 4, base, cx + 3, base - 1, 'N');
  g.line(cx - 3, base - 1, cx + 4, base, 'n');
  const flame = size > 1
    ? ['...y...', '..yoy..', '.yooOy.', '.ooOOo.', '.oOOOo.', '..OOO..']
    : ['..y..', '.yoy.', '.ooO.', '.OOO.'];
  g.sprite(cx - Math.floor(flame[0]!.length / 2), base - flame.length, flame);
}

export function torch(g: Grid, x: number, base: number, h: number): void {
  g.rect(x, base - h, 1, h, 'N');
  g.sprite(x - 1, base - h - 4, ['.y.', 'yoy', '.O.']);
}

export function tree(g: Grid, x: number, base: number, h: number, seed: number): void {
  const rand = rng(seed);
  g.rect(x, base - h, 1, h, 'N');
  for (let i = 0; i < 4; i++) {
    const y = base - h + 2 + i * Math.floor(h / 5);
    const dir = i % 2 ? 1 : -1;
    const len = 3 + Math.floor(rand() * 4);
    g.line(x, y, x + dir * len, y - 2 - Math.floor(rand() * 2), 'N');
  }
}

export function smoke(g: Grid, x: number, y: number, rows: number, seed: number): void {
  const rand = rng(seed);
  let dx = 0;
  for (let i = 0; i < rows; i++) {
    dx += Math.floor(rand() * 3) - 1;
    g.px(x + dx, y - i * 2, i < rows / 2 ? 'x' : 'm');
    g.px(x + dx + 1, y - i * 2 - 1, 'm');
  }
}

/** rubble with a glint of wyrdstone */
export function rubble(g: Grid, x: number, base: number, w: number, seed: number, glow = 3): void {
  const rand = rng(seed);
  for (let i = 0; i < w; i++) {
    const hgt = 1 + Math.floor(rand() * 3);
    g.rect(x + i, base - hgt, 1, hgt, rand() < 0.3 ? 'B' : 'b');
  }
  for (let i = 0; i < glow; i++) {
    const gx = x + 1 + Math.floor(rand() * (w - 2));
    g.px(gx, base - 1, 'g');
    if (i % 2 === 0) g.px(gx, base - 2, 'l');
  }
}

export function crate(g: Grid, x: number, base: number, s: number): void {
  g.rect(x, base - s, s, s, 'n');
  g.rect(x, base - s, s, 1, 'N');
  g.rect(x, base - 1, s, 1, 'N');
  g.line(x, base - s, x + s - 1, base - 1, 'N');
}

export function candle(g: Grid, x: number, base: number, h: number): void {
  g.rect(x, base - h, 2, h, 'z');
  g.rect(x + 1, base - h, 1, h, 'q');
  g.sprite(x, base - h - 3, ['y.', 'oy', 'O.']);
}

export function book(g: Grid, x: number, base: number, w: number, h: number, cover: string): void {
  g.rect(x, base - h, w, h, cover);
  g.rect(x, base - h, w, 1, 'f');
  g.rect(x + 1, base - 2, w - 2, 1, 'q');
}

export function sword(g: Grid, x0: number, y0: number, x1: number, y1: number): void {
  g.line(x0, y0, x1, y1, 'h');
  g.line(x0 + 1, y0, x1 + 1, y1, 'Y');
}
