/* The admin's tools (phase 3g; docs/mockups/more.html "Admin"): the users
   with what can be done for them, invites, and – Rob, 03.10.2026 – the log
   data: who signed in when, and every change in the audit log. Only the
   admin with an authenticator gets here; the server checks every request
   again (can()). */
import { useCallback, useEffect, useState } from 'react';
import { NavLink, useLocation, useParams } from 'react-router';
import { copyText } from '../ui/files.ts';
import { useNotice } from '../ui/Notice.tsx';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { AdminBugs } from '../bugs/AdminBugs.tsx';
import { TABS } from './adminTabs.ts';
import { api, errorText } from './api.ts';
import styles from './Account.module.css';
import { useSession } from './session.ts';
import { ago, stamp } from './time.ts';
import { attemptLine, auditLine, type Attempt, type AuditEntry } from './words.ts';

interface User { id: string; username: string; displayName: string; isAdmin: boolean; totp: boolean; createdAt: string; disabledAt: string | null; lastSeenAt: string | null; sessions: number }
interface Invite { id: string; kind: 'register' | 'reset'; note: string; forUser: string | null; createdAt: string; expiresAt: string }

export { TABS };

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
  const [watch, setWatch] = useState<string | null>(null);
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
        <div className={styles.tableWrap}>
          <table className={styles.table} aria-label="Users">
            <thead>
              <tr><th scope="col">User</th><th scope="col">Role</th><th scope="col">Authenticator</th><th scope="col">Last seen</th><th scope="col">Devices</th><th scope="col">Joined</th><th scope="col"><span className="visually-hidden">What to do</span></th></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td data-label="User"><strong>{u.displayName}</strong>{u.displayName !== u.username && <span className={ui.muted}> · {u.username}</span>}</td>
                  <td data-label="Role">{u.isAdmin ? 'Admin' : 'Player'}{u.disabledAt && <span className={`${styles.flag} ${styles.failed}`}>disabled</span>}</td>
                  <td data-label="Authenticator">{u.totp ? 'On' : 'Not set up'}</td>
                  <td data-label="Last seen">{u.lastSeenAt ? ago(u.lastSeenAt) : 'Never signed in'}</td>
                  <td data-label="Devices">{u.sessions}</td>
                  <td data-label="Joined">{ago(u.createdAt)}</td>
                  <td data-label="">
                    {u.id === meId
                      ? <span className={ui.muted}>you</span>
                      : <button type="button" className={ui.buttonQuiet} onClick={() => { setChosen(u); setLink(null); setWatch(null); setError(null); open(); }} aria-label={`What to do for ${u.displayName}`}>⋯</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                  <span>Where they signed in from<small>The last sign-ins with device and place, and when each device was first seen</small></span>
                  <button type="button" className={ui.buttonQuiet} disabled={busy} onClick={() => setWatch(chosen.id)}>Show sign-ins</button>
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
            {watch === chosen.id && !link && <SignIns userId={chosen.id} />}
            {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
            <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={() => close()}>{link ? 'Done' : 'Close'}</button></div>
          </div>
        )}
      </dialog>
    </>
  );
}

interface SignInRow { at: string; kind: 'signin' | 'moved'; device: string; place: string; ip: string; firstTime: boolean }

