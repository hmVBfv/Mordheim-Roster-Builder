/* Wish #138 (Rob, 29.10.2026): a Tabletop Simulator card shows that it opens – the bar with the turning arrow of the other fold-outs. */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Card } from './TtsCard.tsx';

afterEach(cleanup);

describe('a Tabletop Simulator card', () => {
  it('has the fold bar with its arrow on its title, as the other fold-outs have', () => {
    render(<Card c={{ id: 'c1', label: 'Mercenary Captain', group: null, name: 'Name', text: 'Text' }} open={false} onOpen={() => {}} onCopied={() => {}} />);
    const summary = screen.getByText('Mercenary Captain').closest('summary')!;
    expect(summary.className).toMatch(/fold/);
  });
});
