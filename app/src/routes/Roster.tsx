/* One warband, to read and to change (phase 3a). Every change is an action
   of core, saved on this device at once; the notice after it offers "Undo"
   instead of asking first (docs/ui.md §1.6). */
import * as core from '@mordheim/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { db, type StoredWarband } from '../db/db.ts';
import { useGameData } from '../game/useGameData.ts';
import { Hire, Warrior } from '../roster/Cards.tsx';
import { AdvanceSheet, TakenSheet, type AdvanceChoice, type Correction } from '../roster/AdvanceSheet.tsx';
import { advanceView, takenOf } from '../roster/advance.ts';
import { EquipmentSheet } from '../roster/EquipmentSheet.tsx';
import { injuryEnv } from '../roster/injury.ts';
import { CaptiveSheet, InjuriesSheet, InjurySheet, type InjuryFor } from '../roster/InjurySheet.tsx';
import { markRole, markView, mutationView } from '../roster/chaos.ts';
import { MarkSheet, MutationSheet } from '../roster/ChaosSheets.tsx';
import { equipmentView } from '../roster/equipment.ts';
import { houseView } from '../roster/house.ts';
import { ExpSheet, MenuSheet, MoreMenSheet, NameSheet, RecruitSheet, type ExpSetting, type MenuItem, type Naming } from '../roster/sheets.tsx';
import { moreMenView } from '../roster/men.ts';
import { useEditor } from '../roster/useEditor.ts';
import { ConflictBanner } from '../sync/ConflictBanner.tsx';
import { removeWarband } from '../sync/local.ts';
import { makeCopy } from '../sync/versions.ts';
import { FLAVOUR } from '../flavour.ts';
import { rosterView, type HireView, type WarriorView } from '../roster/view.ts';
import { IconEdit } from '../ui/icons.tsx';
import ui from '../ui/ui.module.css';
import { UndoToast } from '../ui/UndoToast.tsx';
import { useSheet } from '../ui/useSheet.ts';
import styles from '../roster/Roster.module.css';

