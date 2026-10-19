/* "Refers to" in an entry's form: what does it refer to – a battle, a faction,
   a Named NPC, or just a few words? The chooser names the kinds, the tiles
   below it are what can be picked (a tap adds, a second tap takes it out),
   and the references so far stand above. */
import { useState } from 'react';
import type { CampaignView } from '../campaign/api.ts';
import type { World } from '../world/api.ts';
import ui from '../ui/ui.module.css';
import type { Ref } from './api.ts';
import styles from './Background.module.css';
import { REF_CHOICES, REF_KIND_NAMES, refLabel, refOptions, sameRef, type RefChoice } from './refs.ts';

const MAX_REFS = 30;
const EMPTY: Record<'faction' | 'npc', string> = {
  faction: 'No faction yet. Factions are made in the World tab.',
  npc: 'No Named NPC yet. Tick “Named” on an NPC in the World tab, and it can be picked here.',
};

export function RefPicker({ refs, battles, world, onChange }: { refs: Ref[]; battles: NonNullable<CampaignView['battles']>; world: World | null; onChange: (refs: Ref[]) => void }) {
  const [kind, setKind] = useState<RefChoice>('battle');
  const [text, setText] = useState('');
  const options = kind === 'text' ? [] : refOptions(kind, battles, world);
  const has = (r: Pick<Ref, 'kind' | 'id'>) => refs.some((x) => sameRef(x, r));
  const toggle = (id: string, label: string) => {
    const r = { kind: kind as Ref['kind'], id, label };
    if (has(r)) onChange(refs.filter((x) => !sameRef(x, r)));
    else if (refs.length < MAX_REFS) onChange([...refs, r]);
  };
  const addText = () => {
    const label = text.trim();
    if (!label || refs.length >= MAX_REFS || refs.some((x) => x.kind === 'text' && x.label === label)) { setText(''); return; }
    onChange([...refs, { kind: 'text', id: '', label }]);
    setText('');
  };
  return (
    <fieldset className={styles.refPicker}>
      <legend>Refers to (optional)</legend>
      {refs.length > 0 && (
        <ul className={styles.refs} aria-label="Refers to">
          {refs.map((r, i) => {
            const shown = refLabel(r, world, battles);
            return (
              <li key={`${r.kind}:${r.id}:${i}`}>
                <small className={styles.refKind}>{REF_KIND_NAMES[r.kind]}</small> <span>{shown.label}</span>{shown.gone && <small className={ui.muted}> (removed)</small>}
                <button type="button" className={ui.buttonQuiet} aria-label={`Take “${shown.label}” out`} onClick={() => onChange(refs.filter((_, j) => j !== i))}>✕</button>
              </li>
            );
          })}
        </ul>
      )}
      <div className={styles.refKinds} role="group" aria-label="What does it refer to?">
        {REF_CHOICES.map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{k === 'text' ? 'Something else' : REF_KIND_NAMES[k]}</button>)}
      </div>
      {kind === 'text' ? (
        <div className={ui.row}>
          <input className={ui.select} value={text} maxLength={120} placeholder="A place, a note, a rumour…" aria-label="Another reference"
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addText(); } }} />
          <button type="button" className={ui.buttonQuiet} disabled={!text.trim()} onClick={addText}>Add</button>
        </div>
      ) : options.length > 0 ? (
        <ul className={styles.refTiles} aria-label={`${REF_KIND_NAMES[kind]}s to pick`}>
          {options.map((o) => (
            <li key={o.id}>
              <button type="button" aria-pressed={has({ kind, id: o.id })} onClick={() => toggle(o.id, o.label)}>
                <span>{o.label}</span>{o.hint && <small>{o.hint}</small>}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={ui.muted} role="status">{kind === 'battle' ? 'No battle yet.' : !world ? 'Reading the world…' : EMPTY[kind]}</p>
      )}
    </fieldset>
  );
}