/** The last sign-ins of one person (wish #69): when, with what, from where; the first time of a device marked. Only the admin gets this from the server. */
function SignIns({ userId }: { userId: string }) {
  const addresses = useAddresses();
  const [r, setR] = useState<{ signins: SignInRow[]; located: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api<{ signins: SignInRow[]; located: boolean }>(`/admin/users/${userId}/signins`).then((x) => { if (live) setR(x); }).catch((e: unknown) => { if (live) setError(errorText(e)); });
    return () => { live = false; };
  }, [userId]);
  if (error) return <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>;
  if (!r) return <p className={ui.muted}>Loading …</p>;
  if (!r.signins.length) return <p className={ui.muted}>No sign-in noted yet; the next one counts as the first of its device.</p>;
  return (
    <>
      <AddressToggle addresses={addresses} />
      {!r.located && <p className={ui.muted}>There is no database of places on the Pi (see operations.md, GEOIP_DB): the place stays empty.</p>}
      <div className={styles.tableWrap}>
        <table className={styles.table} aria-label="Recent sign-ins">
          <thead><tr><th scope="col">When</th><th scope="col">Device</th><th scope="col">Place</th><th scope="col">Address</th></tr></thead>
          <tbody>
            {r.signins.map((x) => (
              <tr key={x.at + x.device}>
                <td data-label="When"><time dateTime={x.at}>{stamp(x.at)}</time></td>
                <td data-label="Device"><span>{x.device}{x.firstTime && <> <span className={`${styles.flag} ${styles.nowrap}`}>new device</span></>}{x.kind === 'moved' && <> <span className={`${styles.flag} ${styles.nowrap}`}>session used from here</span></>}</span></td>
                <td data-label="Place">{x.place || '–'}</td>
                <td data-label="Address">{addresses.shown ? x.ip : hiddenAddress}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
          <div className={styles.tableWrap}>
            <table className={styles.table} aria-label="Open links">
              <thead>
                <tr><th scope="col">For</th><th scope="col">Made</th><th scope="col">Works until</th><th scope="col"><span className="visually-hidden">Revoke</span></th></tr>
              </thead>
              <tbody>
                {invites.map((i) => (
                  <tr key={i.id}>
                    <td data-label="For">{i.kind === 'reset' ? <>New password for <strong>{i.forUser}</strong></> : <strong>{i.note || 'Invite'}</strong>}</td>
                    <td data-label="Made">{ago(i.createdAt)}</td>
                    <td data-label="Works until">{stamp(i.expiresAt)}</td>
                    <td data-label=""><button type="button" className={ui.buttonQuiet} onClick={() => void revoke(i.id)}>Revoke</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/** A log read page by page, newest first. It reads again whenever the screen
    is visited, also by the tab link of the tab already open or by Back. */
function useLog<T>(path: string, key: string, cursor: (last: T) => number, filter = '', cursorParam = 'before') {
  const visit = useLocation().key;
  const [items, setItems] = useState<T[]>([]);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const fetchPage = useCallback(
    (from?: number) => api<Record<string, T[]>>(`${path}?limit=${PAGE}${from ? `&${cursorParam}=${from}` : ''}${filter}`).then((r) => r[key] ?? []),
    [path, key, filter, cursorParam],
  );
  useEffect(() => {
    let live = true;
    fetchPage()
      .then((got) => { if (live) { setItems(got); setMore(got.length === PAGE); setError(null); } })
      .catch((e: unknown) => { if (live) setError(errorText(e)); })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [fetchPage, visit]);
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

/** Addresses are hidden until the admin asks (wish #72): the choice lasts for the screen as it is, not for the next visit. */
function useAddresses() {
  const visit = useLocation().key;
  // the choice belongs to the visit it was made in
  const [chosen, setChosen] = useState<string | null>(null);
  const shown = chosen === visit;
  return { shown, toggle: () => setChosen(shown ? null : visit) };
}

function AddressToggle({ addresses }: { addresses: ReturnType<typeof useAddresses> }) {
  return (
    <div className={ui.row}>
      <button type="button" className={ui.buttonQuiet} aria-pressed={addresses.shown} onClick={addresses.toggle}>{addresses.shown ? 'Hide addresses' : 'Show addresses'}</button>
    </div>
  );
}

const hiddenAddress = <span className={ui.muted} aria-label="hidden">hidden</span>;

interface LoginFilter { user: string; type: string; from: string; to: string }
const NO_FILTER: LoginFilter = { user: '', type: '', from: '', to: '' };

function Logins() {
  const [filter, setFilter] = useState<LoginFilter>(NO_FILTER);
  const [user, setUser] = useState('');
  // the name is sent when the typing pauses, not with every letter
  useEffect(() => {
    const t = setTimeout(() => setFilter((f) => (f.user === user.trim() ? f : { ...f, user: user.trim() })), 250);
    return () => clearTimeout(t);
  }, [user]);
  const query = Object.entries(filter).filter(([, v]) => v).map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join('');
  const log = useLog<Attempt>('/admin/logins', 'attempts', (a) => a.id, query);
  const addresses = useAddresses();
  const filtered = query !== '';
  return (
    <>
      <p className={ui.muted}>Every sign-in and every failed try, kept for 180 days. Many failures from one address end up blocked by Fail2Ban on the Pi.</p>
      <form className={styles.filters} role="search" aria-label="Filter the sign-ins" onSubmit={(e) => e.preventDefault()}>
        <label className={ui.field}>
          <span>Person</span>
          <input className={ui.input} type="search" maxLength={64} value={user} onChange={(e) => setUser(e.target.value)} />
        </label>
        <label className={ui.field}>
          <span>Kind</span>
          <select className={ui.select} value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })}>
            <option value="">All</option>
            <option value="signin">Signed in</option>
            <option value="joined">Joined</option>
            <option value="failed">Failed</option>
          </select>
        </label>
        <label className={ui.field}>
          <span>From</span>
          <input className={ui.input} type="date" value={filter.from} max={filter.to || undefined} onChange={(e) => setFilter({ ...filter, from: e.target.value })} />
        </label>
        <label className={ui.field}>
          <span>To</span>
          <input className={ui.input} type="date" value={filter.to} min={filter.from || undefined} onChange={(e) => setFilter({ ...filter, to: e.target.value })} />
        </label>
        {filtered && <button type="button" className={ui.buttonQuiet} onClick={() => { setUser(''); setFilter(NO_FILTER); }}>Clear filter</button>}
      </form>
      <AddressToggle addresses={addresses} />
      {log.error && <p className={`${ui.message} ${ui.error}`} role="alert">{log.error}</p>}
      <div className={styles.tableWrap}>
        <table className={styles.table} aria-label="Sign-ins">
          <thead>
            <tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">What</th><th scope="col">Device</th><th scope="col">From</th></tr>
          </thead>
          <tbody>
            {log.items.map((a) => (
              <tr key={a.id}>
                <td data-label="When"><time dateTime={a.at}>{stamp(a.at)}</time></td>
                <td data-label="Who"><strong>{a.username}</strong></td>
                <td data-label="What"><span className={a.ok ? undefined : styles.failed}>{attemptLine(a)}</span></td>
                <td data-label="Device">{a.device || '–'}</td>
                <td data-label="From">{addresses.shown ? a.ip : hiddenAddress}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!log.busy && log.items.length === 0 && !log.error && <p className={ui.muted}>{filtered ? 'Nothing matches this filter.' : 'Nothing yet.'}</p>}
      {log.more && log.items.length > 0 && <div className={ui.row}><button type="button" className={ui.buttonQuiet} disabled={log.busy} onClick={log.next}>Older</button></div>}
    </>
  );
}

interface AuditFilter { q: string; from: string; to: string; order: '' | 'old' }
const NO_AUDIT_FILTER: AuditFilter = { q: '', from: '', to: '', order: '' };

function Audit() {
  const [filter, setFilter] = useState<AuditFilter>(NO_AUDIT_FILTER);
  const [word, setWord] = useState('');
  // the word is sent when the typing pauses, not with every letter
  useEffect(() => {
    const t = setTimeout(() => setFilter((f) => (f.q === word.trim() ? f : { ...f, q: word.trim() })), 250);
    return () => clearTimeout(t);
  }, [word]);
  const query = Object.entries(filter).filter(([, v]) => v).map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join('');
  // read oldest first, a page goes on after the last one it ended with
  const log = useLog<AuditEntry>('/admin/audit', 'entries', (e) => e.seq, query, filter.order === 'old' ? 'after' : 'before');
  const filtered = query !== '';
  return (
    <>
      <p className={ui.muted}>Every change, newest first or oldest first. For now the accounts; warbands and the campaign join with the next steps.</p>
      <form className={styles.filters} role="search" aria-label="Filter the audit log" onSubmit={(e) => e.preventDefault()}>
        <label className={ui.field}>
          <span>Search</span>
          <input className={ui.input} type="search" maxLength={64} placeholder="who, whom or what" value={word} onChange={(e) => setWord(e.target.value)} />
        </label>
        <label className={ui.field}>
          <span>From</span>
          <input className={ui.input} type="date" value={filter.from} max={filter.to || undefined} onChange={(e) => setFilter({ ...filter, from: e.target.value })} />
        </label>
        <label className={ui.field}>
          <span>To</span>
          <input className={ui.input} type="date" value={filter.to} min={filter.from || undefined} onChange={(e) => setFilter({ ...filter, to: e.target.value })} />
        </label>
        <label className={ui.field}>
          <span>Order</span>
          <select className={ui.select} value={filter.order} onChange={(e) => setFilter({ ...filter, order: e.target.value as AuditFilter['order'] })}>
            <option value="">Newest first</option>
            <option value="old">Oldest first</option>
          </select>
        </label>
        {filtered && <button type="button" className={ui.buttonQuiet} onClick={() => { setWord(''); setFilter(NO_AUDIT_FILTER); }}>Clear filter</button>}
      </form>
      {log.error && <p className={`${ui.message} ${ui.error}`} role="alert">{log.error}</p>}
      <div className={styles.tableWrap}>
        <table className={styles.table} aria-label="Audit log">
          <thead>
            <tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">What</th><th scope="col">Details</th></tr>
          </thead>
          <tbody>
            {log.items.map((e) => {
              const l = auditLine(e);
              return (
                <tr key={e.seq}>
                  <td data-label="When"><time dateTime={e.at}>{stamp(e.at)}</time></td>
                  <td data-label="Who"><strong>{l.who}</strong></td>
                  <td data-label="What">{l.what}</td>
                  <td data-label="Details">{l.detail}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!log.busy && log.items.length === 0 && !log.error && <p className={ui.muted}>{filtered ? 'Nothing matches this filter.' : 'Nothing yet.'}</p>}
      {log.more && log.items.length > 0 && <div className={ui.row}><button type="button" className={ui.buttonQuiet} disabled={log.busy} onClick={log.next}>{filter.order === 'old' ? 'Newer' : 'Older'}</button></div>}
    </>
  );
}

export function Admin() {
  const { tab = 'users' } = useParams();
  const session = useSession();
  const [notice, notify] = useNotice();
  const head = (
    <div className={styles.head}>
      <h1>Admin</h1>
      <span className={styles.adminOnly} title="Only the admin sees this"><span aria-hidden="true">⚑</span> Admin only</span>
    </div>
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
                : 'The admin tools open once your authenticator is set up (Account).'}
        </p>
      </section>
    );
  }
  const current = TABS.find((t) => t.key === tab) ?? TABS[0];
  return (
    <section className={ui.page}>
      {head}
      <nav className={`${styles.tabs} ${styles.sideTabs}`} aria-label="Admin">
        {TABS.map((t) => <NavLink key={t.key} to={`/admin/${t.key}`}>{t.label}</NavLink>)}
      </nav>
      {current.key === 'users' && <Users meId={user.id} onNotice={notify} />}
      {current.key === 'invites' && <Invites onNotice={notify} />}
      {current.key === 'logins' && <Logins />}
      {current.key === 'audit' && <Audit />}
      {current.key === 'bugs' && <AdminBugs onNotice={notify} />}
      {notice}
    </section>
  );
}
