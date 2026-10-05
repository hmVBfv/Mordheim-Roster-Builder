/* A battle – the game night (phase 4a2; docs/mockups/game-night.html,
   concept.md 4.5, ADR 0010). Full screen on the phone: the turn, who
   fought, the protocol as it grows, and big buttons below. A leader writes
   the protocol; everybody sees it live (asked every few seconds, only for
   what is newer) and players send corrections. Whatever is entered goes to
   the outbox first and is sent when the server answers: a table without a
   connection loses nothing. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { errorText, type Me } from '../account/api.ts';
import { useSession } from '../account/session.ts';
import { useOnline } from '../app/SyncState.tsx';
import { cachedCampaign, getCampaign, readWarband, type CampaignRole } from '../campaign/api.ts';
import { db, type OutboxItem } from '../db/db.ts';
import { newId } from '../db/ids.ts';
import { useNotice } from '../ui/Notice.tsx';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import {
  battleTitle, cachedBattle, casualtyText, decideProposal, getBattle, OUTCOME_NAMES, patchBattle,
  type BattleView, type CasualtyPayload, type Entry, type EntryBody, type Outcome, type Proposal,
} from './api.ts';
import { CasualtySheet, EventSheet, ProposalSheet, usePicks } from './BattleSheets.tsx';
import styles from './Battle.module.css';
import { enqueue, flushOutbox, useOutbox } from './outbox.ts';

export const POLL_MS = 5000;

type Shown = Entry & { state?: 'pending' | 'refused'; refused?: string };

/** The battle as the server has it, with what this device has not sent yet laid over it. */
function merge(view: BattleView, outbox: OutboxItem[], me: string): { entries: Shown[]; proposals: (Proposal & { pending?: boolean })[] } {
  const entries = new Map<string, Shown>(view.entries.map((e) => [e.id, e]));
  const proposals: (Proposal & { pending?: boolean })[] = [...view.proposals];
  for (const i of outbox) {
    const state = i.refused ? 'refused' : 'pending';
    if (i.op === 'entry.put') {
      const cur = entries.get(i.targetId);
      entries.set(i.targetId, { ...(cur ?? { id: i.targetId, author: 'you', createdAt: i.at, updatedAt: i.at }), ...(i.body as EntryBody), state, ...(i.refused ? { refused: i.refused } : {}) } as Shown);
    } else if (i.op === 'entry.delete' && !i.refused) entries.delete(i.targetId);
    else if (i.op === 'proposal.put' && !proposals.some((p) => p.id === i.targetId)) {
      const b = i.body as { entryId: string | null; text: string };
      proposals.push({ id: i.targetId, targetType: b.entryId ? 'protocol_entry' : 'battle', targetId: b.entryId ?? view.battle.id, authorId: me, author: 'you', payload: { text: b.text }, status: 'open', decidedBy: null, createdAt: i.at, pending: true });
    }
  }
  // newest first: the table looks at what just happened
  const list = [...entries.values()].sort((a, b) => b.turn - a.turn || b.createdAt.localeCompare(a.createdAt));
  return { entries: list, proposals };
}

function useBattle(cid: string, bid: string, userId: string | undefined) {
  const [view, setView] = useState<BattleView | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Sends what waits, then asks for what is newer than the state seen last (all of it with `full`). */
  const refresh = useCallback((full = false): Promise<void> => (userId ? flushOutbox(userId) : Promise.resolve(0))
    .then(() => (full ? null : cachedBattle(bid)))
    .then((cur) => getBattle(cid, bid, cur?.seq).then((v) => { setView(v ?? cur); setError(null); }))
    .catch((e: unknown) => setError(errorText(e))), [cid, bid, userId]);
  useEffect(() => {
    let live = true;
    void cachedBattle(bid).then((v) => { if (live && v) setView((cur) => cur ?? v); });
    void refresh(true);
    const t = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, POLL_MS);
    return () => { live = false; clearInterval(t); };
  }, [bid, refresh]);
  return { view, setView, error, refresh };
}

/** The user's role in the campaign: undefined until known (from this device, or the server). */
function useRole(cid: string): CampaignRole | null | undefined {
  const [role, setRole] = useState<CampaignRole | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void cachedCampaign(cid).then((v) => { if (live && v) setRole((r) => r ?? v.role); });
    getCampaign(cid).then((v) => { if (live) setRole(v.role); }).catch(() => { if (live) setRole((r) => r ?? null); });
    return () => { live = false; };
  }, [cid]);
  return role;
}

