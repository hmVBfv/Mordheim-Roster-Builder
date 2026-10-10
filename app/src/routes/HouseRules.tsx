/* A warband's house rules (phase 3e, mockup docs/mockups/house-rules.html).
   On its own, every warband keeps its own: each rule with what the rules
   as written say, a switch, and its value in steps when on; the
   declaration every export carries; all back to the rules as written. A
   price rule never moves gold already booked in the ledger.
   In a campaign (phase 4a4, the mockup's case "In a campaign") the
   campaign's rules count, set by its leaders: shown as they are, the
   warband's own file marked where it differs, with "Take the campaign's
   rules". Only the display setting stays the player's. */
import * as core from '@mordheim/core';
import { Suspense, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useCampaignRules, type CampaignRules } from '../campaign/rules.ts';
import { type StoredWarband } from '../db/db.ts';
import { FLAVOUR } from '../flavour.ts';
import { useGameData } from '../game/useGameData.ts';
import { adoptHouse, campaignHouseState, declaration, differingRules, houseView, setBodyOnly, setGrade, setRule, stepRule } from '../roster/house.ts';
import { RuleGroups, type RuleActs } from '../roster/HouseParts.tsx';
import { useEditor, type Editor } from '../roster/useEditor.ts';
import styles from '../roster/House.module.css';
import trade from '../roster/Trade.module.css';
import ui from '../ui/ui.module.css';
import { UndoToast } from '../ui/UndoToast.tsx';
import { useWarbandRecord } from '../sync/local.ts';

const KEEP = { gold: 'keep' } as const;

/** The warband's own rules, changed in its file. */
const ownActs = (ed: Editor): RuleActs => ({
  toggle: (key, on, label) => ed.edit((c) => setRule(c, key, on), `${label}: ${on ? 'house rule on' : 'as written again'}.`, KEEP),
  step: (key, dir) => ed.edit((c) => stepRule(c, key, dir), undefined, KEEP),
  grade: (key, grade, played) => ed.edit((c) => setGrade(c, key, grade, played), `Grade ${grade} ${played ? 'is played again' : 'is not played'}.`, KEEP),
  bodyOnly: (on) => ed.edit((c) => setBodyOnly(c, on), undefined, KEEP),
});

function InCampaign({ rec, ed, camp }: { rec: StoredWarband; ed: Editor; camp: CampaignRules }) {
  const data = useGameData();
  const theirs = useMemo(() => houseView(data, campaignHouseState(data, camp.rules), { campaign: true }), [data, camp.rules]);
  const display = houseView(data, ed.state).groups.filter((g) => g.key === 'show');
  const differs = differingRules(camp.rules, ed.state.house);
  const notes = String(camp.rules.notes ?? '');
  return (
    <>
      <p>In {camp.name} its leaders set the house rules, the same for every warband. Everything else is played as written.</p>
      {differs.length > 0 && (
        <div className={`${ui.card} ${styles.flag}`} role="status">
          <p><b>⚠ {rec.name}’s own file differs</b> – {differs.join(', ')}. In {camp.name} its rules count: take them over, and the roster is worked out with them. Everyone in the campaign sees the mark until then.</p>
          <div className={ui.row}>
            <button type="button" className={ui.button} onClick={() => ed.edit((c) => adoptHouse(c, camp.rules), `${rec.name} now plays by ${camp.name}’s house rules.`, KEEP)}>Take {camp.name}’s rules</button>
          </div>
        </div>
      )}
      <RuleGroups groups={theirs.groups} act={null} />
      {notes && (
        <section className={styles.group} aria-labelledby="hr-cnotes">
          <h2 id="hr-cnotes">Notes</h2>
          <p className={styles.declared}>{notes}</p>
        </section>
      )}
      {camp.lead && <div className={ui.row}><Link to={`/campaign/${camp.id}/house-rules`} className={ui.buttonQuiet}>Change {camp.name}’s rules</Link></div>}
      <RuleGroups groups={display} act={ownActs(ed)} />
    </>
  );
}

function Body({ rec }: { rec: StoredWarband }) {
  const data = useGameData();
  const ed = useEditor(data, rec);
  const ctx = useMemo(() => core.ctxOf(data, ed.state), [data, ed.state]);
  const v = houseView(data, ed.state);
  const saved = core.houseRules(ed.state).notes ?? '';
  const [notes, setNotes] = useState<string | null>(null);
  const name = ed.state.name || data.WARBANDS[ed.state.wb as string]?.name || 'Warband';
  const decl = declaration(ctx);
  const locked = core.tradeLocked(ctx);
  const camp = useCampaignRules(FLAVOUR === 'campaign' ? rec.campaignId : null);
  const inCampaign = FLAVOUR === 'campaign' && !!rec.campaignId;
  // in a campaign its rules count
  const count = inCampaign && camp ? houseView(data, campaignHouseState(data, camp.rules), { campaign: true }).count : v.count;

  return (
    <section className={ui.page}>
      <div>
        <Link to={`/warbands/${rec.id}`} className={trade.back}>‹ {name}</Link>
        <h1>House rules</h1>
      </div>
      {!inCampaign && <p>Everything is played as written unless a house rule is switched on here. Every export names the rules that are on.</p>}
      <dl className={trade.figures}>
        <div><dt>House rules on</dt><dd>{count}</dd></div>
        <div><dt>Gold in hand</dt><dd>{core.goldCurrent(ctx)} gc</dd></div>
      </dl>

      {inCampaign
        ? camp
          ? <InCampaign rec={rec} ed={ed} camp={camp} />
          : camp === null && <p className={ui.message}>The campaign’s house rules are not on this device yet: open the campaign once with a connection.</p>
        : (
          <>
            <p className={ui.muted}>{locked
              ? 'Prices count from the next purchase; gold already booked in the ledger stays as it is.'
              : 'Until the first battle, prices change what the warband has spent – and so its gold.'}</p>
            <RuleGroups groups={v.groups} act={ownActs(ed)} />
            <section className={styles.group} aria-labelledby="hr-notes">
              <h2 id="hr-notes">Notes</h2>
              <label className={ui.field}>
                <span className={ui.muted}>Printed with the roster and named on every export</span>
                <textarea className={ui.input} rows={3} value={notes ?? saved} onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => { if (notes != null && notes !== saved) ed.edit((c) => core.setHouseNotes(c, notes), 'House rule notes saved.', KEEP); setNotes(null); }} />
              </label>
            </section>
          </>
        )}

      <section className={styles.group} aria-labelledby="hr-export">
        <h2 id="hr-export">On every export</h2>
        <p className={styles.declared}>{decl || 'Nothing: the rules as written.'}</p>
      </section>

      {!inCampaign && (v.count > 0 || saved) ? (
        <div className={ui.row}>
          <button type="button" className={ui.buttonQuiet} onClick={() => ed.edit((c) => core.resetHouse(c), 'All house rules off: the rules as written.', KEEP)}>All back to the rules as written</button>
        </div>
      ) : null}
      {ed.notice && <UndoToast key={ed.notice.id} text={ed.notice.text} onUndo={ed.undo} onDone={ed.dismiss} />}
    </section>
  );
}

export function HouseRules() {
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
