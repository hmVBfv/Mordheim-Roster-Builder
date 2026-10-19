/* The values part of an NPC form (the world's people, later the scenarios'):
   the grid of characteristics to fill in – movement, weapon skill and so on –
   with skills, equipment and rules; a copy from any model of the game, the
   campaign's warriors or another NPC; and, as the fallback, the plain text
   the Tabletop Simulator copy reads. Leaders only, loaded when a form opens. */
import { npcAsOpponent, npcProfileFrom, npcStatline, parseStatline, type OpponentProfile, type OpponentTemplate } from '@mordheim/core';
import { useEffect, useId, useState } from 'react';
import { cachedOpponents, getOpponents, type OwnSkill } from '../opponents/api.ts';
import { ProfileEditor, TemplatePicker, type WarbandRef } from '../opponents/ProfileTools.tsx';
import ui from '../ui/ui.module.css';
import { LIMITS } from './api.ts';
import { isBlank, type NpcDraft } from './npcDraft.ts';
import styles from './World.module.css';

/** The campaign's own skills, as far as the device knows them, then as the server has them. */
function useOwnSkills(cid: string) {
  const [own, setOwn] = useState<OwnSkill[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    void cachedOpponents(cid).then((c) => { if (live && c) setOwn(c.skills); });
    if (tick === 0) getOpponents(cid).then((o) => { if (live) setOwn(o.skills); }).catch(() => undefined);
    return () => { live = false; };
  }, [cid, tick]);
  return { own, changed: () => setTick((t) => t + 1) };
}

export function NpcFields({ cid, warbands, extra, name, draft, onDraft, onCopied }: {
  cid: string; warbands: WarbandRef[]; extra: OpponentTemplate[]; /** the name as typed, for the labels */ name: string;
  draft: NpcDraft; onDraft: (d: NpcDraft) => void; /** after a copy: the name of the model it came from */ onCopied: (name: string) => void;
}) {
  const ids = useId();
  const { own, changed } = useOwnSkills(cid);
  const [copying, setCopying] = useState(false);
  const [note, setNote] = useState('');

  const asOpponent = npcAsOpponent(name, draft.profile);
  const setProfile = (p: OpponentProfile) => onDraft({ ...draft, profile: { type: p.type, profile: p.profile, sv: p.sv, skills: p.skills, equipment: p.equipment, rules: p.rules, from: p.from } });
  const copy = (t: OpponentTemplate) => {
    onDraft({ ...draft, mode: 'values', profile: npcProfileFrom(t) });
    onCopied(t.name);
    setCopying(false);
    setNote('');
  };
  const toValues = () => {
    if (draft.mode === 'values') return;
    if (!draft.text.trim()) { onDraft({ ...draft, mode: 'values' }); setNote(''); return; }
    const read = parseStatline(draft.text);
    if (!read) { setNote('No statline found in the text – it needs at least five characteristics, like “M4 WS3 BS3 S3 T3 W1 I3 A1 Ld7”. Write the values in by hand, or keep the text.'); return; }
    onDraft({ ...draft, mode: 'values', profile: read });
    setNote('Read the values from the text. Check them; the text is written again from them.');
  };
  const toText = () => {
    if (draft.mode === 'text') return;
    onDraft({ ...draft, mode: 'text', text: isBlank(draft.profile) ? draft.text : npcStatline(draft.profile) });
    setNote('');
  };

  return (
    <>
      <div className={styles.tools}>
        <div className={styles.modes} role="group" aria-label="How the values are written">
          <button type="button" aria-pressed={draft.mode === 'values'} onClick={toValues}>Values</button>
          <button type="button" aria-pressed={draft.mode === 'text'} onClick={toText}>Text for Tabletop Simulator</button>
        </div>
        <button type="button" className={ui.buttonQuiet} aria-expanded={copying} onClick={() => setCopying((c) => !c)}>Copy from a model…</button>
      </div>
      {note && <p className={ui.muted} role="status">{note}</p>}
      {copying && <TemplatePicker cid={cid} warbands={warbands} extra={extra} verb="Copy" done="Close" onPick={copy} onClose={() => setCopying(false)} />}
      {draft.mode === 'values' ? (
        <ProfileEditor bare cid={cid} p={asOpponent} own={own} onChange={setProfile} onOwn={changed} />
      ) : (
        <div className={ui.field}>
          <label htmlFor={`${ids}-sl`}>Statline and rules as text</label>
          <textarea id={`${ids}-sl`} className={`${ui.textarea} ${ui.writing}`} rows={8} value={draft.text} maxLength={LIMITS.statline} onChange={(e) => onDraft({ ...draft, text: e.target.value })} />
          <small className={ui.muted}>The way the Tabletop Simulator export writes them. Players read it too. “Values” fills in the same as a grid.</small>
        </div>
      )}
    </>
  );
}