function RosterBody({ rec }: { rec: StoredWarband }) {
  const data = useGameData();
  const ed = useEditor(data, rec);
  const v = useMemo(() => rosterView(data, ed.state), [data, ed.state]);
  const ctx = useMemo(() => core.ctxOf(data, ed.state), [data, ed.state]);
  // from the first battle on, equipment changes at the Trading Post and
  // nothing a warrior leaves behind is refunded (V4–V7)
  const locked = core.tradeLocked(ctx);
  const houseOn = useMemo(() => houseView(data, ed.state).count, [data, ed.state]);
  const navigate = useNavigate();
  // "Print the roster" (Export) comes here and prints once
  const location = useLocation();
  const printing = !!(location.state as { print?: boolean } | null)?.print;
  useEffect(() => {
    if (!printing) return;
    void navigate('.', { replace: true, state: null });
    setTimeout(() => window.print(), 100);
  }, [printing, navigate]);
  const { ref: eqRef, open: openEqSheet, close: closeEq } = useSheet();
  const [eqOf, setEqOf] = useState<number | null>(null);
  const eqView = eqOf != null ? equipmentView(ctx, eqOf) : null;
  const trade = `/warbands/${rec.id}/trade`;
  const { ref: advRef, open: openAdvSheet, close: closeAdv } = useSheet();
  const [advOf, setAdvOf] = useState<{ key: number; id: number | string } | null>(null);
  const advView = advOf ? advanceView(ctx, advOf.id) : null;
  const { ref: takenRef, open: openTakenSheet, close: closeTaken } = useSheet();
  const [takenFor, setTakenFor] = useState<{ id: number | string; name: string } | null>(null);
  const openAdvance = (id: number | string) => { setAdvOf((p) => ({ key: (p?.key ?? 0) + 1, id })); openAdvSheet(); };

  /* Injuries (V1): one roll, one action of core, from the card or the menu. */
  const { ref: injRef, open: openInjSheet, close: closeInj } = useSheet();
  const [injFor, setInjFor] = useState<(InjuryFor & { key: number }) | null>(null);
  const openInjury = (w: InjuryFor) => { setInjFor((p) => ({ ...w, key: (p?.key ?? 0) + 1 })); openInjSheet(); };
  const injureWarrior = (w: WarriorView, dice?: string) => {
    if (!w.hero) { openInjury({ kind: 'hench', uid: w.uid, name: w.name, men: w.men }); return; }
    const m = ctx.s.models.find((x) => x.uid === w.uid);
    if (!m) return;
    const env = injuryEnv(ctx, m);
    const by = env.attacker ? [env.attacker.name, env.attacker.wb && `(${env.attacker.wb})`].filter(Boolean).join(' ') : null;
    openInjury({ kind: 'hero', uid: w.uid, name: w.name, env, by, dice });
  };
  const { ref: injuriesRef, open: openInjuriesSheet, close: closeInjuries } = useSheet();
  const [injuriesOf, setInjuriesOf] = useState<number | null>(null);
  const { ref: mutRef, open: openMutSheet, close: closeMut } = useSheet();
  const [mutOf, setMutOf] = useState<number | null>(null);
  const mutView = mutOf != null ? mutationView(ctx, mutOf) : null;
  const { ref: markRef, open: openMarkSheet, close: closeMark } = useSheet();
  const [markKey, setMarkKey] = useState(0);
  const mView = markView(ctx);
  const { ref: menRef, open: openMenSheet, close: closeMen } = useSheet();
  const [menFor, setMenFor] = useState<{ key: number; uid: number } | null>(null);
  const menView = menFor ? moreMenView(ctx, menFor.uid) : null;
  const { ref: captiveRef, open: openCaptiveSheet, close: closeCaptive } = useSheet();
  const [captiveOf, setCaptiveOf] = useState<{ key: number; uid: number; name: string; by: string } | null>(null);
  const openCaptive = (w: WarriorView) => { setCaptiveOf((p) => ({ key: (p?.key ?? 0) + 1, uid: w.uid, name: w.name, by: w.captive ?? '' })); openCaptiveSheet(); };
  const injuriesView = injuriesOf != null ? v.heroes.concat(v.henchmen).find((w) => w.uid === injuriesOf) ?? null : null;

  /* An advance as chosen in the sheet: the matching action of core. */
  const applyAdvance = (id: number | string, c: AdvanceChoice, text: string) => ed.edit((x) => {
    if (typeof id === 'string') {
      if (c.kind === 'stat') return core.addHsAdvance(x, id, c.stat);
      if (c.kind === 'skill') return core.addHsSkill(x, id, c.skill);
      if (c.kind === 'spell') return core.addHsSpell(x, id, c.spell);
      if (c.kind === 'reduce') return core.hsSpellReduce(x, id, (x.s.hired ?? []).find((h) => h.uid === id)?.spells?.findIndex((sp) => sp.name === c.spell) ?? -1, 1);
      return x.s;
    }
    if (c.kind === 'stat') return core.addAdvance(x, id, c.stat);
    if (c.kind === 'skill') return core.addSkillFromList(x, id, c.skill);
    if (c.kind === 'spell') return c.own ? core.addSpellFromAdvance(x, id, c.spell) : core.addSpell(x, id, c.spell);
    if (c.kind === 'reduce') return core.spellReduce(x, id, x.s.models.find((m) => m.uid === id)?.spells?.findIndex((sp) => sp.name === c.spell) ?? -1, 1);
    // The lad's got talent: the man becomes a Hero of his own, with his two lists
    let s1 = core.promoteHench(x, id, c.man);
    const hero = s1.models.find((m) => m.promoted && !x.s.models.some((o) => o.uid === m.uid))?.uid ?? id;
    for (const l of c.lists) s1 = core.togglePromoCat(core.ctxOf(data, s1), hero, l);
    return s1;
  }, text);

  const correct = (id: number | string, c: Correction, text: string) => ed.edit((x) => {
    if (typeof id === 'string') {
      if (c.kind === 'stat') return core.removeHsAdvance(x, id, c.stat);
      if (c.kind === 'skill') return core.removeHsSkillAt(x, id, c.index);
      if (c.kind === 'spell') return core.removeHsSpell(x, id, c.index);
      return core.hsSpellReduce(x, id, c.index, -1);
    }
    if (c.kind === 'stat') return core.removeAdvance(x, id, c.stat);
    if (c.kind === 'skill') return core.removeSkill(x, id, c.index);
    if (c.kind === 'spell') return core.removeSpell(x, id, c.index);
    return core.spellReduce(x, id, c.index, -1);
  }, text);

  const { ref: menuRef, open: openMenuSheet, close: closeMenu } = useSheet();
  const [menuOf, setMenuOf] = useState<{ title: string; items: MenuItem[] }>({ title: '', items: [] });
  const { ref: nameRef, open: openNameSheet, close: closeName } = useSheet();
  const [naming, setNaming] = useState<Naming | null>(null);
  const { ref: expRef, open: openExpSheet, close: closeExp } = useSheet();
  const [expSet, setExpSet] = useState<ExpSetting | null>(null);
  const { ref: recruitRef, open: openRecruit, close: closeRecruit } = useSheet();

  // a new key each time, so the form starts from the value it is given
  const askName = (n: Omit<Naming, 'key'>) => { setNaming((prev) => ({ ...n, key: (prev?.key ?? 0) + 1 })); openNameSheet(); };
  const openMenu = (title: string, items: MenuItem[]) => { setMenuOf({ title, items }); openMenuSheet(); };
  const askExp = (who: string, xp: NonNullable<WarriorView['xp']>, save: (v: number) => void) => {
    setExpSet((prev) => ({ key: (prev?.key ?? 0) + 1, who, value: xp.value, steps: xp.steps.map((s) => s.at), min: xp.min, max: xp.max, save }));
    openExpSheet();
  };

  const warriorMenu = (w: WarriorView) => openMenu(w.name, [
    // his own list until his first battle, then the Trading Post (Rob, 02.10.2026)
    w.fought
      ? { label: 'Equipment – at the Trading Post', run: () => { void navigate(`${trade}#give`); } }
      : { label: 'Equipment & rare items', run: () => { setEqOf(w.uid); openEqSheet(); } },
    {
      label: w.hero ? 'Name' : 'Name of the group',
      run: () => askName({
        title: w.hero ? 'Name' : 'Name of the group', label: w.hero ? `Name of this ${w.type}` : 'Name of the group',
        value: w.name === w.type ? '' : w.name, fallback: w.type,
        save: (nm) => ed.edit((c) => core.setModelName(c, w.uid, nm || w.type), 'Name saved.'),
      }),
    },
    ...(w.xp ? [{ label: 'Advances taken – correct', run: () => { setTakenFor({ id: w.uid, name: w.name }); openTakenSheet(); } }] : []),
    ...(() => {
      const mv = mutationView(ctx, w.uid);
      return mv ? [{ label: mv.label, run: () => { setMutOf(w.uid); openMutSheet(); } }] : [];
    })(),
    ...(() => {
      const role = markRole(ctx, w.uid);
      if (role === 'seer') return [{ label: 'Mark of Chaos…', run: () => { setMarkKey((k) => k + 1); openMarkSheet(); } }];
      const mk = ctx.s.mark ? core.markName(ctx, ctx.s.mark) : '';
      const on = !!ctx.s.models.find((m) => m.uid === w.uid)?.caster;
      if (role === 'chief' && mk) {
        return [{ label: on ? 'Give up the Mark' : `Take the ${mk.split(' — ')[0]}`, run: () => ed.edit((c) => core.setCaster(c, w.uid, !on), on ? `${w.name} no longer bears the Mark.` : `${w.name} takes the Mark.`) }];
      }
      return [];
    })(),
    { label: 'Tabletop Simulator card', run: () => { void navigate(`/warbands/${rec.id}/export#tts-${w.uid}`); } },
    ...(w.canLead ? [{ label: 'Lead the warband', run: () => ed.edit((c) => core.setLeader(c, w.uid), `${w.name} leads the warband.`) }] : []),
    ...(w.injuries.length || w.missGames ? [{ label: 'Injuries – correct', run: () => { setInjuriesOf(w.uid); openInjuriesSheet(); } }] : []),
    ...(w.captive != null ? [{ label: 'Captivity – how it ended…', run: () => openCaptive(w) }] : []),
    ...(w.hero && w.captive == null ? [{ label: 'Out of action for good…', danger: true, run: () => injureWarrior(w, '11') }] : []),
    w.fought
      ? { label: 'Dismiss – his equipment goes to the stash', danger: true, run: () => ed.edit((c) => core.dismissWarrior(c, w.uid), `${w.name} dismissed; his equipment is in the stash.`, { gold: 'keep' }) }
      : locked
        // a recruit who has not fought: his hire is undone, at its price
        ? { label: 'Remove from the roster – he has not fought', danger: true, run: () => ed.edit((c) => core.removeUnit(c, w.uid), `${w.name} removed from the roster; his price is back.`) }
        : { label: 'Remove from the roster', danger: true, run: () => ed.edit((c) => core.dismissWarrior(c, w.uid), `${w.name} removed from the roster.`) },
  ]);

  const hireMenu = (h: HireView) => {
    const hs = h.kind === 'Hired Sword';
    openMenu(h.name, [
      {
        label: 'Name',
        run: () => askName({
          title: 'Name', label: `Name of this ${h.type}`, value: h.name === h.type ? '' : h.name, fallback: h.type,
          save: (nm) => ed.edit((c) => (hs ? core.setHsName(c, h.uid, nm) : core.setDpName(c, h.uid, nm)), 'Name saved.'),
        }),
      },
      ...(hs ? [{ label: 'Advances taken – correct', run: () => { setTakenFor({ id: h.uid, name: h.name }); openTakenSheet(); } }] : []),
      { label: 'Tabletop Simulator card', run: () => { void navigate(`/warbands/${rec.id}/export#tts-${h.uid}`); } },
      {
        label: 'Dismiss — upkeep ends', danger: true,
        run: () => ed.edit((c) => core.dismissHire(c, h.uid, hs ? 'hs' : 'dp'), `${h.name} is dismissed.`, { gold: locked ? 'keep' : 'settle' }),
      },
    ]);
  };

  const manSheet = (w: WarriorView, i: number) => {
    const m = w.men[i]!;
    askName({
      title: m.name, label: `Name of this man of ${w.name}`, value: m.named ? m.name : '', fallback: m.name,
      save: (nm) => ed.edit((c) => core.setMemberName(c, w.uid, i, nm), 'Name saved.'),
      extra: w.count > 1
        ? { label: 'Dismiss him', run: () => ed.edit((c) => core.dismissMan(c, w.uid, i), `${m.name} leaves ${w.name}.`, { gold: locked ? 'keep' : 'settle' }) }
        : undefined,
    });
  };

  const warriorActs = (w: WarriorView) => ({
    onMore: () => warriorMenu(w),
    onXp: (d: number) => ed.edit((c) => core.setModelExp(c, w.uid, w.exp + d)),
    onSetXp: () => { if (w.xp) askExp(w.name, w.xp, (v) => ed.edit((c) => core.setModelExp(c, w.uid, v), `${w.name}: experience ${v}.`)); },
    onMan: (i: number) => manSheet(w, i),
    onAdvance: () => openAdvance(w.uid),
    onInjury: () => injureWarrior(w),
    onCaptive: () => openCaptive(w),
    onAddMan: () => {
      if (!w.addMan || !('cost' in w.addMan)) return;
      setMenFor((p) => ({ key: (p?.key ?? 0) + 1, uid: w.uid }));
      openMenSheet();
    },
  });
  const hireActs = (h: HireView) => ({
    onMore: () => hireMenu(h),
    onXp: (d: number) => ed.edit((c) => core.setHsExp(c, h.uid, h.exp + d)),
    onSetXp: () => { if (h.xp) askExp(h.name, h.xp, (v) => ed.edit((c) => core.setHsExp(c, h.uid, v), `${h.name}: experience ${v}.`)); },
    onAdvance: () => openAdvance(h.uid),
    onInjury: () => openInjury({ kind: 'hire', uid: h.uid, name: h.name }),
  });

  return (
    <section className={ui.page}>
      <header>
        <div className={styles.title}>
          <h1>{v.name}</h1>
          <button type="button" className={ui.iconButton} aria-label="Rename the warband"
            onClick={() => askName({
              title: 'Name of the warband', label: 'Name', value: v.name, fallback: v.type,
              save: (nm) => ed.edit((c) => core.setWarbandName(c, nm), 'Name saved.'),
            })}><IconEdit /></button>
        </div>
        <p className={ui.muted}>
          {v.type}{v.campaign ? ` · ${v.campaign}` : ''}
          {houseOn > 0 && <> · <Link to={`/warbands/${rec.id}/house`} className={styles.houseLink}>⚖ {houseOn} house rule{houseOn > 1 ? 's' : ''}</Link></>}
        </p>
        <dl className={styles.summary}>
          <div><dt>Rating</dt><dd>{v.rating}</dd></div>
          <div><dt>Gold</dt><dd>{v.gold} gc</dd></div>
          <div><dt>Models</dt><dd>{v.models}/{v.maxModels}</dd></div>
          <div><dt>Worth</dt><dd>{v.worth}</dd></div>
        </dl>
      </header>
      <ConflictBanner data={data} rec={rec} />
      {v.warnings.length > 0 && (
        <ul className={`${ui.card} ${styles.warnings}`} aria-label="Warnings">
          {v.warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
      {v.heroes.length + v.henchmen.length + v.hires.length === 0 && (
        <p className={`${ui.card} ${ui.muted}`}>No warriors yet. Recruit your Heroes and Henchmen: {v.gold} gc to spend.</p>
      )}
      {v.heroes.length > 0 && <div className={styles.sectionHead}><h2>Heroes</h2><span className={ui.muted}>{v.heroCount} of {v.heroMax}</span></div>}
      <div className={styles.cards}>{v.heroes.map((w) => <Warrior key={w.key} w={w} act={warriorActs(w)} />)}</div>
      {v.henchmen.length > 0 && <h2>Henchmen</h2>}
      <div className={styles.cards}>{v.henchmen.map((w) => <Warrior key={w.key} w={w} act={warriorActs(w)} />)}</div>
      {v.hires.length > 0 && <h2>Hired Swords &amp; Dramatis Personae</h2>}
      <div className={styles.cards}>{v.hires.map((h) => <Hire key={h.key} h={h} act={hireActs(h)} />)}</div>
      {v.fallen.length > 0 && (
        <details className={ui.card}>
          <summary className={styles.summaryToggle}>Fallen ({v.fallen.length})</summary>
          <ul>{v.fallen.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </details>
      )}
      <div className={`${ui.row} ${styles.screenOnly}`}>
        <button type="button" className={ui.button} onClick={openRecruit}>+ Recruit</button>
        <Link to={`/warbands/${rec.id}/hire`} className={ui.buttonQuiet}>Hire…</Link>
        <Link to={`/warbands/${rec.id}/house`} className={ui.buttonQuiet}>House rules</Link>
        <Link to={trade} className={ui.buttonQuiet}>Trading Post{locked && ctx.s.stash?.items?.length ? ` · stash ${ctx.s.stash.items.reduce((n, it) => n + (Number(it.qty) || 0), 0)}` : ''}</Link>
        <Link to="/warbands" className={ui.buttonQuiet}>All warbands</Link>
        <Link to={`/warbands/${rec.id}/export`} className={ui.buttonQuiet}>Export…</Link>
        {FLAVOUR === 'campaign' && rec.ownerId && <Link to={`/warbands/${rec.id}/versions`} className={ui.buttonQuiet}>Versions{rec.serverRev ? ` · ${rec.serverRev}` : ''}</Link>}
        <button type="button" className={ui.buttonQuiet}
          onClick={() => { void makeCopy(rec, ed.state).then((id) => navigate(`/warbands/${id}`)); }}>
          Make a copy
        </button>
        <button type="button" className={ui.buttonQuiet}
          onClick={() => { void removeWarband(rec).then(() => navigate('/warbands', { replace: true, state: { removed: rec } })); }}>
          {rec.ownerId ? 'Remove the warband' : 'Remove from this device'}
        </button>
      </div>

      <MenuSheet dialogRef={menuRef} close={closeMenu} title={menuOf.title} items={menuOf.items} />
      <NameSheet dialogRef={nameRef} close={closeName} naming={naming} />
      <ExpSheet dialogRef={expRef} close={closeExp} setting={expSet} />
      <AdvanceSheet dialogRef={advRef} close={closeAdv} view={advView && advOf ? { ...advView, key: advOf.key } : null}
        onApply={(c, text) => { if (advOf) applyAdvance(advOf.id, c, text); }} />
      <TakenSheet dialogRef={takenRef} close={closeTaken} name={takenFor?.name ?? ''} taken={takenFor ? takenOf(ctx, takenFor.id) : null}
        onRemove={(c, text) => { if (takenFor) correct(takenFor.id, c, text); }} />
      <InjurySheet dialogRef={injRef} close={closeInj} who={injFor}
        onApply={(r, text) => { if (injFor) { const id = injFor.uid; ed.edit((c) => core.injure(c, id, r), text, { gold: 'keep' }); } }} />
      <MutationSheet dialogRef={mutRef} close={closeMut} view={mutView}
        onSet={(key, n, name) => { if (mutOf != null) { const uid = mutOf; ed.edit((c) => core.setMutationCount(c, uid, key, n), undefined, { book: `${mutView?.name ?? ''}: ${name} ×${n}` }); } }} />
      <MarkSheet dialogRef={markRef} close={closeMark} view={mView ? { ...mView, key: markKey } : null}
        onApply={(mark, text) => ed.edit((c) => core.setMark(c, mark), text)} />
      <MoreMenSheet dialogRef={menRef} close={closeMen} view={menView && menFor ? { ...menView, key: menFor.key } : null}
        onAdd={(n, roll, names, text) => {
          if (!menFor) return;
          const uid = menFor.uid;
          ed.edit((c) => {
            const s1 = roll != null ? core.setVeteransRoll(c, roll) : c.s;
            return core.addMen(core.ctxOf(data, s1), uid, n, names);
          }, text);
        }} />
      <CaptiveSheet dialogRef={captiveRef} close={closeCaptive} who={captiveOf}
        onEnd={(fate, text) => { if (captiveOf) { const uid = captiveOf.uid; ed.edit((c) => core.releaseCaptive(c, uid, fate), text, { gold: 'keep' }); } }} />
      <InjuriesSheet dialogRef={injuriesRef} close={closeInjuries} name={injuriesView?.name ?? ''} injuries={injuriesView?.injuries.map((f) => f.label) ?? []} miss={injuriesView?.missGames ?? 0}
        onRemove={(i, text) => { if (injuriesOf != null) ed.edit((c) => core.removeInjury(c, injuriesOf, i), text); }}
        onMiss={(dl) => { if (injuriesOf != null) ed.edit((c) => core.adjustMiss(c, injuriesOf, dl)); }} />
      <EquipmentSheet dialogRef={eqRef} close={closeEq} view={eqView} act={{
        qty: (key, q, name) => ed.edit((c) => core.setListQty(c, eqOf!, key, q), undefined, { book: `${eqView?.name ?? ''}: ${name} ×${q} (his list)` }),
        addRare: (de) => ed.edit((c) => core.addRare(c, eqOf!, de)),
        rareQty: (de, q) => ed.edit((c) => core.setRareQty(c, eqOf!, de, q)),
        target: (de, nm) => ed.edit((c) => core.setRareTarget(c, eqOf!, de, nm)),
        paid: (de, gc) => ed.edit((c) => core.setRarePaid(c, eqOf!, de, gc), `Paid set to ${gc} gc.`),
      }} />
      <RecruitSheet dialogRef={recruitRef} close={closeRecruit} v={v}
        onRecruit={(u) => ed.edit((c) => core.recruitUnit(c, u.id), `Recruited ${u.name} (${u.cost} gc).`)} />
      {ed.notice && <UndoToast key={ed.notice.id} text={ed.notice.text} onUndo={ed.undo} onDone={ed.dismiss} />}
    </section>
  );
}

export function Roster() {
  const { id = '' } = useParams();
  const rec = useLiveQuery(async () => (await db.warbands.get(id)) ?? null, [id]);
  if (rec === undefined) return null;
  if (rec === null || rec.removedAt) {
    return (
      <section className={ui.page}>
        <h1>Not on this device</h1>
        <p className={ui.muted}>This warband is not stored here (any more).</p>
        <p><Link to="/warbands" className={ui.buttonQuiet}>All warbands</Link></p>
      </section>
    );
  }
  return (
    <Suspense fallback={<p className={ui.muted}>Loading the rules…</p>}>
      <RosterBody rec={rec} />
    </Suspense>
  );
}
