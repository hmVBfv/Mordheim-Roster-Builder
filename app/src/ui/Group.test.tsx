import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Group } from './Group.tsx';
import ui from './ui.module.css';

afterEach(cleanup);

describe('a titled group (#86)', () => {
  it('holds the heading and its entries in one framed block', () => {
    render(<Group id="g1" title="Planners"><ul><li>One</li></ul></Group>);
    const block = screen.getByRole('region', { name: 'Planners' });
    expect(block.className).toContain(ui.group!);
    expect(within(block).getByRole('heading', { name: 'Planners' }).className).toContain(ui.groupTitle!);
    expect(within(block).getByText('One')).toBeTruthy();
  });
});
