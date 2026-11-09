/* "What's new" as a tab of Account (Rob, 8.11.2026: it was too hidden at the foot of Settings): the changes of every update, a heading for each day. */
import { AccountTabs } from '../account/AccountTabs.tsx';
import { useSession } from '../account/session.ts';
import { accountLabel } from '../app/nav.ts';
import ui from '../ui/ui.module.css';
import { ChangelogList } from './ChangelogSheet.tsx';
import { ENTRIES } from './entries.ts';

export function WhatsNewPage() {
  const session = useSession();
  return (
    <section className={`${ui.page} ${ui.measure}`}>
      <h1>{accountLabel()}</h1>
      {session.status === 'in' && <AccountTabs />}
      <h2>What's new</h2>
      <ChangelogList entries={ENTRIES} />
    </section>
  );
}
