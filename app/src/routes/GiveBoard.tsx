/* Give on a wide screen (wishes of Rob, 20.10.2026 and report #32): every warrior and the stash as a small card side by side in
   as many columns as fit – with his profile and rules, so one sees whom an item helps most – and what he holds as chips.
   Pick a chip (or start dragging it): each card says whether it may take the item and why not; click "Give here" or drop the
   chip on a card. A phone keeps the sheet (TradingPost.tsx).
   Buy and Sell use the same cards (report #54): Sell turns the chips into buttons that open the price sheet; Buy puts the items
   on sale above the cards, and a picked one says on every card whether it may carry it and what it costs. */
import type * as core from '@mordheim/core';
import { useState, type DragEventHandler, type ReactNode } from 'react';
import type { GiveCard, Holding, Recipient, ShopItem } from '../roster/equipment.ts';
import styles from '../roster/Trade.module.css';
import ui from '../ui/ui.module.css';

const keyOf = (h: Holding) => `${String(h.from)}:${h.goods.rare ? 'r' : h.free ? 'f' : 'c'}:${h.goods.key}`;

const gc = (n: number) => `${n} gc`;

export function GiveBoard({ cards, recipientsFor, onGive }: { cards: GiveCard[]; recipientsFor: (h: Holding) => Recipient[]; onGive: (h: Holding, to: core.Holder) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const all = cards.flatMap((c) => c.items).filter((h) => !h.free);
  // what was given is no longer held by the one who gave it: nothing stays picked
  const item = all.find((h) => keyOf(h) === picked) ?? null;
  const to = item ? recipientsFor(item) : [];
  if (!all.length) return <p className={ui.muted}>Nothing to give.</p>;
  const give = (r: Recipient | undefined) => {
    if (!item || !r?.ok) return;
    setPicked(null);
    setOver(null);
    onGive(item, r.to);
  };
  return (
    <div className={styles.giveBoard} aria-label="Warriors and the stash">
      {item && <p className={styles.giveHint} role="status"><strong>{item.name}</strong> from {item.owner}{item.pieces > 1 ? ` · ${item.pieces} pieces` : ''} – no gold changes hands{item.goods.rare ? '; the price paid goes with it' : ''}. Click “Give here” or drop it on a card.</p>}
      {!item && <p className={`${styles.giveHint} ${ui.muted}`}>Pick an item, or drag it onto a warrior.</p>}
      {cards.map((c) => {
        const r = to.find((x) => x.to === c.holder);
        const mine = item?.from === c.holder;
        return (
          <article key={String(c.holder)} aria-label={c.name} className={`${styles.giveCard} ${over === String(c.holder) ? styles.giveOver : ''} ${item && !mine && r && !r.ok ? styles.giveNo : ''}`}
            onDragOver={(e) => { if (item && r?.ok) { e.preventDefault(); setOver(String(c.holder)); } }}
            onDragLeave={() => setOver((o) => (o === String(c.holder) ? null : o))}
            onDrop={(e) => { e.preventDefault(); give(r); }}>
            <header>
              <h3>{c.name}{c.men > 1 && <small> ×{c.men}</small>}</h3>
              {c.type && c.type !== c.name && <small className={ui.muted}>{c.type}</small>}
            </header>
            {c.stats.length > 0 && (
              <dl className={styles.giveStats} aria-label="Profile">
                {c.stats.map((st) => (<div key={st.key}><dt>{st.key}</dt><dd className={st.changed ? styles.changed : undefined}>{st.value}</dd></div>))}
                {c.save && <div><dt>Sv</dt><dd>{c.save}</dd></div>}
              </dl>
            )}
            {c.rules.length > 0 && <p className={styles.giveRules} title={c.rules.join(', ')}>{c.rules.join(' · ')}</p>}
            <div className={styles.giveChips} role="group" aria-label={`Held by ${c.name}`}>
              {c.items.length === 0 && <small className={ui.muted}>nothing</small>}
              {c.items.map((h) => (h.free
                ? <span key={keyOf(h)} className={styles.giveFree} title={`${h.text ? `${h.text} – ` : ''}The free dagger: it stays with ${c.name} and cannot be traded.`}>{h.name}{h.pieces > 1 ? ` ×${h.pieces}` : ''}</span>
                : <button key={keyOf(h)} type="button" draggable title={h.text || undefined} aria-pressed={keyOf(h) === picked}
                  onDragStart={(e) => { setPicked(keyOf(h)); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', h.name); }}
                  onDragEnd={() => setOver(null)}
                  onClick={() => setPicked(keyOf(h) === picked ? null : keyOf(h))}>
                  {h.name}{h.pieces > 1 ? ` ×${h.pieces}` : ''}
                </button>))}
            </div>
            {item && !mine && r && (
              <button type="button" className={styles.giveHere} disabled={!r.ok} onClick={() => give(r)} aria-label={`Give to ${c.name}`}>
                {r.ok ? 'Give here' : 'Cannot take it'}<small className={r.ok ? undefined : styles.no}>{r.note}</small>
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}

/** Sell on a wide screen: the same cards; an item is a button that opens the price sheet. */
export function SellBoard({ cards, onPick }: { cards: GiveCard[]; onPick: (h: Holding) => void }) {
  if (!cards.some((c) => c.items.some((h) => !h.free))) return <p className={ui.muted}>Nothing to sell.</p>;
  return (
    <div className={styles.giveBoard} aria-label="Warriors and the stash">
      <p className={`${styles.giveHint} ${ui.muted}`}>Pick an item to sell it. The free dagger stays with its warrior.</p>
      {cards.map((c) => (
        <CardShell key={String(c.holder)} c={c}>
          {c.items.map((h) => (h.free ? <FreeChip key={keyOf(h)} h={h} owner={c.name} />
            : (
              <button key={keyOf(h)} type="button" title={h.text || undefined} aria-label={`Sell ${h.name} of ${h.owner}`} onClick={() => onPick(h)}>
                {h.name}{h.pieces > 1 ? ` ×${h.pieces}` : ''}<small> · {h.unpriced ? 'you name the price' : gc(h.sell)}</small>
              </button>
            )))}
        </CardShell>
      ))}
    </div>
  );
}

/** Buy on a wide screen: what is on sale as chips, then the cards; a picked item says on each card what it costs there. */
export function BuyBoard({ cards, shop, recipientsFor, gold, onBuy }: { cards: GiveCard[]; shop: ShopItem[]; recipientsFor: (it: ShopItem) => Recipient[]; gold: number; onBuy: (it: ShopItem, to: core.Holder) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const item = shop.find((it) => it.key === picked) ?? null;
  const to = item ? recipientsFor(item) : [];
  const buy = (r: Recipient | undefined) => {
    if (!item || !r?.ok || r.cost > gold) return;
    setOver(null);
    onBuy(item, r.to);
  };
  return (
    <div className={styles.giveBoard} aria-label="Warriors and the stash">
      <div className={styles.giveChips} role="group" aria-label="For sale">
        {shop.map((it) => (
          <button key={it.key} type="button" draggable title={it.text || undefined} aria-pressed={it.key === picked}
            onDragStart={(e) => { setPicked(it.key); e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', it.name); }}
            onDragEnd={() => setOver(null)}
            onClick={() => setPicked(it.key === picked ? null : it.key)}>
            {it.name}<small> · {gc(it.price)}</small>
          </button>
        ))}
      </div>
      {item && <p className={styles.giveHint} role="status"><strong>{item.name}</strong> · {gc(item.price)} each – a group pays for every man.{item.unlisted ? ' Not in the price chart: the rules of the warband decide whether it can be bought now.' : ''} Click “Buy here” or drop it on a card.</p>}
      {!item && <p className={`${styles.giveHint} ${ui.muted}`}>Pick an item, or drag it onto a warrior.</p>}
      {cards.map((c) => {
        const r = to.find((x) => x.to === c.holder);
        return (
          <CardShell key={String(c.holder)} c={c} over={over === String(c.holder)} no={!!item && !!r && !r.ok}
            onDragOver={(e) => { if (item && r?.ok && r.cost <= gold) { e.preventDefault(); setOver(String(c.holder)); } }}
            onDragLeave={() => setOver((o) => (o === String(c.holder) ? null : o))}
            onDrop={(e) => { e.preventDefault(); buy(r); }}
            action={item && r && (
              <button type="button" className={styles.giveHere} disabled={!r.ok || r.cost > gold} onClick={() => buy(r)} aria-label={`Buy for ${c.name}`}>
                {!r.ok ? 'Cannot take it' : r.cost > gold ? 'Not enough gold' : 'Buy here'}<small className={r.ok && r.cost <= gold ? undefined : styles.no}>{r.ok ? `${gc(r.cost)} · ${r.note}` : r.note}</small>
              </button>
            )}>
            {c.items.map((h) => (h.free ? <FreeChip key={keyOf(h)} h={h} owner={c.name} /> : <span key={keyOf(h)} className={styles.giveHeld} title={h.text || undefined}>{h.name}{h.pieces > 1 ? ` ×${h.pieces}` : ''}</span>))}
          </CardShell>
        );
      })}
    </div>
  );
}

function FreeChip({ h, owner }: { h: Holding; owner: string }) {
  return <span className={styles.giveFree} title={`${h.text ? `${h.text} – ` : ''}The free dagger: it stays with ${owner} and cannot be traded.`}>{h.name}{h.pieces > 1 ? ` ×${h.pieces}` : ''}</span>;
}

/** A warrior's card for Buy and Sell: his profile and rules, then what he holds as the children. */
function CardShell({ c, children, action, over, no, onDragOver, onDragLeave, onDrop }: {
  c: GiveCard; children: ReactNode; action?: ReactNode; over?: boolean; no?: boolean;
  onDragOver?: DragEventHandler; onDragLeave?: DragEventHandler; onDrop?: DragEventHandler;
}) {
  return (
    <article aria-label={c.name} className={`${styles.giveCard} ${over ? styles.giveOver : ''} ${no ? styles.giveNo : ''}`} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <header>
        <h3>{c.name}{c.men > 1 && <small> ×{c.men}</small>}</h3>
        {c.type && c.type !== c.name && <small className={ui.muted}>{c.type}</small>}
      </header>
      {c.stats.length > 0 && (
        <dl className={styles.giveStats} aria-label="Profile">
          {c.stats.map((st) => (<div key={st.key}><dt>{st.key}</dt><dd className={st.changed ? styles.changed : undefined}>{st.value}</dd></div>))}
          {c.save && <div><dt>Sv</dt><dd>{c.save}</dd></div>}
        </dl>
      )}
      {c.rules.length > 0 && <p className={styles.giveRules} title={c.rules.join(', ')}>{c.rules.join(' · ')}</p>}
      <div className={styles.giveChips} role="group" aria-label={`Held by ${c.name}`}>
        {Array.isArray(children) && children.length === 0 ? <small className={ui.muted}>nothing</small> : children}
      </div>
      {action}
    </article>
  );
}
