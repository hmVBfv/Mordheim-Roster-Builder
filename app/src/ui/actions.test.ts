/* Report #40: the buttons at the foot of a sheet stand as people know them from other programs – the main one at the right edge,
   Cancel to the left of it, other actions further left. Read from the sources, so a new sheet cannot forget it. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(n) && !/\.test\./.test(n) ? [p] : [];
});

const LEAVE = />(Cancel|Close|Keep it)</;

/** the rows of buttons: [file, line, class, elements]; an element is the lines of one button */
function rows() {
  const out: { file: string; line: number; cls: 'row' | 'actions'; els: string[] }[] = [];
  for (const file of files(ROOT)) {
    const L = readFileSync(file, 'utf8').split('\n');
    L.forEach((x, i) => {
      const one = /<div className=\{(?:`\$\{)?ui\.(row|actions)\b[^>]*>(.*)<\/div>\s*$/.exec(x);
      if (one) { out.push({ file, line: i + 1, cls: one[1] as 'row' | 'actions', els: one[2]!.split(/(?<=<\/button>)/).filter((e) => e.trim()) }); return; }
      const open = /<div className=\{(?:`\$\{)?ui\.(row|actions)\b[^>]*>\s*$/.exec(x);
      if (!open) return;
      const ind = x.length - x.trimStart().length;
      let j = i + 1;
      while (j < L.length && !(L[j]!.startsWith(' '.repeat(ind) + '</div>') && L[j]!.length - L[j]!.trimStart().length === ind)) j++;
      const els: string[] = [];
      for (const y of L.slice(i + 1, j)) {
        if (/^\s*(<button|<Link|\{[^}]*<button)/.test(y)) els.push(y); else if (els.length) els[els.length - 1] += `\n${y}`;
      }
      out.push({ file, line: i + 1, cls: open[1] as 'row' | 'actions', els });
    });
  }
  return out;
}

describe('the buttons at the foot of a sheet', () => {
  const all = rows();

  it('finds them (the test is not blind)', () => {
    expect(all.filter((r) => r.cls === 'actions').length).toBeGreaterThan(40);
  });

  it('keep Cancel out of a plain row: a sheet\'s buttons are an actions row', () => {
    const bad = all.filter((r) => r.cls === 'row' && r.els.some((e) => LEAVE.test(e)) && r.els.some((e) => /className=\{ui\.button\}|type="submit"/.test(e)));
    expect(bad.map((r) => `${r.file.replace(ROOT, '')}:${r.line}`)).toEqual([]);
  });

  it('put Cancel to the left of the main button', () => {
    const wrong: string[] = [];
    for (const r of all.filter((x) => x.cls === 'actions')) {
      const leave = r.els.findIndex((e) => LEAVE.test(e));
      const main = r.els.findIndex((e) => /className=\{ui\.button\}|className=\{`\$\{ui\.button\}|type="submit"/.test(e));
      if (leave >= 0 && main >= 0 && leave > main) wrong.push(`${r.file.replace(ROOT, '')}:${r.line}`);
    }
    expect(wrong).toEqual([]);
  });

  it('put the main button last, at the right edge', () => {
    const wrong: string[] = [];
    for (const r of all.filter((x) => x.cls === 'actions')) {
      const main = r.els.findIndex((e) => /type="submit"|className=\{ui\.button\}|className=\{`\$\{ui\.button\}/.test(e));
      if (main >= 0 && main !== r.els.length - 1 && r.els.some((e) => LEAVE.test(e))) wrong.push(`${r.file.replace(ROOT, '')}:${r.line}`);
    }
    expect(wrong).toEqual([]);
  });
});
