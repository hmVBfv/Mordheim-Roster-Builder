/* The list of warbands for someone signed in (wish #10): under their own groups, with the choice under each warband
   and the Groups button. Loaded when the list opens for a signed-in person, so the Quick Build never carries it. */
import { errorText } from '../account/api.ts';
import { useOnline } from '../app/SyncState.tsx';
import type { StoredWarband } from '../db/db.ts';
import { FormSheet } from '../ui/FormSheet.tsx';
import ui from '../ui/ui.module.css';
import { useSheet } from '../ui/useSheet.ts';
import { GroupsSheet } from './GroupsSheet.tsx';
import { WarbandList, type GroupChoice } from './WarbandList.tsx';
import { useWarbandGroups } from './useWarbandGroups.ts';

export default function GroupedWarbands({ warbands, notify }: { warbands: StoredWarband[]; notify: (t: string) => void }) {
  const online = useOnline();
  const api = useWarbandGroups(true);
  const sheet = useSheet('warband-groups');
  const choice: GroupChoice = {
    options: api.groups.map((g) => ({ id: g.id, name: g.name })), of: api.groupOf,
    assign: (id, to) => { api.assign(id, to).catch((e: unknown) => notify(errorText(e))); },
    disabled: !online || !api.ready || !!api.error,
  };
  const sections = [
    ...api.groups.map((g) => ({ key: g.id, title: g.name, list: warbands.filter((w) => g.body.warbands.includes(w.id)) })),
    { key: 'none', title: 'Not in a group', list: warbands.filter((w) => !api.groupOf(w.id)) },
  ];
  return (
    <>
      <div className={ui.row}><button type="button" className={ui.buttonQuiet} onClick={() => sheet.open()}>Groups</button></div>
      {api.groups.length === 0 && <WarbandList warbands={warbands} marks grid groups={choice} />}
      {api.groups.length > 0 && sections.map((sec) => (
        <section key={sec.key} className={ui.page} aria-labelledby={`wbg-${sec.key}`}>
          <h2 id={`wbg-${sec.key}`}>{sec.title}</h2>
          {sec.list.length === 0
            ? <p className={ui.muted}>{sec.key === 'none' ? 'Every warband is in a group.' : 'No warband in it yet. Choose this group under a warband.'}</p>
            : <WarbandList warbands={sec.list} marks grid groups={choice} />}
        </section>
      ))}
      <FormSheet dialogRef={sheet.ref}>
        {(titleId) => <GroupsSheet titleId={titleId} api={api} close={() => sheet.close()} />}
      </FormSheet>
    </>
  );
}
