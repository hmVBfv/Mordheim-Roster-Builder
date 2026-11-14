/* Steps 6 to 9 (N12): what has happened in this round so far, read from the save – rare items searched for, Dramatis Personae who may be
   found, what was hired and bought, the stash to hand out – and where to go to do it (with the way back). Nothing is decided here. */
import * as core from '@mordheim/core';
import { Link } from 'react-router';
import { RulesTable } from '../ui/RulesTable.tsx';
import ui from '../ui/ui.module.css';
import type { AftermathView } from './view.ts';

const gold = (n: number) => `${n > 0 ? '+' : ''}${n} gc`;
const roundBookings = (ctx: core.Ctx, round: number) => (ctx.s.ledger ?? []).filter((e) => (Number(e.round) || 0) === round);

/** 6 – Make rarity rolls and buy rare items: one line for each Hero – may he search, has he, what did he find. */
export function RareStep({ a, ctx, tradeLink }: { a: AftermathView; ctx: core.Ctx; tradeLink: string }) {
  const searches = roundBookings(ctx, a.round).filter((e) => e.kind === 'search');
  const heroes = ctx.s.models.filter((m) => core.isHeroModel(ctx, m));
  const name = (m: (typeof heroes)[number]) => core.modelLabel(ctx, m);
  const rows = heroes.map((m) => {
    const mine = searches.filter((e) => e.uid === m.uid);
    const block = core.searchBlock(ctx, m.uid);
    const state = mine.length ? (mine.some((e) => e.found) ? 'found' : 'searched, not found') : block ? 'cannot search' : 'may search';
    return [name(m), state, mine.map((e) => e.item ?? e.text).join(', ') || (block && !mine.length ? block : '–'), mine.filter((e) => e.found).map((e) => gold(e.amount)).join(', ') || '–'];
  });
  return (
    <>
      <p>A Hero not taken out of action in the last battle looks for one rare item: he rolls 2D6 against its rarity and may find one. What he finds is bought and goes into the stash.</p>
      <RulesTable caption="Searches this round" head={['Hero', 'Now', 'Item / reason', 'Paid']} rows={rows} rowHeads={false} />
      <p className={ui.muted}>{searches.length} search{searches.length === 1 ? '' : 'es'} so far, {searches.filter((e) => e.found).length} found.</p>
      <div className={ui.row}><Link to={tradeLink} className={ui.buttonQuiet}>Trading Post</Link></div>
    </>
  );
}

/** 7 – Look for Dramatis Personae: who the warband may hire, and who it has. */
export function DramatisStep({ ctx, hireLink }: { ctx: core.Ctx; hireLink: string }) {
  const el = core.dpEligibility(ctx);
  const have = (ctx.s.dp ?? []).map((d) => d.name || ctx.data.DRAMATIS[d.key]?.name || d.key);
  return (
    <>
      <p>If you want to hire a Dramatis Persona, look for one now. Which of them this warband may hire is listed here; the hiring is done on the Hire page.</p>
      <p>{have.length ? <>In the warband: <strong>{have.join(', ')}</strong>.</> : <span className={ui.muted}>No Dramatis Persona in the warband.</span>}</p>
      <RulesTable caption="May be hired" head={['Name', 'Hire fee', 'Upkeep']} rowHeads={false}
        rows={el.allowed.slice(0, 40).map((o) => [o.name, `${o.hire ?? 0} gc`, `${o.upkeep ?? 0} gc`])}
        note={el.allowed.length > 40 ? `The first 40 of ${el.allowed.length}; the Hire page lists them all.` : `${el.allowed.length} may be hired.`} />
      <div className={ui.row}><Link to={hireLink} className={ui.buttonQuiet}>Hire</Link></div>
    </>
  );
}

/** 8 – Hire new recruits and buy common items: what this round's bookings say. */
export function RecruitsStep({ a, ctx, rosterLink, tradeLink }: { a: AftermathView; ctx: core.Ctx; rosterLink: string; tradeLink: string }) {
  const rows = roundBookings(ctx, a.round).filter((e) => e.kind === 'buy' || e.kind === 'sell' || e.kind === 'roster').map((e) => [({ buy: 'bought', sell: 'sold', roster: 'roster' } as Record<string, string>)[e.kind] ?? e.kind, e.text, gold(e.amount)]);
  const net = roundBookings(ctx, a.round).filter((e) => e.kind === 'buy' || e.kind === 'sell' || e.kind === 'roster').reduce((n, e) => n + e.amount, 0);
  return (
    <>
      <p>Hire new warriors with their free dagger and buy common equipment, in any order and as often as you like. New recruits may not buy rare items; they can be given rare items from the stash in the next step.</p>
      {rows.length > 0
        ? <RulesTable caption="Hired, bought and sold this round" head={['What', 'Booking', 'Gold']} rows={rows} rowHeads={false} note={`Together ${gold(net)}.`} />
        : <p className={ui.muted}>Nothing hired or bought yet this round (the list needs the gold ledger, which starts with the warband's first battle).</p>}
      <p>Gold in hand: <strong>{a.gold} gc</strong>.</p>
      <div className={ui.row}><Link to={rosterLink} className={ui.buttonQuiet}>+ Recruit on the roster</Link><Link to={tradeLink} className={ui.buttonQuiet}>Trading Post</Link></div>
    </>
  );
}

/** 9 – Reallocate equipment: the stash, to hand out. */
export function EquipmentStep({ ctx, rosterLink, tradeLink }: { ctx: core.Ctx; rosterLink: string; tradeLink: string }) {
  const items = ctx.s.stash?.items ?? [];
  return (
    <>
      <p>Equipment may move freely between warriors, as long as they may use it. New warriors may take rare items from the stash.</p>
      {items.length > 0
        ? <RulesTable caption="In the stash" head={['Item', 'How many', 'Came from']} rowHeads={false} rows={items.map((it) => [core.enItem(ctx.data, it.name), String(it.qty), it.source ? it.source.replace('location:', 'place ') : '–'])} />
        : <p className={ui.muted}>The stash holds no items.</p>}
      <div className={ui.row}><Link to={rosterLink} className={ui.buttonQuiet}>The roster</Link><Link to={`${tradeLink}#give`} className={ui.buttonQuiet}>Give from the stash</Link></div>
    </>
  );
}
