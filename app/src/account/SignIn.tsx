/* Signing in (phase 3g; docs/security.md section 3): username and
   password, then – with an authenticator – its code, or one of the recovery
   codes instead. Accounts come from an invite only, so there is no
   "register" here. After signing in the app goes where it was sent from
   (`?next=`), or to the account (Account in the navigation).

   The authenticator's code is sent by itself with its sixth digit (Rob,
   20.10.2026: most sign-ins do). That asks nothing more of the server than
   the button does: the code is checked there, and the brake (5 failures in
   15 minutes, then a doubling wait; docs/security.md) counts every try. A
   typo is now a try before the player could look at it, so a wrong code
   comes back selected, and is sent again only after it was changed. A
   recovery code has no length to wait for and stays with the button. */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useOnline } from '../app/SyncState.tsx';
import ui from '../ui/ui.module.css';
import { api, errorText, type Me } from './api.ts';
import styles from './Account.module.css';
import { deviceLabel, safeNext } from './device.ts';
import { signedIn, signedOut, useSession } from './session.ts';
import { ACCOUNT } from '../app/paths.ts';

type Answer = { stage: 'totp' } | { stage: 'full'; user: Me };

/** The app's code: six digits, typed or pasted with the space some apps print in the middle. */
const isAppCode = (v: string): boolean => /^\d{6}$/.test(v.replace(/\s/g, ''));

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
  const codeField = useRef<HTMLInputElement>(null);
  // a try on its way: a second one (a field that changes twice) would be a second failure for the brake
  const inFlight = useRef(false);

  const run = async (f: () => Promise<Answer>) => {
    if (inFlight.current) return;
    inFlight.current = true;
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
      inFlight.current = false;
      setBusy(false);
    }
  };
  const sendCode = (c: string) => run(() => api<Answer>('/auth/totp', { body: { code: c } }));
  const typeCode = (v: string) => {
    setCode(v);
    if (!recovery && online && isAppCode(v)) void sendCode(v);
  };
  // a code that was not right is selected: the next one replaces it
  useEffect(() => { if (error) codeField.current?.select(); }, [error]);

  if (session.status === 'in') {
    return (
      <section className={ui.page}>
        <h1>Sign in</h1>
        <p className={ui.card}>Signed in as <strong>{session.user.displayName}</strong>.</p>
        <div className={ui.row}><Link className={ui.button} to={ACCOUNT}>Your account</Link></div>
      </section>
    );
  }

  if (session.status === 'pending') {
    return (
      <section className={ui.page}>
        <h1>Sign in</h1>
        <form className={`${ui.card} ${styles.form}`} onSubmit={(e) => { e.preventDefault(); void sendCode(code); }}>
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
            <div className={ui.field}>
              <label className={ui.field}>
                <span>Code from your authenticator app</span>
                <input ref={codeField} className={`${ui.input} ${styles.code}`} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} aria-describedby="code-hint"
                  value={code} onChange={(e) => typeCode(e.target.value)} required autoFocus />
              </label>
              <small id="code-hint" className={ui.muted}>It signs you in as soon as the sixth digit is in.</small>
            </div>
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
