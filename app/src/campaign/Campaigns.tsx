/* The Campaign tab (phase 4a1): the campaigns one is part of – always the list,
   also with a single one (#75) – and starting a new one, which makes its
   starter the first leader – anybody, the authenticator is for the admin's
   things (ADR 0030). */
import { useEffect, useState } from 'react';
import { useOnAnyCampaign } from '../live/live.ts';
import { Link, useLocation, useNavigate } from 'react-router';
import { errorText } from '../account/api.ts';
import { useSession } from '../account/session.ts';
import { Empty } from '../art/Pixels.tsx';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { placeChoices, useLore } from './place.ts';
import { archiveCampaign, cachedCampaigns, listCampaigns, ROLE_NAMES, roundName, startCampaign, type CampaignSummary } from './api.ts';
import styles from './Campaign.module.css';

function StartSheet() {
  const { ref, open, close } = useSheet();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [place, setPlace] = useState('');
  const [vanilla, setVanilla] = useState(false);
  const lore = useLore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const v = await startCampaign(name, vanilla ? 'mordheim' : place, vanilla);
      close(() => void navigate(`/campaign/${v.campaign.id}/manage`));
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <>
      <button type="button" className={ui.button} onClick={() => { setName(''); setPlace(''); setVanilla(false); setError(null); open(); }}>Start a campaign</button>
      <dialog ref={ref} className={ui.sheet} aria-labelledby="start-title">
        <form className={ui.page} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <h2 id="start-title">Start a campaign</h2>
          <p className={ui.muted}>You lead it: you add the players, and confirm the warbands they enter.</p>
          <label className={ui.field}>
            <span>Name of the campaign</span>
            <input className={ui.input} value={name} maxLength={80} required autoFocus onChange={(e) => setName(e.target.value)} />
          </label>
          {lore && (
            <label className={ui.field}>
              <span>Place{vanilla ? ' (the rulebook is set in Mordheim)' : ' (optional)'}</span>
              <select className={ui.select} value={vanilla ? 'mordheim' : place} disabled={vanilla} onChange={(e) => setPlace(e.target.value)}>
                <option value="">No particular place</option>
                {placeChoices(lore).map((p) => <option key={p.id} value={p.id}>{'\u00A0\u00A0'.repeat(p.depth)}{p.name}</option>)}
              </select>
            </label>
          )}
          <label className={styles.choice}>
            <input type="checkbox" checked={vanilla} onChange={(e) => setVanilla(e.target.checked)} />
            <span>Vanilla Mordheim <small>· only the rulebook: its warbands, its items and its skills. It cannot be switched on later; a leader can switch it off for good.</small></span>
          </label>
          {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
          <div className={ui.actions}>
            <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
            <button type="submit" className={ui.button} disabled={busy || !name.trim()}>Start it</button>
          </div>
        </form>
      </dialog>
    </>
  );
}

export function Campaigns() {
  const session = useSession();
  const location = useLocation();
  const user = session.status === 'in' ? session.user : session.status === 'unreachable' ? session.user : null;
  const [list, setList] = useState<CampaignSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let live = true;
    void cachedCampaigns(userId).then((c) => { if (live && c) setList((l) => l ?? c); });
    listCampaigns(userId).then((c) => { if (live) { setList(c); setError(null); } }).catch((e: unknown) => { if (live) setError(errorText(e)); });
    return () => { live = false; };
  }, [userId]);
  useOnAnyCampaign(() => {
    if (userId) listCampaigns(userId).then((c) => { setList(c); setError(null); }).catch(() => undefined);
  });

  if (session.status === 'loading') return null;
  if (!user) {
    return (
      <section className={ui.page}>
        <h1>Campaigns</h1>
        <p className={ui.muted}>Campaigns live on the campaign server: sign in to see yours.</p>
        <p><Link to="/sign-in" className={ui.button}>Sign in</Link></p>
      </section>
    );
  }
  const deleted = (location.state as { deleted?: string } | null)?.deleted;
  // the list is split: the campaigns one plays, and those one filed away for oneself (Rob, 19.10.2026)
  const active = list?.filter((c) => !c.archived) ?? null;
  const filed = list?.filter((c) => c.archived) ?? [];
  const file = (c: CampaignSummary, archived: boolean) => {
    setList((l) => l?.map((x) => (x.id === c.id ? { ...x, archived } : x)) ?? l);
    archiveCampaign(c.id, archived).catch((e: unknown) => {
      setList((l) => l?.map((x) => (x.id === c.id ? { ...x, archived: !archived } : x)) ?? l);
      setError(errorText(e));
    });
  };
  const entry = (c: CampaignSummary) => (
    <li key={c.id} className={styles.filedRow}>
      <Link to={`/campaign/${c.id}`} className={styles.entry}>
        <span>{c.name}<small>{ROLE_NAMES[c.role]} · {roundName(c.round)} · {c.warbands} warband{c.warbands === 1 ? '' : 's'}</small></span>
      </Link>
      <button type="button" className={ui.buttonQuiet} aria-label={`${c.archived ? 'Back to the list' : 'Archive'}: ${c.name}`} onClick={() => file(c, !c.archived)}>
        {c.archived ? 'Back to the list' : 'Archive'}
      </button>
    </li>
  );
  return (
    <section className={ui.page}>
      <h1>Campaigns</h1>
      {deleted && <p className={ui.message} role="status">“{deleted}” is deleted. Its warbands are with their players again.</p>}
      {error && <p className={ui.message} role="status">{error}{list ? ' Shown as last seen.' : ''}</p>}
      {list && list.length === 0 && <Empty scene="gate" title="You are not part of a campaign yet.">A leader adds you; or start one yourself.</Empty>}
      {active && active.length > 0 && <ul className={`${styles.list} ${styles.listWide}`} aria-label="Your campaigns">{active.map(entry)}</ul>}
      {active && active.length === 0 && filed.length > 0 && <p className={ui.muted}>Every campaign of yours is in the archive.</p>}
      {filed.length > 0 && (
        <section className={styles.section} aria-labelledby="c-archived">
          <h2 id="c-archived">Archived</h2>
          <p className={ui.muted}>Filed away for you alone: the others still see them in their lists, and nothing in them changes.</p>
          <ul className={`${styles.list} ${styles.listWide}`} aria-label="Archived campaigns">{filed.map(entry)}</ul>
        </section>
      )}
      <div className={ui.row}><StartSheet /></div>
    </section>
  );
}
