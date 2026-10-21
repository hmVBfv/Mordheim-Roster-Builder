/* Give on a wide screen (Rob, 20.10.2026: "Einzelzeilen von klobigen Feldern" – he asked for two columns side by
   side, to assign by picking): on the left what each warrior and the stash holds, on the right who may take the
   picked item, and why not the others. A phone keeps the sheet (TradingPost.tsx). */
import type * as core from '@mordheim/core';
import { useMemo, useState } from 'react';
import type { Holding, Recipient } from '../roster/equipment.ts';
import styles from '../roster/Trade.module.css';
import ui from '../ui/ui.module.css';

const keyOf = (h: Holding) => `${String(h.from)}:${h.goods.rare ? 'r' : 'c'}:${h.goods.key}`;

export function GiveBoard({ held, recipientsFor, onGive }: { held: Holding[]; recipientsFor: (h: Holding) => Recipient[]; onGive: (h: Holding, to: core.Holder) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  // what was given is no longer held by the one who gave it: nothing stays picked
  const item = held.find((h) => keyOf(h) === picked) ?? null;
  const groups = useMemo(() => {
    const out: { owner: string; items: Holding[] }[] = [];
    for (const h of held) {
      const g = out.find((x) => x.owner === h.owner);
      if (g) g.items.push(h); else out.push({ owner: h.owner, items: [h] });
    }
    return out;
  }, [held]);
  if (!held.length) return <p className={ui.muted}>Nothing to give.</p>;
  const to = item ? recipientsFor(item) : [];
  return (
    <div className={styles.giveBoard}>
      <section aria-label="What to give" className={styles.giveCol}>
        {groups.map((g) => (
          <div key={g.owner}>
            <h3>{g.owner}</h3>
            <div className={styles.pick} role="group" aria-label={`Held by ${g.owner}`}>
              {g.items.map((h) => (
                <button key={keyOf(h)} type="button" title={h.text || undefined} aria-pressed={keyOf(h) === picked} onClick={() => setPicked(keyOf(h) === picked ? null : keyOf(h))}>
                  {h.name}{h.pieces > 1 ? ` ×${h.pieces}` : ''}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
      <section aria-label="Who takes it" className={styles.giveCol}>
        {!item ? <p className={ui.muted}>Pick an item on the left.</p> : (
          <>
            <p><strong>{item.name} from {item.owner}</strong>{item.pieces > 1 ? <span className={ui.muted}> · {item.pieces} pieces</span> : null}<br /><span className={ui.muted}>No gold changes hands{item.goods.rare ? '; the price paid goes with it' : ''}.</span></p>
            <div className={styles.pick} role="group" aria-label="Give to">
              {to.map((r) => (
                <button key={String(r.to)} type="button" disabled={!r.ok} onClick={() => { setPicked(null); onGive(item, r.to); }}>
                  {r.name}<small className={r.ok ? undefined : styles.no}>{r.note}</small>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
