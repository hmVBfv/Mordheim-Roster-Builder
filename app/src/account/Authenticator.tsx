/* The authenticator in the account (phase 3g; ADR 0008): set it up by
   scanning a QR code (or opening the link on the same phone, or typing the
   key), confirm with its first code, keep the ten recovery codes. Required
   for the admin – and later for leaders – optional for players, who may turn
   it off again with their password and a code. A new phone in place of the
   old takes a code of the old one, or a recovery code (security review
   AUTH-3, AUTH-15): a stolen session alone does not change the second
   factor. */
import { useEffect, useState } from 'react';
import { copyText, saveFile } from '../ui/files.ts';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { api, errorText, type Me } from './api.ts';
import styles from './Account.module.css';
import { refreshSession } from './session.ts';

/** The QR code of the otpauth link, drawn as one SVG path; the encoder is
    loaded only when someone sets up an authenticator. */
function QrCode({ text }: { text: string }) {
  const [qr, setQr] = useState<{ size: number; path: string } | null>(null);
  useEffect(() => {
    let live = true;
    void import('uqr').then(({ encode }) => {
      if (!live) return;
      const { data, size } = encode(text, { ecc: 'M', border: 2 });
      let path = '';
      data.forEach((row, y) => row.forEach((dark, x) => { if (dark) path += `M${x} ${y}h1v1h-1z`; }));
      setQr({ size, path });
    });
    return () => { live = false; };
  }, [text]);
  if (!qr) return <div className={`${styles.qr} ${styles.qrWait}`} aria-hidden="true" />;
  return (
    <svg className={styles.qr} viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label="QR code for your authenticator app" shapeRendering="crispEdges">
      <path d={qr.path} fill="#000" />
    </svg>
  );
}

type Step = { at: 'intro' } | { at: 'scan'; secret: string; uri: string } | { at: 'codes'; codes: string[] };

