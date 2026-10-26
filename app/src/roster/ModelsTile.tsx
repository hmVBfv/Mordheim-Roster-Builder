/* The "Models 12/15" tile of a warband's header, with a bar for how full it is: one component for the warband's own page and
   the campaign's view of it, so they cannot drift apart (report #41). */
import board from './Board.module.css';

export function ModelsTile({ models, max, bonus = 0 }: { models: number; max: number; bonus?: number }) {
  return (
    <div className={board.tile}>
      <dt>Models</dt>
      <dd>{models}/{max - bonus}{bonus > 0 && <small>(+{bonus})</small>}<span className={board.meter} aria-hidden="true"><i style={{ width: `${Math.min(100, Math.round((100 * models) / Math.max(1, max)))}%` }} /></span></dd>
    </div>
  );
}
