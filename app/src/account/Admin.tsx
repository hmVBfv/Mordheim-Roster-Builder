/* The admin's tools (phase 3g; docs/mockups/more.html "Admin"): the users
   with what can be done for them, invites, and – Rob, 03.10.2026 – the log
   data: who signed in when, and every change in the audit log. Only the
   admin with an authenticator gets here; the server checks every request
   again (can()). */
import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useParams } from 'react-router';
import trade from '../roster/Trade.module.css';
import { copyText } from '../ui/files.ts';
import { useNotice } from '../ui/Notice.tsx';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { api, errorText } from './api.ts';
import styles from './Account.module.css';
import { useSession } from './session.ts';
import { ago, stamp } from './time.ts';
import { attemptLine, auditLine, type Attempt, type AuditEntry } from './words.ts';

interface User { id: string; username: string; displayName: string; isAdmin: boolean; totp: boolean; createdAt: string; disabledAt: string | null; lastSeenAt: string | null; sessions: number }
interface Invite { id: string; kind: 'register' | 'reset'; note: string; forUser: string | null; createdAt: string; expiresAt: string }

export const TABS = [
  { key: 'users', label: 'Users' },
  { key: 'invites', label: 'Invites' },
  { key: 'logins', label: 'Sign-ins' },
  { key: 'audit', label: 'Audit log' },
] as const;

const PAGE = 50;

/** A link to hand on: shown once, to copy or share. */
function LinkBox({ link, what, onNotice }: { link: string; what: string; onNotice: (t: string) => void }) {
  const share = typeof navigator.share === 'function';
  return (
    <div className={`${ui.message} ${styles.section}`}>
      <p className={styles.link}>{link}</p>
      <div className={ui.row}>
        <button type="button" className={ui.button} onClick={() => { void copyText(link).then((ok) => onNotice(ok ? 'Link copied.' : 'Select the link and copy it.')); }}>Copy the link</button>
        {share && <button type="button" className={ui.buttonQuiet} onClick={() => { void navigator.share({ title: 'Mordheim Campaign', text: what, url: link }).catch(() => undefined); }}>Share</button>}
      </div>
      <p className={ui.muted}>Shown only now. Send it to that person alone – whoever opens it first uses it.</p>
    </div>
  );
}

function Users({ meId, onNotice }: { meId: string; onNotice: (t: string) => void }) {
  const { ref, open, close } = useSheet();
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<User | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    api<{ users: User[] }>('/admin/users').then((r) => { setUsers(r.users); setError(null); }).catch((e: unknown) => setError(errorText(e)));
  }, []);
  useEffect(load, [load]);

  const act = async (op: 'reset' | 'totp-reset' | 'disable' | 'enable' | 'sign-out') => {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ link?: string; revoked?: number; signedOut?: number }>(`/admin/users/${chosen.id}/${op}`, { body: {} });
      load();
      if (op === 'reset') { setLink(r.link ?? null); return; }
      const name = chosen.displayName;
      const said = {
        'totp-reset': `${name}’s authenticator removed; signed out everywhere.`,
        disable: `${name} can no longer sign in.`,
        enable: `${name} can sign in again.`,
        'sign-out': `${name} is signed out everywhere (${r.revoked ?? 0}).`,
      }[op];
      close(() => onNotice(said));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      {users && (
        <ul className={styles.grid}>
          {users.map((u) => (
            <li key={u.id} className={styles.entry}>
              <div className={styles.entryHead}>
                <span><strong>{u.displayName}</strong>{u.displayName !== u.username && <span className={ui.muted}> · {u.username}</span>}</span>
                {u.id === meId
                  ? <span className={ui.muted}>you</span>
                  : <button type="button" className={ui.buttonQuiet} onClick={() => { setChosen(u); setLink(null); setError(null); open(); }} aria-label={`What to do for ${u.displayName}`}>⋯</button>}
              </div>
              <div className={styles.flags}>
                {u.isAdmin && <span className={styles.flag}>admin</span>}
                <span className={styles.flag}>{u.totp ? 'authenticator' : 'no authenticator'}</span>
                {u.disabledAt && <span className={`${styles.flag} ${styles.failed}`}>disabled</span>}
              </div>
              <small>{u.lastSeenAt ? `Last seen ${ago(u.lastSeenAt)}` : 'Never signed in'} · {u.sessions} device{u.sessions === 1 ? '' : 's'} · joined {ago(u.createdAt)}</small>
            </li>
          ))}
        </ul>
      )}
      <dialog ref={ref} className={ui.sheet} aria-labelledby="user-title">
        {chosen && (
          <div className={ui.page}>
            <h2 id="user-title">{chosen.displayName}</h2>
            {link ? (
              <LinkBox link={link} what={`A link to set a new password for Mordheim Campaign (24 hours)`} onNotice={onNotice} />
            ) : (
              <ul className={styles.rows}>
                <li>
                  <span>Forgot the password<small>A link to set a new one, 24 hours; signs out every device</small></span>
                  <button type="button" className={ui.buttonQuiet} disabled={busy || !!chosen.disabledAt} onClick={() => void act('reset')}>Make a link</button>
                </li>
                <li>
                  <span>Signed in somewhere strange<small>Ends every session of the account</small></span>
                  <button type="button" className={ui.buttonQuiet} disabled={busy || chosen.sessions === 0} onClick={() => void act('sign-out')}>Sign out</button>
                </li>
                {chosen.totp && (
                  <li>
                    <span>Lost the phone and the codes<small>Removes the authenticator; signs out every device</small></span>
                    <button type="button" className={ui.buttonQuiet} disabled={busy} onClick={() => void act('totp-reset')}>Remove</button>
                  </li>
                )}
                <li>
                  <span>{chosen.disabledAt ? 'Disabled' : 'Should not sign in any more'}<small>{chosen.disabledAt ? `Since ${ago(chosen.disabledAt)}` : 'Disables the account; nothing is deleted'}</small></span>
                  <button type="button" className={ui.buttonQuiet} disabled={busy} onClick={() => void act(chosen.disabledAt ? 'enable' : 'disable')}>{chosen.disabledAt ? 'Enable' : 'Disable'}</button>
                </li>
              </ul>
            )}
            {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
            <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={() => close()}>{link ? 'Done' : 'Close'}</button></div>
          </div>
        )}
      </dialog>
    </>
  );
}

