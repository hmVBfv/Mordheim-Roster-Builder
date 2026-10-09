/* One campaign (phase 4a1; docs/mockups/campaign.html and manage.html):
   the overview every member sees – the warbands entered with their player,
   type and the totals frozen at their last mark, the members – and, for
   leaders, Manage: the name, members and roles, the warbands waiting for a
   leader, moving on to the next round (4a4). Battles (4a2) and their
   aftermath (4a4): what is open for the user is at the top. */
import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router';
import { ApiError, errorText } from '../account/api.ts';
import styles0 from '../account/Account.module.css';
import { useSession } from '../account/session.ts';
import { listPeople, type Person } from '../share/shares.ts';
import { useWarbands } from '../sync/local.ts';
import { useNotice } from '../ui/Notice.tsx';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import {
  advanceRound, cachedCampaign, confirmEnrolment, declineEnrolment, forgetCampaign, getCampaign, removeMember, renameCampaign, ROLE_NAMES, roundName, setMember,
  type CampaignRole, type CampaignView, type Enrolment,
} from './api.ts';
import styles from './Campaign.module.css';
import { NewBattleSheet } from './NewBattle.tsx';
import { HistorySection } from './History.tsx';
import { NotesTab } from '../notes/Notes.tsx';
import { TimelineTab } from '../timeline/Timeline.tsx';
import { battleTitle } from '../battle/api.ts';

/** The campaign as last seen on this device, then as the server has it now. */
function useCampaign(id: string) {
  const [view, setView] = useState<CampaignView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const reload = useCallback(() => {
    getCampaign(id).then((v) => { setView(v); setError(null); }).catch((e: unknown) => {
      if (e instanceof ApiError && e.status === 404) { setGone(true); void forgetCampaign(id); } else setError(errorText(e));
    });
  }, [id]);
  useEffect(() => {
    let live = true;
    void cachedCampaign(id).then((v) => { if (live && v) setView((cur) => cur ?? v); });
    reload();
    return () => { live = false; };
  }, [id, reload]);
  return { view, setView, error, gone, reload };
}

const stateWord = (e: Enrolment) => {
  if (e.status === 'pending') return { word: 'Waiting for a leader', cls: styles.waiting };
  if (!e.tag) return { word: 'Entered', cls: styles.ok };
  if (e.tag.kind === 'sat_out') return { word: `Sat out battle ${e.tag.round}`, cls: '' };
  if (e.tag.kind === 'start') return { word: e.tag.round > 0 ? `✓ Entered after battle ${e.tag.round}` : '✓ Start', cls: styles.ok };
  return { word: `✓ After battle ${e.tag.round}`, cls: styles.ok };
};

