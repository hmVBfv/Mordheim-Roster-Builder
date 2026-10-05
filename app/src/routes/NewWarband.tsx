/* Starting a new warband (phase 3a), as the Roster Builder starts one: the
   warband from the list grouped by grade, its variant where it has one,
   and a name. The roster opens empty, with the starting gold to spend. */
import { warbandPickerGroups } from '@mordheim/core';
import { Suspense, useId, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { db, type StoredWarband } from '../db/db.ts';
import { newId } from '../db/ids.ts';
import { newOwnership } from '../sync/local.ts';
import { requestSync } from '../sync/runner.ts';
import { FORMAT } from '@mordheim/core';
import { useGameData } from '../game/useGameData.ts';
import { createWarband, newWarbandChoice } from '../roster/view.ts';
import ui from '../ui/ui.module.css';

function Form() {
  const data = useGameData();
  const groups = useMemo(() => warbandPickerGroups(data), [data]);
  const [key, setKey] = useState('');
  const [sub, setSub] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const ids = { wb: useId(), sub: useId(), name: useId() };
  const choice = key ? newWarbandChoice(data, key) : null;
  const subtype = choice?.subtypes.find((x) => x.key === sub) ?? choice?.subtypes[0] ?? null;
  const gold = subtype?.gold ?? choice?.gold ?? 0;

  const create = async () => {
    if (!choice) return;
    setBusy(true);
    const s = createWarband(data, choice.key, subtype?.key ?? null, name);
    const now = new Date().toISOString();
    const rec: StoredWarband = {
      id: newId(), name: s.name || choice.name, wb: choice.key, wbName: choice.name,
      state: s, format: FORMAT, createdAt: now, updatedAt: now, ...newOwnership('save'),
    };
    await db.warbands.add(rec);
    requestSync();
    // Back from the new roster leads to where the player came from, not to this form
    void navigate(`/warbands/${rec.id}`, { replace: true });
  };

  return (
    <form className={ui.page} onSubmit={(e) => { e.preventDefault(); void create(); }}>
      <label className={ui.field} htmlFor={ids.wb}>
        <span>Warband</span>
        <select id={ids.wb} className={ui.select} value={key} required
          onChange={(e) => { setKey(e.target.value); setSub(null); }}>
          <option value="" disabled>Choose a warband…</option>
          {groups.map((g) => (
            <optgroup key={g.grade} label={g.label}>
              {g.warbands.map((w) => <option key={w.key} value={w.key}>{w.name}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      {choice && choice.subtypes.length > 0 && (
        <label className={ui.field} htmlFor={ids.sub}>
          <span>{choice.subtypeLabel?.replace(/:\s*$/, '') || 'Variant'}</span>
          <select id={ids.sub} className={ui.select} value={subtype?.key ?? ''} onChange={(e) => setSub(e.target.value)}>
            {choice.subtypes.map((x) => <option key={x.key} value={x.key}>{x.name}{x.gold !== choice.gold ? ` (${x.gold} gc)` : ''}</option>)}
          </select>
        </label>
      )}
      <label className={ui.field} htmlFor={ids.name}>
        <span>Name</span>
        <input id={ids.name} className={ui.input} value={name} maxLength={80} autoComplete="off"
          placeholder={choice?.name ?? 'The name of your warband'} onChange={(e) => setName(e.target.value)} />
      </label>
      {choice && <p className={ui.muted}>Starting gold: {gold} gc.</p>}
      <div className={ui.row}>
        <button type="submit" className={ui.button} disabled={!choice || busy}>Start the warband</button>
        <Link to="/warbands" className={ui.buttonQuiet}>Cancel</Link>
      </div>
    </form>
  );
}

export function NewWarband() {
  return (
    <section className={ui.page}>
      <h1>New warband</h1>
      <Suspense fallback={<p className={ui.muted}>Loading the rules…</p>}>
        <Form />
      </Suspense>
    </section>
  );
}