function EntryCard({ e, names, lead, canPropose, onCorrect, onRemove, onPropose }: {
  e: Shown; names: Record<string, string>; lead: boolean; canPropose: boolean;
  onCorrect: () => void; onRemove: () => void; onPropose: () => void;
}) {
  const what = e.kind === 'casualty' ? casualtyText(e.payload, names) : null;
  return (
    <li className={`${styles.entry} ${e.kind === 'event' ? styles.event : ''}`}>
      <small>
        Turn {e.turn} · {e.kind === 'casualty' ? 'Out of action' : 'Event'} · {e.author}
        {e.state === 'pending' && <span className={styles.pending}> · ⏳ on this phone</span>}
        {e.state === 'refused' && <span className={styles.refused}> · not taken: {e.refused}</span>}
      </small>
      {what
        ? <p><strong>{what.victim}</strong> is out of action{what.by ? <> – by <strong>{what.by}</strong></> : ''}.{(e.payload as CasualtyPayload).note ? ` ${(e.payload as CasualtyPayload).note}` : ''}</p>
        : <p>{(e.payload as { text: string }).text}</p>}
      {(lead || canPropose) && (
        <div className={styles.row}>
          {lead && <button type="button" className={ui.buttonQuiet} onClick={onCorrect}>Correct</button>}
          {lead && <button type="button" className={ui.buttonQuiet} onClick={onRemove}>Take out</button>}
          {!lead && canPropose && e.state !== 'pending' && <button type="button" className={ui.buttonQuiet} onClick={onPropose}>Suggest a correction</button>}
        </div>
      )}
    </li>
  );
}

export function Battle() {
  const { id: cid = '', bid = '' } = useParams();
  const session = useSession();
  const user = session.status === 'in' ? session.user : session.status === 'unreachable' ? session.user : null;
  const b = useBattle(cid, bid, user?.id);
  const role = useRole(cid);
  if (!user) return <section className={ui.page}><p className={ui.muted}>Battles live on the campaign server: sign in first.</p><p><Link to="/sign-in" className={ui.button}>Sign in</Link></p></section>;
  if (!b.view || role === undefined) return <section className={ui.page}>{b.error ? <p className={ui.message} role="alert">{b.error}</p> : <p className={ui.muted}>Loading the battle…</p>}</section>;
  // the sheets need their dialogs from the first render on: the game night mounts once there is a battle
  return <GameNight cid={cid} bid={bid} user={user} role={role} view={b.view} setView={b.setView} error={b.error} refresh={b.refresh} />;
}

