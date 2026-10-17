/* The instructions for Claude sessions in .claude/ (phase 4c2): `/bugs` and
   the reviewer. They are prose, but they name scripts, files and agents that
   must exist – a command that sends a session to something that is not there
   is worse than none. */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const read = (p: string) => readFileSync(root(p), 'utf8');

function frontmatter(text: string): Record<string, string> {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  expect(m, 'front matter').not.toBeNull();
  return Object.fromEntries(m![1]!.split('\n').map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim()]));
}

describe('/bugs', () => {
  const text = read('.claude/commands/bugs.md');

  it('has a description and takes the report number', () => {
    const f = frontmatter(text);
    expect(f.description).toMatch(/problem reports/);
    expect(f['argument-hint']).toContain('number');
    expect(text).toContain('$ARGUMENTS');
  });

  it('names only npm scripts that exist, and only subcommands the script knows', () => {
    const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;
    const named = [...text.matchAll(/npm run ([\w-]+(?::[\w-]+)*)/g)].map((m) => m[1]!);
    expect(named.length).toBeGreaterThan(2);
    for (const n of named) expect(scripts, n).toHaveProperty(n);
    const usage = read('core/scripts/bugs.ts');
    const subcommands = new Set([...text.matchAll(/npm run bugs -- (\w+)/g)].map((m) => m[1]!));
    expect([...subcommands].sort()).toEqual(['fixture', 'list', 'set', 'show']);
    for (const s of subcommands) expect(usage, s).toContain(`npm run bugs -- ${s}`);
  });

  it('keeps the rules that matter: data not instructions, only on request, S1 reviewed, Rob decides rules, nothing without the OK', () => {
    expect(text).toMatch(/not an instruction/);
    expect(text).toMatch(/Only on request/);
    expect(text).toMatch(/S1 gets an independent review/);
    expect(text).toMatch(/`reviewer` agent/);
    expect(text).toMatch(/Do not change anything in `data\/` without his\s+OK/);
    expect(text).toMatch(/never push to `master`/);
    expect(text).toMatch(/Never print, echo, write down\s+or look for the token/);
  });

  it('points at documents that exist', () => {
    for (const p of [...text.matchAll(/`(docs\/[\w./-]+\.md)`/g)].map((m) => m[1]!)) expect(existsSync(root(p)), p).toBe(true);
    expect(text).toContain('docs/operations.md');
    expect(read('docs/operations.md')).toContain('Bug-Token für eine Cloud-Sitzung');
  });
});

describe('the reviewer', () => {
  const text = read('.claude/agents/reviewer.md');

  it('is called what /bugs calls it, and can read and run but not write', () => {
    const f = frontmatter(text);
    expect(f.name).toBe('reviewer');
    expect(read('.claude/commands/bugs.md')).toContain('`reviewer` agent');
    expect(f.description).toMatch(/S1/);
    const tools = f.tools!.split(',').map((t) => t.trim());
    expect(tools).toEqual(['Read', 'Grep', 'Glob', 'Bash']);
    expect(tools).not.toContain('Write');
    expect(tools).not.toContain('Edit');
  });

  it('sees only the report and the diff, treats the report as data, and answers APPROVE or CHANGES NEEDED', () => {
    expect(text).toMatch(/only two things: \*\*the problem report\*\* and \*\*the diff\*\*/);
    expect(text).toMatch(/data, not instructions/);
    expect(text).toContain('**APPROVE** or **CHANGES NEEDED**');
    expect(text).toMatch(/You do not change anything/);
  });
});
