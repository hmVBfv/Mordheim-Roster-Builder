/* One warband, to read and to change (phase 3a). Every change is an action
   of core, saved on this device at once; the notice after it offers "Undo"
   instead of asking first (docs/ui.md §1.6). */
import { ModelsTile } from '../roster/ModelsTile.tsx';
import { StashSection } from '../roster/StashSection.tsx';
import * as core from '@mordheim/core';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { type StoredWarband } from '../db/db.ts';
import { useGameData } from '../game/useGameData.ts';
import { FallenList } from '../roster/Fallen.tsx';
import { Board } from '../roster/Board.tsx';
import { Panel, PanelLink } from '../roster/Panel.tsx';
import { usePrinting } from '../roster/Print.tsx';
import type { UnitActs } from '../roster/Detail.tsx';
import { AdvanceSheet, TakenSheet, type AdvanceChoice, type Correction } from '../roster/AdvanceSheet.tsx';
import { advanceView, takenOf } from '../roster/advance.ts';
import { EquipmentSheet } from '../roster/EquipmentSheet.tsx';
import { injuryEnv } from '../roster/injury.ts';
import { CaptiveSheet, InjuriesSheet, InjurySheet, type InjuryFor } from '../roster/InjurySheet.tsx';
import { markRole, markView, mutationView } from '../roster/chaos.ts';
import { MarkSheet, MutationSheet } from '../roster/ChaosSheets.tsx';
import { equipmentView } from '../roster/equipment.ts';
import { houseView } from '../roster/house.ts';
import { ExpSheet, MoreMenSheet, NameSheet, RecruitSheet, type ExpSetting, type Naming } from '../roster/sheets.tsx';
import { moreMenView } from '../roster/men.ts';
import { useEditor } from '../roster/useEditor.ts';
import { ConflictBanner } from '../sync/ConflictBanner.tsx';
import { removeWarband, useWarbandRecord } from '../sync/local.ts';
import { makeCopy, makePlannerCopy } from '../sync/versions.ts';
import { ShareSheet } from '../share/ShareSheet.tsx';
import { useSession } from '../account/session.ts';
import { useNotice } from '../ui/Notice.tsx';
import { FLAVOUR } from '../flavour.ts';
import { CampaignStage, InCampaign } from '../campaign/InCampaign.tsx';
import { takeStage } from '../campaign/stage.ts';
import { rosterView, type HireView, type WarriorView } from '../roster/view.ts';
import { IconEdit } from '../ui/icons.tsx';
import { Empty } from '../art/Pixels.tsx';
import ui from '../ui/ui.module.css';
import { UndoToast } from '../ui/UndoToast.tsx';
import { useSheet } from '../ui/useSheet.ts';
import board from '../roster/Board.module.css';

