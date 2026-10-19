/* The Story of a warband (phase 4b2; concept.md 4.6, docs/mockups/story.html):
   what its player writes – the prologue, an interlude after each round, the
   names in both languages, a profile for every warrior – and a warrior's
   life, which is derived from all of it. It all lives in the warband's save
   (ADR 0016): it travels with every export, and in a campaign everyone can
   read it once the warband is saved to the server. */
import * as core from '@mordheim/core';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import type { StoredWarband } from '../db/db.ts';
import { useGameData } from '../game/useGameData.ts';
import { useEditor } from '../roster/useEditor.ts';
import trade from '../roster/Trade.module.css';
import { useWarbandRecord } from '../sync/local.ts';
import { Empty } from '../art/Pixels.tsx';
import ui from '../ui/ui.module.css';
import { UndoToast } from '../ui/UndoToast.tsx';
import { useSheet } from '../ui/useSheet.ts';
import { FieldsSheet, type FieldsEdit } from './FieldsSheet.tsx';
import { Life } from './Life.tsx';
import { CANON_FIELDS, L, peopleOf, PROFILE_FIELDS, PROLOGUE_QUESTIONS, type Person } from './people.ts';
import styles from './Story.module.css';

const GROUP_NAMES: Record<Person['group'], string> = { hero: 'Heroes', group: 'Henchmen', hired: 'Hired Swords & Dramatis Personae', fallen: 'The fallen' };

