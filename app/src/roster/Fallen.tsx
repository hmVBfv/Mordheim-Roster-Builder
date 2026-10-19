/* The Fallen under the list (legacy renderFallen): the totals in the line
   that opens it, then the dead by unit – Heroes one by one, henchmen by name
   or counted together – each with his experience, what he carried and what
   he cost the warband. Read-only, on the own roster and on another player's. */
import type { FallenView } from './view.ts';
import styles from './Board.module.css';
import ui from '../ui/ui.module.css';

export function FallenList({ f }: { f: FallenView }) {
  if (!f.count) return null;
  return (
    <details className={`${ui.card} ${styles.fallenBox}`}>
      <summary className={styles.fallen}>
        <span className={styles.fallenTitle}>Fallen ({f.count})</span>
        <span className={styles.fallenTotals}>{f.goldLost} gc lost{f.xpLost ? ` · ${f.xpLost} Exp earned in play lost` : ''}</span>
      </summary>
      <p className={ui.muted}>Removed from the warband; their equipment was lost with them.</p>
      <div className={styles.fallenGroups}>
        {f.groups.map((g) => (
          <section key={g.key} className={styles.fallenGroup} aria-label={`${g.count}× ${g.unit}`}>
            <h3>{g.count}× {g.unit}<small>{g.kind === 'hero' ? 'Hero' : 'Henchmen'}</small></h3>
            {/* the group's totals only where they add up more than one line */}
            {(g.entries.length > 1 || g.entries[0]!.count > 1) && (
              <p className={styles.fallenNote}>{g.xpTotal} Exp{g.xpEarned ? ` (${g.xpEarned} earned in play)` : ''} · {g.goldLost} gc lost</p>
            )}
            <ul className={styles.fallenRows}>
              {g.entries.map((e, i) => (
                <li key={i}>
                  <span className={styles.fallenName}>{e.count > 1 ? `${e.count}× ` : ''}{e.name}</span>
                  <span className={styles.fallenNums}>{e.xp} Exp · {e.worth} gc</span>
                  <span className={styles.fallenGear}>{e.equipment.length ? e.equipment.join(', ') : 'No equipment'}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </details>
  );
}
