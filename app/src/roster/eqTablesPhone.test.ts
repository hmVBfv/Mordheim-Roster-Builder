/* Report #119: the tables of the equipment sheet ran their columns into each other on a phone. Below the width of a phone each line
   is a card of its own – the name and what it costs on the left, what can be done to it on the right – and the header row, which
   would only repeat what the cells say, is left to screen readers. jsdom lays nothing out, so this reads the style sheet. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/roster/Roster.module.css', 'utf8');
const phone = /@media \(max-width: 640px\) \{([\s\S]*?)\n\}\n/.exec(css)?.[1] ?? '';
const rule = (sel: string) => new RegExp(`(?:^|\\n)\\s*${sel.replace(/[.[\]()]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(phone)?.[1] ?? '';

describe('the equipment tables on a phone', () => {
  it('make each line a grid card, with the header row kept for screen readers', () => {
    expect(phone).not.toBe('');
    expect(rule('.eqTable tr')).toMatch(/display:\s*grid/);
    expect(rule('.eqTable thead')).toMatch(/position:\s*absolute|clip/);
    expect(rule('.eqTable th,\n  .eqTable td')).toMatch(/border-bottom:\s*0|border:\s*0/);
  });

  it('put the name and the price on the left and the buttons on the right, the upgrades under both', () => {
    expect(rule('.eqCarried tr')).toMatch(/grid-template-areas/);
    expect(rule('.eqCarried td:nth-child(3)')).toMatch(/grid-area:\s*up/);
    expect(rule('.eqListTable td:nth-child(3)')).toMatch(/grid-area:\s*act/);
  });
});
