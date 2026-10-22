/* A scene as an svg: one path per colour, so a picture is a handful of
   elements. The page paints the backdrop bands beside it (Banner), which is
   why a picture can be as wide as the screen. Decorative: hidden from
   assistive technology. */
import { useEffect, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { H, LIVE, PALETTE, W, WB, backdropRows } from './draw.ts';
import { paint, SCENES, type SceneId } from './scenes.ts';
import styles from './art.module.css';
import ui from '../ui/ui.module.css';

interface Layer { color: string; live?: keyof typeof styles; d: string }

const layerCache = new Map<string, Layer[]>();

/** the picture cut into runs of one colour per row; `wide`: the banner's rows, with the surroundings of its motif (wings.ts) */
export function layers(id: SceneId, wide?: readonly string[]): Layer[] {
  const key = `${id}:${wide ? 'wide' : 'narrow'}`;
  const hit = layerCache.get(key);
  if (hit) return hit;
  const byLetter = new Map<string, string>();
  (wide ?? paint(id)).forEach((row, y) => {
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
  layerCache.set(key, out);
  return out;
}

function Picture({ scene, view, wide }: { scene: SceneId; view: string; wide?: readonly string[] }): ReactElement {
  return (
    <svg className={styles.svg} viewBox={view} shapeRendering="crispEdges" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      {layers(scene, wide).map((l, i) => <path key={i} d={l.d} fill={l.color} className={l.live ? styles[l.live] : undefined} />)}
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

type Wings = typeof import('./wings.ts');
let wings: Wings | undefined;

/** the strip at the top of a screen: the motif in the middle, its surroundings to both sides (wings.ts), the night beyond.
    The surroundings load after the first paint (they are a chunk of their own: the first load has a budget); until then
    the motif stands alone in the middle, as it always did. */
export function Banner({ scene }: { scene: SceneId }): ReactElement {
  const [loaded, setLoaded] = useState<Wings | undefined>(wings);
  useEffect(() => {
    if (wings) return;
    let live = true;
    void import('./wings.ts').then((m) => { wings = m; if (live) setLoaded(m); });
    return () => { live = false; };
  }, []);
  const style: CSSProperties = { background: bands() };
  const x0 = Math.floor((W - WB) / 2);
  return (
    <div className={styles.banner} style={style} data-scene={scene} aria-hidden="true">
      <Picture scene={scene} view={loaded ? `0 0 ${WB} ${H}` : `${x0} 0 ${WB} ${H}`} wide={loaded?.paintWide(scene)} />
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
