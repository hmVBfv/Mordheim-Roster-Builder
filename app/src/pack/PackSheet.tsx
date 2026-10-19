/* The AI pack sheet (phase 4b4a; concept.md 4.10, docs/mockups/timeline.html):
   the battle in the order of the timeline and all that goes with it, as one
   Markdown prompt a leader gives Claude in a chat. The app calls no AI. Leaders
   only, because hidden background goes in, each piece with the rule how far it
   may be told. The leader chooses the battle, the parts and the language and
   sees the prompt as it will be copied. */
import { buildPack, PACK_PARTS, packSize, type PackLang, type PackPart } from '@mordheim/core';
import { useEffect, useId, useMemo, useState } from 'react';
import { errorText } from '../account/api.ts';
import { battleTitle, type BattleSummary } from '../battle/api.ts';
import type { CampaignView } from '../campaign/api.ts';
import { useGameData } from '../game/useGameData.ts';
import notes from '../notes/Notes.module.css';
import type { Segment } from '../timeline/build.ts';
import { copyText, fileSlug, saveFile } from '../ui/files.ts';
import ui from '../ui/ui.module.css';
import { gatherPack, packInput, type Gathered } from './gather.ts';
import styles from './Pack.module.css';

const PARTS: Record<PackPart, [string, string]> = {
  aftermath: ['Aftermath and advances', 'deaths, injuries, advances, equipment and gold per warband, each with the player’s explanation and what the warrior did in this battle'],
  canon: ['Canon', 'names, titles and voices in German and English, from the warriors’ profiles'],
  world: ['World', 'the districts held, factions, people and the standing of each warband'],
  notes: ['Notes of the round', 'the public notes of the interlude; sealed ones once opened'],
  plan: ['The leaders’ plan ⚑', 'the red thread written for this battle under Background → Plans, as direction for the writer'],
  background: ['Background ⚑', 'threads, people and places that have started, each with how far it may be told as a hard rule'],
  story: ['The story so far', 'the backstory before the app, the chapters written so far and the last one in full'],
  style: ['Style', 'the campaign’s style guide'],
};
const LANGS: [PackLang, string][] = [['de', 'Deutsch'], ['en', 'English'], ['both', 'Both']];

