/* Step 10, update the warband rating – and the balance of the round (N13): what the steps brought and cost, in tables, from the save. Every
   member of the campaign reads the same balance once it is marked (the server freezes it with the mark). */
import * as core from '@mordheim/core';
import { RulesTable } from '../ui/RulesTable.tsx';

const gc = (n: number) => `${n} gc`;
const arrow = (a: number | undefined, b: number) => (a == null ? String(b) : `${a} → ${b}${b !== a ? ` (${b > a ? '+' : ''}${b - a})` : ''}`);

export function BalanceTables({ r }: { r: core.RoundSummary }) {
  const rows: string[][] = [
    ['Injuries', r.injuries.total ? `${r.injuries.total}: ${r.injuries.dead} dead, ${r.injuries.injured} injured, ${r.injuries.recovered} recovered${r.injuries.pending ? `, ${r.injuries.pending} still to roll` : ''}` : 'none'],
    ['Experience', r.experience.points ? `${r.experience.points} points${r.experience.underdog ? ` (underdog +${r.experience.underdog} each` : ''}${r.experience.scenario ? `${r.experience.underdog ? ', ' : ' ('}scenario ${r.experience.scenario}` : ''}${r.experience.underdog || r.experience.scenario ? ')' : ''}` : 'none'],
    ['Exploration', r.exploration ? `${r.exploration.dice} dice = ${r.exploration.total} → ${r.exploration.shards} shard${r.exploration.shards === 1 ? '' : 's'}${r.exploration.location ? `, place ${r.exploration.location}` : ''}${r.exploration.by === 'app' ? ' (rolled in the app)' : ''}` : 'not rolled'],
    ['Wyrdstone', `${r.wyrd.found} found, ${r.wyrd.sold} sold, ${r.wyrd.held} in the stash`],
    ['Income', `${gc(r.income.total)}: wyrdstone ${r.income.wyrdstone}, places ${r.income.locations}, scenario ${r.income.scenario}, goods ${r.income.goods}, other ${r.income.other}`],
    ['Spending', `${gc(r.spending.total)}: upkeep ${r.spending.upkeep}, bought ${r.spending.buys}, searches ${r.spending.searches}, recruits ${r.spending.recruits}`],
    ['Found items', r.lootValue ? `worth ${gc(r.lootValue)}` : 'none'],
  ];
  return (
    <>
      <RulesTable caption="Before and after" head={['', 'Rating', 'Gold in hand', 'Models']} rowHeads={false}
        rows={[[r.before ? 'Before the battle' : 'Now', ...(r.before ? [String(r.before.rating), gc(r.before.gold), String(r.before.models)] : [String(r.after.rating), gc(r.after.gold), String(r.after.models)])],
          ...(r.before ? [['After', arrow(r.before.rating, r.after.rating), `${arrow(r.before.gold, r.after.gold)} gc`, arrow(r.before.models, r.after.models)]] : [])]} />
      <RulesTable caption="The balance of the round" head={['', 'What']} rows={rows} rowHeads />
      {r.finds.length > 0 && (
        <RulesTable caption="What the round brought, with its origin" head={['What', 'Where from']} rowHeads={false}
          rows={r.finds.map((f) => [f.text, f.source.replace('location:', 'place ')])} />
      )}
    </>
  );
}

export function BalanceStep({ ctx, round }: { ctx: core.Ctx; round: number }) {
  const r = core.postBattleSummary(ctx, round);
  return (
    <>
      <p>Warband rating for the next battle: <strong>{r.after.rating}</strong>. Here is what this post-battle sequence brought and cost; once you mark the warband, everyone in the campaign reads the same.</p>
      <BalanceTables r={r} />
    </>
  );
}