export function AuthenticatorRow({ user, onNotice }: { user: Me; onNotice: (t: string) => void }) {
  const { ref, open, close } = useSheet();
  const [step, setStep] = useState<Step>({ at: 'intro' });
  const [code, setCode] = useState('');
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await f(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const start = () => run(async () => {
    const s = await api<{ secret: string; uri: string }>('/account/totp/setup', { body: {} });
    setCode('');
    setCurrent('');
    setStep({ at: 'scan', ...s });
  });
  const enable = () => run(async () => {
    const r = await api<{ recoveryCodes: string[] }>('/account/totp/enable', { body: user.totp ? { code, current } : { code } });
    setStep({ at: 'codes', codes: r.recoveryCodes });
    await refreshSession();
  });
  const disable = () => run(async () => {
    await api('/account/totp/disable', { body: { password, code: current } });
    setPassword('');
    setCurrent('');
    await refreshSession();
    close(() => onNotice('Authenticator turned off.'));
  });
  const show = () => { setStep({ at: 'intro' }); setError(null); setCode(''); setCurrent(''); setPassword(''); open(); };

  const codesText = step.at === 'codes' ? `Mordheim Campaign – recovery codes for ${user.username}\nEach works once instead of the authenticator's code.\n\n${step.codes.join('\n')}\n` : '';

  return (
    <li>
      <span>Authenticator<small>{user.totp ? 'On – a code after the password' : user.isAdmin ? 'Required for admins – not set up yet' : 'Off – optional for players'}</small></span>
      <button type="button" className={user.totp ? ui.buttonQuiet : ui.button} onClick={show}>{user.totp ? 'Manage' : 'Set up'}</button>
      <dialog ref={ref} className={ui.sheet} aria-labelledby="auth-title">
        <div className={ui.page}>
          <h2 id="auth-title">Authenticator</h2>
          {step.at === 'intro' && user.totp && (
            <>
              <p>On. After the password, the app asks for the code your authenticator shows. If the phone is lost, one of your recovery codes gets you in once.</p>
              {user.isAdmin ? (
                <p className={ui.muted}>Admins keep the authenticator. Without the phone and the codes, <code className={styles.cmd}>roster-cli totp-reset</code> on the Pi removes it.</p>
              ) : (
                <form className={styles.form} onSubmit={(e) => { e.preventDefault(); void disable(); }}>
                  <p className={ui.muted}>To turn it off: your password and a code.</p>
                  <label className={ui.field}>
                    <span>Your password</span>
                    <input className={ui.input} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </label>
                  <label className={ui.field}>
                    <span>A code from the authenticator – or a recovery code</span>
                    <input className={`${ui.input} ${styles.code}`} autoComplete="one-time-code" maxLength={20} value={current} onChange={(e) => setCurrent(e.target.value)} required />
                  </label>
                  <div className={ui.row}><button type="submit" className={ui.buttonQuiet} disabled={busy || !password || !current.trim()}>Turn off</button></div>
                </form>
              )}
              {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
              <div className={ui.row}>
                <button type="button" className={ui.buttonQuiet} disabled={busy} onClick={() => void start()}>Set up on a new phone</button>
                <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Close</button>
              </div>
            </>
          )}
          {step.at === 'intro' && !user.totp && (
            <>
              <p>An authenticator app on your phone (Aegis, 2FAS, Google Authenticator, Microsoft Authenticator …) shows a new six-digit code every 30 seconds. With it, a stolen password alone does not get anyone into your account.</p>
              {user.isAdmin && <p className={ui.message}>Admins need it: the admin tools stay closed until it is set up.</p>}
              {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
              <div className={ui.row}>
                <button type="button" className={ui.button} disabled={busy} onClick={() => void start()}>Set up</button>
                <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Not now</button>
              </div>
            </>
          )}
          {step.at === 'scan' && (
            <form className={ui.page} onSubmit={(e) => { e.preventDefault(); void enable(); }}>
              <p>1. Scan this QR code with the authenticator app. On this phone, open it in the app instead.</p>
              <QrCode text={step.uri} />
              <div className={ui.row}><a className={ui.buttonQuiet} href={step.uri}>Open in the app</a></div>
              <details>
                <summary className={styles.summary}>Type the key instead</summary>
                <p className={styles.secret}>{step.secret.replace(/(.{4})/g, '$1 ').trim()}</p>
                <div className={ui.row}>
                  <button type="button" className={ui.buttonQuiet} onClick={() => { void copyText(step.secret).then((ok) => onNotice(ok ? 'Key copied.' : 'Select the key and copy it.')); }}>Copy the key</button>
                </div>
                <p className={ui.muted}>Time-based, 6 digits, every 30 seconds.</p>
              </details>
              <label className={ui.field}>
                <span>{user.totp ? '2. The code the new app shows now' : '2. The code the app shows now'}</span>
                <input className={`${ui.input} ${styles.code}`} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7}
                  value={code} onChange={(e) => setCode(e.target.value)} required />
              </label>
              {user.totp && (
                <label className={ui.field}>
                  <span>3. A code from your current authenticator – or a recovery code</span>
                  <input className={`${ui.input} ${styles.code}`} autoComplete="off" maxLength={20} value={current} onChange={(e) => setCurrent(e.target.value)} required />
                </label>
              )}
              {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
              <div className={ui.row}>
                <button type="submit" className={ui.button} disabled={busy || code.replace(/\s/g, '').length !== 6 || (user.totp && !current.trim())}>{user.totp ? 'Switch to the new phone' : 'Turn on'}</button>
                <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
              </div>
            </form>
          )}
          {step.at === 'codes' && (
            <>
              <p><strong>On.</strong> Keep these recovery codes somewhere safe – a password manager, or on paper. Each gets you in once if the phone is lost. They are shown only now.</p>
              <ul className={styles.codes} aria-label="Recovery codes">
                {step.codes.map((c) => <li key={c}>{c}</li>)}
              </ul>
              <div className={ui.row}>
                <button type="button" className={ui.buttonQuiet} onClick={() => { void copyText(codesText).then((ok) => onNotice(ok ? 'Codes copied.' : 'Select the codes and copy them.')); }}>Copy</button>
                <button type="button" className={ui.buttonQuiet} onClick={() => saveFile(`mordheim-recovery-codes-${user.username}.txt`, codesText, 'text/plain')}>Save as a file</button>
              </div>
              <div className={ui.row}>
                <button type="button" className={ui.button} onClick={() => close(() => onNotice('Authenticator on.'))}>I have kept them</button>
              </div>
            </>
          )}
        </div>
      </dialog>
    </li>
  );
}
