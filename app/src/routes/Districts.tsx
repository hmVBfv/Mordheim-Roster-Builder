/* The districts a warband holds (phase 4a4; the Roster Builder's campaign
   panel): every district of Mordheim by area with what it gives, and
   none · foothold · control set by hand, with Undo. In a campaign on the
   server, the other warbands' footholds stand beside each district. */
import * as core from '@mordheim/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { Suspense, useMemo } from 'react';
import { Link, useParams } from 'react-router';
import type { CampaignView } from '../campaign/api.ts';
import { db, type StoredWarband } from '../db/db.ts';
import { FLAVOUR } from '../flavour.ts';
import { useGameData } from '../game/useGameData.ts';
import { districtsView, type Hold } from '../roster/districts.ts';
import styles from '../roster/House.module.css';
import trade from '../roster/Trade.module.css';
import { useEditor } from '../roster/useEditor.ts';
import ui from '../ui/ui.module.css';
import { UndoToast } from '../ui/UndoToast.tsx';

/* a district's prices never move gold already in hand, like a price house rule */
const KEEP = { gold: 'keep' } as const;
const HOLDS: [Hold, string][] = [['none', 'None'], ['foothold', 'Foothold'], ['control', 'Control']];

/** The other warbands of the campaign with what they hold, as this device last saw the campaign. */
function useOthers(rec: StoredWarband) {
  return useLiveQuery(async () => {
    if (FLAVOUR !== 'campaign' || !rec.campaignId) return [];
    const v = (await db.meta.get(`campaign:${rec.campaignId}`))?.value as CampaignView | undefined;
    return (v?.enrolments ?? []).filter((e) => e.warbandId !== rec.id && e.status === 'active').map((e) => ({ name: e.name || e.wbName, districts: e.districts ?? [] }));
  }, [rec.id, rec.campaignId]) ?? [];
}

function Body({ rec }: { rec: StoredWarband }) {
  const data = useGameData();
  const ed = useEditor(data, rec);
  const others = useOthers(rec);
  const v = useMemo(() => districtsView(data, ed.state, others), [data, ed.state, others]);
  const name = ed.state.name || data.WARBANDS[ed.state.wb as string]?.name || 'Warband';
  const on = !!ed.state.campaign?.on;
  return (
    <section className={ui.page}>
      <div>
        <Link to={`/warbands/${rec.id}`} className={trade.back}>‹ {name}</Link>
        <h1>Districts</h1>
      </div>
      <p>Footholds on the map of Mordheim. Winning a battle at a district gains a foothold there, losing one loses it{FLAVOUR === 'campaign' && rec.campaignId ? ' – after a battle of the campaign the map follows the outcome on its own' : ''}. Control is the only foothold at a district: set it here when no other warband holds one.</p>
      {!on && (
        <div className={ui.row}>
          <button type="button" className={ui.button} onClick={() => ed.edit((c) => core.setCampaignOn(c, true), 'The campaign layer is on.')}>Switch the campaign layer on</button>
        </div>
      )}
      <dl className={trade.figures}>
        <div><dt>Districts held</dt><dd>{v.held}</dd></div>
        <div><dt>In effect</dt><dd>{v.active.length}</dd></div>
      </dl>
      {v.active.length > 0 && (
        <section className={styles.group} aria-labelledby="d-active">
          <h2 id="d-active">In effect</h2>
          <ul className={ui.list}>{v.active.map((a, i) => <li key={i}><b>{a.district}:</b> {a.label}</li>)}</ul>
        </section>
      )}
      {on && v.areas.map((a) => (
        <section key={a.area} className={styles.group} aria-label={a.area}>
          <h2>{a.area}</h2>
          {a.rows.map((d) => (
            <div key={d.id} className={`${styles.rule} ${d.hold !== 'none' ? styles.on : ''}`}>
              <div className={styles.head}>
                <span>
                  <b>{d.name}</b>
                  {d.hardFought && <span className={styles.tag} title="Its benefits only with control">Hard fought</span>}
                  {d.abundance && <span className={styles.tag} title="The winner of a battle here gains +1D3 wyrdstone shards">☄ Wyrdstone</span>}
                  {d.gate && <span className={styles.tag}>Gate</span>}
                </span>
              </div>
              {d.effects.map((e, i) => <span key={i} className={styles.std}>{e.control ? 'With control: ' : ''}{e.label}</span>)}
              {d.others.length > 0 && <span className={styles.std}>Also a foothold here: {d.others.join(', ')}</span>}
              <div className={trade.seg} role="group" aria-label={d.name}>
                {HOLDS.map(([h, label]) => (
                  <button key={h} type="button" aria-pressed={d.hold === h}
                    onClick={() => { if (d.hold !== h) ed.edit((c) => core.setDistrict(c, d.id, h), `${d.name}: ${label.toLowerCase()}.`, KEEP); }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
      {ed.notice && <UndoToast key={ed.notice.id} text={ed.notice.text} onUndo={ed.undo} onDone={ed.dismiss} />}
    </section>
  );
}

export function Districts() {
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