function StoryBody({ rec }: { rec: StoredWarband }) {
  const data = useGameData();
  const ed = useEditor(data, rec);
  const [params] = useSearchParams();
  const state = ed.state;
  const story = core.storyOf(state);
  const canon = core.canonOf(state);
  const people = useMemo(() => peopleOf(data, state), [data, state]);
  const round = Number(state.campaign?.round) || 0;
  const written = Object.keys(story.interludes).map(Number);
  const rounds = Array.from({ length: Math.max(round, ...written, 0) }, (_, i) => i + 1).reverse();

  const { ref: fieldsRef, open: openFields, close: closeFields } = useSheet();
  const [edit, setEdit] = useState<FieldsEdit | null>(null);
  const { ref: lifeRef, open: openLife, close: closeLife } = useSheet();
  // "His story so far" on the roster comes here with ?who=: that life opens at once
  const wanted = params.get('who');
  const [lifeOf, setLifeOf] = useState<{ key: number; who: Person } | null>(() => {
    const w = wanted ? people.find((p) => String(p.uid) === wanted) : undefined;
    return w ? { key: 1, who: w } : null;
  });
  const openedAtOnce = useRef(lifeOf !== null);
  useEffect(() => { if (openedAtOnce.current) openLife(); }, [openLife]);

  const ask = (e: Omit<FieldsEdit, 'key'>) => { setEdit((p) => ({ ...e, key: (p?.key ?? 0) + 1 })); openFields(); };
  const save = (action: (c: core.Ctx) => core.WarbandState, text: string) => ed.edit(action, text, { gold: 'keep' });

  const writeProse = (title: string, intro: string | undefined, label: string, max: number, value: string, run: (text: string) => void, rows = 8) =>
    ask({ title, intro, fields: [{ key: 'text', label, kind: 'text', max, rows }], values: { text: value }, save: (v) => run(v.text ?? '') });

  const editProfile = (w: Person) => ask({
    title: `${w.name}: names, voice, story`,
    intro: 'Spellings are fixed once here and used everywhere the chronicle names him.',
    fields: PROFILE_FIELDS, values: { ...w.profile } as Record<string, string>,
    save: (v) => save((c) => core.setProfile(c, w.uid, v), `${w.name}: profile saved.`),
  });
  const showLife = (w: Person) => { setLifeOf((p) => ({ key: (p?.key ?? 0) + 1, who: w })); openLife(); };

  const lifeWho = lifeOf ? people.find((p) => p.key === lifeOf.who.key) ?? lifeOf.who : null;
  const groups = (['hero', 'group', 'hired', 'fallen'] as const).map((g) => ({ g, list: people.filter((p) => p.group === g) })).filter((x) => x.list.length > 0);

  return (
    <section className={ui.page}>
      <div>
        <Link to={`/warbands/${rec.id}`} className={trade.back}>‹ {rec.name}</Link>
        <h1>Story</h1>
        <p className={ui.muted}>
          {rec.campaignId
            ? '👁 This is part of the warband’s save: everyone in the campaign can read it once the warband is saved to the server. Something only you should know before a battle belongs in a sealed note.'
            : 'This is part of the warband’s save: it goes with every export.'}
        </p>
      </div>

      <section className={styles.section} aria-labelledby="story-prologue">
        <div className={styles.head}>
          <h2 id="story-prologue">Prologue</h2>
          <button type="button" className={ui.buttonQuiet}
            onClick={() => writeProse('The prologue', 'Before the campaign: who they were when they came to Mordheim.', 'Prologue', L.prologue, story.prologue, (t) => save((c) => core.setPrologue(c, t), 'Prologue saved.'), 10)}>
            {story.prologue ? 'Edit the prologue' : 'Write the prologue'}
          </button>
        </div>
        {story.prologue ? <p className={`${ui.card} ${styles.text}`}>{story.prologue}</p> : <p className={ui.muted}>Not written yet.</p>}
        <details className={`${ui.card} ${styles.more}`}>
          <summary>What a prologue answers</summary>
          <ul className={styles.questions}>{PROLOGUE_QUESTIONS.map((q) => <li key={q}>{q}</li>)}</ul>
        </details>
      </section>

      <section className={styles.section} aria-labelledby="story-interludes">
        <h2 id="story-interludes">Interludes</h2>
        {rounds.length === 0 && <p className={ui.muted}>An interlude is what the warband does between two battles. They begin after the first one.</p>}
        {rounds.map((n) => {
          const text = story.interludes[String(n)] ?? '';
          return (
            <article key={n} className={ui.card} aria-label={`Interlude ${n}`}>
              <div className={styles.head}>
                <h3>Interlude {n}</h3>
                <button type="button" className={ui.buttonQuiet}
                  onClick={() => writeProse(`Interlude ${n}`, 'What happened between the battles: trade, recovery, recruiting, quarrels.', 'What happened', L.interlude, text, (t) => save((c) => core.setInterlude(c, n, t), `Interlude ${n} saved.`))}>
                  {text ? 'Edit' : 'Write'}
                </button>
              </div>
              <span className={styles.meta}>After battle {n}</span>
              {text ? <p className={styles.text}>{text}</p> : <p className={ui.muted}>Not written yet.</p>}
            </article>
          );
        })}
      </section>

      <section className={styles.section} aria-labelledby="story-names">
        <div className={styles.head}>
          <h2 id="story-names">The warband’s names</h2>
          <button type="button" className={ui.buttonQuiet}
            onClick={() => ask({ title: 'The warband’s names', intro: 'The German and the English chronicle may name it differently, on purpose.', fields: CANON_FIELDS, values: { ...canon } as Record<string, string>, save: (v) => save((c) => core.setCanon(c, v), 'Names saved.') })}>
            Edit the names
          </button>
        </div>
        <p className={ui.muted}>
          {canon.name_de || canon.name_en
            ? [canon.name_de && `German: ${canon.name_de}`, canon.name_en && `English: ${canon.name_en}`].filter(Boolean).join(' · ')
            : 'Not set: the chronicle uses the warband’s name.'}
        </p>
      </section>

      <section className={styles.section} aria-labelledby="story-lives">
        <h2 id="story-lives">Their lives</h2>
        <p className={ui.muted}>Battles, wounds, advances and what was written about each of them, in order.</p>
        {people.length === 0 && <Empty scene="camp" title="No warriors yet." />}
        {groups.map(({ g, list }) => (
          <div key={g} role="group" aria-label={GROUP_NAMES[g]}>
            <h3>{GROUP_NAMES[g]}</h3>
            <ul className={styles.lives}>
              {list.map((w) => <li key={w.key}><button type="button" onClick={() => showLife(w)}>{w.name}<small>{w.sub}</small></button></li>)}
            </ul>
          </div>
        ))}
      </section>

      <div className={ui.row}>
        {rec.campaignId && <Link to={`/campaign/${rec.campaignId}/timeline`} className={ui.buttonQuiet}>The campaign’s timeline</Link>}
        <Link to={`/warbands/${rec.id}`} className={ui.buttonQuiet}>The roster</Link>
      </div>

      <FieldsSheet dialogRef={fieldsRef} close={closeFields} edit={edit} />
      <dialog ref={lifeRef} className={ui.sheet} aria-labelledby="life-title">
        {lifeWho && lifeOf && (
          <Life key={lifeOf.key} data={data} rec={rec} state={state} who={lifeWho} close={() => closeLife()}
            onProfile={lifeWho.group === 'group' ? null : () => closeLife(() => editProfile(lifeWho))} />
        )}
      </dialog>
      {ed.notice && <UndoToast key={ed.notice.id} text={ed.notice.text} onUndo={ed.undo} onDone={ed.dismiss} />}
    </section>
  );
}

export function Story() {
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
      <StoryBody rec={rec} />
    </Suspense>
  );
}
