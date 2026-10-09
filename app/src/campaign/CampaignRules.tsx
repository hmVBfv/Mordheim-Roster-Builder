/* A campaign's house rules (phase 4a4; docs/mockups/house-rules.html, the
   case "As leader"): the Roster Builder's switches, for every warband of
   the campaign. A leader changes them – each change goes to the server at
   once, with Undo; every member reads them, and sees which warband's own
   file still differs. Each warband takes the rules over into its file (its
   House rules screen); until it does, it is marked for everyone. */
import * as core from '@mordheim/core';
import type { WarbandState } from '@mordheim/core';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { errorText, type Me } from '../account/api.ts';
import { useSession } from '../account/session.ts';
import { useGameData } from '../game/useGameData.ts';
import { campaignHouseState, declaration, houseView, ruleLabel, setBodyOnly, setGrade, setRule, stepRule } from '../roster/house.ts';
import { RuleGroups, type RuleActs } from '../roster/HouseParts.tsx';
import styles from '../roster/House.module.css';
import trade from '../roster/Trade.module.css';
import ui from '../ui/ui.module.css';
import { UndoToast } from '../ui/UndoToast.tsx';
import { cachedCampaign, getCampaign, setHouseRules, type CampaignView } from './api.ts';

/** The rules as the campaign keeps them: every rule, the notes; the display setting is each player's own. */
const rulesOf = (s: WarbandState) => {
  const h = core.effectiveHouse(s.house) as unknown as Record<string, unknown>;
  delete h.showRarity;
  return h;
};

function Body({ id, view, setView, user }: { id: string; view: CampaignView; setView: (v: CampaignView) => void; user: Me }) {
  const data = useGameData();
  const lead = view.role === 'leader' && user.totp;
  const state = useMemo(() => campaignHouseState(data, view.campaign.houseRules), [data, view.campaign.houseRules]);
  const ctx = useMemo(() => core.ctxOf(data, state), [data, state]);
  const v = houseView(data, state, { campaign: true });
  const saved = String((view.campaign.houseRules as Record<string, unknown> | null)?.notes ?? '');
  const [notes, setNotes] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ n: number; text: string; before: Record<string, unknown> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // every change counts up; an answer to an older one is not shown over a newer change
  const changes = useRef(0);

  const send = useCallback((rules: Record<string, unknown>, text?: string) => {
    const before = (view.campaign.houseRules ?? {}) as Record<string, unknown>;
    const n = ++changes.current;
    setView({ ...view, campaign: { ...view.campaign, houseRules: rules } });
    setError(null);
    if (text) setUndo({ n, text, before });
    setHouseRules(id, rules).then((v2) => { if (n === changes.current) setView(v2); }).catch((e: unknown) => { setError(errorText(e)); setView({ ...view }); });
  }, [id, view, setView]);
  const save = (next: WarbandState, text?: string) => { if (next !== state) send(rulesOf(next), text); };

  const act: RuleActs = {
    toggle: (key, on, label) => save(setRule(ctx, key, on), `${label}: ${on ? 'house rule on' : 'as written again'} – for every warband.`),
    step: (key, dir) => save(stepRule(ctx, key, dir)),
    grade: (key, grade, played) => save(setGrade(ctx, key, grade, played), `Grade ${grade} ${played ? 'is played again' : 'is not played'} – for every warband.`),
    bodyOnly: (on) => save(setBodyOnly(ctx, on)),
  };
  const differ = view.enrolments.filter((e) => e.status === 'active' && (e.houseDiffers ?? []).length > 0);
  const decl = declaration(ctx);

  return (
    <section className={ui.page}>
      <div>
        <Link to={`/campaign/${id}${lead ? '/manage' : ''}`} className={trade.back}>‹ {view.campaign.name}</Link>
        <h1>House rules</h1>
      </div>
      <p>{lead
        ? `For every warband of ${view.campaign.name}. A change counts from now on: each player takes it over into the warband’s file, and the warband is marked until then.`
        : `${view.campaign.name}’s leaders set these for every warband of the campaign. Everything else is played as written.`}</p>
      <dl className={trade.figures}>
        <div><dt>House rules on</dt><dd>{v.count}</dd></div>
        <div><dt>Warbands that differ</dt><dd>{differ.length}</dd></div>
      </dl>
      {differ.length > 0 && (
        <ul className={ui.list} aria-label="Warbands that differ">
          {differ.map((e) => <li key={e.id} className={ui.card}><b>{e.name || e.wbName}</b> <small className={ui.muted}>({e.player}): {[...new Set((e.houseDiffers ?? []).map((k) => ruleLabel(k === 'rangedCap' ? 'rangedCapOn' : k)))].join(', ')}</small></li>)}
        </ul>
      )}
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      <RuleGroups groups={v.groups} act={lead ? act : null} />
      {(lead || saved) && (
        <section className={styles.group} aria-labelledby="ch-notes">
          <h2 id="ch-notes">Notes</h2>
          {lead
            ? (
              <label className={ui.field}>
                <span className={ui.muted}>Taken over with the rules, printed with every roster of the campaign</span>
                <textarea className={ui.input} rows={3} maxLength={2000} value={notes ?? saved} onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => { if (notes != null && notes !== saved) send({ ...rulesOf(state), notes }, 'Notes saved – for every warband.'); setNotes(null); }} />
              </label>
            )
            : <p className={styles.declared}>{saved}</p>}
        </section>
      )}
      <section className={styles.group} aria-labelledby="ch-export">
        <h2 id="ch-export">On every export</h2>
        <p className={styles.declared}>{decl || 'Nothing: the rules as written.'}</p>
      </section>
      {lead && v.count > 0 && (
        <div className={ui.row}>
          <button type="button" className={ui.buttonQuiet} onClick={() => send({ ...rulesOf(campaignHouseState(data, {})), notes: saved }, 'All house rules off – the rules as written, for every warband.')}>All back to the rules as written</button>
        </div>
      )}
      {undo && <UndoToast key={undo.n} text={undo.text} onUndo={() => { const b = undo.before; setUndo(null); send(b); }} onDone={() => setUndo(null)} />}
    </section>
  );
}

export function CampaignRules() {
  const { id = '' } = useParams();
  const session = useSession();
  const user = session.status === 'in' ? session.user : session.status === 'unreachable' ? session.user : null;
  const [view, setView] = useState<CampaignView | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void cachedCampaign(id).then((v) => { if (live && v) setView((cur) => cur ?? v); });
    getCampaign(id).then((v) => { if (live) setView(v); }).catch((e: unknown) => { if (live) setError(errorText(e)); });
    return () => { live = false; };
  }, [id]);
  if (!view || !user) return <section className={ui.page}>{error ? <p className={ui.message} role="alert">{error}</p> : <p className={ui.muted}>Loading…</p>}</section>;
  return (
    <Suspense fallback={<p className={ui.muted}>Loading the rules…</p>}>
      <Body id={id} view={view} setView={setView} user={user} />
    </Suspense>
  );
}
