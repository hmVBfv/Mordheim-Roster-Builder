/* The Stash under the roster (wish #63): what lies in the stash with what each item does, written out, and giving it on from here –
   the Trading Post's Give, for stash items only. Shown once trading is open and something lies there. */
import type * as core from '@mordheim/core';
import { useId, useState } from 'react';
import ui from '../ui/ui.module.css';
import { giveRecipients, holdings, type Holding } from './equipment.ts';
import styles from './Trade.module.css';

export function StashSection({ ctx, onGive }: { ctx: core.Ctx; onGive: (h: Holding, to: core.Holder) => void }) {
  const id = useId();
  const [open, setOpen] = useState<string | null>(null);
  const items = holdings(ctx).filter((h) => h.from === 'stash');
  if (!items.length) return null;
  return (
    <section className={ui.page} aria-labelledby={id}>
      <h2 id={id}>Stash</h2>
      <ul className={styles.stashRoster}>
        {items.map((h) => {
          const key = h.goods.key;
          return (
            <li key={`${h.goods.rare ? 'r' : 'c'}:${key}`}>
              <div className={styles.between}>
                <span><b>{h.name}</b>{h.pieces > 1 && <span className={ui.muted}> ×{h.pieces}</span>}</span>
                <button type="button" className={ui.buttonQuiet} aria-expanded={open === key} aria-label={`Give ${h.name}`} onClick={() => setOpen(open === key ? null : key)}>Give</button>
              </div>
              {h.text && <small className={ui.muted}>{h.text}</small>}
              {open === key && (
                <div className={styles.pick} role="group" aria-label={`Give ${h.name} to`}>
                  {giveRecipients(ctx, h).filter((r) => r.to !== 'stash').map((r) => (
                    <button key={String(r.to)} type="button" disabled={!r.ok} onClick={() => { setOpen(null); onGive(h, r.to); }}>
                      {r.name}<small className={r.ok ? undefined : styles.no}>{r.note}</small>
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
