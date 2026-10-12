/* One sheet for everything a player writes about their warband (phase 4b2):
   the prologue, an interlude, a warrior's profile, the warband's names.
   A few labelled fields, each with the limit the save is held to; Save
   hands the words back and the screen applies them as an action of core. */
import { useId, useState } from 'react';
import ui from '../ui/ui.module.css';
import type { useSheet } from '../ui/useSheet.ts';
import styles from './Story.module.css';

export interface Field {
  /** The key in `values` (and in the save: `name_de`, `voice` …). */
  key: string;
  label: string;
  /** A line, or words of several lines. */
  kind: 'line' | 'text';
  max: number;
  hint?: string;
  placeholder?: string;
  rows?: number;
}

export interface FieldsEdit {
  /** A new key each time, so the form starts from the values it is given. */
  key: number;
  title: string;
  intro?: string;
  fields: Field[];
  values: Record<string, string>;
  /** What the words are used for, shown under the fields. */
  note?: string;
  save: (values: Record<string, string>) => void;
}

type Sheet = ReturnType<typeof useSheet>;

function Form({ close, edit, titleId }: { close: Sheet['close']; edit: FieldsEdit; titleId: string }) {
  const [values, setValues] = useState(edit.values);
  const ids = useId();
  const changed = edit.fields.some((f) => (values[f.key] ?? '').trim() !== (edit.values[f.key] ?? '').trim());
  return (
    <form method="dialog" className={ui.page} onSubmit={(e) => { e.preventDefault(); close(() => edit.save(values)); }}>
      <h2 id={titleId}>{edit.title}</h2>
      {edit.intro && <p className={ui.muted}>{edit.intro}</p>}
      {edit.fields.map((f) => {
        const id = `${ids}-${f.key}`;
        const v = values[f.key] ?? '';
        const set = (x: string) => setValues((p) => ({ ...p, [f.key]: x }));
        return (
          <div key={f.key} className={ui.field}>
            <label htmlFor={id}>{f.label}</label>
            {f.kind === 'line'
              ? <input id={id} className={ui.input} value={v} maxLength={f.max} placeholder={f.placeholder} autoComplete="off" onChange={(e) => set(e.target.value)} />
              : <textarea id={id} className={`${ui.textarea} ${ui.writing}`} rows={f.rows ?? 5} value={v} maxLength={f.max} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />}
            {f.hint && <small className={ui.muted}>{f.hint}</small>}
            {v.length > f.max * 0.8 && <small className={styles.count}>{v.length} / {f.max}</small>}
          </div>
        );
      })}
      {edit.note && <p className={ui.muted}>{edit.note}</p>}
      <div className={ui.row}>
        <button type="submit" className={ui.button} disabled={!changed}>Save</button>
        <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
      </div>
    </form>
  );
}

export function FieldsSheet({ dialogRef, close, edit }: { dialogRef: Sheet['ref']; close: Sheet['close']; edit: FieldsEdit | null }) {
  const id = useId();
  return (
    <dialog ref={dialogRef} className={ui.sheet} aria-labelledby={id}>
      {edit && <Form key={edit.key} close={close} edit={edit} titleId={id} />}
    </dialog>
  );
}
