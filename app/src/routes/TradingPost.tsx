/* The Trading Post (phase 3b, mockup docs/mockups/trading-post.html): from
   the warband's first battle on, equipment changes only here – buying
   common items, searching for rare ones, selling at half price, giving
   between warriors and the stash – and every gold piece is booked in the
   ledger (V4–V7, docs/behaviour-changes.md). Before the first battle the
   warband buys from its lists (⋯ → Equipment on a warrior's card). */
import * as core from '@mordheim/core';
import { Suspense, useId, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useAftermathBack } from '../aftermath/back.ts';
import { useSideNav } from '../app/navChildren.ts';
import { type StoredWarband } from '../db/db.ts';
import { useGameData } from '../game/useGameData.ts';
import {
  buyRecipients, giveCards, giveRecipients, holdings, KINDS, ledgerLines, rareItems, searchers, shopItems, stashPaid,
  type Holding, type Kind, type ShopItem,
} from '../roster/equipment.ts';
import { filterRare, sortRare, type SortOrder, type StatFilter } from '../roster/rareFilter.ts';
import { RareLine } from './RareLine.tsx';
import { useEditor } from '../roster/useEditor.ts';
import styles from '../roster/Trade.module.css';
import ui from '../ui/ui.module.css';
import { Pick, RareMask, SearchForm, gc, signed } from './SearchForm.tsx';
import { UndoToast } from '../ui/UndoToast.tsx';
import { useSheet } from '../ui/useSheet.ts';
import { useWarbandRecord } from '../sync/local.ts';
import { BuyBoard, GiveBoard, SellBoard } from './GiveBoard.tsx';
import { HoldingList } from './HoldingList.tsx';

const TABS = [['buy', 'Buy'], ['search', 'Search rare'], ['sell', 'Sell'], ['give', 'Give']] as const;
/** Rare items listed before "Show all". */
const SHORT = 12;
type Tab = (typeof TABS)[number][0];

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className={styles.seg} role="group" aria-label={label}>
      {options.map(([v, l]) => <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>{l}</button>)}
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
      <div className={ui.actions}>
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
        <button type="button" className={ui.button} disabled={cost > gold} onClick={() => close(() => onBuy(to, qty, cost))}>
          {cost > gold ? `Not enough gold (${gc(cost)})` : `Buy · ${gc(cost)}`}
        </button>
      </div>
    </div>
  );
}

/* ---- sell and give ---- */

