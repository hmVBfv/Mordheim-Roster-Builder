/* Signing in (phase 3g; docs/security.md section 3): username and
   password, then – with an authenticator – its code, or one of the recovery
   codes instead. Accounts come from an invite only, so there is no
   "register" here. After signing in the app goes where it was sent from
   (`?next=`), or to the account in More. */
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useOnline } from '../app/SyncState.tsx';
import ui from '../ui/ui.module.css';
import { api, errorText, type Me } from './api.ts';
import styles from './Account.module.css';
import { deviceLabel, safeNext } from './device.ts';
import { signedIn, signedOut, useSession } from './session.ts';

type Answer = { stage: 'totp' } | { stage: 'full'; user: Me };

export function SignIn() {
  const session = useSession();
  const online = useOnline();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (f: () => Promise<Answer>) => {
    setBusy(true);
    setError(null);
    try {
      const a = await f();
      signedIn(a);
      if (a.stage === 'full') navigate(next, { replace: true });
      else setPassword('');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (session.status === 'in') {
    return (
      <section className={ui.page}>
        <h1>Sign in</h1>
        <p className={ui.card}>Signed in as <strong>{session.user.displayName}</strong>.</p>
        <div className={ui.row}><Link className={ui.button} to="/more">Your account</Link></div>
      </section>
    );
  }

  if (session.status === 'pending') {
    return (
      <section className={ui.page}>
        <h1>Sign in</h1>
        <form className={`${ui.card} ${styles.form}`} onSubmit={(e) => { e.preventDefault(); void run(() => api<Answer>('/auth/totp', { body: { code } })); }}>
          {recovery ? (
            <div className={ui.field}>
              <label className={ui.field}>
                <span>One of your recovery codes</span>
                <input className={ui.input} name="code" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="xxxx-xxxx" aria-describedby="recovery-hint"
                  value={code} onChange={(e) => setCode(e.target.value)} required autoFocus />
              </label>
              <small id="recovery-hint" className={ui.muted}>Each works once. Running low? Set up the authenticator again in your account for new ones.</small>
            </div>
          ) : (
            <label className={ui.field}>
              <span>Code from your authenticator app</span>
              <input className={`${ui.input} ${styles.code}`} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7}
                value={code} onChange={(e) => setCode(e.target.value)} required autoFocus />
            </label>
          )}
          {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
          <div className={ui.row}>
            <button type="submit" className={ui.button} disabled={busy || !online || !code.trim()}>Confirm</button>
            <button type="button" className={ui.buttonQuiet} onClick={() => { setRecovery(!recovery); setCode(''); setError(null); }}>
              {recovery ? 'Use the app’s code' : 'Use a recovery code'}
            </button>
          </div>
          <button type="button" className={`${ui.buttonQuiet} ${styles.start}`} onClick={() => { signedOut(); setCode(''); setError(null); }}>Start again</button>
        </form>
      </section>
    );
  }

  return (
    <section className={ui.page}>
      <h1>Sign in</h1>
      <form className={`${ui.card} ${styles.form}`} onSubmit={(e) => { e.preventDefault(); void run(() => api<Answer>('/auth/login', { body: { username: username.trim(), password, device: deviceLabel() } })); }}>
        <label className={ui.field}>
          <span>Username</span>
          <input className={ui.input} name="username" autoComplete="username" autoCapitalize="none" spellCheck={false}
            value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
        </label>
        <label className={ui.field}>
          <span>Password</span>
          <input className={ui.input} name="password" type="password" autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {!online && <p className={ui.message}>You are offline – signing in needs the connection. The warbands on this device work without it.</p>}
        {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
        <div className={ui.row}>
          <button type="submit" className={ui.button} disabled={busy || !online || !username.trim() || !password}>Sign in</button>
        </div>
      </form>
      <p className={ui.muted}>Accounts are by invitation: the campaign’s admin sends you a link. Forgot your password? The admin can send a link to set a new one.</p>
    </section>
  );
}
