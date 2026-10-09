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
import type { GameData, WarbandState } from '@mordheim/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { errorText } from '../account/api.ts';
import { useSession } from '../account/session.ts';
import { useOnline } from '../app/SyncState.tsx';
import { battleTitle, cachedBattle, casualtyText, getBattle, markBattle, OUTCOME_NAMES, type BattleView, type CasualtyPayload } from '../battle/api.ts';
import { readWarband } from '../campaign/api.ts';
import { useCampaignRules } from '../campaign/rules.ts';
import { db, type StoredWarband } from '../db/db.ts';
import { useGameData } from '../game/useGameData.ts';
import { injuryEnv } from '../roster/injury.ts';
import { InjurySheet, type InjuryFor } from '../roster/InjurySheet.tsx';
import trade from '../roster/Trade.module.css';
import { useEditor } from '../roster/useEditor.ts';
import { rosterView } from '../roster/view.ts';
import { saveVersion, versionState } from '../sync/versions.ts';
import { useNotice } from '../ui/Notice.tsx';
import ui from '../ui/ui.module.css';
import { UndoToast } from '../ui/UndoToast.tsx';
import { useSheet } from '../ui/useSheet.ts';
import { groupChanges, previewChanges, type AnyChange, type ChangeGroup } from './changes.ts';
import styles from './Aftermath.module.css';
import { takeOverBattle } from './takeover.ts';
import { aftermathView, grantBattleXp, type AftermathView, type CasualtyView } from './view.ts';

const today = () => new Date().toISOString().slice(0, 10);
const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;

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

function CasualtyRow({ c, onRoll }: { c: CasualtyView; onRoll: () => void }) {
  return (
    <li className={styles.casualty}>
      <span>{c.text}{!c.ours && <small> Their player rolls for them.</small>}</span>
      {c.open && <button type="button" className={ui.button} onClick={onRoll}>Roll</button>}
      {c.ours && !c.open && c.result !== 'pending' && <span className={styles.done}>✓</span>}
    </li>
  );
}

interface StepActs {
  edit: (action: (ctx: core.Ctx) => WarbandState, text?: string, opts?: { gold?: 'settle' | 'keep' }) => void;
  roll: (c: CasualtyView) => void;
}

/** A step done elsewhere in the app: what it asks, and where. */
function Go({ text, links }: { text: string; links: [string, string][] }) {
  return (
    <>
      <p>{text}</p>
      <div className={ui.row}>{links.map(([to, label]) => <Link key={label} to={to} className={ui.buttonQuiet}>{label}</Link>)}</div>
    </>
  );
}

