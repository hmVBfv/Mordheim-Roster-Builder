/* Step 4, selling wyrdstone (N9): the size the price is read at – with every special rule that changes it – the price table with the warband's
   own column and the lot's row, the Cathayan Merchant's roll, and the sale. Once per post-battle sequence; taking it back undoes it. */
import * as core from '@mordheim/core';
import type { GameData } from '@mordheim/core';
import { useState } from 'react';
import ui from '../ui/ui.module.css';
import styles from './Aftermath.module.css';
import type { AftermathView } from './view.ts';
import { WyrdPrices } from './WyrdPrices.tsx';

export interface WyrdActs {
  ctx: core.Ctx;
  edit: (action: (ctx: core.Ctx) => core.WarbandState, text?: string, opts?: { gold?: 'settle' | 'keep' }) => void;
}

const num = (v: string): number | null => (v.trim() !== '' && Number.isInteger(Number(v)) ? Number(v) : null);

export function WyrdStep({ a, data, acts }: { a: AftermathView; data: GameData; acts: WyrdActs }) {
  const [want, setWant] = useState<number | null>(null);
  const [chef, setChef] = useState<boolean | null>(null);
  const [manual, setManual] = useState(0);
  const [die, setDie] = useState('');
  const [dice, setDice] = useState('');
  const sold = a.wyrd.sold;
  const n = Math.max(1, Math.min(a.wyrd.shards, want ?? a.wyrd.shards));
  const size = core.sellingSize(acts.ctx, { kind: 'wyrd', chef: chef === true, manual });
  const price = core.priceAt(acts.ctx, n, size);
  const merchant = core.merchantPresent(acts.ctx);
  const d1 = num(die), d2 = num(dice);
  const sides = d1 === 6 ? 3 : 2;
  const diceOk = d2 != null && d2 >= sides && d2 <= sides * 6;
  const adjust = merchant && d1 != null && d1 >= 1 && d1 <= 6 && diceOk ? core.merchantAdjust(d1, d2!) : null;
  const waitingForMerchant = merchant && adjust == null;
  const total = Math.max(0, price + (adjust ?? 0));
  const bandName = core.WYRD_BANDS[size.band]?.[1] ?? '';
  const rollMerchant = () => { const r = 1 + Math.floor(Math.random() * 6); const k = r === 6 ? 3 : 2; let sum = 0; for (let i = 0; i < k; i++) sum += 1 + Math.floor(Math.random() * 6); setDie(String(r)); setDice(String(sum)); };
  const sell = () => acts.edit((c) => core.sellWyrdstone(c, a.round, n, { size: { models: size.models, band: size.band }, ...(adjust != null ? { adjust: { gc: adjust, text: `Cathayan Merchant: ${adjust > 0 ? '+' : ''}${adjust} gc` } } : {}) }),
    `Sold ${n} shard${n === 1 ? '' : 's'} for ${total} gc.`, { gold: 'keep' });

  return (
    <>
      <p>Wyrdstone is sold once after each battle. The price is for the whole lot, not per shard – smaller lots fetch more each, and a larger warband earns less.</p>
      {sold
        ? (
          <div className={ui.row}>
            <span>✓ Sold {sold.shards} shard{sold.shards === 1 ? '' : 's'} for {sold.gc} gc (warband of {sold.size}{sold.adjust ? `, the Merchant ${sold.adjust > 0 ? '+' : ''}${sold.adjust} gc` : ''}).</span>
            <button type="button" className={ui.buttonQuiet} onClick={() => acts.edit((c) => core.undoWyrdstoneSale(c, a.round), 'Sale taken back.', { gold: 'keep' })}>Take the sale back</button>
          </div>
        )
        : a.wyrd.shards < 1
          ? <p className={ui.muted}>No wyrdstone in the stash to sell.</p>
          : (
            <>
              <div className={styles.recorded} aria-live="polite">
                <p>Size for selling: <strong>{size.models} model{size.models === 1 ? '' : 's'}</strong> – price band <strong>{bandName}</strong>{size.models !== size.base ? ` (the roster counts ${size.base})` : ''}.</p>
                {size.lines.length > 0 && <ul className={styles.plain} aria-label="Size adjustments">{size.lines.map((l) => <li key={l.id}>{l.text}</li>)}</ul>}
              </div>
              {core.chefAvailable(acts.ctx) && (
                <div className={styles.stepper}>
                  <span>Halfling Cook (Master Chef): roll a D6 – 5 or more?</span>
                  <button type="button" className={chef === true ? ui.button : ui.buttonQuiet} aria-pressed={chef === true} onClick={() => setChef(true)}>Yes</button>
                  <button type="button" className={chef === false ? ui.button : ui.buttonQuiet} aria-pressed={chef === false} onClick={() => setChef(false)}>No</button>
                </div>
              )}
              <div className={styles.stepper}>
                <span>Correct the size by hand</span>
                <button type="button" className={ui.buttonQuiet} aria-label="One model less" onClick={() => setManual((m) => m - 1)}>−</button>
                <span aria-live="polite">{manual > 0 ? `+${manual}` : manual}</span>
                <button type="button" className={ui.buttonQuiet} aria-label="One model more" onClick={() => setManual((m) => m + 1)}>+</button>
              </div>
              {merchant && (
                <fieldset className={styles.scenario}>
                  <legend>Cathayan Merchant refines the wyrdstone</legend>
                  <p className={ui.muted}>Roll a D6: 1–2 lose 2D6 gc, 3–5 gain 2D6 gc, 6 gain 3D6 gc. Then the dice for that.</p>
                  <div className={styles.stepper}>
                    <label>D6 <input type="text" inputMode="numeric" maxLength={1} className={styles.cell} aria-label="Merchant D6" value={die} onChange={(e) => setDie(e.target.value.replace(/\D/g, ''))} /></label>
                    <label>{sides}D6 <input type="text" inputMode="numeric" maxLength={2} className={styles.cell} aria-label={`Merchant ${sides}D6 total`} value={dice} onChange={(e) => setDice(e.target.value.replace(/\D/g, ''))} /></label>
                    <button type="button" className={ui.buttonQuiet} onClick={rollMerchant}>Roll</button>
                  </div>
                  {adjust != null && <p>{adjust > 0 ? '+' : ''}{adjust} gc.</p>}
                </fieldset>
              )}
              <p>Stash: {a.wyrd.shards} shard{a.wyrd.shards === 1 ? '' : 's'}.</p>
              <WyrdPrices band={size.band} shards={n} />
              <div className={styles.stepper}>
                <span>Sell</span>
                <button type="button" className={ui.buttonQuiet} aria-label="Sell one shard less" disabled={n <= 1} onClick={() => setWant(n - 1)}>−</button>
                <span aria-live="polite">{n}</span>
                <button type="button" className={ui.buttonQuiet} aria-label="Sell one shard more" disabled={n >= a.wyrd.shards} onClick={() => setWant(n + 1)}>+</button>
                <button type="button" className={ui.button} disabled={waitingForMerchant} onClick={sell}>Sell for {total} gc</button>
              </div>
              {waitingForMerchant && <p className={styles.warn}>The Merchant’s roll comes first.</p>}
            </>
          )}
      <p className={ui.muted}>{data.PB_SOURCE ? 'Sold shards come out of the stash; the gold goes into the treasury.' : ''}</p>
    </>
  );
}
