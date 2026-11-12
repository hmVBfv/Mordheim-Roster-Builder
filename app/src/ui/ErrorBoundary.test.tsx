/* A screen that throws while drawing leaves the frame standing, and the error lands in the trail of a report. */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recentErrors, resetTrail } from '../bugs/trail.ts';
import { ErrorBoundary } from './ErrorBoundary.tsx';

function Bomb({ fail }: { fail: boolean }) {
  if (fail) throw new Error('boom');
  return <p>all well</p>;
}

beforeEach(() => { resetTrail(); vi.spyOn(console, 'error').mockImplementation(() => undefined); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ErrorBoundary', () => {
  it('shows what happened with a way on, and remembers the error for a report', () => {
    render(<><nav>frame</nav><ErrorBoundary resetKey="/a"><Bomb fail /></ErrorBoundary></>);
    expect(screen.getByRole('alert').textContent).toContain('Something went wrong on this page');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
    expect(screen.getByText('Error: boom')).toBeTruthy();
    expect(screen.getByText('frame')).toBeTruthy();
    expect(recentErrors().map((e) => e.message)).toEqual(['Error: boom']);
  });

  it('draws the next screen again when the screen changes, but not before', () => {
    const { rerender } = render(<ErrorBoundary resetKey="/a"><Bomb fail /></ErrorBoundary>);
    rerender(<ErrorBoundary resetKey="/a"><Bomb fail={false} /></ErrorBoundary>);
    expect(screen.queryByText('all well')).toBeNull();
    rerender(<ErrorBoundary resetKey="/b"><Bomb fail={false} /></ErrorBoundary>);
    expect(screen.getByText('all well')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
