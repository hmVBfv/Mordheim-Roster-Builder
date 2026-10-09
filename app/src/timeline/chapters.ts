/* The published chapters of the chronicle (phase 4a5, part 2): read from
   the chronicle's own files – Jekyll posts, a front matter of `key: value`
   lines (a folded `>-` block for long ones) and the Markdown body – and
   put together by their `ref`, the key that links a German and an English
   file. Where a chapter goes in the story follows from its ref (prologue,
   battle-N, interlude-N) or, for one the ref does not place, from the day
   it was published: after the last battle published before it. The leader
   sees all of it before the import and may change any place. Kept apart
   from React so it can be tested. */
import type { BattleSummary } from '../battle/api.ts';

export type ChapterKind = 'prologue' | 'battle' | 'interlude' | 'chapter';
export type Lang = 'de' | 'en';
export interface ChapterLang { label: string; title: string; icDate: string; place: string; victor: string; text: string }
/** One file of the chronicle, read. */
export interface ChapterFile { file: string; refKey: string; kind: ChapterKind; lang: Lang; publishedOn: string | null; fields: ChapterLang }
/** A chapter as it will be imported: its languages side by side. */
export interface ChapterImport { refKey: string; kind: ChapterKind; publishedOn: string | null; de: ChapterLang | null; en: ChapterLang | null; files: string[] }

const unquote = (v: string) => {
  const t = v.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1).replace(/''/g, "'");
  return t;
};

/** The front matter (the lines between the first two `---`) and the body. */
export function splitFrontMatter(source: string): { front: Record<string, string>; body: string } | null {
  const lines = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  if (lines[0]?.trim() !== '---') return null;
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (end < 0) return null;
  const front: Record<string, string> = {};
  for (let i = 1; i < end; i++) {
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(lines[i]!);
    if (!m) continue;
    const [, k, v] = m as unknown as [string, string, string];
    if (/^[>|][-+]?$/.test(v.trim())) {
      // a block: the indented lines after it, folded into one (">") or kept as lines ("|")
      const block: string[] = [];
      while (i + 1 < end && (/^\s+\S/.test(lines[i + 1]!) || lines[i + 1]!.trim() === '')) block.push(lines[++i]!.trim());
      front[k] = v.trim().startsWith('>') ? block.join(' ').replace(/\s+/g, ' ').trim() : block.join('\n').trim();
    } else front[k] = unquote(v);
  }
  return { front, body: lines.slice(end + 1).join('\n').trim() };
}

const GERMAN = /\b(und|der|die|das|nicht|ein|eine|mit|sich|auf|dem|den|ist|war|wie|aus)\b/gi;
const ENGLISH = /\b(and|the|of|not|was|with|his|her|their|from|that|had|were|they)\b/gi;
/** German or English, by the little words of the prose. */
export function guessLang(text: string): Lang {
  return (text.match(GERMAN)?.length ?? 0) >= (text.match(ENGLISH)?.length ?? 0) ? 'de' : 'en';
}

