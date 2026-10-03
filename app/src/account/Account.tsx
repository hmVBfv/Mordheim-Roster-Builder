/* The account in More (campaign flavour; docs/mockups/more.html, phase
   3g): who is signed in, the authenticator, the password, the devices, and
   for the admin the way to the admin tools. Loaded with More only in the
   campaign app. */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useNotice } from '../ui/Notice.tsx';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { api, errorText, type Me } from './api.ts';
import styles from './Account.module.css';
import { AuthenticatorRow } from './Authenticator.tsx';
import { MIN_PASSWORD } from './LinkAccept.tsx';
import { refreshSession, signedOut, useSession } from './session.ts';
import { ago } from './time.ts';

interface Device { id: string; device: string; createdAt: string; lastSeenAt: string; current: boolean }

function PasswordRow({ onNotice }: { onNotice: (t: string) => void }) {
  const { ref, open, close } = useSheet();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if ([...next].length < MIN_PASSWORD) { setError(`The new password needs at least ${MIN_PASSWORD} characters.`); return; }
    if (next !== repeat) { setError('The two new passwords are not the same.'); return; }
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ signedOut: number }>('/account/password', { body: { current, next } });
      setCurrent(''); setNext(''); setRepeat('');
      close(() => onNotice(r.signedOut ? `Password changed; ${r.signedOut === 1 ? 'the other device is' : `${r.signedOut} other devices are`} signed out.` : 'Password changed.'));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <li>
      <span>Password<small>At least {MIN_PASSWORD} characters</small></span>
      <button type="button" className={ui.buttonQuiet} onClick={() => { setError(null); open(); }}>Change</button>
      <dialog ref={ref} className={ui.sheet} aria-labelledby="pass-title">
        <form className={ui.page} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <h2 id="pass-title">Password</h2>
          <label className={ui.field}>
            <span>Current password</span>
            <input className={ui.input} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </label>
          <label className={ui.field}>
            <span>New password</span>
            <input className={ui.input} type="password" autoComplete="new-password" minLength={MIN_PASSWORD} value={next} onChange={(e) => setNext(e.target.value)} required />
          </label>
          <label className={ui.field}>
            <span>The new password again</span>
            <input className={ui.input} type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} required />
          </label>
          <p className={ui.muted}>Your other devices are signed out and sign in with the new one.</p>
          {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
          <div className={ui.row}>
            <button type="submit" className={ui.button} disabled={busy || !current || !next || !repeat}>Change the password</button>
            <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
          </div>
        </form>
      </dialog>
    </li>
  );
}

function Devices({ onNotice }: { onNotice: (t: string) => void }) {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api<{ sessions: Device[] }>('/auth/sessions')
      .then((r) => { setDevices(r.sessions); setError(null); })
      .catch((e: unknown) => setError(errorText(e)));
  }, []);
  useEffect(load, [load]);
  const signOut = async (id: string) => {
    try {
      const r = await api<{ revoked: number }>(`/auth/sessions/${id}`, { method: 'DELETE' });
      onNotice(id === 'others' ? (r.revoked ? `Signed out on ${r.revoked === 1 ? 'one other device' : `${r.revoked} other devices`}.` : 'No other device was signed in.') : 'Signed out there.');
      load();
    } catch (e) {
      setError(errorText(e));
    }
  };
  const others = devices?.filter((d) => !d.current).length ?? 0;
  return (
    <section className={styles.section} aria-labelledby="dev-h">
      <h2 id="dev-h">Devices</h2>
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      {devices && (
        <ul className={styles.rows}>
          {devices.map((d) => (
            <li key={d.id}>
              <span>{d.device}<small>{d.current ? 'This device' : `Last used ${ago(d.lastSeenAt)}`} · signed in {ago(d.createdAt)}</small></span>
              {!d.current && <button type="button" className={ui.buttonQuiet} onClick={() => void signOut(d.id)}>Sign out</button>}
            </li>
          ))}
        </ul>
      )}
      {others > 0 && <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={() => void signOut('others')}>Sign out everywhere else</button></div>}
    </section>
  );
}

function AdminLinks({ user }: { user: Me }) {
  return (
    <section className={`${ui.card} ${styles.section}`} aria-labelledby="adm-h">
      <div className={styles.head}>
        <h2 id="adm-h">Admin</h2>
        <span className={styles.adminOnly} title="Only the admin sees this"><span aria-hidden="true">⚑</span> Admin only</span>
      </div>
      {user.mustSetUpTotp ? (
        <p className={ui.muted}>The admin tools open once your authenticator is set up.</p>
      ) : (
        <div className={ui.row}>
          <Link className={ui.buttonQuiet} to="/admin/users">Users</Link>
          <Link className={ui.buttonQuiet} to="/admin/invites">Invites</Link>
          <Link className={ui.buttonQuiet} to="/admin/logins">Sign-ins</Link>
          <Link className={ui.buttonQuiet} to="/admin/audit">Audit log</Link>
        </div>
      )}
    </section>
  );
}

export function AccountSection() {
  const session = useSession();
  const navigate = useNavigate();
  const [notice, notify] = useNotice();
  const [error, setError] = useState<string | null>(null);

  const signOutHere = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
      signedOut();
      notify('Signed out on this device. The warbands on it stay.');
    } catch (e) {
      setError(errorText(e));
    }
  };

  let body;
  switch (session.status) {
    case 'loading':
      body = <p className={ui.muted}>Checking your account…</p>;
      break;
    case 'unreachable':
      body = (
        <>
          <p>{session.user ? <>Last signed in as <strong>{session.user.displayName}</strong>. </> : null}The campaign server does not answer right now{navigator.onLine ? '' : ' – you are offline'}. Your warbands on this device work without it.</p>
          <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={() => void refreshSession()}>Try again</button></div>
        </>
      );
      break;
    case 'out':
      body = (
        <>
          <p>Not signed in. Accounts are by invitation: the campaign’s admin sends you a link.</p>
          <div className={ui.row}><Link className={ui.button} to="/sign-in">Sign in</Link></div>
        </>
      );
      break;
    case 'pending':
      body = (
        <>
          <p>Signing in is not finished: the code from your authenticator is still due.</p>
          <div className={ui.row}><button type="button" className={ui.button} onClick={() => void navigate('/sign-in')}>Enter the code</button></div>
        </>
      );
      break;
    case 'in': {
      const u = session.user;
      body = (
        <>
          <p className={styles.head}>
            <span><strong>{u.displayName}</strong>{u.displayName !== u.username && <span className={ui.muted}> · {u.username}</span>}</span>
            <span className={ui.muted}>{u.isAdmin ? 'Admin' : 'Player'}</span>
          </p>
          {u.mustSetUpTotp && <p className={ui.message}>Admins sign in with a code from an authenticator app. Set it up to open the admin tools.</p>}
          <ul className={styles.rows}>
            <AuthenticatorRow user={u} onNotice={notify} />
            <PasswordRow onNotice={notify} />
          </ul>
          <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={() => void signOutHere()}>Sign out</button></div>
        </>
      );
      break;
    }
  }

  return (
    <>
      <section className={`${ui.card} ${styles.section}`} aria-labelledby="acc-h">
        <h2 id="acc-h">Account</h2>
        {body}
        {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      </section>
      {session.status === 'in' && <Devices key={session.user.id} onNotice={notify} />}
      {session.status === 'in' && session.user.isAdmin && <AdminLinks user={session.user} />}
      {notice}
    </>
  );
}
