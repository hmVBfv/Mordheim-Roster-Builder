/* The campaign's Timeline tab (phase 4a3, part 2; concept.md 4.7, docs/
   mockups/timeline.html): the story in its order. Fixed anchors – before
   the campaign, each battle's before, course and aftermath, the interlude
   after each round – with the battle reports and the marks; between them
   every note, picture and protocol entry the user may see. Each one moves
   their own blocks with ↑ ↓ or "Move to…", a leader all of them (the
   protocol only a leader); moving changes only the place in the story,
   never when something was recorded. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorText, type Me } from '../account/api.ts';
import { casualtyText, OUTCOME_NAMES, type CasualtyPayload } from '../battle/api.ts';
import type { CampaignView } from '../campaign/api.ts';
import { isSealed, KIND_NAMES } from '../notes/api.ts';
import { useNotes } from '../notes/useNotes.ts';
import { pictureUrl } from '../pictures/api.ts';
import { usePictures } from '../pictures/usePictures.ts';
import ui from '../ui/ui.module.css';
import { UndoToast } from '../ui/UndoToast.tsx';
import { useNotice } from '../ui/Notice.tsx';
import { useSheet } from '../ui/useSheet.ts';
import { cachedTimeline, getTimeline, moveBlock, type Position, type TimelineData, type TimelineMark } from './api.ts';
import { buildTimeline, stepPlace, type Block, type Segment } from './build.ts';
import { between } from './order.ts';
import styles from './Timeline.module.css';

export const TIMELINE_EVERY_MS = 15_000;

function useTimelineData(cid: string) {
  const [data, setData] = useState<TimelineData | null>(null);
  const [error, setError] = useState<string | null>(null);
  // every move made here counts up; an answer asked for before it is not shown over it
  const moves = useRef(0);
  const refresh = useCallback(() => {
    const asked = moves.current;
    return getTimeline(cid).then((d) => { if (asked === moves.current) setData(d); setError(null); }).catch((e: unknown) => setError(errorText(e)));
  }, [cid]);
  useEffect(() => {
    let live = true;
    void cachedTimeline(cid).then((d) => { if (live && d) setData((cur) => cur ?? d); });
    void refresh();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, TIMELINE_EVERY_MS);
    return () => { live = false; clearInterval(t); };
  }, [cid, refresh]);
  const place = useCallback((p: Position) => {
    moves.current++;
    setData((d) => (d ? { ...d, positions: [...d.positions.filter((x) => !(x.itemType === p.itemType && x.itemId === p.itemId)), p] } : d));
  }, []);
  return { data, error, refresh, place };
}

const markText = (m: TimelineMark) => (m.kind === 'start'
  ? `${m.round > 0 ? `Entered after battle ${m.round}` : 'Start'} · ${m.warband} (version ${m.rev})`
  : m.kind === 'sat_out' ? `Sat out round ${m.round} · ${m.warband}`
    : `✓ After battle ${m.round} · ${m.warband} · version ${m.rev}, ${m.changes} change${m.changes === 1 ? '' : 's'}${m.unexplained ? `, ⚠ ${m.unexplained} without a cause` : ''}`);

function BlockBody({ b, cid, names }: { b: Block; cid: string; names: Record<string, string> }) {
  if (b.type === 'picture') {
    const p = b.picture;
    const src = p.localUrl ?? (p.stored ? pictureUrl(cid, p.id) : undefined);
    return (
      <>
        <small className={styles.meta}>Picture · {p.uploader}{p.turn ? ` · turn ${p.turn}` : ''}{p.visibility === 'leader' && <span className={styles.hidden}> · ⚑ Leaders only</span>}</small>
        {src && <img className={styles.thumb} src={src} alt={p.caption || `A picture by ${p.uploader}`} width={p.width} height={p.height} loading="lazy" />}
        {p.caption && <p>{p.caption}</p>}
      </>
    );
  }
  if (b.type === 'entry') {
    const e = b.entry;
    const what = e.kind === 'casualty' ? casualtyText(e.payload as CasualtyPayload, names) : null;
    return (
      <>
        <small className={styles.meta}>Protocol · turn {e.turn}</small>
        {what ? <p><strong>{what.victim}</strong> is out of action{what.by ? <> – by <strong>{what.by}</strong></> : ''}.</p> : <p>{(e.payload as { text: string }).text}</p>}
      </>
    );
  }
  const n = b.note;
  if (isSealed(n)) return <><small className={styles.meta}>🔒 Sealed · {n.author}</small><p className={ui.muted}>Opens when its battle is closed.</p></>;
  const speaker = n.kind === 'quote' ? n.mentions[0] : undefined;
  return (
    <>
      <small className={styles.meta}>
        {KIND_NAMES[n.kind]} · {n.author}{n.turn ? ` · turn ${n.turn}` : ''}
        {n.visibility === 'leader' && <span className={styles.hidden}> · ⚑ Leaders only</span>}
        {n.visibility === 'sealed' && <span> · 🔓 written before, opened after the battle</span>}
      </small>
      {n.kind === 'quote' ? <blockquote className={styles.quote}>“{n.text}”{speaker && <footer>— {speaker.name}</footer>}</blockquote> : <p>{n.text}</p>}
    </>
  );
}

export function TimelineTab({ id, view, user, lead }: { id: string; view: CampaignView; user: Me; lead: boolean }) {
  const notes = useNotes(id, user);
  const pics = usePictures(id, user);
  const tl = useTimelineData(id);
  const [notice, notify] = useNotice();
  const [undo, setUndo] = useState<{ n: number; text: string; back: () => void } | null>(null);
  const { ref: moveRef, open: openMove, close: closeMove } = useSheet();
  const undoCount = useRef(0);
  const [moving, setMoving] = useState<Block | null>(null);
  const names = useMemo(() => Object.fromEntries(view.enrolments.map((e) => [e.warbandId, e.name || e.wbName])), [view.enrolments]);
  const segs: Segment[] = useMemo(() => (tl.data ? buildTimeline(view.battles ?? [], notes.notes ?? [], pics.pictures ?? [], tl.data) : []), [view.battles, notes.notes, pics.pictures, tl.data]);
  const writer = view.role !== 'viewer';

  /** Each moves their own, a leader all; the protocol only a leader; a sealed note only its author. */
  const canMove = (b: Block) => {
    if (!writer) return false;
    if (b.type === 'entry') return lead;
    if (b.type === 'picture') return !b.picture.pending && (b.picture.uploaderId === user.id || lead);
    if (isSealed(b.note)) return false;
    return !b.note.pending && (b.note.authorId === user.id || lead);
  };
  const go = (b: Block, segment: string, pos: string, text: string) => {
    const was = segs.find((s) => s.blocks.some((x) => x.id === b.id))!;
    const back = { itemType: b.type, itemId: b.id, segment: was.key, pos: b.key, movedBy: user.id, movedAt: '' } as Position;
    const p: Position = { itemType: b.type, itemId: b.id, segment, pos, movedBy: user.id, movedAt: '' };
    tl.place(p);
    moveBlock(id, b.type, b.id, { segment, pos }).catch((e: unknown) => { tl.place(back); notify(errorText(e)); });
    setUndo({ n: ++undoCount.current, text, back: () => { tl.place(back); moveBlock(id, b.type, b.id, { segment: back.segment, pos: back.pos }).catch((e: unknown) => notify(errorText(e))); } });
  };
  const step = (b: Block, dir: -1 | 1) => {
    const to = stepPlace(segs, b.id, dir);
    if (to) go(b, to.segment, between(to.before, to.after), dir === -1 ? 'Moved up.' : 'Moved down.');
  };
  const moveTo = (b: Block, seg: Segment) => {
    const last = seg.blocks.filter((x) => x.id !== b.id).at(-1);
    go(b, seg.key, between(last?.key ?? null, null), `Moved to ${seg.title}.`);
  };

  return (
    <div className={ui.page}>
      <p className={ui.muted}>
        The order below is the order of the story. {writer ? 'Move your blocks with ↑ ↓ or ⋯ to where they happen' : 'Players and leaders move blocks to where they happen'}{lead ? ' – as a leader, any block' : ''}.
        Battles, their reports and the marks stay where they are. Moving changes only the place in the story, never when something was recorded.
      </p>
      {tl.error && <p className={ui.message} role="status">{tl.error}{tl.data ? ' Shown as last seen.' : ''}</p>}
      {!tl.data && !tl.error && <p className={ui.muted}>Loading the timeline…</p>}
      <ol className={styles.timeline} aria-label="Timeline">
        {segs.map((s) => (
          <li key={s.key} className={styles.segment} aria-label={s.title}>
            <div className={styles.anchor}><h2>{s.title}</h2><span className={styles.fixed}>fixed</span></div>
            <ol className={styles.blocks}>
              {s.report && (
                <li className={`${styles.block} ${styles.fixedBlock}`}>
                  <small className={styles.meta}>Battle report · fixed</small>
                  <p>{s.report.outcomes.length ? s.report.outcomes.map((o) => `${o.name}${o.outcome ? `: ${OUTCOME_NAMES[o.outcome]}` : ''}`).join(' · ') : 'Who fought is not known yet.'}{s.report.battle.status === 'open' ? ' – still being fought.' : ''}</p>
                </li>
              )}
              {s.marks.map((m) => (
                <li key={m.id} className={`${styles.block} ${styles.fixedBlock}`}>
                  <small className={styles.meta}>Marked state · fixed</small>
                  <p>{markText(m)}</p>
                </li>
              ))}
              {s.blocks.map((b) => {
                const hidden = (b.type === 'note' && !isSealed(b.note) && b.note.visibility === 'leader') || (b.type === 'picture' && b.picture.visibility === 'leader');
                const label = b.type === 'picture' ? (b.picture.caption || 'the picture') : b.type === 'entry' ? `the protocol entry of turn ${b.entry.turn}` : isSealed(b.note) ? 'the sealed note' : b.note.text.slice(0, 40);
                return (
                  <li key={`${b.type}:${b.id}`} className={`${styles.block} ${hidden ? styles.hiddenBlock : ''}`}>
                    <div className={styles.body}><BlockBody b={b} cid={id} names={names} /></div>
                    {canMove(b) && (
                      <div className={styles.tools}>
                        <button type="button" aria-label={`Move up: ${label}`} disabled={!stepPlace(segs, b.id, -1)} onClick={() => step(b, -1)}>↑</button>
                        <button type="button" aria-label={`Move down: ${label}`} disabled={!stepPlace(segs, b.id, 1)} onClick={() => step(b, 1)}>↓</button>
                        <button type="button" aria-label={`Move to…: ${label}`} onClick={() => { setMoving(b); openMove(); }}>⋯</button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
      <dialog ref={moveRef} className={ui.sheet} aria-labelledby="move-title">
        <div className={ui.page}>
          <h2 id="move-title">Move to…</h2>
          <div className={styles.moveTo}>
            {segs.map((s) => {
              const here = !!moving && s.blocks.some((b) => b.id === moving.id);
              return <button key={s.key} type="button" aria-current={here} onClick={() => closeMove(() => { if (moving && !here) moveTo(moving, s); })}>{s.title}</button>;
            })}
          </div>
          <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={() => closeMove()}>Cancel</button></div>
        </div>
      </dialog>
      {undo && <UndoToast key={undo.n} text={undo.text} onUndo={() => { undo.back(); setUndo(null); }} onDone={() => setUndo(null)} />}
      {!undo && notice}
    </div>
  );
}
