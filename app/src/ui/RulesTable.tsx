/* A table of the rules: a caption, a header row, and optionally one row or column marked as "yours" (aria-current), so a reader sees
   where the warband stands on the chart. Wide tables scroll inside their own box and never widen the page. */
import ui from './ui.module.css';
import styles from './RulesTable.module.css';

export interface RulesTableProps {
  caption: string;
  head: string[];
  rows: string[][];
  /** Row index (0-based) to mark. */
  row?: number | null;
  /** Column index (0-based, counting the first column) to mark. */
  col?: number | null;
  note?: string;
  /** Where the rule is written. */
  link?: string;
  /** The first cell of each row is a row heading. */
  rowHeads?: boolean;
}

export function RulesTable({ caption, head, rows, row = null, col = null, note, link, rowHeads = true }: RulesTableProps) {
  return (
    <figure className={styles.figure}>
      <div className={styles.scroll} tabIndex={0} role="region" aria-label={caption}>
        <table className={styles.table}>
          <caption>{caption}</caption>
          <thead>
            <tr>{head.map((h, j) => <th key={j} scope="col" aria-current={col === j ? 'true' : undefined} className={col === j ? styles.mine : undefined}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} aria-current={row === i ? 'true' : undefined} className={row === i ? styles.mine : undefined}>
                {r.map((c, j) => (j === 0 && rowHeads
                  ? <th key={j} scope="row">{c}</th>
                  : <td key={j} aria-current={col === j ? 'true' : undefined} className={col === j ? styles.mine : undefined}>{c}</td>))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(note || link) && (
        <figcaption className={ui.muted}>
          {note}{note && link ? ' ' : ''}
          {link && <a href={link} target="_blank" rel="noopener noreferrer" className={styles.source}>Rules ↗</a>}
        </figcaption>
      )}
    </figure>
  );
}
