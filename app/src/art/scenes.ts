/* The pictures of the app, drawn in code (draw.ts). Each scene is a motif
   standing on the ground line of a night backdrop; the page paints the same
   backdrop beside it, so a banner can be as wide as the screen. `span` is
   the width of the motif: a scene for an empty screen shows only that much. */
import {
  GROUND, Grid, backdrop, candle, comet, crate, fire, house, moon, pole, rng, rubble, ruin, smoke, sword, tent,
  torch, tower, tree
} from './draw.ts';

export type SceneId =
  | 'city' | 'camp' | 'market' | 'dice' | 'tome' | 'map' | 'scribe' | 'fire' | 'gate' | 'battle' | 'lock';

export interface Scene { span: number; stars: number; draw: (g: Grid) => void }

const CX = 80;

function sparks(g: Grid, cx: number, y: number, seed: number, n = 7): void {
  const rand = rng(seed);
  for (let i = 0; i < n; i++) g.px(cx - 6 + Math.floor(rand() * 13), y - Math.floor(rand() * 9), rand() < 0.5 ? 'y' : 'o');
}

function awning(g: Grid, x: number, y: number, w: number): void {
  for (let i = 0; i < w; i++) g.rect(x + i, y, 1, 3, Math.floor(i / 3) % 2 ? 'z' : 'p');
  for (let i = 0; i < w; i += 3) g.rect(x + i, y + 3, 3, 1, Math.floor(i / 3) % 2 ? 'z' : 'p');
  g.rect(x, y - 1, w, 1, 'P');
}

