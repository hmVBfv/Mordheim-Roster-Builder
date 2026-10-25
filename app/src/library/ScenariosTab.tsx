/* The Scenarios tab of the Library (ADR 0023): scenarios written outside any campaign – title, rules, the NPC statlines –
   and kept with the account, private like the rest. A leader brings one into a campaign as a draft
   (scenarios/ScenariosFromLibrary.tsx). The NPCs of a scenario (with the parts hidden from the players, ADR 0022) come
   along with a copy in either direction and are kept as they are here; they are changed in a campaign, where their form lives. */
import { useId, useState } from 'react';
import { errorText } from '../account/api.ts';
import { stamp } from '../account/time.ts';
import { useOnline } from '../app/SyncState.tsx';
import { newId } from '../db/ids.ts';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { putScenario, removeItem, staleItem, type LibraryItem, type LibraryScenario, type ScenarioBody } from './api.ts';
import { LinkChips, LinksField, keepLinks } from './links.tsx';
import styles from './Library.module.css';
import { scenariosOf, useLibrary } from './useLibrary.ts';

/** The limits the server holds to (server/src/scenarios.ts). */
const LIMITS = { title: 120, body: 20_000, statlines: 10_000 } as const;

function ScenarioForm({ scenario, items, online, close, onSaved, onRemoved }: {
  scenario: LibraryScenario | null; items: LibraryItem[] | null; online: boolean; close: (then?: () => void) => void; onSaved: (s: LibraryScenario) => void; onRemoved: (s: LibraryScenario) => void;
}) {
  const ids = useId();
  const [title, setTitle] = useState(scenario?.name ?? '');
  const [body, setBody] = useState(scenario?.body.body ?? '');
  const [statlines, setStatlines] = useState(scenario?.body.npcStatlines ?? '');
  const [links, setLinks] = useState<string[]>(scenario?.body.links ?? []);
  const [base, setBase] = useState<number | undefined>(scenario?.seq);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [id] = useState(() => scenario?.id ?? newId());
  const npcs = scenario?.body.npcs ?? [];

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await putScenario(id, title.trim(), { body: body.trim(), npcStatlines: statlines.trim(), npcs, links: keepLinks(items, links) }, base);
      close(() => onSaved(saved));
    } catch (e) {
      const cur = staleItem<ScenarioBody>(e);
      if (cur) {
        setBase(cur.seq);
        setError('This scenario was changed on another device while you were writing. Save again to replace it with yours, or cancel to see theirs.');
      } else setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await removeItem(id);
      close(() => onRemoved(scenario!));
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <form className={ui.page} onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <h2 id="scenario-form-title">{scenario ? `Edit ${scenario.name}` : 'A new scenario'}</h2>
      {!online && <p className={`${ui.message} ${ui.error}`}>Saving needs the connection.</p>}
      <label className={ui.field} htmlFor={`${ids}-t`}><span>Title</span>
        <input id={`${ids}-t`} className={ui.input} value={title} maxLength={LIMITS.title} autoComplete="off" onChange={(e) => setTitle(e.target.value)} /></label>
      <div className={ui.field}>
        <label htmlFor={`${ids}-b`}>Rules</label>
        <textarea id={`${ids}-b`} className={`${ui.textarea} ${ui.writing}`} rows={8} value={body} maxLength={LIMITS.body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className={ui.field}>
        <label htmlFor={`${ids}-s`}>NPC statlines (optional)</label>
        <textarea id={`${ids}-s`} className={`${ui.textarea} ${ui.writing}`} rows={5} value={statlines} maxLength={LIMITS.statlines} onChange={(e) => setStatlines(e.target.value)} />
      </div>
      {npcs.length > 0 && <p className={ui.muted}>{npcs.length} {npcs.length === 1 ? 'NPC' : 'NPCs'} with their hidden parts travel along with the scenario. They are changed in a campaign, once the scenario is there.</p>}
      <LinksField items={items} selfId={id} links={links} onChange={setLinks} />
      <p className={ui.muted}>Only you see the Library. In a campaign a leader adds the scenario from here as a draft: only leaders read it until it is released to a battle.</p>
      {error && <p className={`${ui.message} ${ui.error}`} role="alert">{error}</p>}
      {asking ? (
        <div className={ui.page}>
          <p>Remove it for good? It is gone on every device. Campaigns that already have a copy keep it.</p>
          <div className={ui.actions}>
            <button type="button" className={ui.buttonQuiet} onClick={() => setAsking(false)}>Keep it</button>
            <button type="button" className={ui.button} disabled={busy || !online} onClick={() => void remove()}>Yes, remove it</button>
          </div>
        </div>
      ) : (
        <div className={ui.actions}>
          {scenario && <button type="button" className={ui.buttonQuiet} disabled={busy} onClick={() => setAsking(true)}>Remove this scenario</button>}
          <button type="button" className={ui.buttonQuiet} onClick={() => close()}>Cancel</button>
          <button type="submit" className={ui.button} disabled={busy || !online || !title.trim()}>Save</button>
        </div>
      )}
    </form>
  );
}

