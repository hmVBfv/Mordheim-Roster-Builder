/* A one-time link from the admin (phase 3g): /invite#<token> makes an
   account, /reset#<token> sets a new password. The token is in the
   fragment, which the browser never sends to a server; the app takes it,
   removes it from the address bar (and so from the history), and sends it
   to the API in the body. */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useOnline } from '../app/SyncState.tsx';
import ui from '../ui/ui.module.css';
import { api, errorText, type Me } from './api.ts';
import styles from './Account.module.css';
import { deviceLabel } from './device.ts';
import { signedIn } from './session.ts';

type Answer = { stage: 'totp' } | { stage: 'full'; user: Me };
type Check = { kind: 'register' | 'reset'; expiresAt: string; username: string | null };

export const MIN_PASSWORD = 12;

/** The token leaves the address bar at once; kept here, so that React's
    double start in development (and a re-render) still finds it. */
let taken = '';
function takeToken(): string {
  if (location.hash.length > 1) {
    try {
      taken = decodeURIComponent(location.hash.slice(1));
    } catch {
      taken = '';
    }
    history.replaceState(history.state, '', location.pathname + location.search);
  }
  return taken;
}

export function LinkAccept() {
  const navigate = useNavigate();
  const online = useOnline();
  const [token] = useState(takeToken);
  const [check, setCheck] = useState<Check | 'loading' | { error: string }>(token ? 'loading' : { error: 'This address needs the whole link from the admin, including the part after “#”.' });
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let live = true;
    api<Check>('/invites/check', { body: { token } })
      .then((c) => { if (live) setCheck(c); })
      .catch((e: unknown) => { if (live) setCheck({ error: errorText(e) }); });
    return () => { live = false; };
  }, [token]);

  if (check === 'loading') return <section className={ui.page}><h1>Your link</h1><p className={ui.muted}>Checking the link…</p></section>;
  if ('error' in check) {
    return (
      <section className={ui.page}>
        <h1>Your link</h1>
        <p className={`${ui.message} ${ui.error}`} role="alert">{check.error}</p>
        <div className={ui.row}><Link className={ui.buttonQuiet} to="/sign-in">Sign in</Link></div>
      </section>
    );
  }

  const register = check.kind === 'register';
  const tooShort = [...password].length < MIN_PASSWORD;
  const mismatch = repeat !== '' && repeat !== password;
  const submit = async () => {
    if (tooShort) { setError(`The password needs at least ${MIN_PASSWORD} characters.`); return; }
    if (password !== repeat) { setError('The two passwords are not the same.'); return; }
    setBusy(true);
    setError(null);
    try {
      const a = await api<Answer>('/invites/accept', {
        body: register ? { token, username: username.trim(), displayName: displayName.trim(), password, device: deviceLabel() } : { token, password, device: deviceLabel() },
      });
      signedIn(a);
      taken = '';
      // with an authenticator the code is still due: the sign-in screen asks for it
      navigate(a.stage === 'full' ? '/more' : '/sign-in?next=/more', { replace: true });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={ui.page}>
      <h1>{register ? 'Join the campaign' : 'A new password'}</h1>
      <form className={`${ui.card} ${styles.form}`} onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        {register ? (
          <>
            <p className={ui.muted}>You were invited to Mordheim Campaign. Choose how you sign in. The link works once, until {new Date(check.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.</p>
            <div className={ui.field}>
              <label className={ui.field}>
                <span>Username</span>
                <input className={ui.input} name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} pattern="[A-Za-z0-9._\-]{3,32}" aria-describedby="username-hint"
                  value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
              </label>
              <small id="username-hint" className={ui.muted}>3 to 32 letters, digits, dots, dashes or underscores. You sign in with it.</small>
            </div>
            <label className={ui.field}>
              <span>Name shown to the others (optional)</span>
              <input className={ui.input} name="displayName" autoComplete="nickname" maxLength={64}
                value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </label>
          </>
        ) : (
          <p>For <strong>{check.username}</strong>. Afterwards every device signs in again with the new password.</p>
        )}
        <div className={ui.field}>
          <label className={ui.field}>
            <span>Password</span>
            <input className={ui.input} name="password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD} aria-describedby="password-hint"
              value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus={!register} />
          </label>
          <small id="password-hint" className={ui.muted}>At least {MIN_PASSWORD} characters – a few words are easier to remember than symbols. Not the username, nothing common.</small>
        </div>
        <div className={ui.field}>
          <label className={ui.field}>
            <span>The password again</span>
            <input className={ui.input} name="repeat" type="password" autoComplete="new-password" aria-describedby={mismatch ? 'repeat-hint' : undefined}
              value={repeat} onChange={(e) => setRepeat(e.target.value)} required aria-invalid={mismatch} />
          </label>
          {mismatch && <small id="repeat-hint" className={ui.error}>Not the same as above.</small>}
        </div>
        {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
        <div className={ui.row}>
          <button type="submit" className={ui.button} disabled={busy || !online || !password || !repeat || (register && !username.trim())}>
            {register ? 'Create the account' : 'Set the password'}
          </button>
        </div>
      </form>
    </section>
  );
}
