/* One rare item as a line of the Trading Post's lists and of the search sheet (wishes #24, #26): its name, then rarity,
   chance and price as cells that never break in the middle – on a phone under the name, from tablet width as columns –
   and the first sentence of what it does. */
import * as core from '@mordheim/core';
import { effectLine } from '../roster/rareFilter.ts';
import type { RareItem } from '../roster/equipment.ts';
import styles from '../roster/Trade.module.css';

const average = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function RareLine({ it }: { it: RareItem }) {
  return (
    <>
      <span className={styles.rn}>{it.name}{!it.usable && <small className={styles.no}> · nobody here may use it</small>}</span>
      <span className={styles.rr}>Rare {it.rarity}</span>
      <span className={styles.rc}>{Math.round(core.chance2d6(it.rarity) * 100)} %</span>
      <span className={styles.rp}>{it.price}{it.avg != null && <small> ≈ {average(it.avg)} gc</small>}</span>
      {it.text && <small className={styles.re}>{effectLine(it.text)}</small>}
    </>
  );
}
