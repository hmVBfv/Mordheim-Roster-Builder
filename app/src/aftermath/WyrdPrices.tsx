/* The wyrdstone price table. With a warband size it marks that warband's column and, with a lot, the row; on a narrow screen the page
   shows the own column first and keeps the whole table in a fold, so nothing scrolls sideways. Without a size the whole table is shown. */
import * as core from '@mordheim/core';
import { RulesTable } from '../ui/RulesTable.tsx';
import ui from '../ui/ui.module.css';
import { wyrdPriceTable } from './tables.ts';

export function WyrdPrices({ size = null, shards = null, band = null }: { size?: number | null; shards?: number | null; band?: number | null }) {
  const t = wyrdPriceTable();
  const col = band != null ? band + 1 : size == null ? null : core.wyrdSizeBand(size) + 1;
  const row = shards == null ? null : Math.max(0, Math.min(core.WYRD_PRICE.length, shards) - 1);
  if (col == null) return <RulesTable caption={t.title} head={t.head} rows={t.rows} row={row} note={t.note} link={t.link} />;
  const own = { head: [t.head[0] as string, t.head[col] as string], rows: t.rows.map((r) => [r[0] as string, r[col] as string]) };
  return (
    <>
      <RulesTable caption={`${t.title}: ${t.head[col]}`} head={own.head} rows={own.rows} row={row} col={1} note={t.note} link={t.link} />
      <details>
        <summary className={ui.fold}>All sizes</summary>
        <RulesTable caption={t.title} head={t.head} rows={t.rows} row={row} col={col} />
      </details>
    </>
  );
}
