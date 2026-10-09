/* House rules on screen (phase 3e; docs/mockups/house-rules.html): each
   rule with what the rules as written say, its switch and its value in
   steps – for a warband's own rules and, since 4a4, a campaign's. Who may
   not change them (a player in a campaign) sees what is on, nothing else:
   switches he cannot use would only confuse. */
import type { RuleView } from './house.ts';
import styles from './House.module.css';
import trade from './Trade.module.css';
import ui from '../ui/ui.module.css';

/** What a change of a rule does: the screen decides where it goes (the warband's file, or the campaign). */
export interface RuleActs {
  toggle: (key: string, on: boolean, label: string) => void;
  step: (key: string, dir: 1 | -1) => void;
  grade: (key: 'hsGrades' | 'dpGrades', grade: string, played: boolean) => void;
  bodyOnly: (on: boolean) => void;
}

function Rule({ r, act }: { r: RuleView; act: RuleActs | null }) {
  return (
    <div className={`${styles.rule} ${r.on ? styles.on : ''}`}>
      <div className={styles.head}>
        <span>
          <b>{r.label}</b>
          {r.on && <span className={styles.tag}>house rule</span>}
        </span>
        {act && r.kind !== 'grades' && (
          <label className={styles.switch}>
            <input type="checkbox" checked={r.on} aria-label={r.label} onChange={(e) => act.toggle(r.key, e.target.checked, r.label)} />
            <span aria-hidden="true" />
          </label>
        )}
      </div>
      <span className={styles.std}>{r.on && r.effect ? `${r.effect} · ` : ''}As written: {r.std}</span>
      {r.kind === 'grades' && (act || r.on) && (
        <div className={trade.seg} role="group" aria-label={r.label}>
          {r.grades.map((g) => (
            <button key={g.grade} type="button" aria-pressed={g.played} disabled={!act}
              onClick={() => act?.grade(r.key as 'hsGrades' | 'dpGrades', g.grade, !g.played)}>
              {g.grade}
            </button>
          ))}
        </div>
      )}
      {r.on && r.value && (act
        ? (
          <div className={styles.value}>
            <span className={trade.stepper}>
              <button type="button" aria-label={`Less: ${r.label}`} disabled={!r.canLess} onClick={() => act.step(r.key, -1)}>−</button>
              <output aria-live="polite">{r.value}</output>
              <button type="button" aria-label={`More: ${r.label}`} disabled={!r.canMore} onClick={() => act.step(r.key, 1)}>+</button>
            </span>
            {r.unit && <span className={ui.muted}>{r.unit}</span>}
          </div>
        )
        : <p className={styles.std}><b>{r.value}</b>{r.unit ? ` ${r.unit}` : ''}{r.bodyOnly ? ' · body armour only' : ''}</p>)}
      {act && r.bodyOnly != null && (
        <label className={trade.check}>
          <input type="checkbox" checked={r.bodyOnly} onChange={(e) => act.bodyOnly(e.target.checked)} />
          Body armour only, not helmets, shields and bucklers
        </label>
      )}
    </div>
  );
}

/** The groups of rules; without `act`, only the rules that are on. */
export function RuleGroups({ groups, act }: { groups: { key: string; label: string; rules: RuleView[] }[]; act: RuleActs | null }) {
  const shown = groups.map((g) => ({ ...g, rules: act ? g.rules : g.rules.filter((r) => r.on) })).filter((g) => g.rules.length > 0);
  return (
    <>
      {shown.map((g) => (
        <section key={g.key} className={styles.group} aria-label={g.label}>
          <h2>{g.label}</h2>
          {g.rules.map((r) => <Rule key={r.key} r={r} act={act} />)}
        </section>
      ))}
      {!act && <p className={ui.muted}>{shown.length ? 'Everything else is played as written.' : 'No house rules: everything is played as written.'}</p>}
    </>
  );
}
