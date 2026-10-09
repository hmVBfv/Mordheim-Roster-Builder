/* The campaign's history (phase 4a5; roadmap 4a5, Decision E): a campaign
   that began before the app – the group's runs in the Roster Builder –
   brings the battles already played. A leader records them under Manage:
   the round, a title, the district, the day, who fought and how it ended.
   They stay as they were: no protocol, no aftermath, nothing to mark. The
   campaign stands after the last of them, and each warband's start is
   marked there. Open while the campaign has no battle of its own. */
import { Suspense, useState } from 'react';
import { errorText } from '../account/api.ts';
import { battleTitle, getBattle, OUTCOME_NAMES, type BattleSummary, type Outcome } from '../battle/api.ts';
import { newId } from '../db/ids.ts';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { dayName, historyOf, putPastBattle, removePastBattle, type CampaignView } from './api.ts';
import styles from './Campaign.module.css';
import { Districts } from './NewBattle.tsx';

/** Not among those who fought. */
const ABSENT = '-';
type Pick = Outcome | typeof ABSENT;

interface Form { bid: string; known: boolean; round: string; title: string; district: string; playedOn: string; picks: Record<string, Pick> }

export function HistorySection({ id, view, onView, onNotice }: { id: string; view: CampaignView; onView: (v: CampaignView) => void; onNotice: (t: string) => void }) {
  const h = historyOf(view);
  const active = view.enrolments.filter((e) => e.status === 'active');
  const { ref, open, close } = useSheet();
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fresh = () => {
    setError(null);
    setForm({ bid: newId(), known: false, round: String(h.round + 1), title: '', district: '', playedOn: '', picks: Object.fromEntries(active.map((e) => [e.warbandId, '' as Pick])) });
    open();
  };
  const change = (b: BattleSummary) => {
    setError(null);
    getBattle(id, b.id).then((v) => {
      const fought = Object.fromEntries(v!.participants.map((p) => [p.warbandId, p.outcome]));
      setForm({
        bid: b.id, known: true, round: String(b.round), title: v!.battle.title, district: v!.battle.district, playedOn: v!.battle.playedAt ?? '',
        picks: Object.fromEntries(active.map((e) => [e.warbandId, (fought[e.warbandId] ?? ABSENT) as Pick])),
      });
      open();
    }).catch((e: unknown) => onNotice(errorText(e)));
  };
  const round = Number(form?.round);
  const roundOk = Number.isInteger(round) && round >= 1 && round <= 99;
  const fighters = form ? Object.entries(form.picks).filter(([, o]) => o !== ABSENT) : [];
  const save = async () => {
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      const v = await putPastBattle(id, form.bid, {
        round, title: form.title.trim(), district: form.district, playedOn: form.playedOn || null,
        outcomes: Object.fromEntries(fighters) as Record<string, Outcome>,
      });
      onView(v);
      close(() => onNotice(`${battleTitle({ round, title: form.title.trim() })} is in the history.`));
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const takeOut = async () => {
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      onView(await removePastBattle(id, form.bid));
      close(() => onNotice('Taken out of the history.'));
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));
  // a campaign that began in the app has nothing to show here
  if (!h.open && h.battles.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="m-history">
      <h2 id="m-history">Before the app</h2>
      <p className={ui.muted}>
        {h.open
          ? 'A campaign that began before the app: record the battles already played – who fought and how it ended. They stay as they were: no protocol, no aftermath, nothing to mark. The campaign then stands after the last of them, and each warband’s start is marked there.'
          : 'The campaign’s own battles have begun: its history is closed.'}
      </p>
      {h.battles.length > 0 && (
        <ul className={styles.list} aria-label="Battles before the app">
          {h.battles.map((b) => (
            <li key={b.id} className={styles.member}>
              <span>{battleTitle(b)}<small>{[b.playedAt ? dayName(b.playedAt) : '', b.warbands.join(' · ')].filter(Boolean).join(' · ')}</small></span>
              {h.open && <button type="button" className={ui.buttonQuiet} aria-label={`Change ${battleTitle(b)}`} onClick={() => change(b)}>Change</button>}
            </li>
          ))}
        </ul>
      )}
      {h.open && active.length === 0 && <p className={ui.muted}>Confirm the warbands first: a battle names who fought it.</p>}
      {h.open && <div className={ui.row}><button type="button" className={ui.buttonQuiet} disabled={active.length === 0} onClick={fresh}>+ A battle before the app</button></div>}
      <dialog ref={ref} className={ui.sheet} aria-labelledby="past-title">
        {form && (
          <form className={ui.page} onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <h2 id="past-title">{form.known ? 'A battle before the app' : 'New battle before the app'}</h2>
            <label className={ui.field}>
              <span>Battle</span>
              <input className={ui.input} type="number" inputMode="numeric" min={1} max={99} required value={form.round} onChange={(e) => set({ round: e.target.value })} />
            </label>
            <label className={ui.field}>
              <span>Title (optional)</span>
              <input className={ui.input} value={form.title} maxLength={120} placeholder="The Verdict in the Fog" onChange={(e) => set({ title: e.target.value })} />
            </label>
            <label className={ui.field}>
              <span>District</span>
              <Suspense fallback={<select className={ui.select} disabled><option>Loading the map…</option></select>}>
                <Districts value={form.district} onChange={(district) => set({ district })} />
              </Suspense>
            </label>
            <label className={ui.field}>
              <span>Played on (optional)</span>
              <input className={ui.input} type="date" value={form.playedOn} onChange={(e) => set({ playedOn: e.target.value })} />
            </label>
            <fieldset className={styles.people}>
              <legend>Who fought, and how it ended</legend>
              {active.map((e) => (
                <label key={e.warbandId} className={ui.field}>
                  <span>{e.name || e.wbName} <small>· {e.player}</small></span>
                  <select className={ui.select} value={form.picks[e.warbandId] ?? ABSENT} onChange={(x) => set({ picks: { ...form.picks, [e.warbandId]: x.target.value as Pick } })}>
                    <option value={ABSENT}>Not there</option>
                    <option value="">Fought – outcome not known</option>
                    {(Object.keys(OUTCOME_NAMES) as Exclude<Outcome, ''>[]).map((o) => <option key={o} value={o}>{OUTCOME_NAMES[o]}</option>)}
                  </select>
                </label>
              ))}
            </fieldset>
            {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
            <div className={ui.row}>
              <button type="submit" className={ui.button} disabled={busy || !roundOk || fighters.length === 0}>Save</button>
              {form.known && <button type="button" className={ui.buttonQuiet} disabled={busy} onClick={() => void takeOut()}>Take it out</button>}
              <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
            </div>
          </form>
        )}
      </dialog>
    </section>
  );
}
