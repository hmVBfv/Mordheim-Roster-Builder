/* After a battle, for one's own warband (phase 4a4; concept.md 4.2,
   docs/mockups/changes.html, ADR 0016). Once the leader has closed the
   battle:
   1. the battle is taken over into the warband's save – shown first, taken
      over only when the player says so;
   2. the Roster Builder's post-battle sequence, step by step, on the save:
      injuries rolled for whoever went out of action, the battle's
      experience, exploration, wyrdstone, then hiring and buying (on the
      roster and at the Trading Post);
   3. what changed since the last mark, explained as the server will freeze
      it, and "Mark after battle N": a version is saved and marked; marked
      again, the newer mark corrects the earlier.
   Every change is an action of core through the editor, with Undo. */
import * as core from '@mordheim/core';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { errorText } from '../account/api.ts';
import { useSession } from '../account/session.ts';
import { battleTitle, cachedBattle, casualtyText, getBattle, OUTCOME_NAMES, type BattleView, type CasualtyPayload } from '../battle/api.ts';
import { useCampaignRules } from '../campaign/rules.ts';
import type { StoredWarband } from '../db/db.ts';
import { useGameData } from '../game/useGameData.ts';
import { injuryEnv } from '../roster/injury.ts';
import { InjurySheet, type InjuryFor } from '../roster/InjurySheet.tsx';
import trade from '../roster/Trade.module.css';
import { useEditor } from '../roster/useEditor.ts';
import { rosterView } from '../roster/view.ts';
import { useNotice } from '../ui/Notice.tsx';
import ui from '../ui/ui.module.css';
import { UndoToast } from '../ui/UndoToast.tsx';
import { useSheet } from '../ui/useSheet.ts';
import { FieldsSheet, type FieldsEdit } from '../story/FieldsSheet.tsx';
import type { ChangeLine } from './changes.ts';
import { MarkSection } from './MarkSection.tsx';
import { underdogOf } from './underdog.ts';
import { Steps } from './Steps.tsx';
import styles from './Aftermath.module.css';
import { takeOverBattle } from './takeover.ts';
import { aftermathView, type CasualtyView } from './view.ts';
import { useWarbandRecord } from '../sync/local.ts';

const today = () => new Date().toISOString().slice(0, 10);

/** The battle as last seen on this device, then as the server has it. */
function useBattleView(cid: string | null | undefined, bid: string) {
  const [view, setView] = useState<BattleView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!cid) return;
    let live = true;
    void cachedBattle(bid).then((v) => { if (live && v) setView((cur) => cur ?? v); });
    getBattle(cid, bid).then((v) => { if (live && v) { setView(v); setError(null); } }).catch((e: unknown) => { if (live) setError(errorText(e)); });
    return () => { live = false; };
  }, [cid, bid, n]);
  return { view, error, reload: () => setN((x) => x + 1) };
}

/** What the battle brings into the save, before it is taken over. */
function TakeOver({ view, wid, onTake }: { view: BattleView; wid: string; onTake: () => void }) {
  const names = Object.fromEntries(view.participants.map((p) => [p.warbandId, p.name]));
  const me = view.participants.find((p) => p.warbandId === wid);
  const ours = view.entries.filter((e) => e.kind === 'casualty').map((e) => e.payload as CasualtyPayload)
    .filter((c) => c.victim.warbandId === wid || (c.attacker && !c.attacker.env && c.attacker.warbandId === wid));
  const others = view.participants.filter((p) => p.warbandId !== wid).map((p) => p.name);
  return (
    <section className={`${ui.card} ${styles.take}`} aria-labelledby="am-take">
      <h2 id="am-take">Take the battle over</h2>
      <p>
        {battleTitle(view.battle)} against {others.length ? others.join(', ') : 'nobody'}
        {me?.outcome ? `: ${OUTCOME_NAMES[me.outcome]}` : ''}.
      </p>
      {ours.length > 0
        ? (
          <ul className={styles.plain} aria-label="From the protocol">
            {ours.map((c, i) => {
              const t = casualtyText(c, names);
              return <li key={i}>{t.victim} out of action{t.by ? ` – by ${t.by}` : ''}.</li>;
            })}
          </ul>
        )
        : <p className={ui.muted}>Nobody of yours went out of action, and yours put nobody out of action.</p>}
      <p className={ui.muted}>
        It goes into your warband’s chronicle as the Roster Builder records a battle: the campaign moves on to “After battle {view.battle.round}”,
        the casualties wait for their injury roll, a Hero who put an enemy out of action holds +1 experience, and the map follows the outcome.
      </p>
      <div className={ui.row}><button type="button" className={ui.button} onClick={onTake}>Take it over</button></div>
    </section>
  );
}