function Invites({ onNotice }: { onNotice: (t: string) => void }) {
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [note, setNote] = useState('');
  const [made, setMade] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api<{ invites: Invite[] }>('/admin/invites').then((r) => { setInvites(r.invites); setError(null); }).catch((e: unknown) => setError(errorText(e)));
  }, []);
  useEffect(load, [load]);
  const make = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ link: string }>('/admin/invites', { body: { note: note.trim() } });
      setMade(r.link);
      setNote('');
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const revoke = async (id: string) => {
    try {
      await api(`/admin/invites/${id}`, { method: 'DELETE' });
      onNotice('Link revoked – it no longer works.');
      load();
    } catch (e) {
      setError(errorText(e));
    }
  };
  return (
    <>
      <form className={`${ui.card} ${styles.form}`} onSubmit={(e) => { e.preventDefault(); void make(); }}>
        <label className={ui.field}>
          <span>Who is it for? <span className={ui.muted}>(a note for you, optional)</span></span>
          <input className={ui.input} maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className={ui.row}><button type="submit" className={ui.button} disabled={busy}>Make an invite</button></div>
        <p className={ui.muted}>A link to make one account, for 7 days. Admin accounts come only from <code className={styles.cmd}>roster-cli invite --admin</code> on the Pi.</p>
        {made && <LinkBox link={made} what="Your invite to Mordheim Campaign (7 days)" onNotice={onNotice} />}
      </form>
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      <section className={styles.section} aria-labelledby="open-h">
        <h2 id="open-h">Open links</h2>
        {invites && invites.length === 0 && <p className={ui.muted}>None open.</p>}
        {invites && invites.length > 0 && (
          <ul className={styles.grid}>
            {invites.map((i) => (
              <li key={i.id} className={styles.entry}>
                <div className={styles.entryHead}>
                  <span>{i.kind === 'reset' ? <>New password for <strong>{i.forUser}</strong></> : <strong>{i.note || 'Invite'}</strong>}</span>
                  <button type="button" className={ui.buttonQuiet} onClick={() => void revoke(i.id)}>Revoke</button>
                </div>
                <small>Made {ago(i.createdAt)} · works until {stamp(i.expiresAt)}</small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/** A log read page by page, newest first. */
function useLog<T>(path: string, key: string, cursor: (last: T) => number) {
  const [items, setItems] = useState<T[]>([]);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const fetchPage = useCallback(
    (before?: number) => api<Record<string, T[]>>(`${path}?limit=${PAGE}${before ? `&before=${before}` : ''}`).then((r) => r[key] ?? []),
    [path, key],
  );
  useEffect(() => {
    let live = true;
    fetchPage()
      .then((got) => { if (live) { setItems(got); setMore(got.length === PAGE); setError(null); } })
      .catch((e: unknown) => { if (live) setError(errorText(e)); })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [fetchPage]);
  const next = () => {
    const last = items[items.length - 1];
    if (last === undefined) return;
    setBusy(true);
    fetchPage(cursor(last))
      .then((got) => { setItems((old) => [...old, ...got]); setMore(got.length === PAGE); })
      .catch((e: unknown) => setError(errorText(e)))
      .finally(() => setBusy(false));
  };
  return { items, error, busy, more, next };
}

function Logins() {
  const log = useLog<Attempt>('/admin/logins', 'attempts', (a) => a.id);
  return (
    <>
      <p className={ui.muted}>Every sign-in and every failed try, kept for 180 days. Many failures from one address end up blocked by Fail2Ban on the Pi.</p>
      {log.error && <p className={`${ui.message} ${ui.error}`} role="alert">{log.error}</p>}
      <ul className={styles.log} aria-label="Sign-ins">
        {log.items.map((a) => (
          <li key={a.id}>
            <time dateTime={a.at}>{stamp(a.at)}</time>
            <span><strong>{a.username}</strong> <span className={a.ok ? undefined : styles.failed}>{attemptLine(a)}</span><br /><small>from {a.ip}</small></span>
          </li>
        ))}
      </ul>
      {!log.busy && log.items.length === 0 && !log.error && <p className={ui.muted}>Nothing yet.</p>}
      {log.more && log.items.length > 0 && <div className={ui.row}><button type="button" className={ui.buttonQuiet} disabled={log.busy} onClick={log.next}>Older</button></div>}
    </>
  );
}

function Audit() {
  const log = useLog<AuditEntry>('/admin/audit', 'entries', (e) => e.seq);
  return (
    <>
      <p className={ui.muted}>Every change, in order. For now the accounts; warbands and the campaign join with the next steps.</p>
      {log.error && <p className={`${ui.message} ${ui.error}`} role="alert">{log.error}</p>}
      <ul className={styles.log} aria-label="Audit log">
        {log.items.map((e) => {
          const l = auditLine(e);
          return (
            <li key={e.seq}>
              <time dateTime={e.at}>{stamp(e.at)}</time>
              <span><strong>{l.who}</strong> {l.what}{l.detail && <><br /><small>{l.detail}</small></>}</span>
            </li>
          );
        })}
      </ul>
      {!log.busy && log.items.length === 0 && !log.error && <p className={ui.muted}>Nothing yet.</p>}
      {log.more && log.items.length > 0 && <div className={ui.row}><button type="button" className={ui.buttonQuiet} disabled={log.busy} onClick={log.next}>Older</button></div>}
    </>
  );
}

export function Admin() {
  const { tab = 'users' } = useParams();
  const session = useSession();
  const [notice, notify] = useNotice();
  const head = (
    <>
      <Link className={trade.back} to="/more">‹ More</Link>
      <div className={styles.head}>
        <h1>Admin</h1>
        <span className={styles.adminOnly} title="Only the admin sees this"><span aria-hidden="true">⚑</span> Admin only</span>
      </div>
    </>
  );
  if (session.status === 'loading') return <section className={ui.page}>{head}</section>;
  const user = session.status === 'in' ? session.user : null;
  if (!user?.isAdmin || user.mustSetUpTotp) {
    return (
      <section className={ui.page}>
        {head}
        <p className={ui.message}>
          {session.status === 'unreachable' ? 'The campaign server does not answer right now.'
            : !user ? 'Sign in as the admin to see this.'
              : !user.isAdmin ? 'Only the admin sees this.'
                : 'The admin tools open once your authenticator is set up (More → Account).'}
        </p>
      </section>
    );
  }
  const current = TABS.find((t) => t.key === tab) ?? TABS[0];
  return (
    <section className={ui.page}>
      {head}
      <nav className={styles.tabs} aria-label="Admin">
        {TABS.map((t) => <NavLink key={t.key} to={`/admin/${t.key}`}>{t.label}</NavLink>)}
      </nav>
      {current.key === 'users' && <Users meId={user.id} onNotice={notify} />}
      {current.key === 'invites' && <Invites onNotice={notify} />}
      {current.key === 'logins' && <Logins />}
      {current.key === 'audit' && <Audit />}
      {notice}
    </section>
  );
}