export function ScenariosTab({ notify }: { notify: (t: string) => void }) {
  const online = useOnline();
  const { items, setItems, error } = useLibrary();
  const { ref, open, close } = useSheet('scenario-form');
  const [editing, setEditing] = useState<{ scenario: LibraryScenario | null; key: number } | null>(null);
  const scenarios = scenariosOf(items);
  const edit = (scenario: LibraryScenario | null) => { setEditing((e) => ({ scenario, key: (e?.key ?? 0) + 1 })); open(); };
  const reachable = online && !error;

  return (
    <section className={ui.page} aria-labelledby="scenarios-title">
      <h2 id="scenarios-title" className={styles.title}>Scenarios</h2>
      <p className={ui.muted}>Scenarios written once and used in any campaign: a leader adds one from here as a draft. Only you see this.</p>
      {error && <p className={ui.message} role="status">{error}{items ? ' Shown as last seen.' : ''}</p>}
      {!items && !error && <p className={ui.muted}>Loading the scenarios…</p>}
      {items && scenarios.length === 0 && <p className={ui.muted}>No scenarios yet. Write the first one down.</p>}
      {scenarios.length > 0 && (
        <ul className={styles.list} aria-label="Scenarios">
          {scenarios.map((s) => (
            <li key={s.id} className={styles.idea}>
              <div className={styles.head}>
                <strong>{s.name}</strong>
                {s.body.npcs.length > 0 && <span className={styles.chip}>{s.body.npcs.length} {s.body.npcs.length === 1 ? 'NPC' : 'NPCs'}</span>}
              </div>
              {s.body.body && <p className={styles.excerpt}>{s.body.body.length > 200 ? `${s.body.body.slice(0, 200)}…` : s.body.body}</p>}
              <LinkChips items={items} id={s.id} />
              <small className={styles.meta}>Changed <time dateTime={s.updatedAt}>{stamp(s.updatedAt)}</time></small>
              <div className={ui.row}><button type="button" className={ui.buttonQuiet} aria-label={`Edit ${s.name}`} onClick={() => edit(s)}>Edit</button></div>
            </li>
          ))}
        </ul>
      )}
      <div className={ui.row}><button type="button" className={ui.button} onClick={() => edit(null)}>New scenario</button></div>
      <dialog ref={ref} className={ui.sheet} aria-labelledby="scenario-form-title">
        {editing && (
          <ScenarioForm key={editing.key} scenario={editing.scenario} items={items} online={reachable} close={close}
            onSaved={(s) => { setItems((cur) => [s, ...(cur ?? []).filter((x) => x.id !== s.id)]); notify('Scenario saved. Only you see it.'); }}
            onRemoved={(s) => { setItems((cur) => (cur ?? []).filter((x) => x.id !== s.id)); notify('Scenario removed.'); }} />
        )}
      </dialog>
    </section>
  );
}
