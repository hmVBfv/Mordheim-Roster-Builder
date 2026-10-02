/* The Trading Post (phase 3b, mockup docs/mockups/trading-post.html): from
   the warband's first battle on, equipment changes only here – buying
   common items, searching for rare ones, selling at half price, giving
   between warriors and the stash – and every gold piece is booked in the
   ledger (V4–V7, docs/behaviour-changes.md). Before the first battle the
   warband buys from its lists (⋯ → Equipment on a warrior's card). */
import * as core from '@mordheim/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { Suspense, useId, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { db, type StoredWarband } from '../db/db.ts';
import { useGameData } from '../game/useGameData.ts';
import {
  buyRecipients, giveRecipients, holdings, KINDS, ledgerLines, rareItems, searchers, shopItems,
  type Holding, type Kind, type RareItem, type Recipient, type ShopItem,
} from '../roster/equipment.ts';
import { useEditor } from '../roster/useEditor.ts';
import styles from '../roster/Trade.module.css';
import ui from '../ui/ui.module.css';
import { UndoToast } from '../ui/UndoToast.tsx';
import { useSheet } from '../ui/useSheet.ts';

const TABS = [['buy', 'Buy'], ['search', 'Search rare'], ['sell', 'Sell'], ['give', 'Give']] as const;
/** Rare items listed before "Show all". */
const SHORT = 12;
type Tab = (typeof TABS)[number][0];

