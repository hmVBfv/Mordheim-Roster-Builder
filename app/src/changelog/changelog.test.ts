/* Wish #154 (Rob, 30.10.2026): a short changelog with every deploy. Every file in `changelog/` must keep the form, because the
   build collects them and a broken one would break the notice – so the CI fails on it. */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENTRIES } from './entries.ts';
import { newestFirst, notIn, parseEntry, readJson } from './parse.ts';

const dir = join(process.cwd(), '..', 'changelog'); // vitest runs in app/
const files = readdirSync(dir).filter((f) => f.endsWith('.md'));

describe('one changelog file', () => {
  it('is a date and one line a change, each New, Changed or Fixed', () => {
    expect(parseEntry('a', 'date: 2026-10-30\n- New: a pencil.\n- Fixed: a break.\n')).toEqual({
      id: 'a', date: '2026-10-30', changes: [{ kind: 'New', text: 'a pencil.' }, { kind: 'Fixed', text: 'a break.' }],
    });
  });

  it('says what is wrong with one that breaks the form', () => {
    expect(() => parseEntry('a', '- New: no date\n')).toThrow(/first line/);
    expect(() => parseEntry('a', 'date: 30.10.2026\n- New: x\n')).toThrow(/first line/);
    expect(() => parseEntry('a', 'date: 2026-10-30\n- Added: x\n')).toThrow(/must be "- New/);
    expect(() => parseEntry('a', 'date: 2026-10-30\n')).toThrow(/no change/);
  });
});

describe('the files of changelog/', () => {
  it('are all collected, each in the form, dated as their name says, without the number of a report', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(ENTRIES.map((e) => e.id).sort()).toEqual(files.map((f) => f.replace(/\.md$/, '')).sort());
    for (const f of files) {
      const text = readFileSync(join(dir, f), 'utf8');
      const e = parseEntry(f, text);
      expect(f, 'the name starts with the date').toMatch(new RegExp(`^${e.date}-[a-z0-9-]+\\.md$`));
      for (const c of e.changes) {
        expect(c.text, `${f}: no number of a report`).not.toMatch(/#\d+/);
        expect(c.text.length, `${f}: a change is a short line`).toBeLessThanOrEqual(200);
      }
    }
  });

  it('come newest first', () => {
    expect(ENTRIES.map((e) => e.date)).toEqual([...ENTRIES.map((e) => e.date)].sort().reverse());
  });
});

describe('what a newer version holds', () => {
  const a = { id: '2026-10-29-a', date: '2026-10-29', changes: [{ kind: 'New' as const, text: 'x' }] };
  const b = { id: '2026-10-30-b', date: '2026-10-30', changes: [{ kind: 'Fixed' as const, text: 'y' }] };
  it('is what the running one lacks, the newest first', () => {
    expect(notIn([a, b], [a])).toEqual([b]);
    expect(notIn([a, b], [])).toEqual(newestFirst([a, b]));
    expect(notIn([a], [a, b])).toEqual([]);
  });
  it('reads the build’s changelog.json and drops what is not an entry', () => {
    expect(readJson([a, { id: 1 }, null, { ...b, changes: [{ kind: 'Oops', text: 'z' }] }])).toEqual([a]);
    expect(readJson({ not: 'a list' })).toEqual([]);
  });
});

describe('what the players were told of the biggest changes', () => {
  /* The date of a file is the day the change goes live, not the day it was written: an entry dated before the update that carries
     it hides under an older day, where the card on Home does not show it. A campaign of one's own is such a change (a report of
     31.10.2026: it was missing from the newest day). */
  it('says that anybody can start a campaign of their own, as news, on the day it went live', () => {
    const e = ENTRIES.find((x) => x.changes.some((c) => /own campaign/i.test(c.text) && /authenticator/i.test(c.text)));
    expect(e, 'an entry about starting one’s own campaign').toBeTruthy();
    expect(e!.date).toBe('2026-10-31');
    expect(e!.changes.find((c) => /own campaign/i.test(c.text))!.kind).toBe('New');
  });
});