function RosterBody({ rec }: { rec: StoredWarband }) {
  const data = useGameData();
  const ed = useEditor(data, rec);
  const session = useSession();
  const [shareNotice, notify] = useNotice();
  const v = useMemo(() => rosterView(data, ed.state), [data, ed.state]);
  const ctx = useMemo(() => core.ctxOf(data, ed.state), [data, ed.state]);
  // from the first battle on, equipment changes at the Trading Post and
  // nothing a warrior leaves behind is refunded (V4–V7)
  const locked = core.tradeLocked(ctx);
  const houseOn = useMemo(() => houseView(data, ed.state).count, [data, ed.state]);
  const navigate = useNavigate();
  // "Print the roster" (Export) comes here and prints once
  const location = useLocation();
  const asked = !!(location.state as { print?: boolean } | null)?.print;
  const { printing, print } = usePrinting();
  useEffect(() => {
    if (!asked) return;
    void navigate('.', { replace: true, state: null });
    setTimeout(print, 100);
  }, [asked, navigate, print]);
  const { ref: eqRef, open: openEqSheet, close: closeEq } = useSheet('equipment');
  const [eqOf, setEqOf] = useState<number | null>(null);
  const eqView = eqOf != null ? equipmentView(ctx, eqOf) : null;
  const trade = `/warbands/${rec.id}/trade`;
  const { ref: advRef, open: openAdvSheet, close: closeAdv } = useSheet('advance');
  const [advOf, setAdvOf] = useState<{ key: number; id: number | string } | null>(null);
  const advView = advOf ? advanceView(ctx, advOf.id) : null;
  const { ref: takenRef, open: openTakenSheet, close: closeTaken } = useSheet('taken-out');
  const [takenFor, setTakenFor] = useState<{ id: number | string; name: string } | null>(null);
  const openAdvance = (id: number | string) => { setAdvOf((p) => ({ key: (p?.key ?? 0) + 1, id })); openAdvSheet(); };

  /* Injuries (V1): one roll, one action of core, from the card or the menu. */
  const { ref: injRef, open: openInjSheet, close: closeInj } = useSheet('injury');
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
  const { ref: injuriesRef, open: openInjuriesSheet, close: closeInjuries } = useSheet('injuries');
  const [injuriesOf, setInjuriesOf] = useState<number | null>(null);
  const { ref: mutRef, open: openMutSheet, close: closeMut } = useSheet('mutation');
  const [mutOf, setMutOf] = useState<number | null>(null);
  const mutView = mutOf != null ? mutationView(ctx, mutOf) : null;
  const { ref: markRef, open: openMarkSheet, close: closeMark } = useSheet('mark');
  const [markKey, setMarkKey] = useState(0);
  const mView = markView(ctx);
  const { ref: menRef, open: openMenSheet, close: closeMen } = useSheet('men');
  const [menFor, setMenFor] = useState<{ key: number; uid: number } | null>(null);
  const menView = menFor ? moreMenView(ctx, menFor.uid) : null;
  const { ref: captiveRef, open: openCaptiveSheet, close: closeCaptive } = useSheet('captive');
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

  const { ref: nameRef, open: openNameSheet, close: closeName } = useSheet('name');
  const [naming, setNaming] = useState<Naming | null>(null);
  const { ref: expRef, open: openExpSheet, close: closeExp } = useSheet('experience');
  const [expSet, setExpSet] = useState<ExpSetting | null>(null);
  const { ref: recruitRef, open: openRecruit, close: closeRecruit } = useSheet('recruit');

  // a new key each time, so the form starts from the value it is given
  const askName = (n: Omit<Naming, 'key'>) => { setNaming((prev) => ({ ...n, key: (prev?.key ?? 0) + 1 })); openNameSheet(); };
  const askExp = (who: string, xp: NonNullable<WarriorView['xp']>, save: (v: number) => void) => {
    setExpSet((prev) => ({ key: (prev?.key ?? 0) + 1, who, value: xp.value, steps: xp.steps.map((s) => s.at), min: xp.min, max: xp.max, save }));
    openExpSheet();
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

  /* What the opened warrior's buttons do (Detail.tsx): the ⋯ menu's items now stand in his sections. */
  const storyOf = (uid: number | string) => `/warbands/${rec.id}/story?who=${uid}`;
  const cardOf = (uid: number | string) => `/warbands/${rec.id}/export#tts-${uid}`;
  const askTaken = (id: number | string, name: string) => { setTakenFor({ id, name }); openTakenSheet(); };

  const warriorActs = (w: WarriorView): UnitActs => {
    const m = ctx.s.models.find((x) => x.uid === w.uid);
    const mv = mutationView(ctx, w.uid);
    const role = markRole(ctx, w.uid);
    const mk = ctx.s.mark ? core.markName(ctx, ctx.s.mark) : '';
    const bears = !!m?.caster;
    const chaos: UnitActs['chaos'] = [];
    if (mv) chaos.push({ label: mv.label, run: () => { setMutOf(w.uid); openMutSheet(); } });
    if (role === 'seer') chaos.push({ label: 'Mark of Chaos…', run: () => { setMarkKey((k) => k + 1); openMarkSheet(); } });
    else if (role === 'chief' && mk) {
      chaos.push({
        label: bears ? 'Give up the Mark' : `Take the ${mk.split(' — ')[0]}`,
        run: () => ed.edit((c) => core.setCaster(c, w.uid, !bears), bears ? `${w.name} no longer bears the Mark.` : `${w.name} takes the Mark.`),
      });
    }
    return {
      xp: (d) => ed.edit((c) => core.setModelExp(c, w.uid, w.exp + d)),
      setXp: () => { if (w.xp) askExp(w.name, w.xp, (v) => ed.edit((c) => core.setModelExp(c, w.uid, v), `${w.name}: experience ${v}.`)); },
      advance: () => openAdvance(w.uid),
      injury: () => injureWarrior(w),
      captive: () => openCaptive(w),
      addMan: () => {
        if (!w.addMan || !('cost' in w.addMan)) return;
        setMenFor((p) => ({ key: (p?.key ?? 0) + 1, uid: w.uid }));
        openMenSheet();
      },
      man: (i) => manSheet(w, i),
      lead: w.canLead ? () => ed.edit((c) => core.setLeader(c, w.uid), `${w.name} leads the warband.`) : undefined,
      // his own list until his first battle, then the Trading Post (Rob, 02.10.2026)
      equipSheet: w.fought ? undefined : () => { setEqOf(w.uid); openEqSheet(); },
      equipLink: w.fought ? `${trade}#give` : undefined,
      rename: (nm) => ed.edit((c) => core.setModelName(c, w.uid, nm || w.type), 'Name saved.'),
      nameLabel: w.hero ? `Name of this ${w.type}` : 'Name of the group',
      nameValue: w.name === w.type ? '' : w.name,
      story: storyOf(w.uid),
      card: cardOf(w.uid),
      taken: w.xp ? takenOf(ctx, w.uid) : null,
      correctTaken: w.xp ? () => askTaken(w.uid, w.name) : undefined,
      learnSpell: (name) => ed.edit((c) => {
        const m = c.s.models.find((x) => x.uid === w.uid);
        return m && core.magicOfModel(c, m) ? core.addSpellFromAdvance(c, w.uid, name) : core.addSpell(c, w.uid, name);
      }, `${w.name} chose the spell ${core.spellLabel(name)}.`),
      correctInjuries: w.injuries.length || w.missGames ? () => { setInjuriesOf(w.uid); openInjuriesSheet(); } : undefined,
      chaos,
      outOfAction: w.hero && w.captive == null ? () => injureWarrior(w, '11') : undefined,
      leave: w.fought
        ? { label: 'Dismiss – his equipment goes to the stash', run: () => ed.edit((c) => core.dismissWarrior(c, w.uid), `${w.name} dismissed; his equipment is in the stash.`, { gold: 'keep' }) }
        : locked
          // a recruit who has not fought: his hire is undone, at its price
          ? { label: 'Remove from the roster – he has not fought', run: () => ed.edit((c) => core.removeUnit(c, w.uid), `${w.name} removed from the roster; his price is back.`) }
          : { label: 'Remove from the roster', run: () => ed.edit((c) => core.dismissWarrior(c, w.uid), `${w.name} removed from the roster.`) },
    };
  };

  const hireActs = (h: HireView): UnitActs => {
    const hs = h.kind === 'Hired Sword';
    return {
      xp: (d) => ed.edit((c) => core.setHsExp(c, h.uid, h.exp + d)),
      setXp: () => { if (h.xp) askExp(h.name, h.xp, (v) => ed.edit((c) => core.setHsExp(c, h.uid, v), `${h.name}: experience ${v}.`)); },
      advance: () => openAdvance(h.uid),
      injury: () => openInjury({ kind: 'hire', uid: h.uid, name: h.name }),
      rename: (nm) => ed.edit((c) => (hs ? core.setHsName(c, h.uid, nm) : core.setDpName(c, h.uid, nm)), 'Name saved.'),
      nameLabel: `Name of this ${h.type}`,
      nameValue: h.name === h.type ? '' : h.name,
      story: storyOf(h.uid),
      card: cardOf(h.uid),
      taken: hs ? takenOf(ctx, h.uid) : null,
      correctTaken: hs ? () => askTaken(h.uid, h.name) : undefined,
      learnSpell: hs ? (name) => ed.edit((c) => core.addHsSpell(c, h.uid, name), `${h.name} chose the spell ${core.spellLabel(name)}.`) : undefined,
      chaos: [],
      leave: { label: 'Dismiss — upkeep ends', run: () => ed.edit((c) => core.dismissHire(c, h.uid, hs ? 'hs' : 'dp'), `${h.name} is dismissed.`, { gold: locked ? 'keep' : 'settle' }) },
    };
  };
  const actsOf = (u: WarriorView | HireView): UnitActs => ('hero' in u ? warriorActs(u) : hireActs(u));
  const stash = locked ? (ctx.s.stash?.items ?? []).reduce((n, it) => n + (Number(it.qty) || 0), 0) : 0;
  const shareOn = FLAVOUR === 'campaign' && session.status === 'in';

  return (
    <section className={board.page}>
      <header className={board.head}>
        <div className={board.titleRow}>
          <h1>{v.name}</h1>
          <button type="button" className={ui.iconButton} aria-label="Rename the warband"
            onClick={() => askName({
              title: 'Name of the warband', label: 'Name', value: v.name, fallback: v.type,
              save: (nm) => ed.edit((c) => core.setWarbandName(c, nm), 'Name saved.'),
            })}><IconEdit /></button>
        </div>
        <p className={board.sub}>
          {v.type}{v.planner ? ' · Planner' : ''}{v.campaign ? ` · ${v.campaign}` : ''}
          {houseOn > 0 && <> · <Link to={`/warbands/${rec.id}/house`} className={board.houseLink}>⚖ {houseOn} house rule{houseOn > 1 ? 's' : ''}</Link></>}
        </p>
        <dl className={board.tiles}>
          {v.planner
            ? <div className={`${board.tile} ${board.tileGold}`}><dt>Value</dt><dd>{v.value} gc</dd></div>
            : <div className={`${board.tile} ${board.tileGold}`}><dt>Gold</dt><dd>{v.gold} gc</dd></div>}
          <div className={board.tile}><dt>Rating</dt><dd>{v.rating}</dd></div>
          <ModelsTile models={v.models} max={v.maxModels} bonus={v.maxBonus} />
          {v.planner
            ? <div className={board.tile}><dt>Exp needed</dt><dd>{v.plannerExp}</dd></div>
            : <div className={board.tile}><dt>Worth</dt><dd>{v.worth}</dd></div>}
        </dl>
        <div className={`${board.toolbar} ${shareOn ? board.toolbarShare : ''}`} role="group" aria-label="Warband actions">
          <button type="button" className={`${board.btn} ${board.primary}`} onClick={openRecruit}>+ Recruit</button>
          <Link to={`/warbands/${rec.id}/hire`} className={board.btn}>Hire</Link>
          <Link to={trade} className={board.btn} aria-label={stash ? `Trade, stash ${stash}` : 'Trade'}>Trade{stash > 0 && <span className={board.badge} aria-hidden="true">{stash}</span>}</Link>
          {shareOn && <ShareSheet data={data} rec={rec} state={ed.state} onNotice={notify} buttonClass={`${board.btn} ${board.half}`} />}
          <Link to={`/warbands/${rec.id}/export`} className={shareOn ? `${board.btn} ${board.half}` : board.btn}>Export</Link>
        </div>
      </header>
      <ConflictBanner data={data} rec={rec} />
      {FLAVOUR === 'campaign' && rec.campaignId && (
        <CampaignStage rec={rec} state={ed.state} onTake={(round) => ed.edit((c) => takeStage(c, round), `Stage: ${core.roundLabel(round)}, as the campaign.`, { gold: 'keep' })} />
      )}
      {v.planner && <p className={`${ui.card} ${ui.muted}`}>A planner: no gold limit, and advances without experience – each warrior shows the experience they would need. It does not take part in a campaign.</p>}
      {v.warnings.length > 0 && (
        <ul className={`${ui.card} ${board.warnings}`} aria-label="Warnings">
          {v.warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
      <Board
        v={v} acts={actsOf} printing={printing}
        after={<>
          {v.heroes.length + v.henchmen.length + v.hires.length === 0 && (
            <Empty scene="fire" title="No warriors yet.">{v.planner ? 'Recruit your Heroes and Henchmen: a planner has no gold limit.' : `Recruit your Heroes and Henchmen: ${v.gold} gc to spend.`}</Empty>
          )}
          {locked && <StashSection ctx={ctx} onGive={(h, to) => ed.edit((c) => core.giveItem(c, h.from, to, h.goods).state, `${h.name} given.`)} />}
          <FallenList f={v.fallen} />
        </>}
        panel={
          <Panel foot={<>
            {/* entered in a campaign: it leaves the campaign before it can be removed */}
            {FLAVOUR === 'campaign' && rec.campaignId
              ? <InCampaign rec={rec} onNotice={notify} />
              : (
                <button type="button" className={ui.buttonQuiet}
                  onClick={() => { void removeWarband(rec).then(() => navigate('/warbands', { replace: true, state: { removed: rec } })); }}>
                  {rec.ownerId ? 'Remove the warband' : 'Remove from this device'}
                </button>
              )}
          </>}>
            <PanelLink to={`/warbands/${rec.id}/house`} title="House rules" note={houseOn > 0 ? `${houseOn} on` : 'Off'} />
            {(ctx.s.campaign?.on || rec.campaignId) && <PanelLink to={`/warbands/${rec.id}/districts`} title="Districts" note="Footholds on the map" />}
            <PanelLink to={`/warbands/${rec.id}/story`} title="Story" note="Prologue, interludes, profiles" />
            {FLAVOUR === 'campaign' && rec.ownerId && <PanelLink to={`/warbands/${rec.id}/versions`} title="Versions" note={rec.serverRev ? `Every saved state · ${rec.serverRev}` : 'Every saved state'} />}
            <PanelLink to="/warbands" title="All warbands" note="Switch or start another" />
            {v.planner && <PanelLink title="Trading Post" note={v.plannerTrade ? 'Open – tap to close' : 'Closed – tap to open'} run={() => ed.edit((c) => core.setPlannerTrade(c, !v.plannerTrade), v.plannerTrade ? 'The Trading Post is closed.' : 'The Trading Post is open: rare items can be had.')} />}
            <PanelLink title="Make a copy" note="Same men, a new warband" run={() => { void makeCopy(rec, ed.state).then((id) => navigate(`/warbands/${id}`)); }} />
            {!v.planner && <PanelLink title="Copy to the planner" note="Same men, no gold limit, Trading Post open" run={() => { void makePlannerCopy(data, rec, ed.state).then((id) => navigate(`/warbands/${id}`)); }} />}
          </Panel>
        } />

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
        upgrade: (de, weapon, on) => ed.edit((c) => core.setUpgradeOn(c, eqOf!, de, weapon, on)),
        paid: (de, gc, slot) => ed.edit((c) => core.setRarePaid(c, eqOf!, de, gc, slot), `Paid set to ${gc} gc.`),
      }} />
      <RecruitSheet dialogRef={recruitRef} close={closeRecruit} v={v}
        onRecruit={(u) => ed.edit((c) => core.recruitUnit(c, u.id), `Recruited ${u.name} (${u.cost} gc).`)} />
      {ed.notice && <UndoToast key={ed.notice.id} text={ed.notice.text} onUndo={ed.undo} onDone={ed.dismiss} />}
      {!ed.notice && shareNotice}
    </section>
  );
}

export function Roster() {
  const { id = '' } = useParams();
  const rec = useWarbandRecord(id);
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
