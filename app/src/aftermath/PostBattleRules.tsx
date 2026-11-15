/* The post-battle sequence as one overview (N1): the ten steps in the rulebook's order, each with the tables it needs, read from the
   rules data. For reading at the table, with or without a campaign. */
import * as core from '@mordheim/core';
import type { GameData } from '@mordheim/core';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { RULES } from '../app/paths.ts';
import { useGameData } from '../game/useGameData.ts';
import trade from '../roster/Trade.module.css';
import { RulesTable } from '../ui/RulesTable.tsx';
import ui from '../ui/ui.module.css';
import styles from './PostBattleRules.module.css';
import { experienceTables, injuryTables, locationGroups, sequenceTable, shardsTable } from './tables.ts';
import { WyrdPrices } from './WyrdPrices.tsx';

function Step({ n, title, link, text, children }: { n: number; title: string; link: string; text: string; children?: React.ReactNode }) {
  return (
    <section className={`${ui.card} ${styles.step}`} aria-labelledby={`pb-step-${n}`}>
      <h2 id={`pb-step-${n}`}>{n}. {title}</h2>
      <p>{text}</p>
      {children}
      <p><a href={link} target="_blank" rel="noopener noreferrer" className={ui.buttonQuiet}>Rules ↗</a></p>
    </section>
  );
}

function T({ t }: { t: ReturnType<typeof shardsTable> }) {
  return <RulesTable caption={t.title} head={t.head} rows={t.rows} note={t.note} link={t.link} rowHeads={false} />;
}

function Overview({ data }: { data: GameData }) {
  const inj = injuryTables(data), xp = experienceTables(data), seq = sequenceTable(data), places = locationGroups(data);
  const text = Object.fromEntries(data.PB_SEQUENCE);
  const step = (key: string) => { const i = core.PB_ORDER.indexOf(key); const s = core.PB_STEPS[i]!; return { n: i + 1, title: s[1], link: s[2], text: text[key] ?? '' }; };
  return (
    <>
      <T t={seq} />
      <Step {...step('injuries')}><T t={inj.hero} /><T t={inj.hench} /></Step>
      <Step {...step('experience')}><T t={xp.awards} /><T t={xp.underdog} /><T t={xp.hero} /><T t={xp.hench} /></Step>
      <Step {...step('exploration')}>
        <T t={shardsTable(data)} />
        {places.map((g) => <details key={g.id}><summary className={ui.fold}>{g.title}</summary><T t={g.table} /></details>)}
      </Step>
      <Step {...step('wyrdstone')}><WyrdPrices /></Step>
      {['veterans', 'rare', 'dramatis', 'recruits', 'equipment', 'rating'].map((k) => <Step key={k} {...step(k)} />)}
    </>
  );
}

export function PostBattleRules() {
  const data = useGameData();
  const body = useMemo(() => <Overview data={data} />, [data]);
  return (
    <section className={`${ui.page} ${ui.measure} ${styles.page}`}>
      <div>
        <Link to={RULES} className={trade.back}>‹ Rules</Link>
        <h1>After the battle</h1>
        <p className={ui.muted}>The ten steps and their tables, in the order of the rulebook. {data.PB_SOURCE}</p>
      </div>
      {body}
    </section>
  );
}
