/* Step 5, available veterans (N11): the 2D6 of the round – typed or rolled here – is the experience that new men may bring into the henchmen
   groups between them. The table shows each group: its experience, how many may still join, the price of one more man (the surcharge of 2 gc
   for each point of experience included) and whether he fits the pool. Adding men is done on the roster, which comes back here. */
import * as core from '@mordheim/core';
import { useState } from 'react';
import { Link } from 'react-router';
import { RulesTable } from '../ui/RulesTable.tsx';
import ui from '../ui/ui.module.css';
import styles from './Aftermath.module.css';

export interface VeteransActs {
  ctx: core.Ctx;
  edit: (action: (ctx: core.Ctx) => core.WarbandState, text?: string, opts?: { gold?: 'settle' | 'keep' }) => void;
}

export function VeteransStep({ acts, recruitLink }: { acts: VeteransActs; recruitLink: string }) {
  const [typed, setTyped] = useState('');
  const v = core.veteransOf(acts.ctx);
  const left = v ? v.roll - v.spent : 0;
  const groups = acts.ctx.s.models.filter((m) => !core.isHeroModel(acts.ctx, m) && core.unitDef(acts.ctx, m.uid_def)?.t === 'hen');
  const n = Number(typed);
  const valid = typed.trim() !== '' && Number.isInteger(n) && n >= 2 && n <= 12;
  const problem = v && valid && n !== v.roll && n < v.spent ? `New men have already used ${v.spent}.` : null;
  const set = (roll: number) => acts.edit((c) => core.setVeteransRoll(c, roll), `Veterans: ${roll} experience for hire.`, { gold: 'keep' });
  const roll2d6 = () => 2 + Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6);

  return (
    <>
      <p>Roll 2D6: that is the experience of the veterans available for hire. New men may join henchmen groups as long as the experience they bring together does not exceed it; any excess is lost.</p>
      <div className={styles.stepper}>
        <label>2D6 <input type="text" inputMode="numeric" maxLength={2} className={styles.cell} aria-label="Veterans 2D6" value={typed} onChange={(e) => setTyped(e.target.value.replace(/\D/g, ''))} placeholder={v ? String(v.roll) : ''} /></label>
        <button type="button" className={ui.button} disabled={!valid || !!problem || (!!v && n === v.roll)} onClick={() => set(n)}>{v ? 'Change the roll' : 'Enter the roll'}</button>
        <button type="button" className={ui.buttonQuiet} disabled={!!v} onClick={() => set(roll2d6())}>Roll</button>
      </div>
      {problem && <p className={styles.warn}>{problem}</p>}
      {v
        ? <p aria-live="polite">Experience for hire: <strong>{v.roll}</strong> · used {v.spent} · <strong>{left}</strong> left.</p>
        : <p className={ui.muted}>No roll yet this round.</p>}
      {groups.length > 0 && (
        <RulesTable caption="Henchmen groups" head={['Group', 'Exp', 'Men', 'May join', 'One more costs', 'Fits the roll']} rowHeads={false}
          rows={groups.map((m) => {
            const exp = core.veteranExp(m);
            const free = !core.needsVeterans(acts.ctx, m);
            return [
              m.name || core.unitDef(acts.ctx, m.uid_def)?.name || m.uid_def, String(exp), String(core.memberCount(m)), String(core.moreMenMax(acts.ctx, m)),
              `${core.henchRecruitCost(acts.ctx, m)} gc`, free ? 'no roll needed' : !v ? '–' : exp <= left ? `yes (${exp})` : 'no',
            ];
          })} note="A group without experience takes new men freely; one with experience draws on the roll. Each point of experience adds 2 gc to a new man." />
      )}
      <div className={ui.row}><Link to={recruitLink} className={ui.buttonQuiet}>Add men on the roster</Link></div>
    </>
  );
}
