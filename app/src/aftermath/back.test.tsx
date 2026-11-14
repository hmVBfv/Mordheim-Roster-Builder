/* "Back to the aftermath": only for a plausible battle id, and only inside this app. */
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { fromAftermath, useAftermathBack } from './back.ts';

const at = (search: string) => renderHook(() => useAftermathBack('w1'), { wrapper: ({ children }) => <MemoryRouter initialEntries={[`/warbands/w1/hire${search}`]}>{children}</MemoryRouter> }).result.current;

describe('the way back to the aftermath', () => {
  it('goes to the aftermath of the battle the page was opened from', () => {
    expect(at(fromAftermath('b-1'))).toEqual({ to: '/warbands/w1/aftermath/b-1', label: '‹ Back to the aftermath' });
  });
  it('is not there on a page opened any other way', () => {
    expect(at('')).toBeNull();
  });
  it('ignores anything that does not look like an id', () => {
    expect(at('?from=' + encodeURIComponent('https://evil.example/'))).toBeNull();
    expect(at('?from=' + encodeURIComponent('../../x'))).toBeNull();
    expect(at('?from=')).toBeNull();
  });
});
