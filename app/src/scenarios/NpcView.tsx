/* An NPC of a scenario as a card reads it: name, the characteristics in a row,
   skills, equipment and rules, and the Tabletop Simulator copy – never its
   type, which nobody reads (Rob, 20.10.2026). The players get the NPC from the
   server with every part the leader hid already replaced by a "?" (ADR 0022);
   a leader gets all of it and sees what is hidden from the players marked – in
   words, not by colour alone – and can look at the card the way the players
   read it with the eye, the way a password is shown. */
import { useState } from 'react';
import { OPPONENT_STATS, redactNpc, scenarioNpcCard, type Hidable, type ScenarioNpc } from '@mordheim/core';
import { CopyField } from '../roster/TtsCard.tsx';
import { EquipmentTips } from '../ui/EquipmentTips.tsx';
import { EyeIcon, EyeOffIcon } from '../ui/icons.tsx';
import ui from '../ui/ui.module.css';
import styles from './Scenarios.module.css';

const PART_LABEL: Record<Hidable, string> = { name: 'name', M: 'M', WS: 'WS', BS: 'BS', S: 'S', T: 'T', W: 'W', I: 'I', A: 'A', Ld: 'Ld', sv: 'Sv', skills: 'skills', equipment: 'equipment', equipmentTips: 'equipment tooltips', rules: 'special rules' };

/** What the players read in place of the hidden parts, in words. */
export const hiddenWords = (hidden: readonly Hidable[]): string => hidden.map((k) => PART_LABEL[k]).join(', ');

/** The characteristics of an NPC in a row, the way the rule book prints them; a leader sees the hidden cells marked. */
export function NpcStats({ n, marked }: { n: ScenarioNpc; marked: boolean }) {
  const hid = (k: Hidable) => marked && n.hidden.includes(k);
  return (
    <div className={styles.statsWrap}>
      <table className={styles.stats} aria-label={`Characteristics of ${n.name}`}>
        <thead><tr>{OPPONENT_STATS.map((k) => <th key={k} scope="col">{k}</th>)}<th scope="col">Sv</th></tr></thead>
        <tbody>
          <tr>
            {OPPONENT_STATS.map((k) => <td key={k} className={hid(k) ? styles.hiddenCell : undefined}>{n.profile[k]?.trim() || '-'}</td>)}
            <td className={hid('sv') ? styles.hiddenCell : undefined}>{n.sv.trim() || '-'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function NpcView({ n, lead, onCopied }: { n: ScenarioNpc; lead: boolean; onCopied: (what: string) => void }) {
  // a leader reads the whole NPC; the eye shows the card as the players read it (and back)
  const [asPlayers, setAsPlayers] = useState(false);
  const secret = lead && n.hidden.length > 0;
  const shown = secret && asPlayers ? redactNpc(n) : n;
  const tips = shown.equipmentTips ?? [];
  const rules = shown.rules.split('\n').map((x) => x.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean);
  const table = scenarioNpcCard(n);
  return (
    <li className={`${styles.npc} ${secret ? styles.npcHidden : ''}`}>
      <div className={styles.npcHead}>
        <strong>{shown.name}</strong>
        {secret && (
          <button type="button" className={`${styles.eye} ${asPlayers ? styles.eyeOn : ''}`} aria-pressed={asPlayers} title="Look at this card the way the players read it" onClick={() => setAsPlayers((v) => !v)}>
            {asPlayers ? <EyeOffIcon /> : <EyeIcon />}<span>Players’ view</span>
          </button>
        )}
      </div>
      {secret && !asPlayers && <p className={styles.secret}>⚑ The players read “?” for: {hiddenWords(n.hidden)}.</p>}
      {secret && asPlayers && <p className={styles.secret} role="status">This is the card as the players read it.</p>}
      <NpcStats n={shown} marked={lead && !asPlayers} />
      {(shown.skills.length > 0 || shown.equipment.trim() || tips.length > 0 || rules.length > 0) && (
        <details className={styles.more}>
          <summary className={ui.fold}>Skills, equipment and rules</summary>
          <div className={styles.rules}>
            {shown.skills.length > 0 && <p><strong>Skills:</strong> {shown.skills.map((s) => s.name).join(', ')}</p>}
            {shown.equipment.trim() && <p><strong>Equipment:</strong> {shown.equipment.trim()}</p>}
            <EquipmentTips tips={tips} />
            {rules.length > 0 && <ul>{rules.map((r, i) => <li key={`${i}:${r}`}>{r}</li>)}</ul>}
          </div>
        </details>
      )}
      <details className={styles.more}>
        <summary className={ui.fold}>{secret ? 'Tabletop Simulator – as the players get it' : 'Tabletop Simulator'}</summary>
        <CopyField label="Name" value={table.name} rows={1} onCopied={onCopied} />
        <CopyField label="Description" value={table.text} rows={7} onCopied={onCopied} />
      </details>
      {secret && !asPlayers && (
        <details className={styles.more}>
          <summary className={ui.fold}>Tabletop Simulator – every value, for you</summary>
          <CopyField label="Name (whole)" value={scenarioNpcCard(n, true).name} rows={1} onCopied={onCopied} />
          <CopyField label="Description (whole)" value={scenarioNpcCard(n, true).text} rows={7} onCopied={onCopied} />
        </details>
      )}
    </li>
  );
}
