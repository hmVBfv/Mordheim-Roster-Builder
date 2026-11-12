/* On "New warband" each grade of the list is a section that folds out, Core open to begin with (plan P6): a test that picks a warband of
   another grade unfolds what is closed first. */
import { screen, within } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';

export async function unfoldGrades(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const table = await screen.findByRole('table');
  for (const b of within(table).queryAllByRole('button', { expanded: false })) await user.click(b);
}