function WarbandRows({ id, view, me }: { id: string; view: CampaignView; me: string }) {
  if (!view.enrolments.length) return <p className={ui.muted}>No warband entered yet.</p>;
  return (
    <ul className={styles.list} aria-label="Warbands">
      {view.enrolments.map((e) => {
        const st = stateWord(e);
        const t = e.tag?.totals;
        return (
          <li key={e.id}>
            <Link to={e.playerId === me ? `/warbands/${e.warbandId}` : `/campaign/${id}/warbands/${e.warbandId}`} className={styles.entry}>
              <span>
                {e.name || e.wbName}
                <small>{e.player} · {e.wbName}{t ? ` · Rating ${t.rating}` : ''}{(e.districts ?? []).length ? ` · holds ${(e.districts ?? []).map((d) => `${d.name}${d.hold === 'control' ? ' (control)' : ''}`).join(', ')}` : ''}</small>
                {(e.houseDiffers ?? []).length > 0 && <small className={styles.differs}>⚠ its own house rules differ</small>}
              </span>
              <span className={`${styles.chip} ${st.cls}`}>{st.word}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Entering one of one's own warbands: a copy goes in, the warband stays free. */
function EnterSheet({ id, onDone }: { id: string; onDone: (v: CampaignView) => void }) {
  const { ref, open, close } = useSheet();
  const navigate = useNavigate();
  const session = useSession();
  const me = session.status === 'in' ? session.user.id : undefined;
  const free = (useWarbands() ?? []).filter((w) => w.ownerId === me && !w.campaignId && !w.conflict);
  const [chosen, setChosen] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    const rec = free.find((w) => w.id === chosen);
    if (!rec) return;
    setBusy(true);
    setError(null);
    try {
      const [{ enterWarband }, { loadGameData }] = await Promise.all([import('./enter.ts'), import('../game/gameData.ts')]);
      const r = await enterWarband(await loadGameData(), id, rec);
      onDone(r.campaign);
      close(() => void navigate(`/warbands/${r.id}`));
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <>
      <button type="button" className={ui.button} onClick={() => { setChosen(''); setError(null); open(); }}>Enter a warband</button>
      <dialog ref={ref} className={ui.sheet} aria-labelledby="enter-title">
        <form className={ui.page} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <h2 id="enter-title">Enter a warband</h2>
          <p className={ui.muted}>A copy goes into the campaign, under the campaign’s house rules; the warband you pick stays as it is, for other games. A leader confirms the copy, and its start is marked.</p>
          {free.length === 0 && <p className={ui.muted}>None of your warbands is free yet: make a new one for the campaign.</p>}
          {free.length > 0 && (
            <fieldset className={styles.people}>
              <legend className="visually-hidden">Warband</legend>
              {free.map((w) => (
                <label key={w.id} className={styles.choice}>
                  <input type="radio" name="enter-warband" value={w.id} checked={chosen === w.id} onChange={() => setChosen(w.id)} />
                  <span>{w.name} <small>· {w.wbName}</small></span>
                </label>
              ))}
            </fieldset>
          )}
          {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
          <div className={ui.row}>
            {free.length > 0 && <button type="submit" className={ui.button} disabled={busy || !chosen}>Enter a copy</button>}
            <button type="button" className={free.length > 0 ? ui.buttonQuiet : ui.button} onClick={() => close(() => void navigate(`/warbands/new?campaign=${id}`))}>New warband for this campaign</button>
            <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
          </div>
        </form>
      </dialog>
    </>
  );
}

/** The closed battles one of the user's warbands fought and has not marked yet – not those of the history, played before the app (4a5). */
export function openAftermaths(view: CampaignView, me: string): { battleId: string; warbandId: string; label: string }[] {
  const mine = view.enrolments.filter((e) => e.playerId === me && e.status === 'active');
  return (view.battles ?? []).filter((b) => b.status === 'closed' && !b.takenOver).flatMap((b) => mine
    .filter((e) => (b.warbandIds ?? []).includes(e.warbandId) && !(b.marked ?? []).includes(e.warbandId))
    .map((e) => ({ battleId: b.id, warbandId: e.warbandId, label: `${battleTitle(b)} · ${e.name || e.wbName}` })));
}

/** Who holds which district (phase 4a4): a sole foothold is control, as the Roster Builder's campaign file worked it out. */
export function campaignMap(view: CampaignView): { id: string; name: string; holders: string[] }[] {
  const by = new Map<string, { id: string; name: string; holders: string[] }>();
  for (const e of view.enrolments.filter((x) => x.status === 'active')) {
    for (const d of e.districts ?? []) {
      const cur = by.get(d.id) ?? { id: d.id, name: d.name, holders: [] };
      cur.holders.push(e.name || e.wbName);
      by.set(d.id, cur);
    }
  }
  return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function Overview({ id, view, me, lead, onView }: { id: string; view: CampaignView; me: string; lead: boolean; onView: (v: CampaignView) => void }) {
  const open = openAftermaths(view, me);
  return (
    <div className={styles.columns}>
      {open.length > 0 && (
        <section className={`${styles.section} ${styles.wide}`} aria-labelledby="c-open">
          <h2 id="c-open">Open for you</h2>
          <ul className={styles.list}>
            {open.map((o) => (
              <li key={`${o.battleId}:${o.warbandId}`}>
                <Link to={`/warbands/${o.warbandId}/aftermath/${o.battleId}`} className={styles.entry}>
                  <span>Aftermath<small>{o.label}</small></span>
                  <span className={`${styles.chip} ${styles.waiting}`}>to mark</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className={styles.section} aria-labelledby="c-warbands">
        <h2 id="c-warbands">Warbands</h2>
        <WarbandRows id={id} view={view} me={me} />
        <div className={ui.row}>
          {view.role !== 'viewer' && <EnterSheet id={id} onDone={onView} />}
          <Link to={`/campaign/${id}/house-rules`} className={ui.buttonQuiet}>House rules</Link>
        </div>
      </section>
      <div className={ui.page}>
        <section className={styles.section} aria-labelledby="c-members">
          <h2 id="c-members">Members</h2>
          <ul className={styles.list} aria-label="Members">
            {view.members.map((m) => (
              <li key={m.userId} className={styles.member}>
                <span>{m.displayName}<small>{ROLE_NAMES[m.role]}</small></span>
              </li>
            ))}
          </ul>
        </section>
        <section className={styles.section} aria-labelledby="c-battles">
          <h2 id="c-battles">Battles</h2>
          {(view.battles ?? []).length === 0 && <p className={ui.muted}>No battles yet.</p>}
          {(view.battles ?? []).length > 0 && (
            <ul className={styles.list} aria-label="Battles">
              {[...(view.battles ?? [])].reverse().map((b) => (
                <li key={b.id}>
                  <Link to={`/campaign/${id}/battles/${b.id}`} className={styles.entry}>
                    <span>{battleTitle(b)}<small>{b.warbands.join(' · ')}</small></span>
                    <span className={`${styles.chip} ${b.status === 'open' ? styles.ok : ''}`}>
                      {b.takenOver ? 'before the app' : b.status === 'open' ? 'live' : b.marked && b.warbandIds ? `closed · ${b.marked.length}/${b.warbandIds.length} marked` : 'closed'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {lead && <div className={ui.row}><NewBattleSheet id={id} view={view} /></div>}
        </section>
        <section className={styles.section} aria-labelledby="c-map">
          <h2 id="c-map">The map</h2>
          {campaignMap(view).length === 0 && <p className={ui.muted}>No warband holds a district yet.</p>}
          {campaignMap(view).length > 0 && (
            <ul className={styles.list} aria-label="Districts held">
              {campaignMap(view).map((d) => (
                <li key={d.id} className={styles.member}>
                  <span>{d.name}<small>{d.holders.join(', ')}</small></span>
                  <span className={`${styles.chip} ${d.holders.length === 1 ? styles.ok : ''}`}>{d.holders.length === 1 ? 'control' : `${d.holders.length} footholds`}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Manage({ id, view, me, canLead, onView, onNotice }: { id: string; view: CampaignView; me: string; canLead: boolean; onView: (v: CampaignView) => void; onNotice: (t: string) => void }) {
  const [name, setName] = useState(view.campaign.name);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [adding, setAdding] = useState('');
  const [addRole, setAddRole] = useState<CampaignRole>('player');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  useEffect(() => { listPeople().then(setPeople).catch(() => setPeople([])); }, []);
  const run = async (f: () => Promise<CampaignView | { left: true }>, text?: string) => {
    setBusy(true);
    setError(null);
    try {
      const v = await f();
      if ('left' in v) { void navigate('/campaign', { replace: true, state: { all: true } }); return; }
      onView(v);
      if (text) onNotice(text);
    } catch (e) { setError(e instanceof ApiError && e.code === 'last_leader' ? 'A campaign keeps at least one leader: make someone else leader first.' : errorText(e)); } finally { setBusy(false); }
  };
  const waiting = view.enrolments.filter((e) => e.status === 'pending');
  const nextRound = view.campaign.round + 1;
  const ofNext = (view.battles ?? []).filter((b) => b.round === nextRound);
  const stillOpen = ofNext.filter((b) => b.status === 'open').length;
  const satOut = view.enrolments.filter((e) => e.status === 'active' && !ofNext.some((b) => (b.warbandIds ?? []).includes(e.warbandId)));
  const outside = (people ?? []).filter((p) => !view.members.some((m) => m.userId === p.id));
  if (!canLead) {
    return <p className={ui.message}>Leading needs the authenticator: set it up under More → Account, then come back.</p>;
  }
  return (
    <div className={styles.columns}>
      <div className={ui.page}>
        <section className={styles.section} aria-labelledby="m-waiting">
          <h2 id="m-waiting">Waiting for a leader</h2>
          {waiting.length === 0 && <p className={ui.muted}>No warband waiting.</p>}
          <ul className={styles.list}>
            {waiting.map((e) => (
              <li key={e.id} className={styles.member}>
                <span>{e.name || e.wbName}<small>{e.player} · {e.wbName}</small></span>
                <span className={styles.controls}>
                  <Link to={`/campaign/${id}/warbands/${e.warbandId}`} className={ui.buttonQuiet} aria-label={`Look at ${e.name || e.wbName}`}>Look</Link>
                  <button type="button" className={ui.button} disabled={busy} onClick={() => void run(() => confirmEnrolment(id, e.id), `${e.name || e.wbName} takes part; its start is marked.`)}>Confirm</button>
                  <button type="button" className={ui.buttonQuiet} disabled={busy} onClick={() => void run(() => declineEnrolment(id, e.id), 'Declined; the warband is free again.')}>Decline</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <HistorySection id={id} view={view} onView={onView} onNotice={onNotice} />
        <section className={styles.section} aria-labelledby="m-rules">
          <h2 id="m-rules">House rules</h2>
          <p className={ui.muted}>
            The same for every warband of the campaign; each player takes a change over into the warband’s file.
            {view.enrolments.some((e) => (e.houseDiffers ?? []).length) ? ` ${view.enrolments.filter((e) => (e.houseDiffers ?? []).length).map((e) => e.name || e.wbName).join(', ')}: own rules differ.` : ''}
          </p>
          <div className={ui.row}><Link to={`/campaign/${id}/house-rules`} className={ui.buttonQuiet}>Set the house rules</Link></div>
        </section>
        <section className={styles.section} aria-labelledby="m-round">
          <h2 id="m-round">The next round</h2>
          <p className={ui.muted}>
            Now: {roundName(view.campaign.round)}.{' '}
            {ofNext.length === 0 ? `No battle of round ${nextRound} yet.` : stillOpen ? `${stillOpen} of ${ofNext.length} battle${ofNext.length === 1 ? '' : 's'} of round ${nextRound} still being fought.` : `The battle${ofNext.length === 1 ? '' : 's'} of round ${nextRound} ${ofNext.length === 1 ? 'is' : 'are'} closed.`}
            {ofNext.length > 0 && satOut.length > 0 ? ` ${satOut.map((e) => e.name || e.wbName).join(', ')} fought none: moving on marks ${satOut.length === 1 ? 'it' : 'them'} as having sat the round out.` : ''}
          </p>
          <div className={ui.row}>
            <button type="button" className={ui.button} disabled={busy || ofNext.length === 0 || stillOpen > 0}
              onClick={() => void run(() => advanceRound(id), `On to ${roundName(nextRound)}.`)}>Move on to {roundName(nextRound)}</button>
          </div>
        </section>
        <form className={styles.section} onSubmit={(e) => { e.preventDefault(); void run(() => renameCampaign(id, name), 'Name saved.'); }}>
          <h2>Name</h2>
          <label className={ui.field}>
            <span>Name of the campaign</span>
            <input className={ui.input} value={name} maxLength={80} required onChange={(e) => setName(e.target.value)} />
          </label>
          <div className={ui.row}><button type="submit" className={ui.buttonQuiet} disabled={busy || !name.trim() || name.trim() === view.campaign.name}>Save the name</button></div>
        </form>
      </div>
      <div className={ui.page}>
        <section className={styles.section} aria-labelledby="m-members">
          <h2 id="m-members">Members</h2>
          <ul className={styles.list}>
            {view.members.map((m) => (
              <li key={m.userId} className={styles.member}>
                <span>{m.displayName}{m.userId === me ? ' (you)' : ''}<small>{m.role === 'leader' && m.canLead === false ? 'leads once the authenticator is set up' : m.username}</small></span>
                <span className={styles.controls}>
                  <select className={ui.select} aria-label={`Role of ${m.displayName}`} value={m.role} disabled={busy}
                    onChange={(e) => void run(() => setMember(id, m.userId, e.target.value as CampaignRole), `${m.displayName}: ${ROLE_NAMES[e.target.value as CampaignRole]}.`)}>
                    {(['leader', 'player', 'viewer'] as const).map((r) => <option key={r} value={r}>{ROLE_NAMES[r]}</option>)}
                  </select>
                  <button type="button" className={ui.buttonQuiet} disabled={busy} aria-label={`Take ${m.displayName} out of the campaign`}
                    onClick={() => void run(() => removeMember(id, m.userId), `${m.displayName} is no longer part of it.`)}>Take out</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <form className={styles.section} onSubmit={(e) => { e.preventDefault(); const who = outside.find((p) => p.id === adding); void run(() => setMember(id, adding, addRole), `${who?.displayName ?? 'Added'}: ${ROLE_NAMES[addRole]}.`).then(() => setAdding('')); }}>
          <h3>Add someone</h3>
          {people && outside.length === 0 && <p className={ui.muted}>Everyone with an account is part of it. New people get an invite from the admin first.</p>}
          {outside.length > 0 && (
            <>
              <label className={ui.field}>
                <span>Who</span>
                <select className={ui.select} value={adding} onChange={(e) => setAdding(e.target.value)} required>
                  <option value="">Choose…</option>
                  {outside.map((p) => <option key={p.id} value={p.id}>{p.displayName}{p.displayName !== p.username ? ` (${p.username})` : ''}</option>)}
                </select>
              </label>
              <label className={ui.field}>
                <span>As</span>
                <select className={ui.select} value={addRole} onChange={(e) => setAddRole(e.target.value as CampaignRole)}>
                  {(['player', 'viewer', 'leader'] as const).map((r) => <option key={r} value={r}>{ROLE_NAMES[r]}</option>)}
                </select>
              </label>
              <div className={ui.row}><button type="submit" className={ui.button} disabled={busy || !adding}>Add</button></div>
            </>
          )}
        </form>
        {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      </div>
    </div>
  );
}

export function Campaign() {
  const { id = '', tab } = useParams();
  const session = useSession();
  const user = session.status === 'in' ? session.user : session.status === 'unreachable' ? session.user : null;
  const { view, setView, error, gone } = useCampaign(id);
  const [notice, notify] = useNotice();
  if (gone) {
    return (
      <section className={ui.page}>
        <h1>Not a campaign of yours</h1>
        <p className={ui.muted}>This campaign does not exist, or you are no longer part of it.</p>
        <p><Link to="/campaign" state={{ all: true }} className={ui.buttonQuiet}>All campaigns</Link></p>
      </section>
    );
  }
  if (!view || !user) return error ? <section className={ui.page}><p className={ui.message} role="alert">{error}</p></section> : null;
  const lead = view.role === 'leader';
  const manage = tab === 'manage' && lead;
  const notes = tab === 'notes';
  const timeline = tab === 'timeline';
  return (
    <section className={ui.page}>
      <header>
        <h1>{view.campaign.name}</h1>
        <p className={ui.muted}>{roundName(view.campaign.round)} · you are {view.role === 'viewer' ? 'watching' : ROLE_NAMES[view.role].toLowerCase()}</p>
      </header>
      {error && <p className={ui.message} role="status">{error} Shown as last seen.</p>}
      <nav className={styles0.tabs} aria-label="Campaign">
        <NavLink to={`/campaign/${id}`} end>Overview</NavLink>
        <NavLink to={`/campaign/${id}/notes`}>Notes</NavLink>
        <NavLink to={`/campaign/${id}/timeline`}>Timeline</NavLink>
        {lead && <NavLink to={`/campaign/${id}/manage`}>Manage</NavLink>}
      </nav>
      {manage
        ? <Manage id={id} view={view} me={user.id} canLead={user.totp} onView={setView} onNotice={notify} />
        : notes
          ? <NotesTab id={id} view={view} user={user} lead={lead && user.totp} />
          : timeline
            ? <TimelineTab id={id} view={view} user={user} lead={lead && user.totp} />
            : <Overview id={id} view={view} me={user.id} lead={lead && user.totp} onView={setView} />}
      <div className={ui.row}><Link to="/campaign" state={{ all: true }} className={ui.buttonQuiet}>All campaigns</Link></div>
      {notice}
    </section>
  );
}
