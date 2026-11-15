/* What changed since the last mark, and marking (phase 4a4). */
import * as core from '@mordheim/core';
import type { GameData, WarbandState } from '@mordheim/core';
import { useEffect, useMemo, useState } from 'react';
import { errorText } from '../account/api.ts';
import { useOnline } from '../app/SyncState.tsx';
import { BeforeAfter } from '../battle/Versions.tsx';
import { markBattle, type BattleView } from '../battle/api.ts';
import { readWarband } from '../campaign/api.ts';
import { db, type StoredWarband } from '../db/db.ts';
import { saveVersion, versionState } from '../sync/versions.ts';
import ui from '../ui/ui.module.css';
import { groupChanges, previewChanges, type AnyChange, type ChangeGroup, type ChangeLine } from './changes.ts';
import styles from './Aftermath.module.css';

export function ChangeList({ groups, label, onExplain }: { groups: ChangeGroup[]; label: string; onExplain?: (l: ChangeLine, who: string) => void }) {
  return (
    <div className={styles.changes} aria-label={label} role="list">
      {groups.map((g) => (
        <article key={g.key} className={styles.who} role="listitem">
          <h3>{g.name || 'The warband'}</h3>
          {g.lines.map((l) => (
            <div key={l.key} className={`${styles.change} ${l.unexplained ? styles.alert : ''}`}>
              <div className={styles.what}>
                <span>{l.what}</span>
                {l.from != null && <><span className={ui.muted}>{l.from}</span><span aria-hidden="true">→</span></>}
                <strong>{l.to}</strong>
                {l.unexplained && <span className={styles.flag}>⚠ no cause found</span>}
              </div>
              {l.why && <small>✓ {l.why}</small>}
              {l.unexplained && <small>Nothing in the chronicle explains it. Everyone in the campaign sees this mark; it blocks nothing.</small>}
              {l.said && <p className={styles.said}>{l.said}</p>}
              {onExplain && l.story && (
                <button type="button" className={`${ui.buttonQuiet} ${styles.explainButton}`} onClick={() => onExplain(l, g.name || 'The warband')}>
                  {l.said ? 'Edit what happened' : 'Say what happened'}
                </button>
              )}
            </div>
          ))}
        </article>
      ))}
    </div>
  );
}

/** What changed since the last mark, and marking. */
export function MarkSection({ data, rec, state, view, cid, round, toRoll, onMarked, notify, onExplain }: {
  data: GameData; rec: StoredWarband; state: WarbandState; view: BattleView; cid: string; round: number; toRoll: number;
  onMarked: () => void; notify: (t: string) => void; onExplain: (l: ChangeLine, who: string) => void;
}) {
  const [before, setBefore] = useState<{ state: WarbandState; label: string } | null>(null);
  const [beforeError, setBeforeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const online = useOnline();
  useEffect(() => {
    let live = true;
    readWarband(cid, rec.id)
      .then((r) => {
        const prev = r.tags.filter((t) => t.round < view.battle.round).at(-1);
        if (!prev) throw new Error('This warband has no mark before this battle.');
        const label = prev.kind === 'start' ? 'its start' : prev.kind === 'sat_out' ? `round ${prev.round}, sat out` : `after battle ${prev.round}`;
        return versionState(data, rec.id, prev.rev).then((s) => ({ state: s, label: `${label} (version ${prev.rev})` }));
      })
      .then((b) => { if (live) setBefore(b); })
      .catch((e: unknown) => { if (live) setBeforeError(errorText(e)); });
    return () => { live = false; };
  }, [cid, rec.id, data, view.battle.round]);
  const changes: AnyChange[] = useMemo(() => (before ? previewChanges(data, before.state, state, view.battle.id, round) : []), [data, before, state, view.battle.id, round]);
  const groups = useMemo(() => groupChanges(changes, state, data), [changes, state, data]);
  const unexplained = changes.filter((c) => c.unexplained && !(core.storyOf(state).explain[c.changeKey] ?? '').trim()).length;
  const unsaid = core.missingExplanations(changes as never, core.storyOf(state).explain).length;
  const mark = view.marks?.[rec.id];

  const doMark = async () => {
    setBusy(true);
    setError(null);
    try {
      const fresh = (await db.warbands.get(rec.id)) ?? rec;
      const saved = await saveVersion(data, fresh, `after battle ${view.battle.round}`);
      if (!saved.ok) { setError(`A newer version (${saved.headRev}) was saved on another device: open Versions and take it, then mark again.`); return; }
      const r = await markBattle(cid, view.battle.id, rec.id, saved.rev);
      const u = r.changes.filter((c) => c.unexplained).length;
      notify(`Marked after battle ${view.battle.round}: version ${saved.rev}, ${r.changes.length} change${r.changes.length === 1 ? '' : 's'}${u ? `, ${u} without a cause` : ''}.`);
      onMarked();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };

  return (
    <section aria-labelledby="am-changes" className={ui.page}>
      <h2 id="am-changes">What changed</h2>
      {before && <p className={ui.muted}>Since {before.label}.{mark ? '' : <small className={ui.noteLine}>A preview; nothing is marked yet.</small>}</p>}
      <BeforeAfter view={view} only={rec.id} />
      {beforeError && <p className={ui.message} role="status">The comparison needs the campaign server: {beforeError}</p>}
      {before && (
        <dl className={styles.summary}>
          <div><dt>Changes</dt><dd>{changes.length}</dd></div>
          <div><dt>Without a cause</dt><dd>{unexplained}</dd></div>
          <div><dt>Not told yet</dt><dd>{unsaid}</dd></div>
        </dl>
      )}
      {before && changes.length === 0 && <p className={ui.muted}>Nothing changed yet.</p>}
      {groups.length > 0 && <ChangeList groups={groups} label="Changes" onExplain={onExplain} />}
      {unsaid > 0 && <p className={ui.muted}>“Say what happened” on a change adds a line to that warrior’s story. It is never required: the mark does not wait for it.</p>}
      <div className={`${ui.card} ${styles.mark}`}>
        {mark && <p>✓ Marked after battle {view.battle.round} – version {mark.rev}, {mark.changes} change{mark.changes === 1 ? '' : 's'}{mark.unexplained ? `, ${mark.unexplained} without a cause` : ''}. Changed something since? Mark again: the newer mark corrects this one.</p>}
        {!mark && toRoll > 0 && <p className={styles.warn}>{toRoll} injur{toRoll === 1 ? 'y is' : 'ies are'} not rolled yet.</p>}
        <button type="button" className={ui.button} disabled={busy || !online} onClick={() => void doMark()}>
          {mark ? `Mark after battle ${view.battle.round} again` : `Looks right – mark after battle ${view.battle.round}`}
        </button>
        <small className={ui.muted}>Saves a version and freezes rating, gold and models as they are now, with what changed – for everyone in the campaign to read.</small>
        {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      </div>
    </section>
  );
}