function SellForm({ h, close, onSell, onUsed, titleId }: { h: Holding; close: SheetApi['close']; onSell: (price: number) => void; onUsed: () => void; titleId: string }) {
  const [v, setV] = useState(h.unpriced ? '' : String(h.sell));
  const n = Number(v);
  return (
    <div className={ui.page}>
      <div>
        <h2 id={titleId}>Sell {h.name}</h2>
        <p className={ui.muted}>{h.owner}{h.pieces > 1 ? ` · ${h.pieces} pieces, sold together` : ''}</p>
      </div>
      <div className={styles.result}>
        {h.unpriced
          ? <p>Not in the price chart, so there is no price to halve. Enter what you got for it.</p>
          : <><p>Half the price that applies now{h.goods.rare ? ' (a dice price counts its base)' : ''}, rounded down, at least 1 gc: <b>{gc(h.sell)}</b></p>
            <p className={ui.muted}>Haggle, the Merchant's Trade or a district may change it: enter what you got.</p></>}
      </div>
      <label className={ui.field}><span>Gold received</span>
        <input className={ui.input} inputMode="numeric" value={v} maxLength={4} onChange={(e) => setV(e.target.value.replace(/\D/g, ''))} />
      </label>
      <div className={ui.actions}>
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
        {h.consumable && <button type="button" className={ui.buttonQuiet} onClick={() => close(onUsed)}>Used up</button>}
        <button type="button" className={ui.button} disabled={v === '' || !(n >= 0)} onClick={() => close(() => onSell(n))}>Sell · {gc(Number.isFinite(n) ? n : 0)}</button>
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
      <div className={ui.actions}>
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
        <button type="button" className={ui.button} disabled={to == null} onClick={() => close(() => onGive(to!))}>Give</button>
      </div>
    </div>
  );
}

function Locked({ ed, ctx }: { ed: ReturnType<typeof useEditor>; ctx: core.Ctx }) {
  const location = useLocation();
  const navigate = useNavigate();
  const tab: Tab = (TABS.find(([t]) => `#${t}` === location.hash)?.[0]) ?? 'buy';
  const setTab = (t: Tab) => { void navigate({ hash: t === 'buy' ? '' : t }, { replace: true }); };
  // a planner has no gold to run out of (#89)
  const planner = ctx.s.planner === true;
  const gold = planner ? Infinity : core.goldCurrent(ctx);
  const [kind, setKind] = useState<Kind>('all');
  const [usable, setUsable] = useState(true);
  const [all, setAll] = useState(false);
  const shop = useMemo(() => shopItems(ctx), [ctx]);
  const rare = useMemo(() => rareItems(ctx, true), [ctx]);
  // a Hero looks for what the catalogue does not keep for other warbands only
  const searchable = useMemo(() => rareItems(ctx), [ctx]);
  const held = useMemo(() => holdings(ctx), [ctx]);
  const heroes = searchers(ctx);
  // from tablet width on, Give is two columns to pick from; a phone keeps the list and the sheet
  const wide = useSideNav();
  const [q, setQ] = useState('');
  const [stat, setStat] = useState<StatFilter | ''>('');
  const [max, setMax] = useState<number | null>(null);
  const [sort, setSort] = useState<SortOrder>('name');
  const [from, setFrom] = useState('');
  const [grade, setGrade] = useState('');
  const pool = rare.filter((it) => (kind === 'all' || it.kind === kind) && (!usable || it.usable));
  const findable = sortRare(filterRare(pool, { q, stat, maxRarity: max, from, grade }), sort);

  const { ref: buyRef, open: openBuy, close: closeBuy } = useSheet('buy');
  const [buying, setBuying] = useState<{ key: number; item: ShopItem } | null>(null);
  const { ref: searchRef, open: openSearch, close: closeSearch } = useSheet('search');
  const [seeking, setSeeking] = useState<{ key: number; uid: number | null; de: string | null } | null>(null);
  const { ref: sellRef, open: openSell, close: closeSell } = useSheet('sell');
  const [selling, setSelling] = useState<{ key: number; h: Holding } | null>(null);
  const { ref: giveRef, open: openGive, close: closeGive } = useSheet('give');
  const [giving, setGiving] = useState<{ key: number; h: Holding } | null>(null);
  const ids = { buy: useId(), search: useId(), sell: useId(), give: useId() };
  const rareName = (de: string) => rare.find((x) => x.de === de)?.name ?? de;

  const stashItems = ctx.s.stash?.items ?? [];
  const lines = ledgerLines(ctx.s);
  return (
    <>
      <dl className={styles.figures}>
        <div><dt>{planner ? 'Value' : 'Gold in hand'}</dt><dd>{planner ? gc(core.plannerValue(ctx)) : gc(gold)}</dd></div>
        <div><dt>Stash</dt><dd>{stashItems.reduce((n, it) => n + (Number(it.qty) || 0), 0)} items</dd></div>
        <div><dt>Stage</dt><dd>{planner ? 'Planner' : core.roundLabel(ctx.s.campaign?.round)}</dd></div>
      </dl>
      <Seg label="What to do" value={tab} options={TABS} onChange={setTab} />

      {tab === 'buy' && (
        <section className={ui.page} aria-label="Buy common items">
          <p className={ui.muted}>Common items, as many as you like, at the price that applies now. A group buys one for every man.</p>
          <Seg label="Kind" value={kind} options={KINDS} onChange={setKind} />
          {wide
            ? <BuyBoard cards={giveCards(ctx)} shop={shop.filter((it) => kind === 'all' || it.kind === kind)} gold={gold} recipientsFor={(it) => buyRecipients(ctx, it.key, it.price)}
              onBuy={(it, to) => ed.edit((c) => core.buyItem(c, to, it.key, { qty: 1 }).state, `Bought ${it.name}${to === 'stash' ? ' for the stash' : ''}.`)} />
            : [false, true].map((unlisted) => {
            const list = shop.filter((it) => it.unlisted === unlisted && (kind === 'all' || it.kind === kind));
            if (!list.length) return null;
            return (
              <div key={String(unlisted)} className={ui.page}>
                {unlisted && <p className={ui.muted}>Not in the price chart – mounts, kits and items of this warband's own. Whether they can be bought now, the rules of the warband decide.</p>}
                <ul className={styles.rows} aria-label={unlisted ? 'Not in the price chart' : 'Common items'}>
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
          <p className={ui.muted}>Each Hero may look for one rare item after a battle: 2D6 equal to or above its rarity, less his modifiers. Heroes taken out of action in the last battle stay home.</p>
          <div className={ui.row}>
            <button type="button" className={ui.button} disabled={!heroes.some((h) => !h.why)} onClick={() => { setSeeking((p) => ({ key: (p?.key ?? 0) + 1, uid: null, de: null })); openSearch(); }}>Search for a rare item</button>
          </div>
          <ul className={styles.rows}>
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
          <RareMask q={q} stat={stat} max={max} sort={sort} from={from} grade={grade} items={rare} onQ={setQ} onStat={setStat} onMax={setMax} onSort={setSort} onFrom={setFrom} onGrade={setGrade} shown={findable.length} total={pool.length} />
          <ul className={styles.rows}>
            {findable.slice(0, all ? undefined : SHORT).map((it) => (
              <li key={it.de}>
                <button type="button" className={`${styles.item} ${styles.rareRow}`} title={it.text || undefined} disabled={!heroes.some((h) => !h.why)}
                  onClick={() => { setSeeking((p) => ({ key: (p?.key ?? 0) + 1, uid: null, de: it.de })); openSearch(); }}>
                  <RareLine it={it} />
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
          {wide
            ? <SellBoard cards={giveCards(ctx)} onPick={(h) => { setSelling((p) => ({ key: (p?.key ?? 0) + 1, h })); openSell(); }} />
            : <HoldingList list={held} label="Sell" action={(h) => (h.unpriced ? 'you name the price' : `sells for ${gc(h.sell)}`)} onPick={(h) => { setSelling((p) => ({ key: (p?.key ?? 0) + 1, h })); openSell(); }} />}
        </section>
      )}

      {tab === 'give' && (
        <section className={ui.page} aria-label="Give items">
          <p className={ui.muted}>Move an item between warriors and the stash, without gold. Only those who may use it can take it; a group takes one for every man.</p>
          {wide
            ? <GiveBoard cards={giveCards(ctx)} recipientsFor={(h) => giveRecipients(ctx, h)} onGive={(h, to) => ed.edit((c) => core.giveItem(c, h.from, to, h.goods).state, `${h.name} given.`)} />
            : <HoldingList list={held} label="Give" action={() => 'give'} onPick={(h) => { setGiving((p) => ({ key: (p?.key ?? 0) + 1, h })); openGive(); }} />}
        </section>
      )}

      <section className={ui.page} aria-labelledby="stash-h">
        <h2 id="stash-h">Stash</h2>
        {stashItems.length ? (
          <ul className={styles.stash}>
            {stashItems.map((it, i) => <li key={i}><span>{it.name}{it.qty > 1 && <span className={ui.muted}> ×{it.qty}</span>}</span><small>{stashPaid(it.paid)}</small></li>)}
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
        {seeking && <SearchForm key={seeking.key} ctx={ctx} start={seeking} items={searchable} gold={gold} close={closeSearch} titleId={ids.search}
          onFound={(uid, de, paid, to) => ed.edit((c) => core.recordSearch(c, uid, de, { found: true, paid, to }).state, `Found ${rareName(de)} (−${paid} gc).`)}
          onMissed={(uid, de) => ed.edit((c) => core.recordSearch(c, uid, de, { found: false }).state, `${rareName(de)}: not found this time.`)} />}
      </dialog>
      <dialog ref={sellRef} className={ui.sheet} aria-labelledby={ids.sell}>
        {selling && <SellForm key={selling.key} h={selling.h} close={closeSell} titleId={ids.sell}
          onSell={(price) => ed.edit((c) => core.sellItem(c, selling.h.from, selling.h.goods, { price, qty: selling.h.pieces }).state, `Sold ${selling.h.name} (+${price} gc).`)}
          onUsed={() => ed.edit((c) => core.sellItem(c, selling.h.from, selling.h.goods, { price: 0, qty: selling.h.pieces }).state, `${selling.h.name} used up.`)} />}
      </dialog>
      <dialog ref={giveRef} className={ui.sheet} aria-labelledby={ids.give}>
        {giving && <GiveForm key={giving.key} ctx={ctx} h={giving.h} close={closeGive} titleId={ids.give}
          onGive={(to) => ed.edit((c) => core.giveItem(c, giving.h.from, to, giving.h.goods).state, `${giving.h.name} given.`)} />}
      </dialog>
    </>
  );
}

/* ---- look around before the first battle (wish of 6.11.2026) ---- */

/** What the Trading Post will offer from the first battle on, to look at: the common items with their prices and the rare ones with rarity, chance
    and price, filtered as in the search – and nothing to buy, search or sell. */
function Browse({ ctx }: { ctx: core.Ctx }) {
  const [what, setWhat] = useState<'rare' | 'common'>('rare');
  const [kind, setKind] = useState<Kind>('all');
  const [usable, setUsable] = useState(true);
  const [all, setAll] = useState(false);
  const shop = useMemo(() => shopItems(ctx), [ctx]);
  const rare = useMemo(() => rareItems(ctx, true), [ctx]);
  const [q, setQ] = useState('');
  const [stat, setStat] = useState<StatFilter | ''>('');
  const [max, setMax] = useState<number | null>(null);
  const [sort, setSort] = useState<SortOrder>('name');
  const [from, setFrom] = useState('');
  const [grade, setGrade] = useState('');
  const pool = rare.filter((it) => (kind === 'all' || it.kind === kind) && (!usable || it.usable));
  const findable = sortRare(filterRare(pool, { q, stat, maxRarity: max, from, grade }), sort);
  const common = shop.filter((it) => kind === 'all' || it.kind === kind);
  return (
    <section className={ui.group} aria-label="Look at the Trading Post">
      <h2 className={ui.groupTitle}>Look at the Trading Post</h2>
      <p className={ui.muted}>What it offers from the first battle on – to look at; nothing can be bought, searched for or sold before then.</p>
      <Seg label="What to look at" value={what} options={[['rare', 'Rare items'], ['common', 'Common items']] as const} onChange={setWhat} />
      <Seg label="Kind" value={kind} options={KINDS} onChange={setKind} />
      {what === 'common' ? (
        <ul className={styles.rows} aria-label="Common items">
          {common.map((it) => <li key={it.key} className={styles.item} title={it.text || undefined}><span>{it.name}</span><small>{gc(it.price)}</small></li>)}
        </ul>
      ) : (
        <>
          <label className={styles.check}><input type="checkbox" checked={usable} onChange={(e) => setUsable(e.target.checked)} /> Only what someone here may use</label>
          <RareMask q={q} stat={stat} max={max} sort={sort} from={from} grade={grade} items={rare} onQ={setQ} onStat={setStat} onMax={setMax} onSort={setSort} onFrom={setFrom} onGrade={setGrade} shown={findable.length} total={pool.length} />
          <ul className={styles.rows} aria-label="Rare items">
            {findable.slice(0, all ? undefined : SHORT).map((it) => <li key={it.de} className={`${styles.item} ${styles.rareRow}`} title={it.text || undefined}><RareLine it={it} /></li>)}
          </ul>
          {!all && findable.length > SHORT && <button type="button" className={ui.buttonQuiet} onClick={() => setAll(true)}>Show all {findable.length}</button>}
        </>
      )}
    </section>
  );
}

function Body({ rec }: { rec: StoredWarband }) {
  const data = useGameData();
  const ed = useEditor(data, rec);
  const ctx = useMemo(() => core.ctxOf(data, ed.state), [data, ed.state]);
  const locked = core.tradeLocked(ctx);
  const name = ed.state.name || data.WARBANDS[ed.state.wb as string]?.name || 'Warband';
  const back = useAftermathBack(rec.id);
  return (
    <section className={ui.page}>
      <div>
        <Link to={back?.to ?? `/warbands/${rec.id}`} className={styles.back}>{back?.label ?? `‹ ${name}`}</Link>
        <h1>Trading Post</h1>
      </div>
      {locked ? <Locked ed={ed} ctx={ctx} /> : (
        <div className={ui.card}>
          {ctx.s.planner === true && <p>A planner trades once its Trading Post is opened: under the warband’s menu, <strong>Trading Post</strong>. Then rare items can be had too.</p>}
          <p>Until its first battle the warband buys from its lists, rare items of the list included, at the list price; taking an item back returns its price.</p>
          <p className={ui.muted}>On a warrior's card: ⋯ → Equipment. From the first battle on, common items are bought here, rare items only when a Hero finds them, and selling brings half the price (rulebook p. 46 and 104; Rob, 29.09.2026).</p>
          <p><Link to={`/warbands/${rec.id}`} className={ui.buttonQuiet}>Back to the roster</Link></p>
        </div>
      )}
      {!locked && <Browse ctx={ctx} />}
      {ed.notice && <UndoToast key={ed.notice.id} text={ed.notice.text} onUndo={ed.undo} onDone={ed.dismiss} />}
    </section>
  );
}

export function TradingPost() {
  const { id = '' } = useParams();
  const rec = useWarbandRecord(id);
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