function AftermathBody({ rec, bid }: { rec: StoredWarband; bid: string }) {
  const data = useGameData();
  const ed = useEditor(data, rec);
  const session = useSession();
  const signedIn = session.status === 'in' || session.status === 'unreachable';
  const cid = rec.campaignId;
  const b = useBattleView(cid, bid);
  const [notice, notify] = useNotice();
  const a = useMemo(() => aftermathView(data, ed.state, bid), [data, ed.state, bid]);
  const ctx = useMemo(() => core.ctxOf(data, ed.state), [data, ed.state]);
  const v = useMemo(() => rosterView(data, ed.state), [data, ed.state]);
  const inj = useSheet();
  const [injFor, setInjFor] = useState<(InjuryFor & { key: number }) | null>(null);
  const said = useSheet();
  const [saying, setSaying] = useState<FieldsEdit | null>(null);
  // what happened behind a change: one text, kept in the save under the change's key (4b2)
  const explain = (l: ChangeLine, who: string) => {
    setSaying((p) => ({
      key: (p?.key ?? 0) + 1, title: `${who}: ${l.what} ${l.to}`.trim(),
      intro: 'Why did it happen? It joins the warrior’s story, and everyone in the campaign can read it.',
      fields: [{ key: 'text', label: 'What happened', kind: 'text', max: core.STORY_LIMITS.explanation, rows: 5 }],
      values: { text: l.said ?? '' },
      save: (vals) => ed.edit((c) => core.setExplanation(c, l.key, vals.text ?? ''), 'Written down.', { gold: 'keep' }),
    }));
    said.open();
  };

  // the injury sheet is there from the first render on (useSheet), whatever is shown around it
  const view = cid && signedIn ? b.view : null;
  // where the campaign's history ends, if this warband fought in it (4a5)
  const camp = useCampaignRules(cid);
  const historyRound = camp?.history.warbandIds.includes(rec.id) ? camp.history.round : 0;
  const fought = view?.participants.some((p) => p.warbandId === rec.id);
  const roll = (c: CasualtyView) => {
    const m = ctx.s.models.find((x) => x.uid === c.uid);
    if (!m) return;
    const w = [...v.heroes, ...v.henchmen].find((x) => x.uid === m.uid);
    if (!w) return;
    if (w.hero) {
      const env = injuryEnv(ctx, m);
      const by = env.attacker ? [env.attacker.name, env.attacker.wb && `(${env.attacker.wb})`].filter(Boolean).join(' ') : null;
      setInjFor((p) => ({ kind: 'hero', uid: w.uid, name: w.name, env, by, key: (p?.key ?? 0) + 1 }));
    } else setInjFor((p) => ({ kind: 'hench', uid: w.uid, name: w.name, men: w.men, key: (p?.key ?? 0) + 1 }));
    inj.open();
  };
  return (
    <section className={ui.page}>
      <div>
        <Link to={`/warbands/${rec.id}`} className={trade.back}>‹ {rec.name}</Link>
        <h1>{view ? `After battle ${view.battle.round}` : 'After the battle'}</h1>
        {view && <p className={ui.muted}>{battleTitle(view.battle)}{view.battle.status === 'closed' ? ' · closed' : ' · still being fought'}</p>}
      </div>
      {(!cid || session.status === 'out') && <p className={ui.message}>{!cid ? 'This warband is not in a campaign on the server.' : 'Sign in first: battles live on the campaign server.'}</p>}
      {cid && signedIn && !view && (b.error ? <p className={ui.message} role="alert">{b.error}</p> : <p className={ui.muted}>Loading the battle…</p>)}
      {view && !fought && <p className={ui.message}>{rec.name} did not fight this battle.</p>}
      {view && fought && view.battle.status === 'open' && <p className={ui.message}>The battle is still being fought. Once a leader closes it, its aftermath begins here.</p>}
      {view && fought && view.battle.takenOver && <p className={ui.message}>Played before the app: this battle has no aftermath here.</p>}
      {view && fought && view.battle.status === 'closed' && !view.battle.takenOver && !a && (
        <TakeOver view={view} wid={rec.id} onTake={() => ed.edit((c) => takeOverBattle(data, c.s, view, rec.id, today(), historyRound), `${battleTitle(view.battle)} taken over.`, { gold: 'keep' })} />
      )}
      {view && fought && view.battle.status === 'closed' && !view.battle.takenOver && a && (
        <div className={styles.columns}>
          <Steps a={a} data={data} wid={rec.id} acts={{ ctx, underdog: underdogOf(data, view, rec.id), edit: ed.edit, roll }} />
          <MarkSection data={data} rec={rec} state={ed.state} view={view} cid={cid!} round={a.round} toRoll={a.toRoll} onMarked={b.reload} notify={notify} onExplain={explain} />
        </div>
      )}
      {view && (
        <div className={ui.row}>
          <Link to={`/campaign/${cid}/battles/${bid}`} className={ui.buttonQuiet}>The battle’s protocol</Link>
          <Link to={`/warbands/${rec.id}`} className={ui.buttonQuiet}>The roster</Link>
        </div>
      )}
      <FieldsSheet dialogRef={said.ref} close={said.close} edit={saying} />
      <InjurySheet dialogRef={inj.ref} close={inj.close} who={injFor}
        onApply={(r, text) => { if (injFor) { const uid = injFor.uid; ed.edit((c) => core.injure(c, uid as number, r), text, { gold: 'keep' }); } }} />
      {ed.notice && <UndoToast key={ed.notice.id} text={ed.notice.text} onUndo={ed.undo} onDone={ed.dismiss} />}
      {!ed.notice && notice}
    </section>
  );
}

export function Aftermath() {
  const { id = '', bid = '' } = useParams();
  const rec = useWarbandRecord(id);
  if (rec === undefined) return null;
  if (rec === null || rec.removedAt) {
    return (
      <section className={ui.page}>
        <h1>Not on this device</h1>
        <p className={ui.muted}>This warband is not stored here (any more).</p>
        <p><Link to="/warbands" className={ui.buttonQuiet}>All warbands</Link></p>
      </section>
    );
  }
  return (
    <Suspense fallback={<p className={ui.muted}>Loading the rules…</p>}>
      <AftermathBody rec={rec} bid={bid} />
    </Suspense>
  );
}