const gc = (n: number) => `${n} gc`;
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className={styles.seg} role="group" aria-label={label}>
      {options.map(([v, l]) => <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

/** A list of choices, one pressed: who gets the item. */
function Pick({ label, items, value, onChange }: { label: string; items: Recipient[]; value: core.Holder | null; onChange: (v: core.Holder) => void }) {
  return (
    <div className={styles.pick} role="group" aria-label={label}>
      {items.map((r) => (
        <button key={String(r.to)} type="button" disabled={!r.ok} aria-pressed={r.to === value} onClick={() => onChange(r.to)}>
          {r.name}<small className={r.ok ? undefined : styles.no}>{r.note}</small>
        </button>
      ))}
    </div>
  );
}

type SheetApi = ReturnType<typeof useSheet>;

/* ---- buy ---- */

function BuyForm({ ctx, item, gold, close, onBuy, titleId }: { ctx: core.Ctx; item: ShopItem; gold: number; close: SheetApi['close']; onBuy: (to: core.Holder, qty: number, cost: number) => void; titleId: string }) {
  const rec = buyRecipients(ctx, item.key, item.price);
  const [to, setTo] = useState<core.Holder>('stash');
  const [qty, setQty] = useState(1);
  const r = rec.find((x) => x.to === to)!;
  const cost = to === 'stash' ? item.price * qty : r.cost;
  return (
    <div className={ui.page}>
      <div>
        <h2 id={titleId}>{item.name}</h2>
        <p className={ui.muted}>{item.unlisted ? 'Not in the price chart' : 'Common'} · {gc(item.price)}</p>
        {item.text && <p className={styles.text}>{item.text}</p>}
      </div>
      <Pick label="For whom" items={rec} value={to} onChange={setTo} />
      {to === 'stash' && (
        <div className={styles.between}>
          <span>How many</span>
          <span className={styles.stepper}>
            <button type="button" aria-label="One less" disabled={qty <= 1} onClick={() => setQty(qty - 1)}>−</button>
            <span aria-live="polite">{qty}</span>
            <button type="button" aria-label="One more" disabled={qty >= 9} onClick={() => setQty(qty + 1)}>+</button>
          </span>
        </div>
      )}
      <div className={ui.row}>
        <button type="button" className={ui.button} disabled={cost > gold} onClick={() => close(() => onBuy(to, qty, cost))}>
          {cost > gold ? `Not enough gold (${gc(cost)})` : `Buy · ${gc(cost)}`}
        </button>
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
      </div>
    </div>
  );
}

/* ---- search ---- */

function SearchForm({ ctx, start, items, gold, close, onFound, onMissed, titleId }: {
  ctx: core.Ctx; start: { uid: number | null; de: string | null }; items: RareItem[]; gold: number; close: SheetApi['close'];
  onFound: (uid: number, de: string, paid: number, to: core.Holder) => void; onMissed: (uid: number, de: string) => void; titleId: string;
}) {
  const who = searchers(ctx).filter((s) => !s.why);
  const [uid, setUid] = useState<number | null>(start.uid ?? who[0]?.uid ?? null);
  const [de, setDe] = useState<string | null>(start.de);
  const [q, setQ] = useState('');
  const [extra, setExtra] = useState('');
  const [roll, setRoll] = useState('');
  const [price, setPrice] = useState('');
  const [to, setTo] = useState<core.Holder>('stash');
  const it = items.find((x) => x.de === de) ?? null;
  const odds = uid != null && de ? core.searchOdds(ctx, uid, de, Number(extra) || 0) : null;
  const r = Number(roll);
  const rolled = Number.isInteger(r) && r >= 2 && r <= 12;
  const found = !!odds && rolled && r >= odds.target;
  const paid = it?.fixed != null && price === '' ? it.fixed : Number(price);
  const priceOk = Number.isFinite(paid) && paid >= 0 && (it?.fixed != null || price !== '');
  const dest: Recipient[] = de ? [
    { to: 'stash', name: 'Stash', ok: true, note: 'after the battle, found items go to the stash', cost: 0 },
    ...ctx.s.models.filter((m) => core.piecesNeeded(ctx, m.uid) === 1).map((m) => {
      const v = core.canReceive(ctx, m.uid, { key: de, rare: true });
      return { to: m.uid, name: m.name || core.unitDef(ctx, m.uid_def)?.name || m.uid_def, ok: v.ok, note: v.ok ? 'may use it' : v.reason, cost: 0 };
    }),
  ] : [];
  const shown = items.filter((x) => x.de === de || !q.trim() || x.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 60);
  return (
    <div className={ui.page}>
      <h2 id={titleId}>{uid != null ? `${who.find((w) => w.uid === uid)?.name ?? 'A Hero'} searches` : 'Search for a rare item'}</h2>
      {who.length > 1 && (
        <label className={ui.field}><span>Who searches</span>
          <select className={ui.select} value={uid ?? ''} onChange={(e) => setUid(Number(e.target.value))}>
            {who.map((w) => <option key={w.uid} value={w.uid}>{w.name}</option>)}
          </select>
        </label>
      )}
      <label className={ui.field}><span>Item</span>
        <input className={ui.input} type="search" value={q} placeholder="Find an item" autoComplete="off" onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className={`${styles.pick} ${styles.scroll}`} role="group" aria-label="Rare items">
        {shown.map((x) => (
          <button key={x.de} type="button" aria-pressed={x.de === de} onClick={() => setDe(x.de)}>
            {x.name}<small>Rare {x.rarity} · {x.price}{x.usable ? '' : ' · nobody here may use it'}</small>
          </button>
        ))}
      </div>
      {it && odds && (
        <div className={styles.result}>
          <p><b>{it.name}</b> — needs <b>{odds.target}+</b> on 2D6 ({Math.round(odds.chance * 100)} %)</p>
          {it.text && <p className={styles.text}>{it.text}</p>}
          <p className={ui.muted}>Rare {odds.rarity}{odds.modifiers.map((m) => `; ${m.label} ${signed(m.value)}`).join('')}{Number(extra) ? `; other ${signed(Number(extra))}` : ''}.</p>
        </div>
      )}
      <label className={ui.field}><span>Other modifiers (a skill, a Hired Sword, the Merchant's reputation …)</span>
        <input className={ui.input} inputMode="numeric" value={extra} placeholder="0" maxLength={3} onChange={(e) => setExtra(e.target.value.replace(/[^\d-]/g, ''))} />
      </label>
      <label className={ui.field}><span>2D6 as rolled</span>
        <input className={ui.input} inputMode="numeric" value={roll} maxLength={2} autoComplete="off" onChange={(e) => setRoll(e.target.value.replace(/\D/g, ''))} />
      </label>
      <p className={`${styles.verdict} ${rolled ? (found ? styles.found : styles.missed) : ''}`} aria-live="polite">
        {!it ? 'Choose the item he looks for.' : !rolled ? 'Enter the roll (2 to 12).' : found ? `${r} — found. The merchant has one.` : `${r} — not found this time.`}
      </p>
      {found && (
        <>
          <label className={ui.field}><span>{it?.fixed != null ? `Price (${gc(it.fixed)}; Haggle may lower it)` : `Price as asked (${it?.price})`}</span>
            <input className={ui.input} inputMode="numeric" value={price} placeholder={it?.fixed != null ? String(it.fixed) : ''} maxLength={4} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} />
          </label>
          <Pick label="Goes to" items={dest} value={to} onChange={setTo} />
        </>
      )}
      <div className={ui.row}>
        <button type="button" className={ui.button} disabled={!found || !priceOk || paid > gold || uid == null}
          onClick={() => close(() => onFound(uid!, de!, paid, to))}>{found && priceOk ? (paid > gold ? 'Not enough gold' : `Buy · ${gc(paid)}`) : 'Buy'}</button>
        <button type="button" className={ui.buttonQuiet} disabled={!it || uid == null} onClick={() => close(() => onMissed(uid!, de!))}>Not found</button>
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
      </div>
    </div>
  );
}

/* ---- sell and give ---- */

function SellForm({ h, close, onSell, titleId }: { h: Holding; close: SheetApi['close']; onSell: (price: number) => void; titleId: string }) {
  const [v, setV] = useState(String(h.sell));
  const n = Number(v);
  return (
    <div className={ui.page}>
      <div>
        <h2 id={titleId}>Sell {h.name}</h2>
        <p className={ui.muted}>{h.owner}{h.pieces > 1 ? ` · ${h.pieces} pieces, sold together` : ''}</p>
      </div>
      <div className={styles.result}>
        <p>Half the price that applies now{h.goods.rare ? ' (a dice price counts its base)' : ''}, rounded down, at least 1 gc: <b>{gc(h.sell)}</b></p>
        <p className={ui.muted}>Haggle, the Merchant's Trade or a district may change it: enter what you got.</p>
      </div>
      <label className={ui.field}><span>Gold received</span>
        <input className={ui.input} inputMode="numeric" value={v} maxLength={4} onChange={(e) => setV(e.target.value.replace(/\D/g, ''))} />
      </label>
      <div className={ui.row}>
        <button type="button" className={ui.button} disabled={v === '' || !(n >= 0)} onClick={() => close(() => onSell(n))}>Sell · {gc(Number.isFinite(n) ? n : 0)}</button>
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
      </div>
    </div>
  );
}

function GiveForm({ ctx, h, close, onGive, titleId }: { ctx: core.Ctx; h: Holding; close: SheetApi['close']; onGive: (to: core.Holder) => void; titleId: string }) {
  const rec = giveRecipients(ctx, h);
  const [to, setTo] = useState<core.Holder | null>(rec.find((r) => r.ok)?.to ?? null);
  return (
    <div className={ui.page}>
      <div>
        <h2 id={titleId}>Give {h.name}</h2>
        <p className={ui.muted}>From {h.owner}{h.pieces > 1 ? ` · ${h.pieces} pieces` : ''}. No gold changes hands{h.goods.rare ? '; the price paid goes with it' : ''}.</p>
      </div>
      <Pick label="To" items={rec} value={to} onChange={setTo} />
      <div className={ui.row}>
        <button type="button" className={ui.button} disabled={to == null} onClick={() => close(() => onGive(to!))}>Give</button>
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
      </div>
    </div>
  );
}

function HoldingList({ list, label, action, onPick }: { list: Holding[]; label: string; action: (h: Holding) => string; onPick: (h: Holding) => void }) {
  if (!list.length) return <p className={ui.muted}>Nothing to {label.toLowerCase()}.</p>;
  return (
    <ul className={ui.list}>
      {list.map((h) => (
        <li key={`${h.from}:${h.goods.rare ? 'r' : 'c'}:${h.goods.key}`}>
          <button type="button" className={styles.item} title={h.text || undefined} onClick={() => onPick(h)} aria-label={`${label} ${h.name} of ${h.owner}`}>
            <span>{h.name}{h.pieces > 1 && <span className={ui.muted}> ×{h.pieces}</span>}</span>
            <small>{h.owner} · {action(h)}</small>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Locked({ ed, ctx }: { ed: ReturnType<typeof useEditor>; ctx: core.Ctx }) {
  const location = useLocation();
  const navigate = useNavigate();
  const tab: Tab = (TABS.find(([t]) => `#${t}` === location.hash)?.[0]) ?? 'buy';
  const setTab = (t: Tab) => { void navigate({ hash: t === 'buy' ? '' : t }, { replace: true }); };
  const gold = core.goldCurrent(ctx);
  const [kind, setKind] = useState<Kind>('all');
  const [usable, setUsable] = useState(true);
  const [all, setAll] = useState(false);
  const shop = useMemo(() => shopItems(ctx), [ctx]);
  const rare = useMemo(() => rareItems(ctx), [ctx]);
  const held = useMemo(() => holdings(ctx), [ctx]);
  const heroes = searchers(ctx);
  const findable = rare.filter((it) => (kind === 'all' || it.kind === kind) && (!usable || it.usable));

  const { ref: buyRef, open: openBuy, close: closeBuy } = useSheet();
  const [buying, setBuying] = useState<{ key: number; item: ShopItem } | null>(null);
  const { ref: searchRef, open: openSearch, close: closeSearch } = useSheet();
  const [seeking, setSeeking] = useState<{ key: number; uid: number | null; de: string | null } | null>(null);
  const { ref: sellRef, open: openSell, close: closeSell } = useSheet();
  const [selling, setSelling] = useState<{ key: number; h: Holding } | null>(null);
  const { ref: giveRef, open: openGive, close: closeGive } = useSheet();
  const [giving, setGiving] = useState<{ key: number; h: Holding } | null>(null);
  const ids = { buy: useId(), search: useId(), sell: useId(), give: useId() };
  const rareName = (de: string) => rare.find((x) => x.de === de)?.name ?? de;

  const stashItems = ctx.s.stash?.items ?? [];
  const lines = ledgerLines(ctx.s);
  return (
    <>
      <dl className={styles.figures}>
        <div><dt>Gold in hand</dt><dd>{gc(gold)}</dd></div>
        <div><dt>Stash</dt><dd>{stashItems.reduce((n, it) => n + (Number(it.qty) || 0), 0)} items</dd></div>
        <div><dt>Stage</dt><dd>{core.roundLabel(ctx.s.campaign?.round)}</dd></div>
      </dl>
      <Seg label="What to do" value={tab} options={TABS} onChange={setTab} />

      {tab === 'buy' && (
        <section className={ui.page} aria-label="Buy common items">
          <p className={ui.muted}>Common items, as many as you like, at the price that applies now. A group buys one for every man.</p>
          <Seg label="Kind" value={kind} options={KINDS} onChange={setKind} />
          {[false, true].map((unlisted) => {
            const list = shop.filter((it) => it.unlisted === unlisted && (kind === 'all' || it.kind === kind));
            if (!list.length) return null;
            return (
              <div key={String(unlisted)} className={ui.page}>
                {unlisted && <p className={ui.muted}>Not in the price chart – mounts, kits and items of this warband's own. Whether they can be bought now, the rules of the warband decide.</p>}
                <ul className={ui.list} aria-label={unlisted ? 'Not in the price chart' : 'Common items'}>
                  {list.map((it) => (
                    <li key={it.key}>
                      <button type="button" className={styles.item} title={it.text || undefined}
                        onClick={() => { setBuying((p) => ({ key: (p?.key ?? 0) + 1, item: it })); openBuy(); }}>
                        <span>{it.name}</span><small>{gc(it.price)}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      {tab === 'search' && (
        <section className={ui.page} aria-label="Search for rare items">
          <p className={ui.muted}>Each Hero may look for one rare item after a battle: 2D6 equal to or above its rarity, less his modifiers. Heroes taken out of action in the last battle stay home – the app cannot tell yet.</p>
          <ul className={ui.list}>
            {heroes.map((h) => (
              <li key={h.uid} className={styles.searcher}>
                <span>{h.name}<small className={h.why ? styles.no : undefined}>{h.last ?? h.why ?? 'may look for one rare item'}</small></span>
                <button type="button" className={ui.buttonQuiet} disabled={!!h.why}
                  onClick={() => { setSeeking((p) => ({ key: (p?.key ?? 0) + 1, uid: h.uid, de: null })); openSearch(); }}>Search</button>
              </li>
            ))}
          </ul>
          <div className={styles.between}>
            <h2>What can be found</h2>
            <label className={styles.check}><input type="checkbox" checked={usable} onChange={(e) => setUsable(e.target.checked)} /> Only what someone here may use</label>
          </div>
          <Seg label="Kind of rare item" value={kind} options={KINDS} onChange={setKind} />
          <ul className={ui.list}>
            {findable.slice(0, all ? undefined : SHORT).map((it) => (
              <li key={it.de}>
                <button type="button" className={styles.item} title={it.text || undefined} disabled={!heroes.some((h) => !h.why)}
                  onClick={() => { setSeeking((p) => ({ key: (p?.key ?? 0) + 1, uid: null, de: it.de })); openSearch(); }}>
                  <span>{it.name}</span><small>Rare {it.rarity} · {it.price} · {Math.round(core.chance2d6(it.rarity) * 100)} %</small>
                </button>
              </li>
            ))}
          </ul>
          {!all && findable.length > SHORT && <button type="button" className={ui.buttonQuiet} onClick={() => setAll(true)}>Show all {findable.length}</button>}
        </section>
      )}

      {tab === 'sell' && (
        <section className={ui.page} aria-label="Sell items">
          <p className={ui.muted}>Half the price that applies now, rounded down, at least 1 gc. A group sells all its pieces of an item together. The free dagger stays with its warrior.</p>
          <HoldingList list={held} label="Sell" action={(h) => `sells for ${gc(h.sell)}`} onPick={(h) => { setSelling((p) => ({ key: (p?.key ?? 0) + 1, h })); openSell(); }} />
        </section>
      )}

      {tab === 'give' && (
        <section className={ui.page} aria-label="Give items">
          <p className={ui.muted}>Move an item between warriors and the stash, without gold. Only those who may use it can take it; a group takes one for every man.</p>
          <HoldingList list={held} label="Give" action={() => 'give'} onPick={(h) => { setGiving((p) => ({ key: (p?.key ?? 0) + 1, h })); openGive(); }} />
        </section>
      )}

      <section className={ui.page} aria-labelledby="stash-h">
        <h2 id="stash-h">Stash</h2>
        {stashItems.length ? (
          <ul className={styles.stash}>
            {stashItems.map((it, i) => <li key={i}><span>{it.name}{it.qty > 1 && <span className={ui.muted}> ×{it.qty}</span>}</span><small>{it.paid != null ? `${gc(it.paid)} each` : ''}</small></li>)}
          </ul>
        ) : <p className={ui.muted}>Empty.</p>}
      </section>

      <section className={ui.page} aria-labelledby="ledger-h">
        <h2 id="ledger-h">Gold</h2>
        {lines.length ? (
          <ol className={styles.ledger} aria-label="Ledger">
            {lines.map((l) => (
              <li key={l.id}>
                <span className={l.amount > 0 ? styles.plus : l.amount < 0 ? styles.minus : styles.zero}>{signed(l.amount)}</span>
                <span>{l.text}<small>{l.when}</small></span>
              </li>
            ))}
          </ol>
        ) : <p className={ui.muted}>The ledger starts with the first trade after the first battle.</p>}
        <p className={ui.muted}>Every change of gold has a reason (V7).</p>
      </section>

      <dialog ref={buyRef} className={ui.sheet} aria-labelledby={ids.buy}>
        {buying && <BuyForm key={buying.key} ctx={ctx} item={buying.item} gold={gold} close={closeBuy} titleId={ids.buy}
          onBuy={(to, qty, cost) => ed.edit((c) => core.buyItem(c, to, buying.item.key, { qty }).state, `Bought ${buying.item.name}${to === 'stash' ? ' for the stash' : ''} (−${cost} gc).`)} />}
      </dialog>
      <dialog ref={searchRef} className={ui.sheet} aria-labelledby={ids.search}>
        {seeking && <SearchForm key={seeking.key} ctx={ctx} start={seeking} items={rare} gold={gold} close={closeSearch} titleId={ids.search}
          onFound={(uid, de, paid, to) => ed.edit((c) => core.recordSearch(c, uid, de, { found: true, paid, to }).state, `Found ${rareName(de)} (−${paid} gc).`)}
          onMissed={(uid, de) => ed.edit((c) => core.recordSearch(c, uid, de, { found: false }).state, `${rareName(de)}: not found this time.`)} />}
      </dialog>
      <dialog ref={sellRef} className={ui.sheet} aria-labelledby={ids.sell}>
        {selling && <SellForm key={selling.key} h={selling.h} close={closeSell} titleId={ids.sell}
          onSell={(price) => ed.edit((c) => core.sellItem(c, selling.h.from, selling.h.goods, { price, qty: selling.h.pieces }).state, `Sold ${selling.h.name} (+${price} gc).`)} />}
      </dialog>
      <dialog ref={giveRef} className={ui.sheet} aria-labelledby={ids.give}>
        {giving && <GiveForm key={giving.key} ctx={ctx} h={giving.h} close={closeGive} titleId={ids.give}
          onGive={(to) => ed.edit((c) => core.giveItem(c, giving.h.from, to, giving.h.goods).state, `${giving.h.name} given.`)} />}
      </dialog>
    </>
  );
}

function Body({ rec }: { rec: StoredWarband }) {
  const data = useGameData();
  const ed = useEditor(data, rec);
  const ctx = useMemo(() => core.ctxOf(data, ed.state), [data, ed.state]);
  const locked = core.tradeLocked(ctx);
  const name = ed.state.name || data.WARBANDS[ed.state.wb as string]?.name || 'Warband';
  return (
    <section className={ui.page}>
      <div>
        <Link to={`/warbands/${rec.id}`} className={styles.back}>‹ {name}</Link>
        <h1>Trading Post</h1>
      </div>
      {locked ? <Locked ed={ed} ctx={ctx} /> : (
        <div className={ui.card}>
          <p>Until its first battle the warband buys from its lists, rare items of the list included, at the list price; taking an item back returns its price.</p>
          <p className={ui.muted}>On a warrior's card: ⋯ → Equipment. From the first battle on, common items are bought here, rare items only when a Hero finds them, and selling brings half the price (rulebook p. 46 and 104; Rob, 29.09.2026).</p>
          <p><Link to={`/warbands/${rec.id}`} className={ui.buttonQuiet}>Back to the roster</Link></p>
        </div>
      )}
      {ed.notice && <UndoToast key={ed.notice.id} text={ed.notice.text} onUndo={ed.undo} onDone={ed.dismiss} />}
    </section>
  );
}

export function TradingPost() {
  const { id = '' } = useParams();
  const rec = useLiveQuery(async () => (await db.warbands.get(id)) ?? null, [id]);
  if (rec === undefined) return null;
  if (rec === null) {
    return (
      <section className={ui.page}>
        <h1>Not on this device</h1>
        <p><Link to="/warbands" className={ui.buttonQuiet}>All warbands</Link></p>
      </section>
    );
  }
  return (
    <Suspense fallback={<p className={ui.muted}>Loading the rules…</p>}>
      <Body rec={rec} />
    </Suspense>
  );
}
