/* The Warbands tab of a campaign (Rob, 19.10.2026: "eine Unterkategorie links
   wie Warbands zum schnellen Überblick"): every warband that takes part as a
   card – player and type, where it stands (the totals frozen at its last
   mark), the districts it holds – the strongest first, side by side on a
   desktop. Those waiting for a leader stand apart. What the overview shows in
   a line is here at a glance; the numbers are those of the last mark, not
   live ones. */
import { Link } from 'react-router';
import { Empty } from '../art/Pixels.tsx';
import ui from '../ui/ui.module.css';
import type { CampaignView, Enrolment } from './api.ts';
import styles from './Campaign.module.css';
import { EnterSheet } from './EnterSheet.tsx';

export const stateWord = (e: Enrolment) => {
  if (e.status === 'pending') return { word: 'Waiting for a leader', cls: styles.waiting };
  if (!e.tag) return { word: 'Entered', cls: styles.ok };
  if (e.tag.kind === 'sat_out') return { word: `Sat out battle ${e.tag.round}`, cls: '' };
  if (e.tag.kind === 'start') return { word: e.tag.round > 0 ? `✓ Entered after battle ${e.tag.round}` : '✓ Start', cls: styles.ok };
  return { word: `✓ After battle ${e.tag.round}`, cls: styles.ok };
};

const FACTS = [
  ['rating', 'Rating'], ['models', 'Warriors'], ['heroes', 'Heroes'], ['gold', 'Gold'], ['fallen', 'Fallen'],
] as const;

/** Active warbands by rating, the strongest first; one without a mark yet after those that have one. */
export function ranked(view: CampaignView): Enrolment[] {
  return view.enrolments.filter((e) => e.status === 'active')
    .map((e, i) => ({ e, i }))
    .sort((a, b) => (b.e.tag?.totals.rating ?? -1) - (a.e.tag?.totals.rating ?? -1) || a.i - b.i)
    .map((x) => x.e);
}

function Card({ id, e, me, top }: { id: string; e: Enrolment; me: string; top: number }) {
  const st = stateWord(e);
  const t = e.tag?.totals;
  const name = e.name || e.wbName;
  const held = e.districts ?? [];
  return (
    <li>
      <Link to={e.playerId === me ? `/warbands/${e.warbandId}` : `/campaign/${id}/warbands/${e.warbandId}`} className={styles.warbandCard}>
        <span className={styles.cardHead}>
          <strong>{name}</strong>
          <span className={`${styles.chip} ${st.cls}`}>{st.word}</span>
        </span>
        <small>{e.player}{e.playerId === me ? ' (you)' : ''} · {e.wbName}</small>
        {t ? (
          <>
            <span className={styles.bar} aria-hidden="true"><span style={{ width: `${top > 0 ? Math.max(4, Math.round((t.rating / top) * 100)) : 0}%` }} /></span>
            <dl className={styles.facts}>
              {FACTS.map(([k, label]) => <div key={k}><dt>{label}</dt><dd>{t[k]}</dd></div>)}
            </dl>
          </>
        ) : <small className={ui.muted}>No mark yet – its numbers come with the first one.</small>}
        {held.length > 0 && <small>Holds {held.map((d) => `${d.name}${d.hold === 'control' ? ' (control)' : ''}`).join(', ')}</small>}
        {(e.houseDiffers ?? []).length > 0 && <small className={styles.differs}>⚠ its own house rules differ</small>}
      </Link>
    </li>
  );
}

export function WarbandsTab({ id, view, me, onView }: { id: string; view: CampaignView; me: string; onView: (v: CampaignView) => void }) {
  const playing = ranked(view);
  const waiting = view.enrolments.filter((e) => e.status === 'pending');
  const top = Math.max(0, ...playing.map((e) => e.tag?.totals.rating ?? 0));
  return (
    <div className={ui.page}>
      <section className={styles.section} aria-labelledby="w-playing">
        <h2 id="w-playing">Warbands in the campaign</h2>
        {playing.length === 0 && <Empty scene="camp" title="No warband takes part yet." compact />}
        {playing.length > 0 && (
          <>
            <p className={ui.muted}>{playing.length} {playing.length === 1 ? 'warband takes' : 'warbands take'} part, the strongest first. The numbers are those of each warband’s last mark.</p>
            <ul className={styles.cards} aria-label="Warbands">
              {playing.map((e) => <Card key={e.id} id={id} e={e} me={me} top={top} />)}
            </ul>
          </>
        )}
        <div className={ui.row}>
          {view.role !== 'viewer' && <EnterSheet id={id} rules={view.campaign.houseRules} onDone={onView} />}
          <Link to={`/campaign/${id}/house-rules`} className={ui.buttonQuiet}>House rules</Link>
        </div>
      </section>
      {waiting.length > 0 && (
        <section className={styles.section} aria-labelledby="w-waiting">
          <h2 id="w-waiting">Waiting for a leader</h2>
          <ul className={styles.cards} aria-label="Waiting warbands">
            {waiting.map((e) => <Card key={e.id} id={id} e={e} me={me} top={top} />)}
          </ul>
        </section>
      )}
    </div>
  );
}