function StepBody({ k, a, data, wid, acts }: { k: string; a: AftermathView; data: GameData; wid: string; acts: StepActs }) {
  const [sell, setSell] = useState(a.wyrd.shards);
  const roster = `/warbands/${wid}`;
  switch (k) {
    case 'injuries': return (
      <>
        <p>Heroes taken out of action roll a D66 on the Serious Injuries chart; Henchmen a D6 – 1–2 the man is dead, 3–6 he fights on.</p>
        {a.casualties.length === 0 && <p className={ui.muted}>No casualties in this battle.</p>}
        <ul className={styles.plain} aria-label="Casualties">
          {a.casualties.map((c) => <CasualtyRow key={c.id} c={c} onRoll={() => acts.roll(c)} />)}
        </ul>
        {a.toRoll > 0 ? <p className={styles.warn}>{a.toRoll} still to roll.</p> : <p className={ui.muted}>Nothing left to roll.</p>}
      </>
    );
    case 'experience': return (
      <>
        <p>+1 to every Hero and Henchman group that survived, +1 to the leader of the winning warband, +1 to a Hero for every enemy he put out of action. A scenario may give more: add that on the roster.</p>
        <div className={ui.row}>
          <button type="button" className={ui.button} disabled={a.xpAwarded}
            onClick={() => acts.edit((c) => grantBattleXp(data, c, a.local.id), 'The battle’s experience is held, ready to write onto the roster.')}>
            {a.xpAwarded ? '✓ Battle experience granted' : 'Grant the battle’s experience'}
          </button>
        </div>
        {a.pendingXp.length > 0 && (
          <ul className={styles.plain} aria-label="Experience held">
            {a.pendingXp.map((x) => <li key={x.id}>{x.name} +{x.amount} <small className={ui.muted}>{x.reason}</small></li>)}
          </ul>
        )}
        {(a.pendingXp.length > 0 || a.deathsToApply > 0) && (
          <div className={ui.row}>
            <button type="button" className={ui.button} onClick={() => acts.edit((c) => core.applyBattleResults(c), 'Written onto the roster.', { gold: 'keep' })}>Write it onto the roster</button>
          </div>
        )}
        {a.advancesDue.length > 0 && (
          <>
            <p>Advance due: {a.advancesDue.join(', ')}.</p>
            <div className={ui.row}><Link to={roster} className={ui.buttonQuiet}>Roll it on the roster</Link></div>
          </>
        )}
      </>
    );
    case 'exploration': return (
      <>
        <p>
          Roll <strong>{a.explore.capped}</strong> {a.explore.capped === 1 ? 'die' : 'dice'}: one for each Hero not taken out of action
          {a.explore.searching.length ? ` (${a.explore.searching.join(', ')})` : ''}{a.explore.winDie ? ', one for the win' : ''}{a.explore.base > 6 ? ', six at most' : ''} – dice from skills and equipment come on top.
          Total them and read the Exploration chart; doubles or better find a special location.
        </p>
        <div className={styles.stepper}>
          <span>Wyrdstone in the stash</span>
          <button type="button" className={ui.buttonQuiet} aria-label="One shard less" disabled={a.wyrd.shards <= 0} onClick={() => acts.edit((c) => core.stashAdjust(c, 'wyrd', -1))}>−</button>
          <span aria-live="polite">{a.wyrd.shards}</span>
          <button type="button" className={ui.buttonQuiet} aria-label="One shard more" onClick={() => acts.edit((c) => core.stashAdjust(c, 'wyrd', 1))}>+</button>
        </div>
      </>
    );
    case 'wyrdstone': {
      const n = Math.max(1, Math.min(a.wyrd.shards, sell || a.wyrd.shards));
      return (
        <>
          <p>Wyrdstone is sold once after each battle. The price is for the whole lot, not per shard – smaller lots fetch more each, and a larger warband earns less.</p>
          {a.wyrd.sold
            ? (
              <div className={ui.row}>
                <span>✓ Sold {a.wyrd.sold.shards} shard{a.wyrd.sold.shards === 1 ? '' : 's'} for {a.wyrd.sold.gc} gc (warband of {a.wyrd.sold.size}).</span>
                <button type="button" className={ui.buttonQuiet} onClick={() => acts.edit((c) => core.undoWyrdstoneSale(c, a.round), 'Sale taken back.')}>Take the sale back</button>
              </div>
            )
            : a.wyrd.shards < 1
              ? <p className={ui.muted}>No wyrdstone in the stash to sell.</p>
              : (
                <>
                  <p>Stash: {a.wyrd.shards} shard{a.wyrd.shards === 1 ? '' : 's'} · warband of {a.wyrd.size} (band {a.wyrd.band}).</p>
                  <div className={styles.stepper}>
                    <span>Sell</span>
                    <button type="button" className={ui.buttonQuiet} aria-label="Sell one shard less" disabled={n <= 1} onClick={() => setSell(n - 1)}>−</button>
                    <span aria-live="polite">{n}</span>
                    <button type="button" className={ui.buttonQuiet} aria-label="Sell one shard more" disabled={n >= a.wyrd.shards} onClick={() => setSell(n + 1)}>+</button>
                    <button type="button" className={ui.button} onClick={() => acts.edit((c) => core.sellWyrdstone(c, a.round, n), `Sold ${n} shard${n === 1 ? '' : 's'} for ${a.wyrd.price(n)} gc.`)}>Sell for {a.wyrd.price(n)} gc</button>
                  </div>
                </>
              )}
        </>
      );
    }
    case 'veterans': return <Go text="Roll 2D6: new recruits may bring experience up to that total between them." links={[[`${roster}/hire`, 'Hire']]} />;
    case 'rare': return <Go text="A Hero not taken out of action may look for one rare item: 2D6 against its rarity. What he finds is bought at the Trading Post." links={[[`${roster}/trade`, 'Trading Post']]} />;
    case 'dramatis': return <Go text="A Dramatis Persona may be found, if the warband may hire one and can pay." links={[[`${roster}/hire`, 'Hire']]} />;
    case 'recruits': return <Go text={`Hire new warriors and buy common equipment. Gold in hand: ${a.gold} gc.`} links={[[roster, '+ Recruit on the roster'], [`${roster}/trade`, 'Trading Post']]} />;
    case 'equipment': return <Go text="Equipment may move freely between warriors; new warriors may take rare items from the stash." links={[[roster, 'The roster']]} />;
    case 'rating': return <p>Warband rating for the next battle: <strong>{a.rating}</strong>.</p>;
    default: return null;
  }
}

