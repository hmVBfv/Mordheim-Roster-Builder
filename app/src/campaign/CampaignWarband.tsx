/* Another player's warband in a campaign (phase 4a1): to read – the
   mechanics are open to every member (ADR 0002). Its latest state (the
   player's work since the last version included), the same cards as one's
   own roster without anything to change, and the totals frozen at its marks. */
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useOnCampaign } from '../live/live.ts';
import { Link, useParams } from 'react-router';
import { errorText } from '../account/api.ts';
import { stamp } from '../account/time.ts';
import { useGameData } from '../game/useGameData.ts';
import { Board } from '../roster/Board.tsx';
import board from '../roster/Board.module.css';
import { usePrinting } from '../roster/Print.tsx';
import { rosterView } from '../roster/view.ts';
import { readSave } from '../sync/engine.ts';
import ui from '../ui/ui.module.css';
import { readWarband, type CampaignWarband as Read } from './api.ts';
import styles from './Campaign.module.css';

function Body({ id, read }: { id: string; read: Read }) {
  const data = useGameData();
  const state = useMemo(() => readSave(data, read.draft?.data ?? read.head.data), [data, read]);
  const v = useMemo(() => (state ? rosterView(data, state) : null), [data, state]);
  const { printing } = usePrinting();
  if (!v) return <p className={ui.message}>This warband cannot be read by this version of the app.</p>;
  const start = read.tags.find((t) => t.kind === 'start');
  return (
    <section className={board.page}>
      <header className={board.head}>
        <div className={board.titleRow}><h1>{v.name}</h1></div>
        <p className={board.sub}>{read.player.displayName} · {v.type}</p>
        <dl className={board.tiles}>
          <div className={`${board.tile} ${board.tileGold}`}><dt>Gold</dt><dd>{v.gold} gc</dd></div>
          <div className={board.tile}><dt>Rating</dt><dd>{v.rating}</dd></div>
          <div className={board.tile}><dt>Models</dt><dd>{v.models}/{v.maxModels}</dd></div>
          <div className={board.tile}><dt>Worth</dt><dd>{v.worth}</dd></div>
        </dl>
      </header>
      <p className={`${ui.card} ${ui.muted}`}>
        {read.status === 'pending' ? 'Entered, waiting for a leader. ' : ''}
        {start ? `Start marked ${stamp(start.createdAt)} (version ${start.rev}): rating ${start.totals.rating}, ${start.totals.gold} gc, ${start.totals.models} models. ` : ''}
        {read.draft ? `Shown with ${read.player.displayName}’s changes since version ${read.head.rev} (${stamp(read.draft.updatedAt)}).` : `Version ${read.head.rev}.`}
      </p>
      <Board
        v={v} printing={printing}
        after={v.fallen.length > 0 ? (
          <details className={ui.card}>
            <summary className={board.fallen}>Fallen ({v.fallen.length})</summary>
            <ul>{v.fallen.map((f, i) => <li key={i}>{f}</li>)}</ul>
          </details>
        ) : undefined} />
      <div className={ui.row}><Link to={`/campaign/${id}`} className={ui.buttonQuiet}>Back to the campaign</Link></div>
    </section>
  );
}

export function CampaignWarband() {
  const { id = '', wid = '' } = useParams();
  const [read, setRead] = useState<Read | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    readWarband(id, wid).then((r) => { if (live) setRead(r); }).catch((e: unknown) => { if (live) setError(errorText(e)); });
    return () => { live = false; };
  }, [id, wid]);
  // its owner saved a new version
  useOnCampaign(id, () => { readWarband(id, wid).then(setRead).catch(() => undefined); });
  if (error) {
    return (
      <section className={ui.page}>
        <p className={ui.message} role="alert">{error}</p>
        <div className={ui.row}><Link to={`/campaign/${id}`} className={ui.buttonQuiet}>Back to the campaign</Link></div>
      </section>
    );
  }
  if (!read) return <p className={`${ui.muted} ${styles.section}`}>Loading…</p>;
  return (
    <Suspense fallback={<p className={ui.muted}>Loading the rules…</p>}>
      <Body id={id} read={read} />
    </Suspense>
  );
}
