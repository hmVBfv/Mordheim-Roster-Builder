/* The Quick Build has no server: the report can only be copied and handed on. */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { takeSnapshot } from './snapshot.ts';

vi.mock('../flavour.ts', () => ({ FLAVOUR: 'quickbuild', APP_NAME: 'Mordheim Quick Build' }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('reporting in the Quick Build', () => {
  it('offers the copy and says why there is no sending', async () => {
    const { ReportForm } = await import('./ReportForm.tsx');
    const snap = await takeSnapshot('/warbands/new');
    const user = userEvent.setup();
    render(<ReportForm snap={snap} close={() => undefined} onSent={() => undefined} />);
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
    expect(screen.getByText('The Quick Build has no campaign server. Copy the report and send it to Rob.')).toBeTruthy();
    // no warband is offered: there is no server to receive it
    expect(screen.queryByRole('checkbox', { name: /Attach/ })).toBeNull();
    await user.type(screen.getByLabelText(/What did you want to do/), 'The export button is missing.');
    await user.click(screen.getByRole('button', { name: 'Copy the report' }));
    expect(await screen.findByText(/Copied/)).toBeTruthy();
    const text = await navigator.clipboard.readText(); // user-event's own clipboard
    expect(text).toContain('quickbuild');
    expect(text).toContain('The export button is missing.');
  });
});
