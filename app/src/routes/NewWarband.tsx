/* Starting a new warband (phase 3a), as the Roster Builder starts one: the
   warband from the list grouped by grade, its variant where it has one,
   and a name. The roster opens empty, with the starting gold to spend.

   For a campaign (Rob, 05.10.2026: "Enter a warband" → "New warband for
   this campaign", ?campaign=<id>): the warband is made as always, free
   under Warbands, and a copy is entered in the campaign at once; the copy
   opens. Campaigns stay apart from the warbands themselves. */
import { warbandPickerGroups } from '@mordheim/core';
import { Suspense, useId, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { errorText } from '../account/api.ts';
import { useCampaignName } from '../campaign/name.ts';
import { db, type StoredWarband } from '../db/db.ts';
import { newId } from '../db/ids.ts';
import { newOwnership } from '../sync/local.ts';
import { requestSync } from '../sync/runner.ts';
import { FORMAT } from '@mordheim/core';
import { useGameData } from '../game/useGameData.ts';
import { createWarband, newWarbandChoice } from '../roster/view.ts';
import ui from '../ui/ui.module.css';

function Form({ campaignId }: { campaignId: string | null }) {
  const data = useGameData();
  const [made, setMade] = useState<{ id: string; error: string } | null>(null);
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
    let open = rec.id;
    if (campaignId) {
      try {
        const { enterWarband } = await import('../campaign/enter.ts');
        open = (await enterWarband(data, campaignId, rec)).id;
      } catch (e) {
        // the warband is made; entering it can wait for the connection
        setMade({ id: rec.id, error: errorText(e) });
        setBusy(false);
        return;
      }
    }
    // Back from the new roster leads to where the player came from, not to this form
    void navigate(`/warbands/${open}`, { replace: true });
  };

  if (made && campaignId) {
    return (
      <div className={ui.page}>
        <p className={`${ui.message} ${ui.error}`} role="alert">Your warband is made and under Warbands, but it could not be entered yet: {made.error} Enter it from the campaign later.</p>
        <div className={ui.row}>
          <Link to={`/warbands/${made.id}`} className={ui.button} replace>Open the warband</Link>
          <Link to={`/campaign/${campaignId}`} className={ui.buttonQuiet} replace>To the campaign</Link>
        </div>
      </div>
    );
  }

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
        <Link to={campaignId ? `/campaign/${campaignId}` : '/warbands'} className={ui.buttonQuiet}>Cancel</Link>
      </div>
    </form>
  );
}

export function NewWarband() {
  const [params] = useSearchParams();
  const campaignId = params.get('campaign');
  const campaign = useCampaignName(campaignId);
  return (
    <section className={ui.page}>
      <h1>New warband</h1>
      {campaignId && (
        <p className={`${ui.card} ${ui.muted}`}>
          For {campaign ?? 'the campaign'}: the warband is yours under Warbands, free for other games; a copy of it is entered in the campaign at once, and that copy opens.
        </p>
      )}
      <Suspense fallback={<p className={ui.muted}>Loading the rules…</p>}>
        <Form campaignId={campaignId} />
      </Suspense>
    </section>
  );
}
