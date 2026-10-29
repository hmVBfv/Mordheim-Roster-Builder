/* A warrior's equipment while the warband is founded (phase 3b): his own
   list with a stepper per item, at the list price (the first dagger free),
   and rare or trading-post items from the catalogue, as in the Roster
   Builder. After the first battle equipment changes only at the Trading
   Post. Changes are made at once; a step back is the − beside it. */
import { useId, useState } from 'react';
import { TipWord } from '../ui/Tip.tsx';
import ui from '../ui/ui.module.css';
import type { useSheet } from '../ui/useSheet.ts';
import type { EquipmentView } from './equipment.ts';
import styles from './Roster.module.css';

type Sheet = ReturnType<typeof useSheet>;

export interface EquipmentActions {
  qty: (key: string, qty: number, name: string) => void;
  addRare: (de: string) => void;
  rareQty: (de: string, q: number) => void;
  /** Puts an upgrade on a weapon, or takes it off again – a used-up poison as well. */
  upgrade: (de: string, weapon: string, on: boolean) => void;
  /** What was paid for a rare item, set by hand (a price rolled at the table). */
  paid: (de: string, gc: number, slot: number) => void;
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
          : `Until the first battle every warrior buys from his own list${v.men > 1 ? ', a group for every man' : ''}, with what the warband gives at the start; the Trading Post opens after his first battle. Taking an item back returns its price.`}</p>
      </div>
      {/* what he carries comes first and stands apart (#135): every piece on its own line, so each weapon can be upgraded (#115) */}
      <section className={`${styles.eqGroup} ${styles.eqCarriedBox}`} aria-label="Carried">
        <h3>Carried</h3>
        {v.carried.length === 0 ? <p className={ui.muted}>Nothing carried yet.</p> : (
          <table className={`${styles.eqTable} ${styles.eqCarried}`}>
            <thead><tr><th scope="col">Item</th><th scope="col">Price</th><th scope="col">Upgrade</th><th scope="col"><span className="visually-hidden">Take away</span></th></tr></thead>
            <tbody>
              {v.carried.map((r) => (
                <tr key={r.id}>
                  <th scope="row" className={styles.eqName}><TipWord label={r.name} tips={r.tips} /><small>{r.group}</small></th>
                  <td className={styles.eqPrice}>{r.price}</td>
                  <td>
                    <span className={styles.eqUpgrade}>
                      {r.ups.map((u) => (
                        <span key={u.de} className={styles.eqUp}>
                          <span>{u.name}</span>
                          <label className={styles.paid}>
                            <small>Paid</small>
                            <input key={u.paid} className={ui.input} type="number" inputMode="numeric" min={0} defaultValue={u.paid} aria-label={`Paid for ${u.name} on ${r.name}`}
                              onBlur={(e) => { const n = Math.max(0, Math.round(Number(e.target.value) || 0)); if (n !== u.paid) act.paid(u.de, n, u.slot); }} />
                            <small>gc</small>
                          </label>
                          <button type="button" className={ui.buttonQuiet} aria-label={`Remove ${u.name} on ${r.name}`} onClick={() => act.upgrade(u.de, r.key, false)}>Remove</button>
                        </span>
                      ))}
                      {r.options.length > 0 && (
                        <select className={ui.select} aria-label={`Upgrade ${r.name}`} value="" onChange={(e) => { if (e.target.value) act.upgrade(e.target.value, r.key, true); }}>
                          <option value="">Upgrade…</option>
                          {r.options.map((o) => <option key={o.de} value={o.de}>{o.name} – {o.price} gc</option>)}
                        </select>
                      )}
                      {r.weapon && r.free && <small className={ui.muted}>the free dagger is never upgraded</small>}
                    </span>
                  </td>
                  <td>
                    {r.keep ? <small className={ui.muted}>stays</small> : r.used ? (
                      <button type="button" className={ui.buttonQuiet} aria-label={`${r.name} used`}
                        onClick={() => (r.from === 'list' ? act.qty(r.key, r.qty - 1, r.name) : act.rareQty(r.key, r.qty - 1))}>Used</button>
                    ) : (
                      <button type="button" className={ui.buttonQuiet} aria-label={`Take one ${r.name} away`}
                        onClick={() => (r.from === 'list' ? act.qty(r.key, r.qty - 1, r.name) : act.rareQty(r.key, r.qty - 1))}>−</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section className={styles.eqGroup} aria-label="Buy from the list">
        <h3 className={styles.eqBuyHead}>Buy from the list</h3>
      {/* the list, one small table for each kind, side by side where there is room (#115) */}
      <div className={styles.eqTables}>
        {v.groups.map((g) => (
          <table key={g.label} className={`${styles.eqTable} ${styles.eqListTable}`}>
            <caption>{g.label}</caption>
            <thead className="visually-hidden"><tr><th scope="col">Item</th><th scope="col">Price</th><th scope="col">How many</th></tr></thead>
            <tbody>
              {g.rows.map((r) => (
                <tr key={r.key}>
                  <th scope="row" className={styles.eqName}>
                    <TipWord label={r.name} tips={r.tips} />
                    {r.more && r.qty === 0 && <small>{r.more}</small>}
                  </th>
                  <td className={styles.eqPrice}>{r.free ? `first free, then ${r.price} gc` : `${r.price} gc${per}`}</td>
                  <td><Stepper label={r.name} value={r.qty} min={r.min} max={r.more ? r.qty : 9} onChange={(q) => act.qty(r.key, q, r.name)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
      </section>
      <section className={styles.eqGroup} aria-label="Rare and trading-post items">
        <h3>Rare and trading-post items</h3>
        {v.rare.length > 0 && (
          <ul className={styles.eqList}>
            {v.rare.map((r) => (
              <li key={`${r.de}#${r.slot}`} className={styles.eqRow}>
                <span className={styles.eqName} title={r.text || undefined}>
                  {r.name}
                  <label className={styles.paid}>
                    <small>Paid</small>
                    <input key={r.paid} className={ui.input} type="number" inputMode="numeric" min={0} defaultValue={r.paid} aria-label={`Paid for ${r.name}`}
                      onBlur={(e) => { const n = Math.max(0, Math.round(Number(e.target.value) || 0)); if (n !== r.paid) act.paid(r.de, n, r.slot); }} />
                    <small>gc</small>
                  </label>
                </span>
                <Stepper label={r.name} value={r.q} max={r.max} onChange={(q) => act.rareQty(r.de, q)} />
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
        ) : <p className={ui.muted}>Rare items are searched for at the Trading Post, after his first battle.</p>}
      </section>
      <div className={`${ui.row} ${ui.sheetActions}`}><button type="button" className={ui.button} onClick={() => close()}>Done</button></div>
    </div>
  );
}

export function EquipmentSheet({ dialogRef, close, view, act }: { dialogRef: Sheet['ref']; close: Sheet['close']; view: EquipmentView | null; act: EquipmentActions }) {
  const id = useId();
  return (
    <dialog ref={dialogRef} className={`${ui.sheet} ${ui.sheetWide}`} aria-labelledby={id}>
      {view && <Body key={view.uid} v={view} act={act} close={close} titleId={id} />}
    </dialog>
  );
}
