/* The pieces a leaders' form in a sheet is made of (world, scenarios): the
   saving state that keeps the sheet open with its words when the server
   refuses, the Save/Cancel row, the dialog around a form, the removal prompt. */
import { useId, useState } from 'react';
import { errorText } from '../account/api.ts';
import ui from './ui.module.css';
import type { useSheet } from './useSheet.ts';

type Sheet = ReturnType<typeof useSheet>;

/** A sheet's form: it stays open with the words and says why, when the server refuses. */
export function useSaving(onSave: () => Promise<void>, close: () => void, explain: (e: unknown) => string = errorText) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    onSave().then(() => close(), (err: unknown) => setError(explain(err))).finally(() => setBusy(false));
  };
  return { busy, error, submit };
}

export function Actions({ busy, ok, label, close, error }: { busy: boolean; ok: boolean; label: string; close: () => void; error: string | null }) {
  return (
    <>
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      <div className={ui.actions}>
        <button type="button" className={ui.buttonQuiet} onClick={close}>Cancel</button>
        <button type="submit" className={ui.button} disabled={busy || !ok}>{label}</button>
      </div>
    </>
  );
}

export interface Removing { key: number; title: string; text: string; run: () => Promise<void> }

export function RemoveForm({ r, close, titleId }: { r: Removing; close: () => void; titleId: string }) {
  const { busy, error, submit } = useSaving(r.run, close);
  return (
    <form className={ui.page} onSubmit={submit}>
      <h2 id={titleId}>{r.title}</h2>
      <p className={ui.muted}>{r.text}</p>
      <Actions busy={busy} ok label="Remove" close={close} error={error} />
    </form>
  );
}

/** `wide`: a form with many parts (an NPC's values, a scenario) – on a desktop it takes more of the screen. */
export function FormSheet({ dialogRef, wide = false, children }: { dialogRef: Sheet['ref']; wide?: boolean; children: (titleId: string) => React.ReactNode }) {
  const id = useId();
  return <dialog ref={dialogRef} className={wide ? `${ui.sheet} ${ui.sheetWide}` : ui.sheet} aria-labelledby={id}>{children(id)}</dialog>;
}