/** The inside of the sheet: made anew each time it opens, so it asks the server again. */
export function PackForm({ cid, campaign, view, segs, close, titleId }: {
  cid: string; campaign: string; view: CampaignView; segs: Segment[]; close: () => void; titleId: string;
}) {
  const data = useGameData();
  const ids = useId();
  // the prompt is made from what the Timeline showed when the sheet opened; the Timeline asks the server again every 15 seconds, the prompt does not move under the leader's hands
  const [snap] = useState({ view, segs });
  const battles: BattleSummary[] = useMemo(() => [...(snap.view.battles ?? [])].sort((a, b) => b.round - a.round || b.createdAt.localeCompare(a.createdAt)), [snap]);
  const [battleId, setBattleId] = useState(battles[0]?.id ?? '');
  const [parts, setParts] = useState<Set<PackPart>>(() => new Set(PACK_PARTS));
  const [lang, setLang] = useState<PackLang>('de');
  const [state, setState] = useState<{ for: string; g: Gathered | null; error: string | null }>({ for: '', g: null, error: null });
  const [status, setStatus] = useState('');

  useEffect(() => {
    const battle = battles.find((b) => b.id === battleId);
    if (!battle) return;
    let live = true;
    gatherPack({ cid, campaign, view: snap.view, battle, segs: snap.segs, data })
      .then((g) => { if (live) setState({ for: battleId, g, error: null }); })
      .catch((e: unknown) => { if (live) setState({ for: battleId, g: null, error: errorText(e) }); });
    return () => { live = false; };
  }, [cid, campaign, snap, battles, battleId, data]);

  const ready = state.for === battleId ? state : { for: battleId, g: null, error: null };
  const battle = battles.find((b) => b.id === battleId);
  const text = useMemo(() => (ready.g ? buildPack(data, packInput(ready.g, lang), { parts: PACK_PARTS.filter((p) => parts.has(p)), lang }) : ''), [data, ready.g, lang, parts]);
  const size = packSize(text);
  const toggle = (p: PackPart) => { setStatus(''); setParts((cur) => { const n = new Set(cur); if (n.has(p)) n.delete(p); else n.add(p); return n; }); };
  const count = (p: PackPart): string => {
    const b = ready.g?.base;
    if (!b) return '';
    const n = p === 'background' ? b.background.length : p === 'canon' ? b.canon.length : p === 'notes' ? b.roundNotes.length : p === 'story' ? ready.g!.chapters.length + (b.backstory?.length ?? 0) : -1;
    return n >= 0 ? ` (${n})` : '';
  };

  const copy = () => { void copyText(text).then((ok) => setStatus(ok ? 'Prompt copied. Paste it into a chat with Claude.' : 'Copying is not possible here. Select the text and copy it yourself.')); };
  const download = () => {
    if (!battle) return;
    saveFile(`${fileSlug(campaign)}-battle-${battle.round}-ai-pack.md`, text, 'text/markdown');
    setStatus('Saved as a .md file.');
  };

  return (
    <div className={ui.page}>
      <h2 id={titleId}>AI pack</h2>
      <p className={ui.muted}>One prompt with everything below, in the order of the timeline. Give it to Claude in a chat; the chapter that comes back is imported with “Import chapters…” on the Timeline. The app itself calls no AI.</p>
      <p className={styles.leader}>⚑ Leaders only. Hidden background goes in, each piece with the rule how far it may be told – and the notes only leaders can read stay out.</p>
      {battles.length === 0 ? <p className={ui.muted}>The campaign has no battle yet.</p> : (
        <>
          <label className={ui.field} htmlFor={`${ids}-b`}><span>Battle</span>
            <select id={`${ids}-b`} className={ui.select} value={battleId} onChange={(e) => { setBattleId(e.target.value); setStatus(''); }}>
              {battles.map((b) => <option key={b.id} value={b.id}>{battleTitle(b)}</option>)}
            </select></label>
          <fieldset className={styles.parts}>
            <legend>What goes in</legend>
            <label className={`${notes.choice} ${notes.chosen}`}><input type="checkbox" checked disabled readOnly /><span>The battle in story order<small>who fought, the scenario, and what was recorded of the battle, as arranged on the Timeline</small></span></label>
            {PACK_PARTS.map((p) => (
              <label key={p} className={`${notes.choice} ${parts.has(p) ? notes.chosen : ''}`}>
                <input type="checkbox" checked={parts.has(p)} onChange={() => toggle(p)} /><span>{PARTS[p][0]}{count(p)}<small>{PARTS[p][1]}</small></span>
              </label>
            ))}
          </fieldset>
          <fieldset className={notes.who}>
            <legend>Language of the chapter</legend>
            {LANGS.map(([v, name]) => (
              <label key={v} className={`${notes.choice} ${lang === v ? notes.chosen : ''}`}>
                <input type="radio" name="pack-lang" checked={lang === v} onChange={() => { setLang(v); setStatus(''); }} /><span>{name}</span>
              </label>
            ))}
          </fieldset>
          {ready.error && <p className={`${ui.message} ${ui.error}`} role="alert">{ready.error}</p>}
          {!ready.g && !ready.error && <p className={ui.muted} role="status">Gathering the material…</p>}
          {ready.g && ready.g.warnings.length > 0 && (
            <ul className={ui.muted} aria-label="Gaps in the material">{ready.g.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          )}
          {ready.g && (
            <>
              <div className={ui.field}>
                <label htmlFor={`${ids}-t`}>The prompt, as it will be copied</label>
                <textarea id={`${ids}-t`} className={`${ui.textarea} ${styles.prompt}`} rows={10} readOnly value={text} />
              </div>
              <p className={styles.size}>{size.chars.toLocaleString('en')} characters · about {size.tokens.toLocaleString('en')} tokens</p>
            </>
          )}
          {status && <p className={ui.message} role="status">{status}</p>}
        </>
      )}
      <div className={ui.row}>
        <button type="button" className={ui.button} disabled={!ready.g} onClick={copy}>Copy prompt</button>
        <button type="button" className={ui.buttonQuiet} disabled={!ready.g} onClick={download}>Download .md</button>
        <button type="button" className={ui.buttonQuiet} onClick={close}>Close</button>
      </div>
    </div>
  );
}