function GameNight({ cid, bid, user, role, view, setView, error, refresh }: {
  cid: string; bid: string; user: Me; role: CampaignRole | null; view: BattleView; setView: (v: BattleView) => void; error: string | null; refresh: () => Promise<void>;
}) {
  const online = useOnline();
  const outbox = useOutbox(bid);
  const [notice, notify] = useNotice();
  const lead = role === 'leader' && user.totp;
  const canPropose = role === 'leader' || role === 'player';
  const [turn, setTurn] = useState<number | null>(null);
  const shownTurn = turn ?? view.battle.turn;

  const cas = useSheet();
  const ev = useSheet();
  const prop = useSheet();
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<Shown | null>(null);
  const [about, setAbout] = useState<Shown | null>(null);
  const loadWarband = useCallback(async (wid: string) => {
    const k = `cw:${cid}:${wid}`;
    try {
      const r = await readWarband(cid, wid);
      const data = r.draft?.data ?? r.head.data;
      await db.meta.put({ key: k, value: data });
      return data;
    } catch {
      return (await db.meta.get(k))?.value ?? null;
    }
  }, [cid]);
  const [wantPicks, setWantPicks] = useState(false);
  const { picks, error: picksError } = usePicks(view.participants, loadWarband, lead && wantPicks);

  const merged = useMemo(() => merge(view, outbox, user.id), [view, outbox, user.id]);
  const names = useMemo(() => Object.fromEntries(view.participants.map((p) => [p.warbandId, p.name])), [view]);

  const waiting = outbox.filter((i) => !i.refused).length;
  const closed = view.battle.status === 'closed';
  // the battle shown takes what was entered at once, so nothing flickers once it is sent
  const writeEntry = async (entryId: string, body: EntryBody, text: string) => {
    const at = new Date().toISOString();
    const cur = view.entries.find((e) => e.id === entryId);
    setView({ ...view, entries: [...view.entries.filter((e) => e.id !== entryId), { ...(cur ?? { id: entryId, author: user.displayName, createdAt: at }), ...body, updatedAt: at } as Entry] });
    await enqueue({ key: entryId, op: 'entry.put', userId: user.id, campaignId: cid, battleId: bid, targetId: entryId, body });
    notify(text);
    void refresh();
  };
  const removeEntry = async (e: Shown) => {
    setView({ ...view, entries: view.entries.filter((x) => x.id !== e.id) });
    // not sent yet: it need not go at all; the removal goes anyway, in case an earlier send arrived
    await db.outbox.delete(e.id);
    await enqueue({ key: `${e.id}:delete`, op: 'entry.delete', userId: user.id, campaignId: cid, battleId: bid, targetId: e.id, body: null });
    notify('Taken out of the protocol.');
    void refresh();
  };
  const mine = merged.entries.filter((e) => e.author === user.displayName || e.author === 'you');
  const step = (d: number) => {
    const t = Math.min(99, Math.max(1, shownTurn + d));
    setTurn(t);
    // the turn is a convenience: offline it stays here until the next step
    patchBattle(cid, bid, { turn: t }).then(setView).catch(() => undefined);
  };
  const outcome = (warbandId: string, o: Outcome) => {
    patchBattle(cid, bid, { outcomes: { [warbandId]: o } }).then((v) => { setView(v); notify('Outcome saved.'); }).catch((e: unknown) => notify(errorText(e)));
  };
  const decide = (p: Proposal, accept: boolean) => {
    decideProposal(cid, bid, p.id, accept).then((v) => { setView(v); notify(accept ? 'Taken over – correct the entry if it needs it.' : 'Not taken over.'); }).catch((e: unknown) => notify(errorText(e)));
  };

  return (
    <section className={ui.page}>
      <header className={styles.top}>
        <Link to={`/campaign/${cid}`} className={styles.back} aria-label="Back to the campaign">←</Link>
        <h1>{battleTitle(view.battle)}</h1>
        {waiting > 0 && <span className={styles.waiting} title="Entered here, not yet on the campaign server">⏳ {waiting} waiting</span>}
      </header>
      {!online && <p className={styles.banner} role="status">⚡ No connection. Everything you enter stays on this phone and is sent when the campaign server is reachable again. Nothing is lost.</p>}
      {online && error && <p className={styles.banner} role="status">{error} Shown as last seen.</p>}
      {closed && <p className={ui.message}>This battle is closed: its protocol is fixed.</p>}

      <div className={styles.columns}>
        <div className={ui.page}>
          <div className={styles.turn} aria-label="Turn">
            {lead && !closed ? <button type="button" className={ui.buttonQuiet} aria-label="One turn back" disabled={shownTurn <= 1} onClick={() => step(-1)}>−</button> : <span />}
            <span aria-live="polite">Turn {shownTurn}</span>
            {lead && !closed ? <button type="button" className={ui.buttonQuiet} aria-label="Next turn" onClick={() => step(1)}>+</button> : <span />}
          </div>
          <section aria-labelledby="b-protocol" className={ui.page}>
            <h2 id="b-protocol">Protocol</h2>
            {merged.entries.length === 0 && <p className={ui.muted}>Nothing yet.{lead ? ' Who goes out of action, you enter below.' : ' A leader writes it; it appears here.'}</p>}
            <ul className={styles.protocol} aria-label="Protocol">
              {merged.entries.map((e) => (
                <EntryCard key={e.id} e={e} names={names} lead={lead && !closed} canPropose={canPropose && !closed}
                  onCorrect={() => { setEditing(e); setFormKey((k) => k + 1); if (e.kind === 'casualty') { setWantPicks(true); cas.open(); } else ev.open(); }}
                  onRemove={() => void removeEntry(e)}
                  onPropose={() => { setAbout(e); setFormKey((k) => k + 1); prop.open(); }} />
              ))}
            </ul>
          </section>
        </div>
        <div className={ui.page}>
          <section aria-labelledby="b-fighters" className={ui.page}>
            <h2 id="b-fighters">Who fought</h2>
            <ul className={styles.fighters}>
              {view.participants.map((p) => (
                <li key={p.warbandId} className={styles.fighter}>
                  <span>{p.name}<small>{p.player} · {p.wbName}</small></span>
                  {lead && !closed
                    ? (
                      <select className={ui.select} aria-label={`Outcome for ${p.name}`} value={p.outcome} onChange={(e) => outcome(p.warbandId, e.target.value as Outcome)}>
                        <option value="">No outcome yet</option>
                        {(Object.keys(OUTCOME_NAMES) as Exclude<Outcome, ''>[]).map((o) => <option key={o} value={o}>{OUTCOME_NAMES[o]}</option>)}
                      </select>
                    )
                    : <span>{p.outcome ? OUTCOME_NAMES[p.outcome] : ''}</span>}
                </li>
              ))}
            </ul>
          </section>
          {merged.proposals.length > 0 && (
            <section aria-labelledby="b-proposals" className={ui.page}>
              <h2 id="b-proposals">Corrections</h2>
              <ul className={styles.protocol} aria-label="Corrections">
                {merged.proposals.map((p) => {
                  const about = p.targetType === 'protocol_entry' ? merged.entries.find((e) => e.id === p.targetId) : null;
                  return (
                    <li key={p.id} className={`${styles.entry} ${styles.event}`}>
                      <small>
                        {p.author}{about ? ` · about turn ${about.turn}` : ' · about the battle'} · {p.status === 'open' ? 'open' : p.status === 'accepted' ? 'taken over' : 'not taken over'}
                        {p.pending && <span className={styles.pending}> · ⏳ on this phone</span>}
                      </small>
                      <p>{p.payload.text}</p>
                      {lead && !closed && p.status === 'open' && !p.pending && (
                        <div className={styles.row}>
                          <button type="button" className={ui.button} onClick={() => decide(p, true)}>Take over</button>
                          <button type="button" className={ui.buttonQuiet} onClick={() => decide(p, false)}>Reject</button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>

      {!closed && (lead || canPropose) && (
        <div className={styles.actions}>
          {lead && <button type="button" className={ui.button} onClick={() => { setEditing(null); setFormKey((k) => k + 1); setWantPicks(true); cas.open(); }}>+ Casualty</button>}
          {lead && <button type="button" className={ui.button} onClick={() => { setEditing(null); setFormKey((k) => k + 1); ev.open(); }}>+ Event</button>}
          {lead && mine.length > 0 && <button type="button" className={ui.buttonQuiet} onClick={() => void removeEntry(mine.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]!)}>Undo last</button>}
          {!lead && <button type="button" className={ui.button} onClick={() => { setAbout(null); setFormKey((k) => k + 1); prop.open(); }}>Suggest a correction</button>}
        </div>
      )}

      <CasualtySheet dialogRef={cas.ref} close={cas.close} formKey={formKey} participants={view.participants} picks={picks} picksError={picksError} turn={shownTurn}
        entry={editing?.kind === 'casualty' ? (editing as Entry & { kind: 'casualty' }) : null}
        onSave={(payload, t) => void writeEntry(editing?.id ?? newId(), { turn: t, kind: 'casualty', payload }, editing ? 'Corrected.' : 'In the protocol.')} />
      <EventSheet dialogRef={ev.ref} close={ev.close} formKey={formKey} turn={shownTurn}
        entry={editing?.kind === 'event' ? (editing as Entry & { kind: 'event' }) : null}
        onSave={(text, t) => void writeEntry(editing?.id ?? newId(), { turn: t, kind: 'event', payload: { text } }, editing ? 'Corrected.' : 'In the protocol.')} />
      <ProposalSheet dialogRef={prop.ref} close={prop.close} formKey={formKey}
        about={about ? (about.kind === 'casualty' ? `${casualtyText(about.payload, names).victim}, turn ${about.turn}` : `“${(about.payload as { text: string }).text}”`) : null}
        onSave={(text) => {
          const pid = newId();
          const entryId = about?.id ?? null;
          setView({ ...view, proposals: [...view.proposals, { id: pid, targetType: entryId ? 'protocol_entry' : 'battle', targetId: entryId ?? bid, authorId: user.id, author: user.displayName, payload: { text }, status: 'open', decidedBy: null, createdAt: new Date().toISOString() }] });
          void enqueue({ key: pid, op: 'proposal.put', userId: user.id, campaignId: cid, battleId: bid, targetId: pid, body: { entryId, text } })
            .then(() => { notify('Sent to the leader.'); void refresh(); });
        }} />
      {notice}
    </section>
  );
}
