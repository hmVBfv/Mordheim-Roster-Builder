/* Why each change happened (concept 4.3): every change is matched with the
   event or battle record behind it. A change without one — a characteristic
   that rose without an advance, a skill nobody rolled for — is marked
   `unexplained`. That is a visible marker for everyone, never a block.

   Evidence comes from the warband's chronicle (the app's own action log)
   and its casualty records (the battle protocol). Each piece of evidence
   explains at most one change. Some changes need none: choices a player
   makes freely in the post-battle sequence (buying and selling gear, hiring,
   dismissing), names, and the totals that follow from everything else. */
import type { Casualty, LogEntry, WarbandState } from '../state/types.ts';
import type { Change, ChangeKind } from './diff.ts';

export interface ReconciledChange extends Change {
  /** `evt:<log id>` or `cas:<casualty id>`; null without evidence. */
  eventRef: string | null;
  unexplained: boolean;
}

/** Changes that are free choices or follow from others: never unexplained. */
const FREE: ReadonlySet<ChangeKind> = new Set(['renamed', 'gear_added', 'gear_removed', 'rare_removed', 'hired', 'released', 'gold', 'rating', 'worth']);

export interface Evidence { log: LogEntry[]; casualties?: Casualty[] }

/** The evidence of one battle of the campaign server in a save (phase 4a4,
    ADR 0016): the chronicle of its round, and the casualties of the battle
    as the app took it over (the save's battle carries the server's id).
    The app's preview and the server's mark read it alike. */
export function battleEvidence(s: WarbandState, serverBattleId: string, round: number): Evidence {
  const camp = s.campaign ?? {};
  const local = (camp.battles ?? []).find((x) => (x as { serverId?: unknown }).serverId === serverBattleId);
  return {
    log: (camp.log ?? []).filter((e) => Number(e.round) === round),
    casualties: local ? (camp.casualties ?? []).filter((c) => c.battleId === local.id) : [],
  };
}

/** Matches changes with the events and casualty records of the same
    interval (the caller selects them: those of the battle the changes
    follow). */
export function reconcile(changes: Change[], evidence: Evidence): ReconciledChange[] {
  const used = new Set<string>();
  const log = evidence.log ?? [];
  const cas = evidence.casualties ?? [];
  const take = (ref: string) => { used.add(ref); return ref; };
  const findEvent = (pred: (e: LogEntry) => boolean) => { const e = log.find((x) => !used.has(`evt:${x.id}`) && pred(x)); return e ? take(`evt:${e.id}`) : null; };
  const findCas = (pred: (c: Casualty) => boolean) => { const c = cas.find((x) => !used.has(`cas:${x.id}`) && pred(x)); return c ? take(`cas:${c.id}`) : null; };
  const d = (e: LogEntry) => (e.data ?? {}) as Record<string, unknown>;

  const out: ReconciledChange[] = changes.map((c) => ({ ...c, eventRef: null, unexplained: false }));
  for (const c of out) {
    if (FREE.has(c.kind)) continue;
    const p = c.payload;
    let ref: string | null = null;
    switch (c.kind) {
      case 'recruited': ref = findEvent((e) => e.type === 'recruit' && d(e).uid === c.uid); break;
      case 'promoted': ref = findEvent((e) => e.type === 'promote' && d(e).uid === c.uid); break;
      case 'died':
        ref = findCas((x) => x.victim.uid === c.uid && x.result === 'dead')
          ?? findEvent((e) => (e.type === 'death' && d(e).uid === c.uid)); break;
      case 'injury':
        if (p.added === false) break;
        ref = findCas((x) => x.victim.uid === c.uid && x.result === 'injured')
          // the legacy app logged injuries by unit type only
          ?? findEvent((e) => e.type === 'injury' && (d(e).uid === c.uid || (d(e).uid == null && d(e).uid_def != null)));
        break;
      case 'stat': {
        // one advance per point gained; a fall has no advance behind it.
        // Once no advance is left, none will be: the search stops there, so a
        // crafted gain of 1e15 costs no more than the log is long (INPUT-1).
        const gained = Number(p.after) - Number(p.before);
        if (gained <= 0) break;
        const refs: string[] = [];
        while (refs.length < gained) {
          const r = findEvent((e) => e.type === 'advance' && d(e).uid === c.uid && d(e).stat === p.stat);
          if (!r) break;
          refs.push(r);
        }
        ref = refs.length === gained ? (refs[0] as string) : null;
        break;
      }
      case 'skill': if (p.added !== false) ref = findEvent((e) => e.type === 'advance' && d(e).uid === c.uid && d(e).skill === p.skill); break;
      case 'spell': if (p.added !== false) ref = findEvent((e) => e.type === 'advance' && d(e).uid === c.uid && d(e).spell === p.spell); break;
      case 'rare_added': ref = findEvent((e) => e.type === 'item' && d(e).uid === c.uid && d(e).item === p.item); break;
      case 'experience': {
        const gained = Number(p.gained);
        if (gained <= 0) break;
        // what the battle awarded, as applied from the held experience
        const xs = log.filter((e) => !used.has(`evt:${e.id}`) && e.type === 'xp' && d(e).uid === c.uid);
        const sum = xs.reduce((a, e) => a + (Number(d(e).gained) || 0), 0);
        if (xs.length && sum >= gained) { xs.forEach((e) => used.add(`evt:${e.id}`)); ref = `evt:${(xs[0] as LogEntry).id}`; }
        break;
      }
      case 'group_size': {
        // a smaller group is explained by its deaths and its promotions
        const lost = Number(p.before) - Number(p.after);
        if (lost > 0) {
          const accounted = out.filter((x) => (x.kind === 'died' && x.uid === c.uid) || (x.kind === 'promoted' && x.payload.fromUid === c.uid && x.uid !== c.uid)).length;
          if (accounted >= lost) { c.eventRef = null; continue; }
        }
        ref = lost < 0 ? findEvent((e) => e.type === 'recruit' && d(e).uid === c.uid) : null;
        break;
      }
      case 'district': ref = findEvent((e) => e.type === 'district' && d(e).district === p.district); break;
      default: break;
    }
    c.eventRef = ref;
    c.unexplained = ref == null;
  }
  return out;
}

/** Changes that ask for the player's own words ("Sir Honnung +1 WS — what
    happened?"): the ones a story is made of, not routine experience,
    shopping or totals. */
export const STORY_KINDS: ReadonlySet<ChangeKind> = new Set(['recruited', 'died', 'released', 'promoted', 'stat', 'skill', 'spell', 'injury', 'rare_added', 'hired', 'district']);

/** Story changes still without an explanation (`story.explain[changeKey]`). */
export function missingExplanations(changes: Change[], explain: Record<string, string> | undefined): Change[] {
  return changes.filter((c) => STORY_KINDS.has(c.kind) && !(explain && (explain[c.changeKey] || '').trim()));
}
