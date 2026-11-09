/* A page that is still being fetched is never an empty page (report of 9.11.2026): after a short while it says "Loading …", not before, so a fast
   page does not flash it. */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoadingLate } from './Loading.tsx';

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('the fallback of a page that loads', () => {
  it('shows nothing at first, then says that it is loading', () => {
    vi.useFakeTimers();
    render(<LoadingLate />);
    expect(screen.queryByText('Loading …')).toBeNull();
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByRole('status').textContent).toBe('Loading …');
  });
});
