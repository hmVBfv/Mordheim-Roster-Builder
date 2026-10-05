/* The Campaign tab (phase 4a1): the campaigns one is part of – with a single
   one, straight to it – and starting a new one, which makes its starter the
   first leader and so needs the authenticator (ADR 0008). */
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { errorText } from '../account/api.ts';
import { useSession } from '../account/session.ts';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { cachedCampaigns, listCampaigns, ROLE_NAMES, roundName, startCampaign, type CampaignSummary } from './api.ts';
import styles from './Campaign.module.css';

function StartSheet() {
  const { ref, open, close } = useSheet();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const v = await startCampaign(name);
      close(() => void navigate(`/campaign/${v.campaign.id}/manage`));
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <>
      <button type="button" className={ui.button} onClick={() => { setName(''); setError(null); open(); }}>Start a campaign</button>
      <dialog ref={ref} className={ui.sheet} aria-labelledby="start-title">
        <form className={ui.page} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <h2 id="start-title">Start a campaign</h2>
          <p className={ui.muted}>You lead it: you add the players, and confirm the warbands they enter.</p>
          <label className={ui.field}>
            <span>Name of the campaign</span>
            <input className={ui.input} value={name} maxLength={80} required autoFocus onChange={(e) => setName(e.target.value)} />
          </label>
          {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
          <div className={ui.row}>
            <button type="submit" className={ui.button} disabled={busy || !name.trim()}>Start it</button>
            <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
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
  // one campaign: straight to it (from there, "All campaigns" comes back here)
  const all = !!(location.state as { all?: boolean } | null)?.all;
  if (list && list.length === 1 && !all) return <Navigate to={`/campaign/${list[0]!.id}`} replace />;
  return (
    <section className={ui.page}>
      <h1>Campaigns</h1>
      {error && <p className={ui.message} role="status">{error}{list ? ' Shown as last seen.' : ''}</p>}
      {list && list.length === 0 && <p className={ui.muted}>You are not part of a campaign yet. A leader adds you; or start one yourself.</p>}
      {list && list.length > 0 && (
        <ul className={styles.list} aria-label="Your campaigns">
          {list.map((c) => (
            <li key={c.id}>
              <Link to={`/campaign/${c.id}`} className={styles.entry}>
                <span>{c.name}<small>{ROLE_NAMES[c.role]} · {roundName(c.round)} · {c.warbands} warband{c.warbands === 1 ? '' : 's'}</small></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {user.totp
        ? <div className={ui.row}><StartSheet /></div>
        : (
          <>
            <p className={ui.muted}>Starting a campaign needs the authenticator – a leader’s account is worth more to an intruder. Set it up under More → Account.</p>
            <div className={ui.row}><Link to="/more" className={ui.buttonQuiet}>To the account</Link></div>
          </>
        )}
    </section>
  );
}
