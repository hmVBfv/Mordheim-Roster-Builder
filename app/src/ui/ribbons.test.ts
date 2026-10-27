/* Report #102: a planner ribbon pushed aside by a favourite's was moved but not lengthened, so it began and ended inside the
   box. The ribbons are placed by the distance of their centre line from the corner (`--c`) and are long enough to be cut by
   the box on both sides wherever they lie. jsdom lays nothing out, so this reads the style sheet. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/ui/ui.module.css', 'utf8');
const rule = (sel: string) => new RegExp(`(?:^|\\n)${sel.replace('.', '\\.')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';

describe('the corner ribbons of the warband list', () => {
  it('are placed by the distance of their centre line from the corner and are far longer than the box is deep', () => {
    const base = rule('.ribbon');
    expect(base).toContain('var(--c)');
    const width = /width:\s*(\d+)px/.exec(base)?.[1];
    expect(Number(width)).toBeGreaterThanOrEqual(240);
  });

  it('a favourite lies nearest the corner, a planner beside it moves out by more than a ribbon is thick, and no rule gives either its own width', () => {
    const near = Number(/--c:\s*(\d+)px/.exec(rule('.ribbonFavourite'))?.[1]);
    const far = Number(/--c:\s*(\d+)px/.exec(rule('.ribbonFurther'))?.[1]);
    const alone = Number(/--c:\s*(\d+)px/.exec(rule('.ribbon'))?.[1]);
    expect(near).toBeGreaterThan(0);
    expect(far - near).toBeGreaterThanOrEqual(36);
    expect(alone).toBeGreaterThan(0);
    expect(rule('.ribbonFavourite')).not.toMatch(/width:/);
    expect(rule('.ribbonFurther')).not.toMatch(/width:/);
  });
});