export const SCENES: Readonly<Record<SceneId, Scene>> = {
  // Mordheim at night: the comet over the roofs, wyrdstone glowing in the rubble
  city: {
    span: 112, stars: 40,
    draw(g) {
      comet(g, 30, 8, 24);
      ruin(g, 28, GROUND, 8, 7, 3);
      house(g, 37, GROUND, 9, 7, 'r', 11);
      tower(g, 48, GROUND, 6, 10);
      house(g, 56, GROUND, 10, 8, 'R', 12);
      ruin(g, 67, GROUND, 8, 8, 5);
      tower(g, 77, GROUND, 8, 14);
      house(g, 87, GROUND, 9, 12, 'r', 13);
      ruin(g, 98, GROUND, 9, 6, 7);
      house(g, 108, GROUND, 8, 9, 'R', 14);
      tower(g, 118, GROUND, 6, 15);
      house(g, 126, GROUND, 9, 7, 'r', 15);
      rubble(g, 64, GROUND + 2, 30, 9, 5);
    }
  },
  // a camp at the edge of the ruins: two tents, a banner, a fire
  camp: {
    span: 96, stars: 38,
    draw(g) {
      ruin(g, 34, GROUND, 9, 9, 2);
      tree(g, 124, GROUND + 1, 14, 4);
      tent(g, 58, GROUND + 2, 10, 'p', 'P');
      tent(g, 104, GROUND + 2, 8, 'u', 'U');
      pole(g, 80, GROUND + 3, 17, 'z', 'q');
      fire(g, 80, GROUND + 5, 2);
      sparks(g, 80, GROUND - 3, 21);
      crate(g, 90, GROUND + 4, 4);
      crate(g, 94, GROUND + 4, 3);
      g.line(46, GROUND + 4, 52, GROUND + 4, 'N');
    }
  },
  // the Trading Post: stalls with awnings, coins, a lantern
  market: {
    span: 100, stars: 30,
    draw(g) {
      for (const [x, w, bay] of [[32, 22, 'p'], [60, 22, 'u'], [88, 22, 'p']] as const) {
        g.rect(x, GROUND - 14, 1, 16, 'N');
        g.rect(x + w - 1, GROUND - 14, 1, 16, 'N');
        awning(g, x - 1, GROUND - 14, w + 2);
        g.rect(x + 1, GROUND - 2, w - 2, 4, 'n');
        g.rect(x + 1, GROUND - 2, w - 2, 1, 'N');
        g.px(x + 2, GROUND - 14, bay === 'p' ? 'P' : 'U');
      }
      // coins
      for (let i = 0; i < 4; i++) { g.rect(38, GROUND - 4 - i, 4, 1, i % 2 ? 'F' : 'f'); }
      for (let i = 0; i < 3; i++) { g.rect(45, GROUND - 4 - i, 4, 1, i % 2 ? 'F' : 'f'); }
      for (let i = 0; i < 6; i++) { g.rect(66 + i * 2, GROUND - 4, 2, 2, i % 2 ? 'g' : 'W'); }
      g.rect(94, GROUND - 5, 5, 3, 'q');
      g.rect(101, GROUND - 4, 4, 2, 'Q');
      crate(g, 118, GROUND + 2, 6);
      crate(g, 124, GROUND + 2, 5);
    }
  },
  // the TTS cards: a table, two dice, a small warrior
  dice: {
    span: 88, stars: 26,
    draw(g) {
      g.rect(38, GROUND - 2, 84, 3, 'n');
      g.rect(38, GROUND - 2, 84, 1, 'f');
      g.rect(42, GROUND + 1, 3, 9, 'N');
      g.rect(115, GROUND + 1, 3, 9, 'N');
      const pips = (x: number, y: number, p: string[]) => {
        g.rect(x, y, 9, 9, 'z');
        g.rect(x, y + 8, 9, 1, 'Q');
        g.rect(x + 8, y, 1, 9, 'Q');
        for (const s of p) { const [px, py] = s.split(',').map(Number); g.rect(x + 1 + px! * 3, y + 1 + py! * 3, 2, 2, 'i'); }
      };
      pips(60, GROUND - 11, ['0,0', '2,2', '1,1']);
      pips(73, GROUND - 10, ['0,0', '2,0', '0,2', '2,2', '1,1']);
      g.rect(88, GROUND - 4, 12, 2, 'q');
      g.rect(88, GROUND - 4, 12, 1, 'Q');
      g.sprite(104, GROUND - 13, [
        '..hhh..', '.hhhhh.', '.hiiih.', '..zzz..', '.uuuuu.', 'puuuuu.', 'puuuuu.', '.u...u.', '.N...N.', '.N...N.'
      ]);
      candle(g, 46, GROUND - 2, 8);
      g.rect(112, GROUND - 6, 5, 4, 'n');
      g.rect(117, GROUND - 5, 1, 2, 'n');
    }
  },
  // the house rules: an open book on a stand between two candles
  tome: {
    span: 76, stars: 28,
    draw(g) {
      g.rect(62, GROUND - 3, 36, 2, 'N');
      g.rect(66, GROUND - 1, 28, 9, 'n');
      g.rect(66, GROUND - 1, 28, 1, 'N');
      for (let i = 0; i < 2; i++) {
        const x = i ? 81 : 62;
        g.rect(x, GROUND - 16, 17, 13, 'q');
        g.rect(x, GROUND - 3, 17, 1, 'Q');
        for (let y = 0; y < 5; y++) g.rect(x + 2, GROUND - 14 + y * 2, 12 - (y % 2) * 3, 1, 'Q');
        for (let y = 0; y < 2; y++) g.rect(x + 2, GROUND - 5 + y * 1, 9, 1, 'Q');
      }
      g.rect(79, GROUND - 17, 2, 15, 'N');
      g.rect(77, GROUND - 17, 1, 2, 'q'); g.rect(82, GROUND - 17, 1, 2, 'q');
      g.rect(84, GROUND - 3, 1, 8, 'p');
      g.px(84, GROUND + 5, 'P');
      candle(g, 48, GROUND + 4, 14);
      candle(g, 110, GROUND + 4, 14);
      g.rect(46, GROUND + 4, 6, 1, 'F');
      g.rect(108, GROUND + 4, 6, 1, 'F');
    }
  },
  // districts and the world: a map on a table, pins in the districts
  map: {
    span: 96, stars: 24,
    draw(g) {
      g.rect(40, GROUND - 16, 80, 20, 'q');
      g.rect(40, GROUND - 16, 80, 1, 'Q');
      g.rect(40, GROUND + 3, 80, 1, 'Q');
      g.rect(40, GROUND - 16, 1, 20, 'Q');
      g.rect(119, GROUND - 16, 1, 20, 'Q');
      // a river and the roads
      for (let x = 42; x < 118; x++) g.px(x, GROUND - 8 + Math.round(Math.sin(x / 5) * 2), 'u');
      g.line(48, GROUND - 13, 70, GROUND - 4, 'n');
      g.line(70, GROUND - 4, 96, GROUND - 12, 'n');
      g.line(70, GROUND - 4, 86, GROUND + 1, 'n');
      // districts
      for (const [x, y] of [[48, 13], [60, 17], [78, 9], [96, 14], [104, 19], [88, 20]] as const) {
        g.rect(x, y, 6, 4, 'b'); g.tri(x + 3, y - 3, y - 1, 'r');
        g.px(x + 1, y + 1, 'W'); g.px(x + 4, y + 1, 'W');
      }
      // compass rose
      g.rect(111, GROUND - 14, 1, 6, 'i'); g.rect(109, GROUND - 12, 5, 1, 'i'); g.px(111, GROUND - 15, 'p');
      // pins
      for (const [x, y] of [[78, 6], [96, 11], [58, 14]] as const) { g.rect(x + 1, y + 2, 1, 4, 'Y'); g.disc(x + 1, y + 1, 1, 'p'); }
      g.rect(38, GROUND + 4, 84, 2, 'N');
      candle(g, 34, GROUND + 4, 7);
    }
  },
  // chronicle, story, notes: a desk with a scroll, an inkwell and a quill; books behind
  scribe: {
    span: 100, stars: 14,
    draw(g) {
      g.rect(34, 8, 92, 14, 'N');
      g.rect(34, 8, 92, 1, 'n');
      g.rect(34, 15, 92, 1, 'n');
      const cols = ['p', 'u', 'G', 'f', 'P', 'U', 'F', 'p', 'G', 'u'];
      const rand = rng(8);
      for (let shelf = 0; shelf < 2; shelf++) {
        let x = 36;
        while (x < 122) {
          const w = 2 + Math.floor(rand() * 3);
          const hgt = 4 + Math.floor(rand() * 3);
          g.rect(x, shelf ? 15 - hgt : 8 - hgt + 7, w, hgt, cols[Math.floor(rand() * cols.length)] ?? 'p');
          x += w + (rand() < 0.2 ? 2 : 0);
        }
      }
      g.rect(30, GROUND - 2, 100, 3, 'n');
      g.rect(30, GROUND - 2, 100, 1, 'f');
      g.rect(34, GROUND + 1, 3, 9, 'N');
      g.rect(123, GROUND + 1, 3, 9, 'N');
      // the scroll
      g.rect(54, GROUND - 7, 36, 5, 'q');
      g.rect(54, GROUND - 3, 36, 1, 'Q');
      g.disc(54, GROUND - 5, 2, 'Q'); g.disc(90, GROUND - 5, 2, 'Q');
      for (let i = 0; i < 4; i++) g.rect(58, GROUND - 6 + (i % 2), 24 - (i % 3) * 4, 1, 'i');
      g.px(60, GROUND - 5, 'p');
      // ink and quill
      g.rect(100, GROUND - 6, 5, 4, 'i');
      g.rect(101, GROUND - 7, 3, 1, 'i');
      g.line(103, GROUND - 7, 110, GROUND - 15, 'N');
      g.line(106, GROUND - 11, 112, GROUND - 19, 'z');
      g.line(107, GROUND - 11, 113, GROUND - 18, 'z');
      g.line(108, GROUND - 13, 114, GROUND - 20, 'q');
      candle(g, 120, GROUND - 2, 8);
    }
  },
  // aftermath: the fire after the battle, two figures sitting by it
  fire: {
    span: 100, stars: 40,
    draw(g) {
      tent(g, 48, GROUND, 7, 'b', 'D');
      tent(g, 112, GROUND, 6, 'b', 'D');
      tree(g, 38, GROUND, 13, 6);
      ruin(g, 122, GROUND, 7, 8, 4);
      for (const x of [64, 96]) {
        g.rect(x, GROUND - 1, 7, 5, 'b');
        g.disc(x + 3, GROUND - 4, 2, 'b');
        g.rect(x + (x < 80 ? 6 : -1), GROUND, 1, 4, 'b');
      }
      fire(g, 80, GROUND + 4, 2);
      smoke(g, 82, GROUND - 9, 9, 3);
      sparks(g, 80, GROUND - 3, 5, 9);
      g.line(70, GROUND + 5, 90, GROUND + 5, 'N');
    }
  },
  // the campaign overview: the ruined city gate, a banner on the tower, torches
  gate: {
    span: 110, stars: 36,
    draw(g) {
      moon(g, 118, 8, 4);
      ruin(g, 26, GROUND, 9, 7, 6);
      ruin(g, 126, GROUND, 8, 6, 8);
      tower(g, 52, GROUND + 1, 10, 22);
      tower(g, 98, GROUND + 1, 10, 22);
      g.rect(62, GROUND - 13, 36, 14, 'b');
      for (let i = 0; i < 36; i += 2) g.rect(62 + i, GROUND - 15, 1, 2, 'b');
      g.rect(62, GROUND - 13, 36, 1, 'B');
      g.tri(CX, GROUND - 10, GROUND, 'D');
      g.rect(CX - 8, GROUND - 2, 17, 3, 'D');
      g.rect(CX - 7, GROUND - 10, 15, 11, 'D');
      for (let x = CX - 7; x <= CX + 7; x += 3) g.rect(x, GROUND - 9, 1, 10, 'Y');
      for (let y = GROUND - 7; y < GROUND; y += 4) g.rect(CX - 7, y, 15, 1, 'Y');
      pole(g, 56, GROUND - 22, 8, 'p', 'P');
      torch(g, 66, GROUND - 3, 5);
      torch(g, 94, GROUND - 3, 5);
      // the road
      for (let y = GROUND + 1; y < g.h - 1; y++) { const half = 3 + (y - GROUND) * 2; g.rect(CX - half, y, half * 2 + 1, 1, y % 2 ? 'B' : 'M'); }
    }
  },
  // the battle: a shield with two crossed swords, ruins and fires beside
  battle: {
    span: 104, stars: 30,
    draw(g) {
      ruin(g, 30, GROUND, 11, 10, 9);
      ruin(g, 120, GROUND, 11, 8, 10);
      fire(g, 44, GROUND + 4, 1);
      fire(g, 116, GROUND + 4, 1);
      smoke(g, 44, GROUND - 6, 8, 12);
      smoke(g, 116, GROUND - 6, 7, 13);
      sword(g, CX - 26, 1, CX + 16, 27);
      sword(g, CX + 27, 1, CX - 15, 27);
      g.line(CX + 17, 28, CX + 18, 30, 'N'); g.line(CX - 16, 28, CX - 17, 30, 'N');
      g.px(CX + 18, 31, 'f'); g.px(CX - 17, 31, 'f');
      // the shield: a cream rim, a red field, a gold boss and stripe
      const top = 5;
      for (let r = 0; r < 24; r++) {
        const half = r < 12 ? 10 : Math.max(0, 10 - Math.round(((r - 12) * 10) / 12));
        g.rect(CX - half, top + r, half * 2 + 1, 1, 'z');
        if (r >= 2 && r < 22) g.rect(CX - Math.max(0, half - 2), top + r, Math.max(0, half - 2) * 2 + 1, 1, 'p');
      }
      g.rect(CX, top + 3, 1, 18, 'z');
      g.rect(CX - 8, top + 9, 17, 1, 'z');
      g.disc(CX, top + 9, 2, 'f');
      g.px(CX, top + 9, 'F');
    }
  },
  // account and sign-in: a door of planks with a padlock, a key beside it
  lock: {
    span: 76, stars: 26,
    draw(g) {
      g.rect(56, GROUND - 22, 48, 26, 'b');
      g.rect(56, GROUND - 22, 48, 1, 'B');
      g.rect(64, GROUND - 19, 32, 23, 'n');
      for (let x = 68; x < 96; x += 6) g.rect(x, GROUND - 19, 1, 23, 'N');
      g.rect(64, GROUND - 14, 32, 2, 'Y');
      g.rect(64, GROUND - 4, 32, 2, 'Y');
      g.rect(65, GROUND - 14, 1, 2, 'h'); g.rect(65, GROUND - 4, 1, 2, 'h');
      // the padlock
      g.rect(76, GROUND - 11, 9, 7, 'f');
      g.rect(76, GROUND - 11, 9, 1, 'l');
      g.rect(76, GROUND - 5, 9, 1, 'F');
      g.rect(77, GROUND - 15, 1, 4, 'h'); g.rect(83, GROUND - 15, 1, 4, 'h'); g.rect(78, GROUND - 16, 5, 1, 'h');
      g.rect(80, GROUND - 9, 1, 3, 'i'); g.px(80, GROUND - 10, 'i');
      torch(g, 50, GROUND - 4, 6);
      torch(g, 110, GROUND - 4, 6);
      g.disc(74, GROUND + 4, 2, 'f'); g.px(74, GROUND + 4, 'F');
      g.rect(76, GROUND + 4, 8, 1, 'f'); g.rect(81, GROUND + 5, 1, 2, 'f'); g.rect(84, GROUND + 5, 1, 2, 'f');
    }
  }
};

const cache = new Map<SceneId, string[]>();

function seedOf(id: SceneId): number {
  return id.length * 97 + 11;
}

/** the night backdrop of a scene without its motif (to see what the motif adds) */
export function backdropOnly(id: SceneId): string[] {
  const g = new Grid();
  backdrop(g, seedOf(id), SCENES[id].stars);
  return g.rows();
}

/** a scene drawn from scratch, as rows of letters */
export function render(id: SceneId): string[] {
  const g = new Grid();
  backdrop(g, seedOf(id), SCENES[id].stars);
  SCENES[id].draw(g);
  return g.rows();
}

/** the picture of a scene, drawn once */
export function paint(id: SceneId): string[] {
  let rows = cache.get(id);
  if (!rows) { rows = render(id); cache.set(id, rows); }
  return rows;
}
