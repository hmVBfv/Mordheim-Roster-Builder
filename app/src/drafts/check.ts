/* What a draft needs to be checked and placed (phase 4b5b): the background
   held against the chapter's text, the names the players know anyway, and
   the story's parts as they stand with everything in them. Gathered on the
   leader's device from what it can already read (ADR 0005); the server
   stores the draft and judges nothing about its words. */
import { checkLeaks, ruleAtRound, type LeakCheck, type LeakEntry } from '@mordheim/core';
import { getBackground, type Entry } from '../background/api.ts';
import { readWarband, type CampaignView } from '../campaign/api.ts';
import { campaignMap } from '../campaign/map.ts';
import { cachedNotes, getNotes } from '../notes/api.ts';
import { cachedPictures, getPictures } from '../pictures/api.ts';
import { cachedTimeline, getTimeline, type TimelineData } from '../timeline/api.ts';
import { buildTimeline, type Segment } from '../timeline/build.ts';
import type { ChapterKind } from '../timeline/chapters.ts';
import { getWorld, nameOf, otherName } from '../world/api.ts';

/** The round of the story a chapter tells: its ref names it (battle-N, interlude-N), the prologue comes before any, and any other chapter is read as told after all of them. */
export function roundOfRef(refKey: string, kind: ChapterKind): number {
  const n = /^(?:battle|interlude)-(\d+)$/.exec(refKey)?.[1];
  if (n) return Number(n);
  return kind === 'prologue' ? 0 : Infinity;
}

interface SaveNames {
  canon?: { name_de?: string; name_en?: string };
  models?: { name?: string; profile?: Profile }[];
  fallen?: { m: { name?: string; profile?: Profile } }[];
}
interface Profile { name_de?: string; name_en?: string; title_de?: string; title_en?: string }

/** Every name the players know anyway: the warbands, their warriors, the world's public people and factions, the districts. */
async function knownNames(cid: string, view: CampaignView): Promise<string[]> {
  const out: string[] = [view.campaign.name, ...view.enrolments.flatMap((e) => [e.name, e.wbName]), ...campaignMap(view).map((d) => d.name)];
  const [world, reads] = await Promise.all([
    getWorld(cid).catch(() => null),
    Promise.all(view.enrolments.map((e) => readWarband(cid, e.warbandId).catch(() => null))),
  ]);
  for (const f of world?.factions ?? []) out.push(nameOf(f), otherName(f));
  for (const n of world?.npcs ?? []) out.push(nameOf(n), otherName(n));
  for (const r of reads) {
    const save = (r?.head.data ?? {}) as SaveNames;
    out.push(save.canon?.name_de ?? '', save.canon?.name_en ?? '');
    for (const m of [...(save.models ?? []), ...(save.fallen ?? []).map((f) => f.m)]) {
      out.push(m.name ?? '', m.profile?.name_de ?? '', m.profile?.name_en ?? '', m.profile?.title_de ?? '', m.profile?.title_en ?? '');
    }
  }
  return out.filter(Boolean);
}

export interface Checked { check: LeakCheck; /** How many pieces of the background were held against the text. */ held: number }

/** What the text is held against: the background and the names the players know. Read once; the text can then be checked as it is typed. */
export interface Material { entries: Entry[]; known: string[] }

export async function loadMaterial(cid: string, view: CampaignView): Promise<Material> {
  const [bg, known] = await Promise.all([getBackground(cid), knownNames(cid, view)]);
  return { entries: bg.entries, known };
}

type Written = { refKey: string; kind: ChapterKind; title: string; label: string; icDate: string; place: string; victor: string; text: string };

/** The text held against every piece of the background that is not public at the chapter's place. Every piece counts, planned and leaders' own included: the check is about what must not slip out. */
export function checkText(m: Material, view: CampaignView, d: Written): Checked {
  const round = roundOfRef(d.refKey, d.kind);
  const roundOf = (id: string) => view.battles?.find((b) => b.id === id)?.round;
  const entries: LeakEntry[] = m.entries.map((e) => ({ title: e.title, truth: e.truth, playersKnow: e.playersKnow, rule: ruleAtRound(e, round, roundOf), hintLimits: e.hintLimits }));
  const text = [d.title, d.label, d.icDate, d.place, d.victor, d.text].filter(Boolean).join('\n\n');
  return { check: checkLeaks(text, entries, m.known), held: entries.filter((e) => e.rule !== 'revealed').length };
}

export async function checkDraft(cid: string, view: CampaignView, d: Written): Promise<Checked> {
  return checkText(await loadMaterial(cid, view), view, d);
}

/** The story's parts with everything in them (notes and pictures too), so a chapter can be put at the head of one. Offline: what the device kept. */
export async function storySegments(cid: string, view: CampaignView): Promise<Segment[]> {
  const [data, notes, pictures] = await Promise.all([
    getTimeline(cid).catch(() => cachedTimeline(cid)),
    getNotes(cid).catch(() => cachedNotes(cid)),
    getPictures(cid).catch(() => cachedPictures(cid)),
  ]);
  const tl: TimelineData = data ?? { positions: [], entries: [], outcomes: [], marks: [], chapters: [] };
  return buildTimeline(view.battles ?? [], notes?.notes ?? [], pictures ?? [], tl);
}
