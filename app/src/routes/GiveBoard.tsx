/* Give on a wide screen (wishes of Rob, 20.10.2026 and report #32): every warrior and the stash as a small card side by side in
   as many columns as fit – with his profile and rules, so one sees whom an item helps most – and what he holds as chips.
   Pick a chip (or start dragging it): each card says whether it may take the item and why not; click "Give here" or drop the
   chip on a card. A phone keeps the sheet (TradingPost.tsx). */
import type * as core from '@mordheim/core';
import { useState } from 'react';
import type { GiveCard, Holding, Recipient } from '../roster/equipment.ts';
import styles from '../roster/Trade.module.css';
import ui from '../ui/ui.module.css';

const keyOf = (h: Holding) => `${String(h.from)}:${h.goods.rare ? 'r' : h.free ? 'f' : 'c'}:${h.goods.key}`;

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
