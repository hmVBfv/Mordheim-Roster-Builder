/* A scene as an svg: one path per colour, so a picture is a handful of
   elements. The page paints the backdrop bands beside it (Banner), which is
   why a picture can be as wide as the screen. Decorative: hidden from
   assistive technology. */
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { H, LIVE, PALETTE, W, backdropRows } from './draw.ts';
import { paint, SCENES, type SceneId } from './scenes.ts';
import styles from './art.module.css';
import ui from '../ui/ui.module.css';

interface Layer { color: string; live?: keyof typeof styles; d: string }

const layerCache = new Map<SceneId, Layer[]>();

/** the picture cut into runs of one colour per row */
export function layers(id: SceneId): Layer[] {
  const hit = layerCache.get(id);
  if (hit) return hit;
  const byLetter = new Map<string, string>();
  paint(id).forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x] ?? '.';
      let n = 1;
      while (row[x + n] === c) n++;
      if (c !== '.' && PALETTE[c]) byLetter.set(c, `${byLetter.get(c) ?? ''}M${x} ${y}h${n}v1h-${n}z`);
      x += n;
    }
  });
  const out: Layer[] = [];
  for (const [letter, d] of byLetter) out.push({ color: PALETTE[letter]!, live: LIVE[letter], d });
  layerCache.set(id, out);
  return out;
}

function Picture({ scene, view }: { scene: SceneId; view: string }): ReactElement {
  return (
    <svg className={styles.svg} viewBox={view} shapeRendering="crispEdges" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      {layers(scene).map((l, i) => <path key={i} d={l.d} fill={l.color} className={l.live ? styles[l.live] : undefined} />)}
    </svg>
  );
}

let bandCache: string | undefined;

/** the sky and ground rows as hard-edged bands (the page paints them beside the picture) */
export function bands(): string {
  if (bandCache) return bandCache;
  const rows = backdropRows();
  const stops: string[] = [];
  let from = 0;
  for (let y = 1; y <= rows.length; y++) {
    if (y === rows.length || rows[y] !== rows[from]) {
      stops.push(`${rows[from]} ${(from / H) * 100}% ${(y / H) * 100}%`);
      from = y;
    }
  }
  bandCache = `linear-gradient(to bottom, ${stops.join(', ')})`;
  return bandCache;
}

/** the strip at the top of a screen: the picture in the middle, the night continuing to both sides */
export function Banner({ scene }: { scene: SceneId }): ReactElement {
  const style: CSSProperties = { background: bands() };
  return (
    <div className={styles.banner} style={style} data-scene={scene} aria-hidden="true">
      <Picture scene={scene} view={`0 0 ${W} ${H}`} />
    </div>
  );
}

/** the picture of an empty screen, with what to do about it; `compact` for an empty part of a page: a small picture beside the words */
export function Empty({ scene, title, children, compact = false }: { scene: SceneId; title: string; children?: ReactNode; compact?: boolean }): ReactElement {
  const span = SCENES[scene].span;
  const x0 = Math.floor((W - span) / 2);
  return (
    <div className={`${styles.empty} ${compact ? styles.compact : ''}`} data-scene={scene}>
      <div className={styles.frame} style={{ aspectRatio: `${span} / ${H}` }}>
        <Picture scene={scene} view={`${x0} 0 ${span} ${H}`} />
      </div>
      <div className={styles.emptyBody}>
        <h3 className={styles.emptyTitle}>{title}</h3>
        {children && <p className={`${ui.muted} ${styles.emptyText}`}>{children}</p>}
      </div>
    </div>
  );
}
