/* The whole chronicle as one Markdown file (phase 4b5a; ui.md "Chronicle"):
   the chapters in the order of the story, in the language the reader chose –
   a chapter that exists only in the other language is given in that one, and
   says so. Kept apart from React so it can be tested. */
import type { Chapter } from '../timeline/api.ts';
import type { Lang } from '../timeline/chapters.ts';

export const LANG_NAMES: Record<Lang, string> = { de: 'Deutsch', en: 'English' };

/** What a reader gets of a chapter in a language: that language, else the other (and which it is). */
export function told<L>(c: { de: L | null; en: L | null }, lang: Lang): { lang: Lang; fields: L; fallback: boolean } | null {
  const own = c[lang];
  if (own) return { lang, fields: own, fallback: false };
  const other: Lang = lang === 'de' ? 'en' : 'de';
  const alt = c[other];
  return alt ? { lang: other, fields: alt, fallback: true } : null;
}

export interface Told { segment: string; chapter: Chapter }

/** One file: a heading for the campaign, each chapter under its own, separated by rules. The chapters' own text is kept as written. */
export function chronicleMarkdown(campaign: string, lang: Lang, chapters: Told[]): { md: string; fallbacks: number } {
  let fallbacks = 0;
  const parts = chapters.flatMap(({ segment, chapter }) => {
    const t = told(chapter, lang);
    if (!t) return [];
    if (t.fallback) fallbacks++;
    const f = t.fields;
    const head = [f.label, f.title].filter(Boolean).join(' · ');
    const meta = [f.icDate, f.place, segment].filter(Boolean).join(' · ');
    return [[
      `## ${head}`,
      '',
      ...(meta ? [`*${meta}*`, ''] : []),
      ...(f.victor ? [`> ${f.victor.replace(/\s*\n\s*/g, ' ')}`, ''] : []),
      ...(t.fallback ? [`*(Only available in ${LANG_NAMES[t.lang]}.)*`, ''] : []),
      f.text.trim(),
    ].join('\n')];
  });
  const md = [`# ${campaign} — Chronicle (${LANG_NAMES[lang]})`, '', parts.length ? parts.join('\n\n---\n\n') : 'No chapter has been published yet.', ''].join('\n');
  return { md, fallbacks };
}
