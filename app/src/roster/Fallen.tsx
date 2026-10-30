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
        <span className={styles.fallenTotals}>
          <span>{f.goldLost} gc lost</span>
          {f.xpLost > 0 && <span>{f.xpLost} Exp lost</span>}
        </span>
      </summary>
      <p className={ui.muted}>Removed from the warband; their equipment was lost with them. Experience lost is what they earned in play.</p>
      <div className={styles.fallenGroups}>
        {f.groups.map((g) => (
          <section key={g.key} className={styles.fallenGroup} aria-label={`${g.count}× ${g.unit}`}>
            <h3>{g.unit}<small>{g.kind === 'hero' ? 'Hero unit' : 'Henchmen unit'}</small></h3>
            <p className={styles.fallenNote}>
              <span>{g.count} {g.count === 1 ? 'model' : 'models'} fallen</span>
              <span>{g.xpTotal} Exp{g.xpEarned ? ` (${g.xpEarned} earned in play)` : ''}</span>
              <span>{g.goldLost} gc lost</span>
            </p>
            <ul className={styles.fallenRows} aria-label={`Fallen models of ${g.unit}`}>
              {g.entries.map((e, i) => (
                <li key={i}>
                  <span className={styles.fallenName}>{e.count > 1 ? `${e.count}× ` : ''}{e.name}</span>
                  <span className={styles.fallenNums}>
                    <span>{e.xp} Exp{e.xpEarned ? ` (${e.xpEarned} earned in play)` : ''}</span>
                    <span>{e.worth} gc lost</span>
                  </span>
                  {(e.fell || e.joined) && <span className={styles.fallenWhen}>{[e.joined, e.fell].filter(Boolean).map((t) => <span key={t}>{t}</span>)}</span>}
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
