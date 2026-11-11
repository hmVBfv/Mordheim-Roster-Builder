/* The role in a campaign as a chip (report of 11.11.2026): a leader's is marked – a flag, the accent – so it can be seen at a glance, and the others' are plain. */
import { ROLE_NAMES } from './api.ts';
import type { CampaignRole } from './api.ts';
import styles from './Campaign.module.css';

export function RoleChip({ role }: { role: CampaignRole }) {
  return (
    <span className={`${styles.chip} ${role === 'leader' ? styles.leaderChip : ''}`} data-role={role}>
      {role === 'leader' && <span aria-hidden="true">⚑ </span>}{ROLE_NAMES[role]}
    </span>
  );
}
