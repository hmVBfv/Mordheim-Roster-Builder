/* An NPC of a scenario as a card reads it: name, type, the characteristics in a
   row, skills, equipment and rules, and the Tabletop Simulator copy. The
   players get the NPC from the server with every part the leader hid already
   replaced by a "?" (ADR 0022); a leader gets all of it and sees what is
   hidden from the players marked – in words, not by colour alone. */
import { HIDDEN_MARK, OPPONENT_STATS, scenarioNpcCard, type Hidable, type ScenarioNpc } from '@mordheim/core';
import { CopyField } from '../roster/TtsCard.tsx';
import styles from './Scenarios.module.css';

const PART_LABEL: Record<Hidable, string> = { name: 'name', M: 'M', WS: 'WS', BS: 'BS', S: 'S', T: 'T', W: 'W', I: 'I', A: 'A', Ld: 'Ld', sv: 'Sv', skills: 'skills', equipment: 'equipment', rules: 'special rules' };

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
  const rules = n.rules.split('\n').map((x) => x.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean);
  const hidden = lead && n.hidden.length > 0;
  const table = scenarioNpcCard(n);
  return (
    <li className={`${styles.npc} ${hidden ? styles.npcHidden : ''}`}>
      <div className={styles.npcHead}>
        <strong>{n.name}</strong>
        {n.type && n.type !== HIDDEN_MARK && <small>{n.type}</small>}
      </div>
      {hidden && <p className={styles.secret}>⚑ The players read “?” for: {hiddenWords(n.hidden)}.</p>}
      <NpcStats n={n} marked={lead} />
      {(n.skills.length > 0 || n.equipment.trim() || rules.length > 0) && (
        <details className={styles.more}>
          <summary>Skills, equipment and rules</summary>
          <div className={styles.rules}>
            {n.skills.length > 0 && <p><strong>Skills:</strong> {n.skills.map((s) => s.name).join(', ')}</p>}
            {n.equipment.trim() && <p><strong>Equipment:</strong> {n.equipment.trim()}</p>}
            {rules.length > 0 && <ul>{rules.map((r, i) => <li key={`${i}:${r}`}>{r}</li>)}</ul>}
          </div>
        </details>
      )}
      <details className={styles.more}>
        <summary>{hidden ? 'Tabletop Simulator – as the players get it' : 'Tabletop Simulator'}</summary>
        <CopyField label="Name" value={table.name} rows={1} onCopied={onCopied} />
        <CopyField label="Description" value={table.text} rows={7} onCopied={onCopied} />
      </details>
      {hidden && (
        <details className={styles.more}>
          <summary>Tabletop Simulator – every value, for you</summary>
          <CopyField label="Name (whole)" value={scenarioNpcCard(n, true).name} rows={1} onCopied={onCopied} />
          <CopyField label="Description (whole)" value={scenarioNpcCard(n, true).text} rows={7} onCopied={onCopied} />
        </details>
      )}
    </li>
  );
}