/** A chronicle file read, or why not. */
export function readChapterFile(file: string, source: string): ChapterFile | { file: string; problem: string } {
  const fm = splitFrontMatter(source);
  if (!fm) return { file, problem: 'no front matter (the lines between ---)' };
  const { front, body } = fm;
  const refKey = (front.ref ?? '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(refKey)) return { file, problem: 'no ref, or one that is not a key (prolog, battle-1, interlude-1 …)' };
  const title = (front.title ?? '').trim();
  if (!title) return { file, problem: 'no title' };
  const kind: ChapterKind = front.kind === 'prologue' || front.kind === 'interlude' || front.kind === 'battle' ? front.kind
    : /^battle-\d+$/.test(refKey) ? 'battle' : /^prolog(ue)?$/.test(refKey) ? 'prologue' : /interlude/.test(refKey) ? 'interlude' : 'chapter';
  const day = /^\d{4}-\d{2}-\d{2}/.exec(front.date ?? '')?.[0] ?? /^(\d{4}-\d{2}-\d{2})-/.exec(file.split('/').pop() ?? '')?.[1] ?? null;
  const lang: Lang = front.lang === 'de' || front.lang === 'en' ? front.lang : guessLang(`${title} ${body.slice(0, 4000)}`);
  return {
    file, refKey, kind, lang, publishedOn: day,
    fields: { label: front.chapter ?? '', title, icDate: front.ic_date ?? '', place: front.place ?? '', victor: front.victor ?? '', text: body },
  };
}

/** Files of the same ref make one chapter; the later file of a language wins. Ordered by the day they were published, one without a day last. */
export function groupChapters(files: ChapterFile[]): ChapterImport[] {
  const by = new Map<string, ChapterImport>();
  for (const f of files) {
    const c = by.get(f.refKey) ?? { refKey: f.refKey, kind: f.kind, publishedOn: f.publishedOn, de: null, en: null, files: [] };
    c[f.lang] = f.fields;
    c.files.push(f.file);
    if (f.publishedOn && (!c.publishedOn || f.publishedOn < c.publishedOn)) c.publishedOn = f.publishedOn;
    by.set(f.refKey, c);
  }
  // one without a day goes last
  return [...by.values()].sort((a, b) => (a.publishedOn ?? '9999').localeCompare(b.publishedOn ?? '9999') || a.refKey.localeCompare(b.refKey));
}

/** The battle a chapter is about (its ref names the round), if the campaign has one of that round. */
const battleOf = (refKey: string, battles: BattleSummary[]) => {
  const n = /^battle-(\d+)$/.exec(refKey)?.[1];
  return n ? [...battles].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).find((b) => b.round === Number(n)) : undefined;
};

/** Where a chapter goes in the story: by its ref, else after the last battle chapter published before it, else before the campaign. */
export function chapterPlace(c: Pick<ChapterImport, 'refKey' | 'kind' | 'publishedOn'>, all: Pick<ChapterImport, 'refKey' | 'publishedOn'>[], battles: BattleSummary[], segments: string[]): string {
  if (c.kind === 'prologue') return 'pre';
  const b = battleOf(c.refKey, battles);
  if (b) return `b${b.id}:battle`;
  const n = /^interlude-(\d+)$/.exec(c.refKey)?.[1];
  if (n && segments.includes(`i${n}`)) return `i${n}`;
  const before = all.filter((x) => x.refKey !== c.refKey && battleOf(x.refKey, battles) && x.publishedOn && c.publishedOn && x.publishedOn <= c.publishedOn)
    .sort((x, y) => x.publishedOn!.localeCompare(y.publishedOn!)).at(-1);
  const round = before ? battleOf(before.refKey, battles)!.round : null;
  return round != null && segments.includes(`i${round}`) ? `i${round}` : 'pre';
}

/* ---- the text, as the chronicle writes it ---- */

export type Piece = { strong: boolean; text: string };
export type Paragraph = { kind: 'heading'; text: string } | { kind: 'rule' } | { kind: 'para'; pieces: Piece[] };

/** The chronicle's Markdown – headings, rules, paragraphs with bold names – as plain pieces for React (no HTML is made from it). */
export function readText(md: string): Paragraph[] {
  return md.replace(/\r\n?/g, '\n').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p): Paragraph => {
    if (/^#{1,6}\s/.test(p)) return { kind: 'heading', text: p.replace(/^#{1,6}\s+/, '').replace(/\s+/g, ' ') };
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(p)) return { kind: 'rule' };
    const pieces = p.replace(/\s*\n\s*/g, ' ').split(/(\*\*[^*]+\*\*)/).filter(Boolean)
      .map((t) => (t.startsWith('**') && t.endsWith('**') && t.length > 4 ? { strong: true, text: t.slice(2, -2) } : { strong: false, text: t }));
    return { kind: 'para', pieces };
  });
}
