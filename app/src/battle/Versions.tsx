/* The version that goes into a battle (docs/ui.md §3, concept.md 4.2): its
   player confirms it before the battle is fought – a leader can for them –
   and the leader sees what went in beside what came out. Nothing here stops
   a battle: an unconfirmed warband just says so. */
import { useState } from 'react';
import { errorText, type Me } from '../account/api.ts';
import { db } from '../db/db.ts';
import { useGameData } from '../game/useGameData.ts';
import { saveVersion } from '../sync/versions.ts';
import ui from '../ui/ui.module.css';
import { confirmBattle, type BattleView, type Participant } from './api.ts';
import styles from './Battle.module.css';

export interface Totals { rating: number; spent: number; models: number; heroes: number; gold: number; fallen: number }

/** What the server froze, when it is what it should be. */
export function readTotals(x: unknown): Totals | null {
  if (!x || typeof x !== 'object') return null;
  const t = x as Record<string, unknown>;
  const keys = ['rating', 'spent', 'models', 'heroes', 'gold', 'fallen'] as const;
  if (!keys.every((k) => typeof t[k] === 'number')) return null;
  return Object.fromEntries(keys.map((k) => [k, t[k]])) as unknown as Totals;
}

const confirmed = (p: Participant) => !!p.confirmedAt;

/** Who of the fighters has not confirmed a version yet. */
export const unconfirmed = (view: BattleView) => view.participants.filter((p) => !confirmed(p));

/** Confirms for one warband: the player's own saves what is on the device as a version and confirms that; a leader confirms the newest on the server. */
export function useConfirm(cid: string, bid: string, user: Me, round: number, setView: (v: BattleView) => void, notify: (t: string) => void) {
  const data = useGameData();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; text: string } | null>(null);
  const confirm = async (p: Participant) => {
    setBusy(p.warbandId);
    setError(null);
    try {
      let rev = p.headRev ?? p.revBefore ?? 1;
      const rec = p.playerId === user.id ? await db.warbands.get(p.warbandId) : undefined;
      if (rec && data) {
        const saved = await saveVersion(data, rec, `before battle ${round}`);
        if (!saved.ok) { setError({ id: p.warbandId, text: `A newer version (${saved.headRev}) was saved on another device: open Versions and take it, then confirm again.` }); return; }
        rev = saved.rev;
      }
      setView(await confirmBattle(cid, bid, p.warbandId, rev));
      notify(`${p.name} goes in with version ${rev}.`);
    } catch (e) { setError({ id: p.warbandId, text: errorText(e) }); } finally { setBusy(null); }
  };
  return { confirm, busy, error };
}

/** One line under a fighter: which version goes in, and the button for whoever may confirm it. */
export function VersionLine({ p, round, mine, lead, open, busy, error, online, onConfirm }: {
  p: Participant; round: number; mine: boolean; lead: boolean; open: boolean; busy: boolean; error: string | null; online: boolean; onConfirm: () => void;
}) {
  const can = open && (mine || lead);
  const newer = confirmed(p) && p.headRev !== undefined && p.revBefore !== null && p.headRev > p.revBefore;
  return (
    <>
      <small className={confirmed(p) ? styles.marked : styles.unmarked}>
        {confirmed(p)
          ? `✓ Version ${p.revBefore} goes in${p.confirmedBy ? ` · confirmed by ${p.confirmedBy}` : ''}${newer ? ` · version ${p.headRev} exists since` : ''}`
          : open ? 'Version not confirmed yet' : 'Went in without a confirmed version'}
      </small>
      {can && (!confirmed(p) || newer) && (
        <button type="button" className={`${ui.buttonQuiet} ${styles.confirm}`} disabled={busy || !online} onClick={onConfirm}>
          {busy ? 'Confirming…' : confirmed(p) ? `Take version ${p.headRev} instead` : mine ? `Confirm my warband for battle ${round}` : `Confirm for ${p.player}`}
        </button>
      )}
      {can && !confirmed(p) && mine && <small className={ui.muted}>Saves the warband as it is now and fixes its numbers for this battle.</small>}
      {error && <small className={styles.warn} role="alert">{error}</small>}
    </>
  );
}

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));
const STATS: { key: keyof Totals; label: string }[] = [
  { key: 'rating', label: 'Rating' }, { key: 'gold', label: 'Gold' }, { key: 'models', label: 'Models' }, { key: 'fallen', label: 'Fallen' },
];

/** What went into the battle beside what came out: the numbers frozen at the confirmation and at the mark after it. */
export function BeforeAfter({ view, only }: { view: BattleView; only?: string }) {
  const list = view.participants.filter((p) => !only || p.warbandId === only);
  const closed = view.battle.status === 'closed';
  return (
    <ul className={styles.compare} aria-label="Before and after">
      {list.map((p) => {
        const before = readTotals(p.beforeTotals);
        const mark = view.marks?.[p.warbandId];
        const after = readTotals(mark?.totals);
        return (
          <li key={p.warbandId} className={ui.card}>
            <strong>{p.name}</strong>
            <small className={ui.muted}>
              {before ? `before: version ${p.revBefore}` : 'before: not confirmed'} · {after ? `after: version ${mark!.rev}` : closed ? 'after: not marked yet' : 'after: the battle is still on'}
            </small>
            <dl className={styles.stats}>
              {STATS.map(({ key, label }) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>
                    {before ? before[key] : '–'} → {after ? after[key] : '–'}
                    {before && after && after[key] !== before[key] && <small className={after[key] > before[key] ? styles.up : styles.down}> {sign(after[key] - before[key])}</small>}
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}