function Steps({ a, data, wid, acts }: { a: AftermathView; data: GameData; wid: string; acts: StepActs }) {
  const lastDone = a.steps.filter((s) => s.done).at(-1)?.key;
  return (
    <section aria-labelledby="am-steps" className={ui.page}>
      <h2 id="am-steps">After the battle</h2>
      <ol className={styles.steps}>
        {a.steps.map((s, i) => (
          <li key={s.key} className={`${styles.step} ${s.active ? styles.active : ''} ${s.locked ? styles.locked : ''}`} aria-current={s.active ? 'step' : undefined}>
            <div className={styles.stepHead}>
              <span className={styles.num}>{s.done ? '✓' : i + 1}</span>
              <h3>{s.title}</h3>
              <a href={s.link} {...ext} className={styles.chart} aria-label={`${s.title} on mordheimer.net`}>Rules ↗</a>
            </div>
            {s.active && (
              <div className={styles.stepBody}>
                <StepBody k={s.key} a={a} data={data} wid={wid} acts={acts} />
                <div className={ui.row}>
                  <button type="button" className={ui.buttonQuiet} onClick={() => acts.edit((c) => core.setPostBattleStep(c, s.key, true, a.round))}>Done – next step</button>
                </div>
              </div>
            )}
            {s.done && s.key === lastDone && (
              <div className={ui.row}>
                <button type="button" className={ui.buttonQuiet} onClick={() => acts.edit((c) => core.setPostBattleStep(c, s.key, false, a.round))}>Back to this step</button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {a.steps.every((s) => s.done) && <p className={ui.message}>The sequence is done. Look over what changed, then mark it.</p>}
    </section>
  );
}

export function ChangeList({ groups, label }: { groups: ChangeGroup[]; label: string }) {
  return (
    <div className={styles.changes} aria-label={label} role="list">
      {groups.map((g) => (
        <article key={g.key} className={styles.who} role="listitem">
          <h3>{g.name || 'The warband'}</h3>
          {g.lines.map((l) => (
            <div key={l.key} className={`${styles.change} ${l.unexplained ? styles.alert : ''}`}>
              <div className={styles.what}>
                <span>{l.what}</span>
                {l.from != null && <><span className={ui.muted}>{l.from}</span><span aria-hidden="true">→</span></>}
                <strong>{l.to}</strong>
                {l.unexplained && <span className={styles.flag}>⚠ no cause found</span>}
              </div>
              {l.why && <small>✓ {l.why}</small>}
              {l.unexplained && <small>Nothing in the chronicle explains it. Everyone in the campaign sees this mark; it blocks nothing.</small>}
            </div>
          ))}
        </article>
      ))}
    </div>
  );
}

/** What changed since the last mark, and marking. */
function MarkSection({ data, rec, state, view, cid, round, toRoll, onMarked, notify }: {
  data: GameData; rec: StoredWarband; state: WarbandState; view: BattleView; cid: string; round: number; toRoll: number;
  onMarked: () => void; notify: (t: string) => void;
}) {
  const [before, setBefore] = useState<{ state: WarbandState; label: string } | null>(null);
  const [beforeError, setBeforeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const online = useOnline();
  useEffect(() => {
    let live = true;
    readWarband(cid, rec.id)
      .then((r) => {
        const prev = r.tags.filter((t) => t.round < view.battle.round).at(-1);
        if (!prev) throw new Error('This warband has no mark before this battle.');
        const label = prev.kind === 'start' ? 'its start' : prev.kind === 'sat_out' ? `round ${prev.round}, sat out` : `after battle ${prev.round}`;
        return versionState(data, rec.id, prev.rev).then((s) => ({ state: s, label: `${label} (version ${prev.rev})` }));
      })
      .then((b) => { if (live) setBefore(b); })
      .catch((e: unknown) => { if (live) setBeforeError(errorText(e)); });
    return () => { live = false; };
  }, [cid, rec.id, data, view.battle.round]);
  const changes: AnyChange[] = useMemo(() => (before ? previewChanges(data, before.state, state, view.battle.id, round) : []), [data, before, state, view.battle.id, round]);
  const groups = useMemo(() => groupChanges(changes, state, data), [changes, state, data]);
  const unexplained = changes.filter((c) => c.unexplained).length;
  const mark = view.marks?.[rec.id];

  const doMark = async () => {
    setBusy(true);
    setError(null);
    try {
      const fresh = (await db.warbands.get(rec.id)) ?? rec;
      const saved = await saveVersion(data, fresh, `after battle ${view.battle.round}`);
      if (!saved.ok) { setError(`A newer version (${saved.headRev}) was saved on another device: open Versions and take it, then mark again.`); return; }
      const r = await markBattle(cid, view.battle.id, rec.id, saved.rev);
      const u = r.changes.filter((c) => c.unexplained).length;
      notify(`Marked after battle ${view.battle.round}: version ${saved.rev}, ${r.changes.length} change${r.changes.length === 1 ? '' : 's'}${u ? `, ${u} without a cause` : ''}.`);
      onMarked();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };

  return (
    <section aria-labelledby="am-changes" className={ui.page}>
      <h2 id="am-changes">What changed</h2>
      {before && <p className={ui.muted}>Since {before.label}{mark ? '' : ' · a preview; nothing is marked yet'}.</p>}
      {beforeError && <p className={ui.message} role="status">The comparison needs the campaign server: {beforeError}</p>}
      {before && (
        <dl className={styles.summary}>
          <div><dt>Changes</dt><dd>{changes.length}</dd></div>
          <div><dt>Without a cause</dt><dd>{unexplained}</dd></div>
        </dl>
      )}
      {before && changes.length === 0 && <p className={ui.muted}>Nothing changed yet.</p>}
      {groups.length > 0 && <ChangeList groups={groups} label="Changes" />}
      <div className={`${ui.card} ${styles.mark}`}>
        {mark && <p>✓ Marked after battle {view.battle.round} – version {mark.rev}, {mark.changes} change{mark.changes === 1 ? '' : 's'}{mark.unexplained ? `, ${mark.unexplained} without a cause` : ''}. Changed something since? Mark again: the newer mark corrects this one.</p>}
        {!mark && toRoll > 0 && <p className={styles.warn}>{toRoll} injur{toRoll === 1 ? 'y is' : 'ies are'} not rolled yet.</p>}
        <button type="button" className={ui.button} disabled={busy || !online} onClick={() => void doMark()}>
          {mark ? `Mark after battle ${view.battle.round} again` : `Looks right – mark after battle ${view.battle.round}`}
        </button>
        <small className={ui.muted}>Saves a version and freezes rating, gold and models as they are now, with what changed – for everyone in the campaign to read.</small>
        {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      </div>
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
          <Steps a={a} data={data} wid={rec.id} acts={{ edit: ed.edit, roll }} />
          <MarkSection data={data} rec={rec} state={ed.state} view={view} cid={cid!} round={a.round} toRoll={a.toRoll} onMarked={b.reload} notify={notify} />
        </div>
      )}
      {view && (
        <div className={ui.row}>
          <Link to={`/campaign/${cid}/battles/${bid}`} className={ui.buttonQuiet}>The battle’s protocol</Link>
          <Link to={`/warbands/${rec.id}`} className={ui.buttonQuiet}>The roster</Link>
        </div>
      )}
      <InjurySheet dialogRef={inj.ref} close={inj.close} who={injFor}
        onApply={(r, text) => { if (injFor) { const uid = injFor.uid; ed.edit((c) => core.injure(c, uid as number, r), text, { gold: 'keep' }); } }} />
      {ed.notice && <UndoToast key={ed.notice.id} text={ed.notice.text} onUndo={ed.undo} onDone={ed.dismiss} />}
      {!ed.notice && notice}
    </section>
  );
}

export function Aftermath() {
  const { id = '', bid = '' } = useParams();
  const rec = useLiveQuery(async () => (await db.warbands.get(id)) ?? null, [id]);
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
