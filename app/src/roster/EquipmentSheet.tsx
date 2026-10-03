/* A warrior's equipment while the warband is founded (phase 3b): his own
   list with a stepper per item, at the list price (the first dagger free),
   and rare or trading-post items from the catalogue, as in the Roster
   Builder. After the first battle equipment changes only at the Trading
   Post. Changes are made at once; a step back is the − beside it. */
import { useId, useState } from 'react';
import ui from '../ui/ui.module.css';
import type { useSheet } from '../ui/useSheet.ts';
import type { EquipmentView } from './equipment.ts';
import styles from './Roster.module.css';

type Sheet = ReturnType<typeof useSheet>;

export interface EquipmentActions {
  qty: (key: string, qty: number, name: string) => void;
  addRare: (de: string) => void;
  rareQty: (de: string, q: number) => void;
  target: (de: string, weapon: string) => void;
  /** What was paid for a rare item, set by hand (a price rolled at the table). */
  paid: (de: string, gc: number) => void;
}

function Stepper({ label, value, min = 0, max = 9, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (v: number) => void }) {
  // max = value: no more may be taken
  return (
    <span className={styles.stepper}>
      <button type="button" aria-label={`One ${label} less`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <span aria-live="polite">{value}</span>
      <button type="button" aria-label={`One ${label} more`} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </span>
  );
}

function Body({ v, act, close, titleId }: { v: EquipmentView; act: EquipmentActions; close: Sheet['close']; titleId: string }) {
  const [pick, setPick] = useState('');
  const per = v.men > 1 ? ` each – ${v.men} men` : '';
  return (
    <div className={ui.page}>
      <div>
        <h2 id={titleId}>Equipment · {v.name}</h2>
        <p className={ui.muted}>{v.recruit
          ? 'Hired after the warband\'s first battle: until his own he buys from his list at its prices – common items freely, rare ones only by a search at the Trading Post. Taking an item back returns its price.'
          : `Until the first battle every warrior buys from his own list${v.men > 1 ? ', a group for every man' : ''}; taking an item back returns its price.`}</p>
      </div>
      {v.groups.map((g) => (
        <section key={g.label} className={styles.eqGroup} aria-label={g.label}>
          <h3>{g.label}</h3>
          <ul className={styles.eqList}>
            {g.rows.map((r) => (
              <li key={r.key} className={styles.eqRow}>
                <span className={styles.eqName} title={r.text || undefined}>
                  {r.name}
                  <small>{r.free ? `first one free, then ${r.price} gc` : `${r.price} gc${per}`}{r.more && r.qty === 0 ? ` · ${r.more}` : ''}</small>
                </span>
                <Stepper label={r.name} value={r.qty} max={r.more ? r.qty : 9} onChange={(q) => act.qty(r.key, q, r.name)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className={styles.eqGroup} aria-label="Rare and trading-post items">
        <h3>Rare and trading-post items</h3>
        {v.rare.length > 0 && (
          <ul className={styles.eqList}>
            {v.rare.map((r) => (
              <li key={r.de} className={styles.eqRow}>
                <span className={styles.eqName} title={r.text || undefined}>
                  {r.name}
                  {r.upgrade && r.on && <small>on {r.targets.find((t) => t.key === r.on)?.name ?? r.on}</small>}
                  <label className={styles.paid}>
                    <small>Paid</small>
                    <input key={r.paid} className={ui.input} type="number" inputMode="numeric" min={0} defaultValue={r.paid} aria-label={`Paid for ${r.name}`}
                      onBlur={(e) => { const n = Math.max(0, Math.round(Number(e.target.value) || 0)); if (n !== r.paid) act.paid(r.de, n); }} />
                    <small>gc</small>
                  </label>
                </span>
                {r.upgrade ? (
                  <span className={styles.eqUpgrade}>
                    {r.targets.length > 1 && (
                      <select className={ui.select} aria-label={`Weapon for ${r.name}`} value={r.on ?? ''} onChange={(e) => act.target(r.de, e.target.value)}>
                        {r.targets.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
                      </select>
                    )}
                    <button type="button" className={ui.buttonQuiet} onClick={() => act.rareQty(r.de, 0)}>Remove</button>
                  </span>
                ) : <Stepper label={r.name} value={r.q} onChange={(q) => act.rareQty(r.de, q)} />}
              </li>
            ))}
          </ul>
        )}
        {v.offer.length > 0 ? (
          <div className={styles.eqAdd}>
            <select className={ui.select} aria-label="Rare item to add" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Choose an item…</option>
              {v.offer.map((o) => <option key={o.de} value={o.de}>{o.name} – {o.price}{o.rarity && o.rarity !== 'Common' ? ` · ${o.rarity}` : ''}</option>)}
            </select>
            <button type="button" className={ui.buttonQuiet} disabled={!pick} onClick={() => { act.addRare(pick); setPick(''); }}>Add</button>
          </div>
        ) : <p className={ui.muted}>{v.recruit ? 'Rare items: search for them at the Trading Post.' : 'Nothing from the catalogue fits this warrior.'}</p>}
      </section>
      <div className={`${ui.row} ${ui.sheetActions}`}><button type="button" className={ui.button} onClick={() => close()}>Done</button></div>
    </div>
  );
}

export function EquipmentSheet({ dialogRef, close, view, act }: { dialogRef: Sheet['ref']; close: Sheet['close']; view: EquipmentView | null; act: EquipmentActions }) {
  const id = useId();
  return (
    <dialog ref={dialogRef} className={ui.sheet} aria-labelledby={id}>
      {view && <Body key={view.uid} v={view} act={act} close={close} titleId={id} />}
    </dialog>
  );
}
