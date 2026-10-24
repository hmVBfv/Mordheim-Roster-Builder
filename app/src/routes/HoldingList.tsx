/* What is held, as a list on a phone (Sell and Give): what the warriors carry first, then – set apart under a heading – what lies in the stash
   (reports #57 and #61: carried and stashed items ran into one another). The free dagger is not in it (#56): it cannot be traded, and the
   cards of a wide screen show it. */
import type { Holding } from '../roster/equipment.ts';
import styles from '../roster/Trade.module.css';
import ui from '../ui/ui.module.css';

const keyOf = (h: Holding) => `${h.from}:${h.goods.rare ? 'r' : 'c'}:${h.goods.key}`;

export function HoldingList({ list, label, action, onPick }: { list: Holding[]; label: string; action: (h: Holding) => string; onPick: (h: Holding) => void }) {
  const items = list.filter((h) => !h.free);
  if (!items.length) return <p className={ui.muted}>Nothing to {label.toLowerCase()}.</p>;
  const carried = items.filter((h) => h.from !== 'stash');
  const stashed = items.filter((h) => h.from === 'stash');
  const rows = (rs: Holding[], name: string) => (
    <ul className={styles.rows} aria-label={name}>
      {rs.map((h) => (
        <li key={keyOf(h)}>
          <button type="button" className={styles.item} title={h.text || undefined} onClick={() => onPick(h)} aria-label={`${label} ${h.name} of ${h.owner}`}>
            <span>{h.name}{h.pieces > 1 && <span className={ui.muted}> ×{h.pieces}</span>}</span>
            <small>{h.owner} · {action(h)}</small>
          </button>
        </li>
      ))}
    </ul>
  );
  return (
    <div className={ui.page}>
      {carried.length > 0 && <>{stashed.length > 0 && <h3 className={styles.holdHead}>Carried by the warband</h3>}{rows(carried, 'Carried')}</>}
      {stashed.length > 0 && <><h3 className={styles.holdHead}>In the stash</h3>{rows(stashed, 'In the stash')}</>}
    </div>
  );
}
