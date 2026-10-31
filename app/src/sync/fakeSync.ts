/* The campaign server's warband endpoints as the sync tests (Vitest and
   Playwright) need them: the
   same rules as server/src/routes-warbands.ts and warbands.ts (versions on
   baseRev, one draft per user with afterSeq, tombstones, sync by seq,
   epoch), in memory, for one signed-in user. Tests can act as "another
   device" by changing the state directly. Sharing as in
   server/src/routes-shares.ts: the others, copies sent, share codes.
   Campaigns as in server/src/routes-campaigns.ts (phase 4a1): members,
   warbands entered (the signed-in user's among the sync's own, the others'
   kept here), a leader's confirmation with the start tag. After a battle
   (phase 4a4): closing it, marking a warband "after" it (the changes from
   `opts.changes`, which the specs compute with core as the server does),
   moving the campaign on; the campaign's house rules, and what the
   overview shows of each warband's newest version (rules that differ,
   districts held); pictures – a raw body arrives as { raw, type }; the
   campaign's history (4a5). */
import { effectiveHouse, houseDifferences, normalizeHidden, redactNpc, releasedChangeProblem, type ScenarioNpc } from '@mordheim/core';
export interface FakeVersion { rev: number; data: unknown; createdAt: string; source: string; note?: string }
export interface FakeWarband {
  id: string; headRev: number; versions: FakeVersion[]; archivedAt: string | null; seq: number;
  draft: { baseRev: number; data: unknown; device: string; updatedAt: string; seq: number } | null;
  copiedFrom: { id: string; rev: number } | null; createdAt: string;
  campaignId?: string | null;
}

export type FakeRole = 'leader' | 'player' | 'viewer';
export interface FakeEntry { id: string; turn: number; kind: 'casualty' | 'event'; payload: unknown; author: string; createdAt: string; updatedAt: string; deleted?: boolean }
export interface FakeProposal { id: string; targetType: 'battle' | 'protocol_entry'; targetId: string; authorId: string; author: string; payload: { text: string }; status: 'open' | 'accepted' | 'rejected'; decidedBy: string | null; createdAt: string }
export interface FakeNote {
  id: string; campaignId: string; battleId: string | null; turn: number | null; authorId: string; author: string; kind: string; text: string;
  visibility: 'public' | 'sealed' | 'leader'; mentions: unknown[]; createdAt: string; updatedAt: string; seq: number; deleted?: boolean; edited?: boolean;
}
export interface FakePicture {
  id: string; campaignId: string; battleId: string | null; turn: number | null; uploaderId: string; uploader: string; mime: string; bytes: number; width: number; height: number;
  caption: string; visibility: 'public' | 'leader'; stored: boolean; createdAt: string; updatedAt: string; seq: number; deleted?: boolean; data?: Uint8Array;
}
export interface FakeBattle {
  id: string; campaignId: string; round: number; title: string; district: string; status: 'open' | 'closed'; turn: number; createdAt: string; seq: number;
  participants: { warbandId: string; outcome: string; /** the version confirmed for the battle, by whom and when, and the numbers frozen with it */ confirm?: { rev: number; by: string; at: string; totals: unknown } }[];
  entries: FakeEntry[];
  proposals: FakeProposal[];
  closedAt?: string | null;
  /** Phase 4a5: a battle of the history, played before the app, and the day it was played. */
  takenOver?: boolean; playedAt?: string | null;
}
/** A published chapter of the chronicle (4a5): both languages, each { label, title, icDate, place, victor, text }. */
export interface FakeChapter {
  id: string; campaignId: string; refKey: string; kind: string; publishedOn: string | null; createdAt: string; updatedAt: string;
  de: Record<string, string> | null; en: Record<string, string> | null; deleted?: boolean;
}
/** A chapter draft (4b5b): a leaders' own text, not yet a chapter. */
export interface FakeDraft {
  id: string; campaignId: string; refKey: string; kind: string; lang: 'de' | 'en'; title: string; label: string; icDate: string; place: string; victor: string; text: string;
  status: 'draft' | 'published'; createdBy: string; createdAt: string; updatedAt: string; seq: number; deleted?: boolean;
}
export interface FakeTotals { rating: number; spent: number; models: number; heroes: number; gold: number; fallen: number }
export interface FakeChange { kind: string; uid: number | string | null; name: string; changeKey: string; payload: Record<string, unknown>; eventRef: string | null; unexplained: boolean }
export interface FakeTag {
  id: string; kind: 'start' | 'after_battle' | 'sat_out'; rev: number; round: number; battleId: string | null; totals: FakeTotals; createdBy: string; createdAt: string;
  changes?: FakeChange[]; supersededBy?: string;
}
export interface FakeEnrolment {
  id: string; warbandId: string; playerId: string; player: string; status: 'pending' | 'active'; fromRound: number | null;
  createdAt: string; confirmedAt: string | null; name: string; wbType: string;
  /** The newest mark that stands. */
  tag: FakeTag | null;
  /** Every mark, the corrected ones too, oldest first. */
  tags?: FakeTag[];
  /** Another player's warband: its save, kept here. */
  data?: unknown;
}
export interface FakeCampaign {
  id: string; name: string; round: number; createdAt: string;
  /** A key of the lore (#66). */ place?: string;
  /** Plays Vanilla Mordheim (#167). */ vanilla?: boolean;
  /** The leaders' opening scene (#169). */ opening?: string;
  houseRules?: Record<string, unknown>;
  /** Members who filed it away in their own list (migration 24). */
  archivedBy?: string[];
  members: { userId: string; displayName: string; username: string; role: FakeRole }[];
  enrolments: FakeEnrolment[];
}

export interface FakePerson { id: string; username: string; displayName: string }
/** An entry of the background (4b1): leaders only, as server/src/background.ts keeps it. */
export interface FakeBackground {
  id: string; campaignId: string; kind: string; title: string; truth: string; playersKnow: string; status: string; reveal: string; hintLimits: string;
  revealFromBattle: string | null; refs: unknown[]; battleId: string | null; updatedBy: string; createdAt: string; updatedAt: string; seq: number; deleted?: boolean;
  lastReveal: { by: string; at: string; noteId: string; battleId: string | null; level: string } | null;
  revisions: { snapshot: Record<string, unknown>; editedBy: string; editedAt: string }[];
}

/** A question to a player (4b3a), as server/src/questions.ts keeps it. */
export interface FakeQuestion {
  id: string; campaignId: string; battleId: string | null; askedBy: string; askedByName: string; to: string; toName: string; text: string;
  status: 'open' | 'answered' | 'withdrawn'; answerNoteId: string | null; createdAt: string; updatedAt: string; answeredAt: string | null; seq: number;
}

/** The campaign world (4b3b), as server/src/world.ts keeps it: open to every member, written by leaders. */
export interface FakeFaction { id: string; campaignId: string; nameDe: string; nameEn: string; publicStatus: string; updatedAt: string; seq: number; deleted?: boolean }
export interface FakeNpc { id: string; campaignId: string; factionId: string | null; nameDe: string; nameEn: string; publicStatus: string; statlineTts: string; named: boolean; profile: unknown; updatedAt: string; seq: number; deleted?: boolean }
export interface FakeReputation { id: string; campaignId: string; warbandId: string; factionId: string; delta: number; reason: string; battleId: string | null; actor: string; createdAt: string; seq: number; deleted?: boolean }

/** A scenario (4b3c), as server/src/scenarios.ts keeps it: a draft only leaders read, released to a battle for everybody. */
export interface FakeScenario {
  id: string; campaignId: string; title: string; body: string; npcStatlines: string; npcs: ScenarioNpc[]; visibility: 'leader' | 'public'; playedInBattle: string | null;
  releasedAt: string | null; releasedBy: string | null; edited: boolean; createdAt: string; updatedAt: string; seq: number; deleted?: boolean;
}

/** A problem report (4c1) as the stand-in server keeps it. */
export interface FakeBug {
  id: string; number: number; reporterId: string; reporterName: string; kind: 'bug' | 'wish' | 'rules'; title: string; text: string; sourceRef: string;
  status: 'new' | 'confirmed' | 'in_progress' | 'fixed' | 'closed' | 'duplicate'; severity: 'S1' | 'S2' | 'S3' | 'S4' | null; area: string; headline: string; fixedIn: string;
  appVersion: string; device: string; view: string; context: unknown; jsErrors: unknown[]; warbandId: string | null; rev: number | null; consent: boolean; attachment: unknown;
  createdAt: string; updatedAt: string;
  /** The body as it was sent. */
  sent: Record<string, unknown>;
}

export interface FakeShare {
  id: string; name: string; wbType: string; from: string; to: string | null; toId: string | null; code: string | null; data: unknown;
  createdAt: string; expiresAt: string; answeredAt: string | null; accepted: boolean | null; uses: number; revokedAt: string | null;
  /** Made by the signed-in user. */
  mine: boolean;
}
const ME_NAME = 'Kai';
/** Seven days from the moment it is made, as on the server: a fixed date ran out on 11 Oct 2026, and every share in the tests counted as expired from then on. */
const shareExpires = () => new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
const CODES = ['K7M2Q9XD', 'H4TR8WNP', 'Z3FB6YCM'];

const NO_TOTALS: FakeTotals = { rating: 0, spent: 0, models: 0, heroes: 0, gold: 0, fallen: 0 };

export function createFakeSync(opts: {
  me?: { id: string; username: string; displayName: string }; totals?: (save: unknown) => FakeTotals; wbName?: (wb: string) => string;
  /** What changed between two saves, as the server's core finds and explains it. */
  changes?: (before: unknown, after: unknown, battle: { id: string; round: number }) => FakeChange[];
  districtName?: (id: string) => string;
} = {}) {
  const me = opts.me ?? { id: 'u1', username: 'kai', displayName: ME_NAME };
  const totalsOf = opts.totals ?? (() => NO_TOTALS);
  const s = {
    epoch: 'epoch-1',
    seq: 0,
    warbands: new Map<string, FakeWarband>(),
    calls: [] as string[],
    /** Answer nothing at all (offline). */
    down: false,
    people: [{ id: 'user-ben', username: 'ben', displayName: 'Ben' }, { id: 'user-rob', username: 'rob', displayName: 'Rob' }] as FakePerson[],
    shares: [] as FakeShare[],
    campaigns: new Map<string, FakeCampaign>(),
    battles: new Map<string, FakeBattle>(),
    notes: new Map<string, FakeNote>(),
    pictures: new Map<string, FakePicture>(),
    positions: new Map<string, { campaignId: string; itemType: string; itemId: string; segment: string; pos: string; movedBy: string; movedAt: string }>(),
    chapters: new Map<string, FakeChapter>(),
    background: new Map<string, FakeBackground>(),
    questions: new Map<string, FakeQuestion>(),
    factions: new Map<string, FakeFaction>(),
    npcs: new Map<string, FakeNpc>(),
    reputation: new Map<string, FakeReputation>(),
    scenarios: new Map<string, FakeScenario>(),
    /** The style guide per campaign (4b4a); none until a leader writes one. */
    styles: new Map<string, { text: string; updatedBy: string; updatedAt: string; seq: number }>(),
    /** Opponent groups and the campaign's own skills (server/src/opponents.ts), by id. */
    opponentGroups: new Map<string, { id: string; campaignId: string; name: string; note: string; profiles: unknown[]; updatedBy: string; updatedAt: string; seq: number; deleted?: boolean }>(),
    opponentSkills: new Map<string, { id: string; campaignId: string; name: string; text: string; updatedBy: string; updatedAt: string; seq: number; deleted?: boolean }>(),
    /** Hidden NPC warbands (server/src/npc-warbands.ts), leaders only, by id. */
    npcWarbands: new Map<string, { id: string; campaignId: string; name: string; save: Record<string, unknown>; summary: Record<string, unknown>; updatedBy: string; createdAt: string; updatedAt: string; seq: number; deleted?: boolean }>(),
    /** The Library (server/src/library.ts), private to its owner: every entry carries its owner. */
    library: new Map<string, { id: string; owner: string; kind: string; name: string; body: unknown; createdAt: string; updatedAt: string; deletedAt: string | null; seq: number }>(),
    /** The leaders' plans per campaign and battle number (server/src/plans.ts). */
    plans: new Map<string, { round: number; text: string; updatedBy: string; updatedAt: string; seq: number }>(),
    /** The backstory per campaign (server/src/backstory.ts); none until a leader brings one in. */
    backstories: new Map<string, { sections: { heading: string; battleNo: number | null; text: string }[]; updatedBy: string; updatedAt: string; seq: number }>(),
    /** Chapter drafts (4b5b), leaders' own. */
    drafts: new Map<string, FakeDraft>(),
    /** Problem reports (4c1), the newest last. */
    bugs: [] as FakeBug[],
  };
  const at = () => new Date(Date.UTC(2026, 9, 4, 12, 0, s.seq)).toISOString();
  const next = () => ++s.seq;
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const meta = (w: FakeWarband) => ({ id: w.id, name: '', wbType: '', headRev: w.headRev, copiedFrom: w.copiedFrom, createdAt: w.createdAt, updatedAt: at(), archivedAt: w.archivedAt, campaignId: w.campaignId ?? null });

  /* ---- campaigns ---- */
  const roleOf = (c: FakeCampaign) => c.members.find((m) => m.userId === me.id)?.role ?? null;
  const view = (c: FakeCampaign) => {
    const role = roleOf(c)!;
    return {
      campaign: { id: c.id, name: c.name, round: c.round, place: c.place ?? '', vanilla: !!c.vanilla, opening: c.opening ?? '', houseRules: c.houseRules ?? {}, createdAt: c.createdAt, updatedAt: c.createdAt },
      role,
      members: c.members.map((m) => ({ ...m, joinedAt: c.createdAt })),
      enrolments: c.enrolments.map((e) => ({
        id: e.id, warbandId: e.warbandId, playerId: e.playerId, player: e.player, status: e.status, fromRound: e.fromRound,
        createdAt: e.createdAt, confirmedAt: e.confirmedAt, name: e.name, wbType: e.wbType, wbName: opts.wbName?.(e.wbType) ?? e.wbType, tag: e.tag && publicTag(e.tag),
        headRev: s.warbands.get(e.warbandId)?.headRev ?? 1, updatedAt: c.createdAt,
        ...standing(c, e),
      })),
      battles: [...s.battles.values()].filter((b) => b.campaignId === c.id).map(battleSummary),
    };
  };

  /** What every member sees of a warband's newest version (server/src/campaigns.ts standing). */
  const standing = (c: FakeCampaign, e: FakeEnrolment) => {
    const d = (dataOf(e) ?? {}) as { house?: unknown; campaign?: { districts?: Record<string, string> } };
    const held = Object.entries(d.campaign?.districts ?? {}).filter(([, v]) => v === 'foothold' || v === 'control');
    return { houseDiffers: houseDifferences(c.houseRules ?? {}, d.house), districts: held.map(([id, hold]) => ({ id, name: opts.districtName?.(id) ?? id, hold })) };
  };
  const publicTag = (t: FakeTag) => ({ id: t.id, kind: t.kind, rev: t.rev, round: t.round, battleId: t.battleId, totals: t.totals, createdBy: t.createdBy, createdAt: t.createdAt });

  /* ---- battles ---- */
  const nameOf = (warbandId: string) => [...s.campaigns.values()].flatMap((c) => c.enrolments).find((e) => e.warbandId === warbandId);
  const battleSummary = (b: FakeBattle) => {
    const ws = b.participants.map((p) => ({ id: p.warbandId, name: nameOf(p.warbandId)?.name ?? '' })).sort((x, y) => x.name.localeCompare(y.name));
    return {
      id: b.id, round: b.round, title: b.title, status: b.status, turn: b.turn, warbands: ws.map((w) => w.name), warbandIds: ws.map((w) => w.id), marked: Object.keys(marksOf(b)), confirmed: b.participants.filter((p) => p.confirm).map((p) => p.warbandId), createdAt: b.createdAt, closedAt: b.closedAt ?? null,
      takenOver: !!b.takenOver, playedAt: b.playedAt ?? (b.takenOver ? null : b.createdAt),
    };
  };
  /** The marks that stand after a battle, by warband. */
  const marksOf = (b: FakeBattle) => Object.fromEntries([...s.campaigns.values()].flatMap((c) => c.enrolments).flatMap((e) => (e.tags ?? [])
    .filter((t) => t.battleId === b.id && t.kind === 'after_battle' && !t.supersededBy)
    .map((t) => [e.warbandId, { tagId: t.id, rev: t.rev, totals: t.totals, changes: t.changes?.length ?? 0, unexplained: t.changes?.filter((x) => x.unexplained).length ?? 0, createdAt: t.createdAt }])));
  const battleView = (b: FakeBattle) => ({
    battle: {
      id: b.id, campaignId: b.campaignId, round: b.round, title: b.title, scenario: '', district: b.district, status: b.status, turn: b.turn, createdAt: b.createdAt, updatedAt: b.createdAt, closedAt: b.closedAt ?? null,
      takenOver: !!b.takenOver, playedAt: b.playedAt ?? (b.takenOver ? null : b.createdAt),
    },
    seq: b.seq,
    participants: b.participants.map((p) => {
      const e = nameOf(p.warbandId)!;
      const head = s.warbands.get(p.warbandId)?.headRev ?? 1;
      return {
        warbandId: p.warbandId, name: e.name, wbType: e.wbType, wbName: opts.wbName?.(e.wbType) ?? e.wbType, playerId: e.playerId, player: e.player, outcome: p.outcome,
        revBefore: p.confirm?.rev ?? 1, confirmedAt: p.confirm?.at ?? null, confirmedBy: p.confirm?.by ?? null, beforeTotals: p.confirm?.totals ?? null, headRev: head,
      };
    }),
    entries: b.entries.filter((e) => !e.deleted).sort((x, y) => x.turn - y.turn || x.createdAt.localeCompare(y.createdAt)).map((e) => ({ id: e.id, turn: e.turn, kind: e.kind, payload: e.payload, author: e.author, createdAt: e.createdAt, updatedAt: e.updatedAt })),
    proposals: b.proposals,
    marks: marksOf(b),
  });
  /** A battle in a campaign, of the warbands confirmed there (all of them, unless named). */
  const addBattle = (campaignId: string, o: { title?: string; warbandIds?: string[]; round?: number } = {}) => {
    const c = s.campaigns.get(campaignId)!;
    const b: FakeBattle = {
      id: `00000000-0000-4000-8000-${String(s.battles.size + 1).padStart(12, '0')}`, campaignId, round: o.round ?? c.round + 1, title: o.title ?? '', district: '', status: 'open', turn: 1, createdAt: at(), seq: next(),
      participants: (o.warbandIds ?? c.enrolments.filter((e) => e.status === 'active').map((e) => e.warbandId)).map((warbandId) => ({ warbandId, outcome: '' })),
      entries: [], proposals: [],
    };
    s.battles.set(b.id, b);
    return b;
  };
  /** The campaign's history (server/src/history.ts): its round follows the last battle before the app, the warbands' start marks move along. */
  const followHistory = (c: FakeCampaign) => {
    const round = Math.max(0, ...[...s.battles.values()].filter((b) => b.campaignId === c.id && b.takenOver).map((b) => b.round));
    c.round = round;
    for (const e of c.enrolments.filter((x) => x.status === 'active')) {
      const start = (e.tags ?? []).find((t) => t.kind === 'start' && !t.supersededBy);
      if (!start || start.round === round) continue;
      const moved: FakeTag = { ...start, id: `${start.id}-r${round}`, round, createdAt: at() };
      start.supersededBy = moved.id;
      e.tags = [...(e.tags ?? []), moved];
      e.tag = moved;
    }
  };
  /** A battle of the history, as a leader records it (PUT …/history/:bid). */
  const pastBattle = (campaignId: string, o: { id?: string; round: number; title?: string; district?: string; playedOn?: string | null; outcomes: Record<string, string> }): FakeBattle | string => {
    const c = s.campaigns.get(campaignId)!;
    if ([...s.battles.values()].some((b) => b.campaignId === c.id && !b.takenOver)) return 'history_closed';
    const id = o.id ?? `00000000-0000-4000-8000-${String(s.battles.size + 1).padStart(12, '0')}`;
    const there = s.battles.get(id);
    const b: FakeBattle = {
      ...(there ?? { id, campaignId, status: 'closed', turn: 1, createdAt: at(), closedAt: at(), entries: [], proposals: [], takenOver: true }),
      round: o.round, title: (o.title ?? '').trim(), district: o.district ?? '', playedAt: o.playedOn ?? null, seq: next(),
      participants: Object.entries(o.outcomes).map(([warbandId, outcome]) => ({ warbandId, outcome })),
    } as FakeBattle;
    s.battles.set(id, b);
    followHistory(c);
    return b;
  };
  /** Another leader's device writes an entry. */
  const entryElsewhere = (bid: string, e: Omit<FakeEntry, 'createdAt' | 'updatedAt'>) => {
    const b = s.battles.get(bid)!;
    b.entries.push({ ...e, createdAt: at(), updatedAt: at() });
    b.seq = next();
  };

  /* ---- notes (as server/src/notes.ts filters them) ---- */
  const noteFor = (n: FakeNote, role: FakeRole) => {
    if (n.deleted) return null;
    if (n.visibility === 'leader' && role !== 'leader' && n.authorId !== me.id) return null;
    const closed = n.battleId ? s.battles.get(n.battleId)?.status === 'closed' : false;
    if (n.visibility === 'sealed' && !closed && n.authorId !== me.id) {
      return { id: n.id, battleId: n.battleId, authorId: n.authorId, author: n.author, visibility: 'sealed', sealedUntil: n.battleId, sealed: true, createdAt: n.createdAt };
    }
    return {
      id: n.id, battleId: n.battleId, turn: n.turn, authorId: n.authorId, author: n.author, kind: n.kind, text: n.text, lang: '', visibility: n.visibility,
      sealedUntil: n.visibility === 'sealed' ? n.battleId : null, opened: n.visibility === 'sealed' && closed, mentions: n.mentions, protocolEntryId: null,
      createdAt: n.createdAt, updatedAt: n.updatedAt, edited: !!n.edited,
    };
  };
  const notesSeq = (cid: string) => Math.max(0, ...[...s.notes.values()].filter((n) => n.campaignId === cid).map((n) => n.seq));
  /** Another member writes a note. */
  const noteFrom = (campaignId: string, n: { author: string; text: string; battleId?: string | null; turn?: number | null; kind?: string; visibility?: FakeNote['visibility']; mentions?: unknown[] }) => {
    const note: FakeNote = {
      id: `${String(s.notes.size + 1).padStart(8, '0')}-0000-4000-8000-000000000000`, campaignId, battleId: n.battleId ?? null, turn: n.turn ?? null,
      authorId: `user-${n.author.toLowerCase()}`, author: n.author, kind: n.kind ?? 'general', text: n.text, visibility: n.visibility ?? 'public', mentions: n.mentions ?? [],
      createdAt: at(), updatedAt: at(), seq: next(),
    };
    s.notes.set(note.id, note);
    return note;
  };
  const noteRoutes = (c: FakeCampaign, role: FakeRole, method: string, rest: string, query: URLSearchParams, body: Record<string, unknown>): Response | null => {
    if (method === 'GET' && rest === '/notes' && query.get('as') === 'player') {
      const asNobody = (n: FakeNote) => (n.visibility === 'leader' ? null : noteFor({ ...n, authorId: '' }, 'player'));
      return json(200, { notes: [...s.notes.values()].filter((n) => n.campaignId === c.id && !n.deleted).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(asNobody).filter(Boolean), seq: notesSeq(c.id) });
    }
    if (method === 'GET' && rest === '/notes') {
      const seq = notesSeq(c.id);
      const since = query.get('since');
      if (since !== null && Number(since) >= seq) return json(200, { unchanged: true, seq });
      return json(200, { notes: [...s.notes.values()].filter((n) => n.campaignId === c.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((n) => noteFor(n, role)).filter(Boolean), seq });
    }
    const m = rest.match(/^\/notes\/([^/]+)$/);
    if (!m) return null;
    if (role === 'viewer') return json(403, { error: 'forbidden' });
    const cur = s.notes.get(m[1]!);
    if (method === 'PUT') {
      if (cur?.deleted) return json(409, { error: 'removed' });
      if (body.visibility === 'leader' && role !== 'leader') return json(403, { error: 'forbidden' });
      if (cur && cur.authorId !== me.id && role !== 'leader') return json(403, { error: 'forbidden' });
      const fields = { battleId: (body.battleId as string | null) ?? null, turn: (body.turn as number | null) ?? null, kind: String(body.kind ?? 'general'), text: String(body.text), mentions: (body.mentions as unknown[]) ?? [] };
      if (cur) Object.assign(cur, fields, cur.authorId === me.id ? { visibility: body.visibility ?? 'public' } : {}, { updatedAt: at(), seq: next(), edited: cur.edited || cur.text !== fields.text });
      else s.notes.set(m[1]!, { id: m[1]!, campaignId: c.id, ...fields, authorId: me.id, author: me.displayName, visibility: (body.visibility as FakeNote['visibility']) ?? 'public', createdAt: at(), updatedAt: at(), seq: next() });
      return json(200, { note: noteFor(s.notes.get(m[1]!)!, role), seq: notesSeq(c.id) });
    }
    if (method === 'DELETE') {
      if (!cur || !noteFor(cur, role)) return json(404, { error: 'not_found' });
      if (cur.authorId !== me.id && role !== 'leader') return json(403, { error: 'forbidden' });
      cur.deleted = true;
      cur.seq = next();
      return json(200, { removed: true, seq: notesSeq(c.id) });
    }
    return json(404, { error: 'not_found' });
  };

  /* ---- the background (as server/src/routes-background.ts: leaders only) ---- */
  const bgView = (b: FakeBackground) => {
    const e: Partial<FakeBackground> = { ...b };
    delete e.revisions; delete e.deleted; delete e.campaignId;
    return e;
  };
  const bgSeq = (cid: string) => Math.max(0, ...[...s.background.values()].filter((b) => b.campaignId === cid).map((b) => b.seq));
  /** A leader wrote an entry earlier (or on another device). */
  const backgroundFrom = (campaignId: string, e: { kind?: string; title: string; truth?: string; playersKnow?: string; status?: string; reveal?: string; hintLimits?: string; battleId?: string | null; refs?: unknown[] }) => {
    const entry: FakeBackground = {
      id: `00000000-0000-4000-9000-${String(s.background.size + 1).padStart(12, '0')}`, campaignId, kind: e.kind ?? 'thread', title: e.title, truth: e.truth ?? '', playersKnow: e.playersKnow ?? '',
      status: e.status ?? 'planned', reveal: e.reveal ?? 'hidden', hintLimits: e.hintLimits ?? '', revealFromBattle: null, refs: e.refs ?? [], battleId: e.battleId ?? null,
      updatedBy: 'Anna', createdAt: at(), updatedAt: at(), seq: next(), lastReveal: null, revisions: [],
    };
    s.background.set(entry.id, entry);
    return entry;
  };
  const backgroundRoutes = (c: FakeCampaign, role: FakeRole, method: string, rest: string, query: URLSearchParams, body: Record<string, unknown>): Response => {
    if (role !== 'leader') return json(403, { error: 'forbidden' });
    const list = [...s.background.values()].filter((b) => b.campaignId === c.id && !b.deleted);
    if (method === 'GET' && rest === '/background') {
      const since = query.get('since');
      if (since !== null && Number(since) === bgSeq(c.id)) return json(200, { unchanged: true, seq: bgSeq(c.id) });
      return json(200, { entries: list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(bgView), seq: bgSeq(c.id) });
    }
    const m = rest.match(/^\/background\/([^/]+)(\/reveal)?$/);
    if (!m) return json(404, { error: 'not_found' });
    const cur = s.background.get(m[1]!);
    if (method === 'GET') return cur && cur.campaignId === c.id && !cur.deleted ? json(200, { entry: bgView(cur), revisions: [...cur.revisions].reverse(), reveals: cur.lastReveal ? [{ noteId: cur.lastReveal.noteId, battleId: cur.lastReveal.battleId, level: cur.lastReveal.level, at: cur.lastReveal.at, by: cur.lastReveal.by }] : [] }) : json(404, { error: 'not_found' });
    if (method === 'DELETE') {
      if (!cur || cur.deleted) return json(404, { error: 'not_found' });
      cur.deleted = true;
      cur.seq = next();
      return json(200, { removed: true, seq: bgSeq(c.id) });
    }
    const snapshot = (e: FakeBackground) => ({ kind: e.kind, title: e.title, truth: e.truth, playersKnow: e.playersKnow, status: e.status, reveal: e.reveal, hintLimits: e.hintLimits, revealFromBattle: e.revealFromBattle, refs: e.refs, battleId: e.battleId });
    if (method === 'POST' && m[2]) {
      if (!cur || cur.deleted) return json(404, { error: 'not_found' });
      const noteId = String(body.noteId);
      if (cur.lastReveal?.noteId === noteId) return json(200, { entry: bgView(cur), note: noteId, seq: bgSeq(c.id) });
      s.notes.set(noteId, { id: noteId, campaignId: c.id, battleId: (body.battleId as string | null) ?? null, turn: null, kind: 'general', text: String(body.text), mentions: [], authorId: me.id, author: me.displayName, visibility: 'public', createdAt: at(), updatedAt: at(), seq: next() });
      const place = body.place as { segment: string; pos: string } | null;
      if (place) s.positions.set(`note:${noteId}`, { campaignId: c.id, itemType: 'note', itemId: noteId, segment: place.segment, pos: place.pos, movedBy: me.id, movedAt: at() });
      cur.revisions.push({ snapshot: snapshot(cur), editedBy: me.displayName, editedAt: at() });
      cur.playersKnow = cur.playersKnow ? `${cur.playersKnow}\n\n${String(body.text)}` : String(body.text);
      cur.reveal = String(body.level);
      cur.revealFromBattle = body.level === 'revealed' ? ((body.battleId as string | null) ?? null) : null;
      cur.lastReveal = { by: me.displayName, at: at(), noteId, battleId: (body.battleId as string | null) ?? null, level: String(body.level) };
      cur.updatedBy = me.displayName; cur.updatedAt = at(); cur.seq = next();
      return json(200, { entry: bgView(cur), note: noteId, seq: bgSeq(c.id) });
    }
    if (method === 'PUT') {
      const fields = { kind: String(body.kind), title: String(body.title), truth: String(body.truth ?? ''), playersKnow: String(body.playersKnow ?? ''), status: String(body.status ?? 'planned'), reveal: String(body.reveal ?? 'hidden'), hintLimits: String(body.hintLimits ?? ''), revealFromBattle: (body.revealFromBattle as string | null) ?? null, refs: (body.refs as unknown[]) ?? [], battleId: (body.battleId as string | null) ?? null };
      if (!cur) {
        s.background.set(m[1]!, { id: m[1]!, campaignId: c.id, ...fields, updatedBy: me.displayName, createdAt: at(), updatedAt: at(), seq: next(), lastReveal: null, revisions: [] });
      } else {
        if (cur.deleted) return json(409, { error: 'removed' });
        if (Number(body.baseSeq) !== cur.seq) return json(409, { error: 'stale', current: bgView(cur) });
        cur.revisions.push({ snapshot: snapshot(cur), editedBy: me.displayName, editedAt: at() });
        Object.assign(cur, fields, { updatedBy: me.displayName, updatedAt: at(), seq: next() });
      }
      return json(200, { entry: bgView(s.background.get(m[1]!)!), seq: bgSeq(c.id) });
    }
    return json(404, { error: 'not_found' });
  };

  /* ---- questions to players (as server/src/questions.ts filters them: leaders all, the one asked their own) ---- */
  const questionShown = (q: FakeQuestion, role: FakeRole) => (role === 'leader' || (q.to === me.id && q.status !== 'withdrawn'));
  const questionView = (q: FakeQuestion) => { const v: Partial<FakeQuestion> = { ...q }; delete v.campaignId; return v; };
  const questionsSeq = (cid: string, role: FakeRole) => Math.max(0, ...[...s.questions.values()].filter((q) => q.campaignId === cid && questionShown(q, role)).map((q) => q.seq));
  /** A leader asked earlier (or on another device): of `to` (default: the signed-in user). */
  const questionFrom = (campaignId: string, q: { text: string; to?: { id: string; displayName: string }; askedBy?: string; battleId?: string | null; status?: FakeQuestion['status'] }) => {
    const to = q.to ?? { id: me.id, displayName: me.displayName };
    const fq: FakeQuestion = {
      id: `${String(s.questions.size + 1).padStart(8, '0')}-2222-4000-8000-000000000000`, campaignId, battleId: q.battleId ?? null, askedBy: 'user-anna', askedByName: q.askedBy ?? 'Anna',
      to: to.id, toName: to.displayName, text: q.text, status: q.status ?? 'open', answerNoteId: null, createdAt: at(), updatedAt: at(), answeredAt: null, seq: next(),
    };
    s.questions.set(fq.id, fq);
    return fq;
  };
  const questionRoutes = (c: FakeCampaign, role: FakeRole, method: string, rest: string, body: Record<string, unknown>): Response => {
    if (method === 'GET' && rest === '/questions') {
      const rank = { open: 0, answered: 1, withdrawn: 2 } as const;
      const list = [...s.questions.values()].filter((q) => q.campaignId === c.id && questionShown(q, role)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).sort((a, b) => rank[a.status] - rank[b.status]);
      return json(200, { questions: list.map(questionView), seq: questionsSeq(c.id, role) });
    }
    const m = rest.match(/^\/questions\/([^/]+)(\/answer)?$/);
    if (!m) return json(404, { error: 'not_found' });
    const cur = s.questions.get(m[1]!);
    if (method === 'PUT' && !m[2]) {
      if (role !== 'leader') return json(403, { error: 'forbidden' });
      const to = c.members.find((x) => x.userId === body.to);
      if (!to || to.role === 'viewer') return json(400, { error: 'invalid', problem: 'a question is asked of a leader or a player of this campaign' });
      const fields = { text: String(body.text).trim(), battleId: (body.battleId as string | null) ?? null };
      if (!cur) {
        s.questions.set(m[1]!, { id: m[1]!, campaignId: c.id, ...fields, askedBy: me.id, askedByName: me.displayName, to: to.userId, toName: to.displayName, status: 'open', answerNoteId: null, createdAt: at(), updatedAt: at(), answeredAt: null, seq: next() });
      } else {
        if (cur.status === 'answered') return json(409, { error: 'answered' });
        Object.assign(cur, fields, { status: body.status === 'withdrawn' ? 'withdrawn' : 'open', updatedAt: at(), seq: next() });
      }
      return json(200, { question: questionView(s.questions.get(m[1]!)!), seq: questionsSeq(c.id, role) });
    }
    if (method === 'POST' && m[2]) {
      if (role === 'viewer') return json(403, { error: 'forbidden' });
      if (!cur || cur.to !== me.id) return json(role === 'leader' && cur ? 403 : 404, { error: role === 'leader' && cur ? 'forbidden' : 'not_found' });
      if (cur.status === 'withdrawn') return json(409, { error: 'withdrawn' });
      const noteId = String(body.noteId);
      if (cur.status === 'answered') return cur.answerNoteId === noteId ? json(200, { question: questionView(cur), note: null, seq: questionsSeq(c.id, role) }) : json(409, { error: 'answered' });
      const visibility = (body.visibility as FakeNote['visibility'] | undefined) ?? 'public';
      const battle = cur.battleId ? s.battles.get(cur.battleId) : undefined;
      if (visibility === 'leader' && role !== 'leader') return json(403, { error: 'forbidden' });
      if (visibility === 'sealed' && (!battle || battle.status === 'closed')) return json(400, { error: 'invalid', problem: 'a note is sealed until a battle that is still open' });
      s.notes.set(noteId, { id: noteId, campaignId: c.id, battleId: cur.battleId, turn: null, kind: String(body.kind ?? 'general'), text: String(body.text), mentions: [], authorId: me.id, author: me.displayName, visibility, createdAt: at(), updatedAt: at(), seq: next() });
      Object.assign(cur, { status: 'answered', answerNoteId: noteId, answeredAt: at(), updatedAt: at(), seq: next() });
      return json(200, { question: questionView(cur), note: noteFor(s.notes.get(noteId)!, role), seq: questionsSeq(c.id, role) });
    }
    return json(404, { error: 'not_found' });
  };

  /* ---- the world (as server/src/world.ts: every member reads, a leader writes) ---- */
  const liveFactions = (cid: string) => [...s.factions.values()].filter((f) => f.campaignId === cid && !f.deleted);
  const worldOf = (cid: string) => {
    const factions = liveFactions(cid).sort((a, b) => (a.nameEn || a.nameDe).localeCompare(b.nameEn || b.nameDe));
    const live = new Set(factions.map((f) => f.id));
    const c = s.campaigns.get(cid)!;
    const strip = <T extends { campaignId: string; deleted?: boolean }>(x: T): Omit<T, 'campaignId' | 'deleted'> => { const rest: Partial<T> = { ...x }; delete rest.campaignId; delete rest.deleted; return rest as Omit<T, 'campaignId' | 'deleted'>; };
    return {
      factions: factions.map(strip),
      npcs: [...s.npcs.values()].filter((n) => n.campaignId === cid && !n.deleted).sort((a, b) => (a.nameEn || a.nameDe).localeCompare(b.nameEn || b.nameDe))
        .map((n) => strip({ ...n, factionId: n.factionId && live.has(n.factionId) ? n.factionId : null })),
      reputation: [...s.reputation.values()].filter((e) => e.campaignId === cid && !e.deleted && live.has(e.factionId)).sort((a, b) => b.seq - a.seq)
        .map((e) => ({ ...strip(e), warband: c.enrolments.find((x) => x.warbandId === e.warbandId)?.name || '(removed warband)' })),
      seq: Math.max(0, ...[...s.factions.values(), ...s.npcs.values(), ...s.reputation.values()].filter((x) => x.campaignId === cid).map((x) => x.seq)),
    };
  };
  /** A leader set up a faction earlier (or on another device). */
  const factionFrom = (campaignId: string, f: { nameEn: string; nameDe?: string; publicStatus?: string }) => {
    const ff: FakeFaction = { id: `${String(s.factions.size + 1).padStart(8, '0')}-3333-4000-8000-000000000000`, campaignId, nameDe: f.nameDe ?? '', nameEn: f.nameEn, publicStatus: f.publicStatus ?? '', updatedAt: at(), seq: next() };
    s.factions.set(ff.id, ff);
    return ff;
  };
  const npcFrom = (campaignId: string, n: { nameEn: string; nameDe?: string; factionId?: string | null; publicStatus?: string; statlineTts?: string; named?: boolean; profile?: unknown }) => {
    const nn: FakeNpc = { id: `${String(s.npcs.size + 1).padStart(8, '0')}-4444-4000-8000-000000000000`, campaignId, factionId: n.factionId ?? null, nameDe: n.nameDe ?? '', nameEn: n.nameEn, publicStatus: n.publicStatus ?? '', statlineTts: n.statlineTts ?? '', named: n.named ?? false, profile: n.profile ?? null, updatedAt: at(), seq: next() };
    s.npcs.set(nn.id, nn);
    return nn;
  };
  const reputationFrom = (campaignId: string, e: { warbandId: string; factionId: string; delta: number; reason: string; battleId?: string | null; actor?: string }) => {
    const ee: FakeReputation = { id: `${String(s.reputation.size + 1).padStart(8, '0')}-5555-4000-8000-000000000000`, campaignId, warbandId: e.warbandId, factionId: e.factionId, delta: e.delta, reason: e.reason, battleId: e.battleId ?? null, actor: e.actor ?? 'Anna', createdAt: at(), seq: next() };
    s.reputation.set(ee.id, ee);
    return ee;
  };
  const worldRoutes = (c: FakeCampaign, role: FakeRole, method: string, rest: string, body: Record<string, unknown>): Response => {
    if (method === 'GET' && rest === '/world') return json(200, worldOf(c.id));
    const m = rest.match(/^\/world\/(factions|npcs|reputation)\/([^/]+)$/);
    if (!m) return json(404, { error: 'not_found' });
    if (role !== 'leader') return json(403, { error: 'forbidden' });
    const [, kind, id] = m as unknown as [string, 'factions' | 'npcs' | 'reputation', string];
    const table = (kind === 'factions' ? s.factions : kind === 'npcs' ? s.npcs : s.reputation) as Map<string, { campaignId: string; deleted?: boolean; seq: number }>;
    const cur = table.get(id);
    if (method === 'DELETE') {
      if (!cur || cur.campaignId !== c.id) return json(404, { error: 'not_found' });
      const was = !cur.deleted;
      Object.assign(cur, { deleted: true, seq: next() });
      return json(200, { ...worldOf(c.id), removed: was });
    }
    if (method !== 'PUT') return json(404, { error: 'not_found' });
    if (cur?.deleted) return json(409, { error: 'removed' });
    const named = (b: Record<string, unknown>) => String(b.nameDe ?? '').trim() !== '' || String(b.nameEn ?? '').trim() !== '';
    if (kind === 'factions') {
      if (!named(body)) return json(400, { error: 'invalid', problem: 'not a faction (nameEn: a name, in German or English)' });
      const f: FakeFaction = { id, campaignId: c.id, nameDe: String(body.nameDe ?? '').trim(), nameEn: String(body.nameEn ?? '').trim(), publicStatus: String(body.publicStatus ?? '').trim(), updatedAt: at(), seq: next() };
      s.factions.set(id, f);
    } else if (kind === 'npcs') {
      if (!named(body)) return json(400, { error: 'invalid', problem: 'not an NPC (nameEn: a name, in German or English)' });
      const fid = (body.factionId as string | null | undefined) ?? null;
      if (fid && !liveFactions(c.id).some((f) => f.id === fid)) return json(400, { error: 'invalid', problem: 'no such faction in this campaign' });
      s.npcs.set(id, { id, campaignId: c.id, factionId: fid, nameDe: String(body.nameDe ?? '').trim(), nameEn: String(body.nameEn ?? '').trim(), publicStatus: String(body.publicStatus ?? '').trim(), statlineTts: String(body.statlineTts ?? ''), named: body.named === true, profile: body.profile ?? null, updatedAt: at(), seq: next() });
    } else {
      if (cur) return json(409, { error: 'exists' });
      const delta = Number(body.delta);
      if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100 || !String(body.reason ?? '').trim()) return json(400, { error: 'invalid', problem: 'not a reputation event' });
      if (!c.enrolments.some((e) => e.warbandId === body.warbandId && e.status === 'active')) return json(400, { error: 'invalid', problem: 'no such warband in this campaign' });
      if (!liveFactions(c.id).some((f) => f.id === body.factionId)) return json(400, { error: 'invalid', problem: 'no such faction in this campaign' });
      s.reputation.set(id, { id, campaignId: c.id, warbandId: String(body.warbandId), factionId: String(body.factionId), delta, reason: String(body.reason).trim(), battleId: (body.battleId as string | null) ?? null, actor: me.displayName, createdAt: at(), seq: next() });
    }
    return json(200, worldOf(c.id));
  };

  /* ---- scenarios (as server/src/routes-scenarios.ts: drafts for leaders, released ones for every member) ---- */
  const scenarioShown = (x: FakeScenario, role: FakeRole) => !x.deleted && (x.visibility === 'public' || role === 'leader');
  /** As the server answers: a leader reads every NPC whole, everybody else with each hidden part a "?" (ADR 0022). */
  const scenarioView = (x: FakeScenario, role: FakeRole = 'leader') => {
    const v: Partial<FakeScenario> = { ...x, npcs: role === 'leader' ? x.npcs : x.npcs.map(redactNpc) };
    delete v.campaignId; delete v.deleted;
    return v as Omit<FakeScenario, 'campaignId' | 'deleted'>;
  };
  const scenariosSeq = (cid: string, role: FakeRole) => Math.max(0, ...[...s.scenarios.values()].filter((x) => x.campaignId === cid && (role === 'leader' || x.visibility === 'public')).map((x) => x.seq));
  /** A leader wrote a scenario earlier (or on another device); `battleId` releases it. */
  const scenarioFrom = (campaignId: string, x: { title: string; body?: string; npcStatlines?: string; npcs?: ScenarioNpc[]; battleId?: string | null; releasedBy?: string }) => {
    const sc: FakeScenario = {
      id: `${String(s.scenarios.size + 1).padStart(8, '0')}-6666-4000-8000-000000000000`, campaignId, title: x.title, body: x.body ?? '', npcStatlines: x.npcStatlines ?? '', npcs: x.npcs ?? [],
      visibility: x.battleId ? 'public' : 'leader', playedInBattle: x.battleId ?? null, releasedAt: x.battleId ? at() : null, releasedBy: x.battleId ? (x.releasedBy ?? 'Anna') : null,
      edited: false, createdAt: at(), updatedAt: at(), seq: next(),
    };
    s.scenarios.set(sc.id, sc);
    return sc;
  };
  const scenarioRoutes = (c: FakeCampaign, role: FakeRole, method: string, rest: string, body: Record<string, unknown>): Response => {
    if (method === 'GET' && rest === '/scenarios') {
      const list = [...s.scenarios.values()].filter((x) => x.campaignId === c.id && scenarioShown(x, role));
      const drafts = list.filter((x) => x.visibility === 'leader').sort((a, b) => b.seq - a.seq);
      const played = list.filter((x) => x.visibility === 'public').sort((a, b) => (b.releasedAt ?? '').localeCompare(a.releasedAt ?? '') || b.seq - a.seq);
      return json(200, { scenarios: [...drafts, ...played].map((x) => scenarioView(x, role)), seq: scenariosSeq(c.id, role) });
    }
    const m = rest.match(/^\/scenarios\/([^/]+)(\/release)?$/);
    if (!m) return json(404, { error: 'not_found' });
    if (role !== 'leader') return json(403, { error: 'forbidden' });
    const cur = s.scenarios.get(m[1]!);
    const answer = (x: FakeScenario) => json(200, { scenario: scenarioView(x, role), seq: scenariosSeq(c.id, role) });
    if (method === 'DELETE' && !m[2]) {
      if (!cur || cur.campaignId !== c.id) return json(404, { error: 'not_found' });
      if (cur.deleted) return json(200, { removed: false, seq: scenariosSeq(c.id, role) });
      if (cur.visibility === 'public') return json(409, { error: 'released' });
      Object.assign(cur, { deleted: true, seq: next() });
      return json(200, { removed: true, seq: scenariosSeq(c.id, role) });
    }
    if (method === 'POST' && m[2]) {
      if (!cur || cur.campaignId !== c.id || cur.deleted) return json(404, { error: 'not_found' });
      const battle = s.battles.get(String(body.battleId));
      if (!battle || battle.campaignId !== c.id) return json(400, { error: 'invalid', problem: 'no such battle in this campaign' });
      if (cur.visibility === 'public') return cur.playedInBattle === battle.id ? answer(cur) : json(409, { error: 'released' });
      Object.assign(cur, { visibility: 'public', playedInBattle: battle.id, releasedAt: at(), releasedBy: me.displayName, updatedAt: at(), seq: next() });
      return answer(cur);
    }
    if (method !== 'PUT' || m[2]) return json(404, { error: 'not_found' });
    if (cur?.deleted) return json(409, { error: 'removed' });
    if (cur && cur.campaignId !== c.id) return json(409, { error: 'exists' });
    const title = String(body.title ?? '').trim();
    if (!title) return json(400, { error: 'invalid', problem: 'not a scenario (title: too small)' });
    const sent = Array.isArray(body.npcs) ? (body.npcs as ScenarioNpc[]) : [];
    if (sent.length > 30) return json(400, { error: 'invalid', problem: 'not a scenario (npcs: too many)' });
    if (new Set(sent.map((n) => n.id)).size !== sent.length) return json(400, { error: 'invalid', problem: 'not a scenario (npcs: one id twice)' });
    if (sent.some((n) => !String(n.name ?? '').trim())) return json(400, { error: 'invalid', problem: 'not a scenario (npcs: a name is needed)' });
    const npcs = sent.map((n) => ({ ...n, name: n.name.trim(), hidden: normalizeHidden(n.hidden ?? []) }));
    const fields = { title, body: String(body.body ?? ''), npcStatlines: String(body.npcStatlines ?? ''), npcs };
    if (!cur) {
      const sc: FakeScenario = { id: m[1]!, campaignId: c.id, ...fields, visibility: 'leader', playedInBattle: null, releasedAt: null, releasedBy: null, edited: false, createdAt: at(), updatedAt: at(), seq: next() };
      s.scenarios.set(sc.id, sc);
      return answer(sc);
    }
    if (cur.title === fields.title && cur.body === fields.body && cur.npcStatlines === fields.npcStatlines && JSON.stringify(cur.npcs) === JSON.stringify(fields.npcs)) return answer(cur);
    if (cur.seq !== Number(body.baseSeq ?? 0)) return json(409, { error: 'stale', current: scenarioView(cur, role) });
    if (cur.visibility === 'public') {
      const frozen = releasedChangeProblem(cur.npcs, fields.npcs);
      if (frozen) return json(409, { error: 'frozen', problem: frozen });
    }
    Object.assign(cur, fields, { edited: true, updatedAt: at(), seq: next() });
    return answer(cur);
  };

  /* ---- style guide (as server/src/routes-style.ts: leaders only, one text per campaign) ---- */
  const styleOf = (cid: string) => {
    const x = s.styles.get(cid);
    return x ? { ...x } : { text: '', updatedBy: null, updatedAt: null, seq: 0 };
  };
  /** A leader wrote the style earlier (or on another device). */
  const styleFrom = (campaignId: string, text: string, by = 'Anna') => {
    s.styles.set(campaignId, { text, updatedBy: by, updatedAt: at(), seq: next() });
    return styleOf(campaignId);
  };
  const styleRoutes = (c: FakeCampaign, role: FakeRole, method: string, rest: string, body: Record<string, unknown>): Response => {
    if (rest !== '/style') return json(404, { error: 'not_found' });
    if (role !== 'leader') return json(403, { error: 'forbidden' });
    if (method === 'GET') return json(200, { style: styleOf(c.id) });
    if (method !== 'PUT') return json(404, { error: 'not_found' });
    if (typeof body.text !== 'string' || body.text.length > 10_000) return json(400, { error: 'invalid', problem: 'not a style guide (text: too big)' });
    const cur = styleOf(c.id);
    if (cur.text === body.text && cur.seq !== 0) return json(200, { style: cur });
    if (cur.seq !== Number(body.baseSeq ?? 0)) return json(409, { error: 'stale', current: cur });
    s.styles.set(c.id, { text: body.text, updatedBy: me.displayName, updatedAt: at(), seq: next() });
    return json(200, { style: styleOf(c.id) });
  };

  /* ---- opponents (as server/src/routes-opponents.ts: leaders only) ---- */
  const oppOut = (x: object) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== 'campaignId' && k !== 'deleted'));
  const opponentsOf = (cid: string) => {
    const groups = [...s.opponentGroups.values()].filter((g) => g.campaignId === cid);
    const skills = [...s.opponentSkills.values()].filter((k) => k.campaignId === cid);
    return {
      groups: groups.filter((g) => !g.deleted).sort((a, b) => a.name.localeCompare(b.name)).map(oppOut),
      skills: skills.filter((k) => !k.deleted).sort((a, b) => a.name.localeCompare(b.name)).map(oppOut),
      seq: Math.max(0, ...groups.map((g) => g.seq), ...skills.map((k) => k.seq)),
    };
  };
  /** A leader kept a group earlier (or on another device). */
  const opponentGroupFrom = (campaignId: string, g: { id?: string; name: string; note?: string; profiles?: unknown[] }, by = 'Anna') => {
    const id = g.id ?? `0000000a-0000-4000-8000-${String(s.opponentGroups.size + 1).padStart(12, '0')}`;
    s.opponentGroups.set(id, { id, campaignId, name: g.name, note: g.note ?? '', profiles: g.profiles ?? [], updatedBy: by, updatedAt: at(), seq: next() });
    return id;
  };
  const opponentSkillFrom = (campaignId: string, k: { name: string; text?: string }, by = 'Anna') => {
    const id = `0000000b-0000-4000-8000-${String(s.opponentSkills.size + 1).padStart(12, '0')}`;
    s.opponentSkills.set(id, { id, campaignId, name: k.name, text: k.text ?? '', updatedBy: by, updatedAt: at(), seq: next() });
    return id;
  };
  const opponentRoutes = (c: FakeCampaign, role: FakeRole, method: string, rest: string, body: Record<string, unknown>): Response => {
    if (role !== 'leader') return json(403, { error: 'forbidden' });
    if (rest === '/opponents' && method === 'GET') return json(200, opponentsOf(c.id));
    const m = /^\/opponents\/(groups|skills)\/([^/]+)$/.exec(rest);
    if (!m) return json(404, { error: 'not_found' });
    const groups = m[1] === 'groups';
    const table = (groups ? s.opponentGroups : s.opponentSkills) as Map<string, { id: string; campaignId: string; seq: number; deleted?: boolean; updatedBy: string; updatedAt: string; name: string }>;
    const cur = table.get(m[2]!);
    if (method === 'DELETE') {
      if (!cur || cur.campaignId !== c.id) return json(404, { error: 'not_found' });
      if (!cur.deleted) { cur.deleted = true; cur.seq = next(); }
      return json(200, { removed: true, seq: cur.seq });
    }
    if (method !== 'PUT') return json(404, { error: 'not_found' });
    const name = String(body.name ?? '').trim();
    if (!name) return json(400, { error: 'invalid', problem: 'a name' });
    if (cur?.deleted) return json(404, { error: 'not_found' });
    const fields = groups ? { name, note: String(body.note ?? ''), profiles: (body.profiles as unknown[]) ?? [] } : { name, text: String(body.text ?? '') };
    if (cur) {
      const same = JSON.stringify(Object.fromEntries(Object.keys(fields).map((k) => [k, (cur as Record<string, unknown>)[k]]))) === JSON.stringify(fields);
      if (same) return json(200, { [groups ? 'group' : 'skill']: oppOut(cur) });
      if (cur.seq !== Number(body.baseSeq ?? 0)) return json(409, { error: 'stale', current: oppOut(cur) });
    }
    const row = { id: m[2]!, campaignId: c.id, ...fields, updatedBy: me.displayName, updatedAt: at(), seq: next() };
    table.set(m[2]!, row as never);
    return json(200, { [groups ? 'group' : 'skill']: oppOut(row) });
  };

  /* ---- hidden NPC warbands (as server/src/routes-npc-warbands.ts: leaders only) ---- */
  const npcOut = (w: { save: unknown } & Record<string, unknown>, withSave: boolean) => ({ id: w.id, name: w.name, summary: w.summary, updatedBy: w.updatedBy, createdAt: w.createdAt, updatedAt: w.updatedAt, seq: w.seq, ...(withSave ? { save: w.save } : {}) });
  const npcRoutes = (c: FakeCampaign, role: FakeRole, method: string, rest: string, body: Record<string, unknown>): Response => {
    if (role !== 'leader') return json(403, { error: 'forbidden' });
    const live = () => [...s.npcWarbands.values()].filter((w) => w.campaignId === c.id && !w.deleted);
    if (rest === '/npc-warbands' && method === 'GET') return json(200, { warbands: live().sort((a, b) => b.seq - a.seq).map((w) => npcOut(w, false)), seq: Math.max(0, ...[...s.npcWarbands.values()].filter((w) => w.campaignId === c.id).map((w) => w.seq)) });
    const m = /^\/npc-warbands\/([^/]+)$/.exec(rest);
    if (!m) return json(404, { error: 'not_found' });
    const cur = s.npcWarbands.get(m[1]!);
    if (method === 'GET') return cur && cur.campaignId === c.id && !cur.deleted ? json(200, { warband: npcOut(cur, true) }) : json(404, { error: 'not_found' });
    if (method === 'DELETE') {
      if (!cur || cur.campaignId !== c.id || cur.deleted) return json(404, { error: 'not_found' });
      cur.deleted = true; cur.seq = next();
      return json(200, { removed: true, seq: cur.seq });
    }
    if (method !== 'PUT') return json(404, { error: 'not_found' });
    const name = String(body.name ?? '').trim();
    const save = body.save as Record<string, unknown> | undefined;
    if (!name || !save || save.planner !== true) return json(400, { error: 'invalid', problem: 'an NPC warband is a planner' });
    if (cur?.deleted) return json(409, { error: 'removed' });
    if (live().some((w) => w.id !== m[1] && w.name.toLowerCase() === name.toLowerCase())) return json(400, { error: 'invalid', problem: 'an NPC warband of this name exists already' });
    if (cur && cur.seq !== Number(body.baseSeq ?? 0) && JSON.stringify(cur.save) !== JSON.stringify(save)) return json(409, { error: 'stale', current: npcOut(cur, true) });
    const row = { id: m[1]!, campaignId: c.id, name, save, summary: (body.summary as Record<string, unknown>) ?? {}, updatedBy: me.displayName, createdAt: cur?.createdAt ?? at(), updatedAt: at(), seq: next() };
    s.npcWarbands.set(m[1]!, row);
    return json(200, { warband: npcOut(row, true), seq: row.seq });
  };

  /* ---- plans (as server/src/routes-plans.ts: leaders only, by battle number) ---- */
  const planKey = (cid: string, round: number) => `${cid}:${round}`;
  const planOf = (cid: string, round: number) => {
    const x = s.plans.get(planKey(cid, round));
    return x ? { ...x } : { round, text: '', updatedBy: null, updatedAt: null, seq: 0 };
  };
  /** A leader wrote a plan earlier (or on another device). */
  const planFrom = (campaignId: string, round: number, text: string, by = 'Anna') => {
    s.plans.set(planKey(campaignId, round), { round, text, updatedBy: by, updatedAt: at(), seq: next() });
    return planOf(campaignId, round);
  };
  const planRoutes = (c: FakeCampaign, role: FakeRole, method: string, rest: string, body: Record<string, unknown>): Response => {
    if (role !== 'leader') return json(403, { error: 'forbidden' });
    if (rest === '/plans' && method === 'GET') return json(200, { plans: [...s.plans.entries()].filter(([k]) => k.startsWith(`${c.id}:`)).map(([, v]) => ({ ...v })).sort((a, b) => a.round - b.round) });
    const m = /^\/plans\/(\d+)$/.exec(rest);
    if (!m || method !== 'PUT') return json(404, { error: 'not_found' });
    const round = Number(m[1]);
    if (round < 1 || round > 999 || typeof body.text !== 'string' || body.text.length > 20_000) return json(400, { error: 'invalid', problem: 'not a plan' });
    const text = body.text.trim() ? body.text : '';
    const cur = planOf(c.id, round);
    if (cur.text === text) return json(200, { plan: cur });
    if (cur.seq !== Number(body.baseSeq ?? 0)) return json(409, { error: 'stale', current: cur });
    if (!text) { s.plans.delete(planKey(c.id, round)); return json(200, { plan: { round, text: '', updatedBy: null, updatedAt: null, seq: next() } }); }
    s.plans.set(planKey(c.id, round), { round, text, updatedBy: me.displayName, updatedAt: at(), seq: next() });
    return json(200, { plan: planOf(c.id, round) });
  };

  /* ---- backstory (as server/src/routes-backstory.ts: every member reads it, leaders replace it) ---- */
  const backstoryOf = (cid: string) => {
    const x = s.backstories.get(cid);
    return x ? { ...x } : { sections: [], updatedBy: null, updatedAt: null, seq: 0 };
  };
  /** A leader brought the backstory in earlier (or on another device). */
  const backstoryFrom = (campaignId: string, sections: { heading: string; battleNo: number | null; text: string }[], by = 'Anna') => {
    s.backstories.set(campaignId, { sections, updatedBy: by, updatedAt: at(), seq: next() });
    return backstoryOf(campaignId);
  };
  const backstoryRoutes = (c: FakeCampaign, role: FakeRole, method: string, rest: string, body: Record<string, unknown>): Response => {
    if (rest !== '/backstory') return json(404, { error: 'not_found' });
    if (method === 'GET') return json(200, { backstory: backstoryOf(c.id) });
    if (method !== 'PUT') return json(404, { error: 'not_found' });
    if (role !== 'leader') return json(403, { error: 'forbidden' });
    const list = body.sections;
    if (!Array.isArray(list) || list.length > 200) return json(400, { error: 'invalid', problem: 'not a backstory (sections)' });
    const sections = list as { heading: string; battleNo: number | null; text: string }[];
    const cur = backstoryOf(c.id);
    if (cur.seq !== 0 && JSON.stringify(cur.sections) === JSON.stringify(sections)) return json(200, { backstory: cur });
    if (cur.seq !== Number(body.baseSeq ?? 0)) return json(409, { error: 'stale', current: cur });
    s.backstories.set(c.id, { sections, updatedBy: me.displayName, updatedAt: at(), seq: next() });
    return json(200, { backstory: backstoryOf(c.id) });
  };

  /* ---- pictures (as server/src/attachments.ts filters them) ---- */
  const pictureFor = (p: FakePicture, role: FakeRole) => !p.deleted && (p.visibility !== 'leader' || role === 'leader' || p.uploaderId === me.id) && (p.stored || p.uploaderId === me.id);
  const pictureView = (p: FakePicture) => ({
    id: p.id, battleId: p.battleId, turn: p.turn, uploaderId: p.uploaderId, uploader: p.uploader, mime: p.mime, bytes: p.bytes, width: p.width, height: p.height,
    caption: p.caption, visibility: p.visibility, stored: p.stored, createdAt: p.createdAt, updatedAt: p.updatedAt,
  });
  const picturesSeq = (cid: string) => Math.max(0, ...[...s.pictures.values()].filter((p) => p.campaignId === cid).map((p) => p.seq));
  /** Another member sends a picture. */
  const pictureFrom = (campaignId: string, p: { uploader: string; caption?: string; battleId?: string | null; turn?: number | null; visibility?: FakePicture['visibility'] }) => {
    const pic: FakePicture = {
      id: `${String(s.pictures.size + 1).padStart(8, '0')}-1111-4000-8000-000000000000`, campaignId, battleId: p.battleId ?? null, turn: p.turn ?? null, uploaderId: `user-${p.uploader.toLowerCase()}`, uploader: p.uploader,
      mime: 'image/png', bytes: 3, width: 1, height: 1, caption: p.caption ?? '', visibility: p.visibility ?? 'public', stored: true, createdAt: at(), updatedAt: at(), seq: next(),
    };
    s.pictures.set(pic.id, pic);
    return pic;
  };
  const pictureRoutes = (c: FakeCampaign, role: FakeRole, method: string, rest: string, query: URLSearchParams, body: Record<string, unknown>): Response | null => {
    if (method === 'GET' && rest === '/attachments' && query.get('as') === 'player') {
      return json(200, { attachments: [...s.pictures.values()].filter((p) => p.campaignId === c.id && !p.deleted && p.visibility !== 'leader' && p.stored).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(pictureView), seq: picturesSeq(c.id) });
    }
    if (method === 'GET' && rest === '/attachments') {
      const seq = picturesSeq(c.id);
      const since = query.get('since');
      if (since !== null && Number(since) >= seq) return json(200, { unchanged: true, seq });
      return json(200, { attachments: [...s.pictures.values()].filter((p) => p.campaignId === c.id && pictureFor(p, role)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(pictureView), seq });
    }
    const m = rest.match(/^\/attachments\/([^/]+)(\/file)?$/);
    if (!m) return null;
    const cur = s.pictures.get(m[1]!);
    if (method === 'GET' && m[2]) {
      if (!cur || !pictureFor(cur, role) || !cur.data) return json(404, { error: 'not_found' });
      return new Response(new Blob([cur.data as BlobPart], { type: cur.mime }), { status: 200, headers: { 'content-type': cur.mime } });
    }
    if (role === 'viewer') return json(403, { error: 'forbidden' });
    if (method === 'PUT' && !m[2]) {
      if (cur?.deleted) return json(409, { error: 'removed' });
      if (body.visibility === 'leader' && role !== 'leader') return json(403, { error: 'forbidden' });
      if (cur && cur.uploaderId !== me.id) return json(403, { error: 'forbidden' });
      const fields = { battleId: (body.battleId as string | null) ?? null, turn: (body.turn as number | null) ?? null, caption: String(body.caption ?? ''), visibility: (body.visibility as FakePicture['visibility']) ?? 'public' };
      if (cur) Object.assign(cur, fields, { updatedAt: at(), seq: next() });
      else s.pictures.set(m[1]!, { id: m[1]!, campaignId: c.id, ...fields, uploaderId: me.id, uploader: me.displayName, mime: String(body.mime), bytes: Number(body.bytes), width: Number(body.width), height: Number(body.height), stored: false, createdAt: at(), updatedAt: at(), seq: next() });
      return json(200, { attachment: pictureView(s.pictures.get(m[1]!)!), seq: picturesSeq(c.id) });
    }
    if (method === 'PUT' && m[2]) {
      if (!cur || !pictureFor(cur, role)) return json(404, { error: 'not_found' });
      if (cur.uploaderId !== me.id) return json(403, { error: 'forbidden' });
      const raw = body.raw as Uint8Array | undefined;
      if (body.type !== cur.mime || !raw || raw.byteLength !== cur.bytes) return json(400, { error: 'invalid', problem: 'not the picture announced' });
      Object.assign(cur, { stored: true, data: raw, updatedAt: at(), seq: next() });
      return json(200, { attachment: pictureView(cur), seq: picturesSeq(c.id) });
    }
    if (method === 'DELETE') {
      if (!cur || !pictureFor(cur, role)) return json(404, { error: 'not_found' });
      if (cur.uploaderId !== me.id && role !== 'leader') return json(403, { error: 'forbidden' });
      cur.deleted = true;
      cur.seq = next();
      return json(200, { removed: true, seq: picturesSeq(c.id) });
    }
    return json(404, { error: 'not_found' });
  };

  const chapterSummary = (ch: FakeChapter) => {
    const short = (l: Record<string, string> | null) => { if (!l) return null; const { text, ...rest } = l; return { ...rest, length: (text ?? '').length }; };
    return { id: ch.id, refKey: ch.refKey, kind: ch.kind, publishedOn: ch.publishedOn, createdAt: ch.createdAt, updatedAt: ch.updatedAt, de: short(ch.de), en: short(ch.en) };
  };

  /* ---- chapter drafts (as server/src/routes-drafts.ts: leaders only) ---- */
  const draftView = (d: FakeDraft) => ({
    id: d.id, refKey: d.refKey, kind: d.kind, lang: d.lang, title: d.title, label: d.label, icDate: d.icDate, place: d.place, victor: d.victor, text: d.text,
    createdBy: d.createdBy, createdAt: d.createdAt, updatedAt: d.updatedAt, seq: d.seq,
  });
  const draftsOf = (cid: string) => [...s.drafts.values()].filter((d) => d.campaignId === cid && d.status === 'draft' && !d.deleted);
  const draftsSeq = (cid: string) => Math.max(0, ...[...s.drafts.values()].filter((d) => d.campaignId === cid).map((d) => d.seq));
  /** A leader brought a draft in earlier (or on another device). */
  const draftFrom = (campaignId: string, x: { title: string; text: string; refKey?: string; kind?: string; lang?: 'de' | 'en'; label?: string; by?: string }) => {
    const d: FakeDraft = {
      id: `${String(s.drafts.size + 1).padStart(8, '0')}-7777-4000-8000-000000000000`, campaignId, refKey: x.refKey ?? 'battle-1', kind: x.kind ?? 'battle', lang: x.lang ?? 'de',
      title: x.title, label: x.label ?? '', icDate: '', place: '', victor: '', text: x.text, status: 'draft', createdBy: x.by ?? 'Anna', createdAt: at(), updatedAt: at(), seq: next(),
    };
    s.drafts.set(d.id, d);
    return draftView(d);
  };
  const draftRoutes = (c: FakeCampaign, role: FakeRole, method: string, rest: string, body: Record<string, unknown>): Response => {
    if (role !== 'leader') return json(403, { error: 'forbidden' });
    if (method === 'GET' && rest === '/chapter-drafts') return json(200, { drafts: draftsOf(c.id).sort((x, y) => y.seq - x.seq).map(draftView), seq: draftsSeq(c.id) });
    const m = rest.match(/^\/chapter-drafts\/([^/]+)(\/publish)?$/);
    if (!m) return json(404, { error: 'not_found' });
    const cur = s.drafts.get(m[1]!);
    if (cur && cur.campaignId !== c.id) return json(409, { error: 'exists' });
    if (method === 'PUT' && !m[2]) {
      if (typeof body.title !== 'string' || !body.title.trim() || typeof body.text !== 'string' || !body.text || body.text.length > 200_000) return json(400, { error: 'invalid', problem: 'not a chapter draft (title or text)' });
      if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(String(body.refKey)) || !['de', 'en'].includes(String(body.lang))) return json(400, { error: 'invalid', problem: 'not a chapter draft (refKey or lang)' });
      const fields = { refKey: String(body.refKey), kind: String(body.kind), lang: body.lang as 'de' | 'en', title: String(body.title).trim(), label: String(body.label ?? ''), icDate: String(body.icDate ?? ''), place: String(body.place ?? ''), victor: String(body.victor ?? ''), text: body.text };
      if (!cur) {
        if (draftsOf(c.id).length >= 100) return json(409, { error: 'full' });
        const d: FakeDraft = { id: m[1]!, campaignId: c.id, ...fields, status: 'draft', createdBy: me.displayName, createdAt: at(), updatedAt: at(), seq: next() };
        s.drafts.set(d.id, d);
        return json(200, { draft: draftView(d), seq: draftsSeq(c.id) });
      }
      if (cur.deleted || cur.status === 'published') return json(409, { error: cur.deleted ? 'removed' : 'published' });
      if (Object.entries(fields).every(([k, v]) => (cur as unknown as Record<string, unknown>)[k] === v)) return json(200, { draft: draftView(cur), seq: draftsSeq(c.id) });
      if (cur.seq !== Number(body.baseSeq ?? 0)) return json(409, { error: 'stale', current: draftView(cur) });
      Object.assign(cur, fields, { updatedAt: at(), seq: next() });
      return json(200, { draft: draftView(cur), seq: draftsSeq(c.id) });
    }
    if (!cur || cur.deleted) return json(404, { error: 'not_found' });
    if (method === 'DELETE' && !m[2]) {
      if (cur.status === 'published') return json(409, { error: 'published' });
      cur.deleted = true;
      cur.seq = next();
      return json(200, { removed: true, seq: draftsSeq(c.id) });
    }
    if (method === 'POST' && m[2]) {
      const lang = { label: cur.label, title: cur.title, icDate: cur.icDate, place: cur.place, victor: cur.victor, text: cur.text };
      const there = [...s.chapters.values()].find((ch) => ch.campaignId === c.id && ch.refKey === cur.refKey && !ch.deleted);
      const place = body.at as { segment: string; pos: string } | undefined;
      if (!there && !place) return json(400, { error: 'invalid', problem: 'a new chapter needs its place in the story' });
      const ch: FakeChapter = there ?? { id: cur.id, campaignId: c.id, refKey: cur.refKey, kind: cur.kind, publishedOn: (body.publishedOn as string | null) ?? at().slice(0, 10), createdAt: at(), updatedAt: at(), de: null, en: null };
      ch[cur.lang] = lang;
      ch.updatedAt = at();
      s.chapters.set(ch.id, ch);
      if (place) s.positions.set(`chapter:${ch.id}`, { campaignId: c.id, itemType: 'chapter', itemId: ch.id, segment: place.segment, pos: place.pos, movedBy: me.id, movedAt: at() });
      Object.assign(cur, { status: 'published' as const, seq: next() });
      return json(200, { chapter: chapterSummary(ch), seq: draftsSeq(c.id) });
    }
    return json(404, { error: 'not_found' });
  };

  /* ---- the timeline (as server/src/timeline.ts gives it) ---- */
  const timelineRoutes = (c: FakeCampaign, role: FakeRole, method: string, rest: string, body: Record<string, unknown>): Response | null => {
    const battles = [...s.battles.values()].filter((b) => b.campaignId === c.id);
    const visible = (type: string, id: string) => {
      if (type === 'note') { const n = s.notes.get(id); return n && n.campaignId === c.id ? noteFor(n, role) : null; }
      if (type === 'picture') { const p = s.pictures.get(id); return p && p.campaignId === c.id && pictureFor(p, role) ? p : null; }
      if (type === 'chapter') { const ch = s.chapters.get(id); return ch && ch.campaignId === c.id && !ch.deleted ? {} : null; }
      return battles.flatMap((b) => b.entries).find((e) => e.id === id && !e.deleted) ?? null;
    };
    const summary = chapterSummary;
    const chapters = [...s.chapters.values()].filter((ch) => ch.campaignId === c.id && !ch.deleted);
    const cm = rest.match(/^\/chapters\/([^/]+)$/);
    if (cm) {
      const ch = s.chapters.get(cm[1]!);
      if (method === 'GET') return ch && ch.campaignId === c.id && !ch.deleted ? json(200, { chapter: { ...summary(ch), de: ch.de, en: ch.en } }) : json(404, { error: 'not_found' });
      if (role !== 'leader') return json(403, { error: 'forbidden' });
      if (method === 'DELETE') {
        if (!ch || ch.deleted) return json(404, { error: 'not_found' });
        ch.deleted = true;
        s.positions.delete(`chapter:${ch.id}`);
        return json(200, { removed: true });
      }
      if (chapters.some((x) => x.refKey === body.refKey && x.id !== cm[1])) return json(409, { error: 'exists' });
      const place = body.place as { segment: string; pos: string } | undefined;
      if (!ch && !place) return json(400, { error: 'invalid', problem: 'a new chapter needs its place in the story' });
      const next: FakeChapter = {
        id: cm[1]!, campaignId: c.id, refKey: String(body.refKey), kind: String(body.kind), publishedOn: (body.publishedOn as string | null) ?? null,
        createdAt: ch?.createdAt ?? at(), updatedAt: at(), de: (body.de as Record<string, string> | null) ?? null, en: (body.en as Record<string, string> | null) ?? null,
      };
      s.seq++;
      s.chapters.set(next.id, next);
      if (place) s.positions.set(`chapter:${next.id}`, { campaignId: c.id, itemType: 'chapter', itemId: next.id, segment: place.segment, pos: place.pos, movedBy: me.id, movedAt: at() });
      return json(200, { chapter: summary(next) });
    }
    if (method === 'GET' && rest === '/timeline') {
      return json(200, {
        positions: [...s.positions.values()].filter((p) => p.campaignId === c.id && visible(p.itemType, p.itemId)).map((p) => ({ itemType: p.itemType, itemId: p.itemId, segment: p.segment, pos: p.pos, movedBy: p.movedBy, movedAt: p.movedAt })),
        entries: battles.flatMap((b) => b.entries.filter((e) => !e.deleted).map((e) => ({ id: e.id, battleId: b.id, turn: e.turn, kind: e.kind, payload: e.payload, author: e.author, createdAt: e.createdAt }))),
        outcomes: battles.flatMap((b) => b.participants.map((p) => ({ battleId: b.id, warbandId: p.warbandId, name: nameOf(p.warbandId)?.name ?? '', outcome: p.outcome }))),
        marks: c.enrolments.flatMap((e) => (e.tags ?? []).filter((t) => !t.supersededBy).map((t) => ({ id: t.id, warbandId: e.warbandId, warband: e.name, kind: t.kind, round: t.round, battleId: t.battleId, rev: t.rev, changes: t.changes?.length ?? 0, unexplained: t.changes?.filter((x) => x.unexplained).length ?? 0, createdAt: t.createdAt }))),
        chapters: chapters.sort((x, y) => (x.publishedOn ?? '').localeCompare(y.publishedOn ?? '')).map(summary),
      });
    }
    const m = rest.match(/^\/timeline\/(note|picture|entry|chapter)\/([^/]+)$/);
    if (!m || method !== 'PUT') return null;
    if (role === 'viewer') return json(403, { error: 'forbidden' });
    const block = visible(m[1]!, m[2]!) as { authorId?: string; uploaderId?: string } | null;
    if (!block) return json(404, { error: 'not_found' });
    const owner = block.authorId ?? block.uploaderId ?? null;
    if (owner !== me.id && role !== 'leader') return json(403, { error: 'forbidden' });
    const position = { itemType: m[1]!, itemId: m[2]!, segment: String(body.segment), pos: String(body.pos), movedBy: me.id, movedAt: at() };
    s.positions.set(`${m[1]}:${m[2]}`, { campaignId: c.id, ...position });
    return json(200, { position });
  };

  const battleRoutes = (c: FakeCampaign, role: FakeRole, method: string, rest: string, query: URLSearchParams, body: Record<string, unknown>): Response | null => {
    const lead = role === 'leader';
    if (rest === '/battles') {
      if (method === 'GET') return json(200, { battles: [...s.battles.values()].filter((b) => b.campaignId === c.id).map(battleSummary) });
      if (method === 'POST') {
        if (!lead) return json(403, { error: 'forbidden' });
        const id = String(body.id);
        const there = s.battles.get(id);
        if (there) return json(200, battleView(there));
        const ws = (body.warbandIds as string[] | undefined) ?? [];
        if (!ws.length) return json(400, { error: 'invalid', problem: 'a battle needs a warband that fought it' });
        const round = body.round === undefined ? c.round + 1 : Number(body.round);
        const h = Math.max(0, ...[...s.battles.values()].filter((x) => x.campaignId === c.id && x.takenOver).map((x) => x.round));
        if (round <= h) return json(400, { error: 'invalid', problem: `round ${round} was played before the app (its history ends with battle ${h})` });
        // a number beyond the next: the campaign comes to the round before it (server/src/aftermath.ts comeToRound)
        if (round - 1 > c.round) c.round = round - 1;
        const b = addBattle(c.id, { title: String(body.title ?? ''), warbandIds: ws, round });
        s.battles.delete(b.id);
        b.id = id;
        b.district = String(body.district ?? '');
        s.battles.set(id, b);
        return json(201, battleView(b));
      }
    }
    const m = rest.match(/^\/battles\/([^/]+)(\/.*)?$/);
    if (!m) return null;
    const b = s.battles.get(m[1]!);
    if (!b || b.campaignId !== c.id) return json(404, { error: 'not_found' });
    const sub = m[2] ?? '';
    if (method === 'GET' && sub === '') {
      const since = query.get('since');
      return since !== null && Number(since) >= b.seq ? json(200, { unchanged: true, seq: b.seq }) : json(200, battleView(b));
    }
    let x: RegExpMatchArray | null;
    if (method === 'PUT' && (x = sub.match(/^\/proposals\/([^/]+)$/))) {
      if (role === 'viewer') return json(403, { error: 'forbidden' });
      const cur = b.proposals.find((p) => p.id === x![1]);
      if (cur) { if (cur.status !== 'open') return json(409, { error: 'decided' }); cur.payload = { text: String(body.text) }; }
      else b.proposals.push({ id: x[1]!, targetType: body.entryId ? 'protocol_entry' : 'battle', targetId: String(body.entryId ?? b.id), authorId: me.id, author: me.displayName, payload: { text: String(body.text) }, status: 'open', decidedBy: null, createdAt: at() });
      b.seq = next();
      return json(200, { ok: true, seq: b.seq });
    }
    if (method === 'POST' && sub === '/confirm') {
      if (role === 'viewer') return json(403, { error: 'forbidden' });
      const wid = String(body.warbandId);
      const e = c.enrolments.find((q) => q.warbandId === wid);
      if (!e || (e.playerId !== me.id && role !== 'leader')) return json(403, { error: 'forbidden' });
      if (b.status !== 'open') return json(409, { error: 'closed' });
      const part = b.participants.find((p) => p.warbandId === wid);
      if (!part) return json(400, { error: 'invalid', problem: 'this warband does not fight the battle' });
      // a warband another player entered here has only its entered data (version 1)
      const w = s.warbands.get(wid);
      const v = w ? w.versions.find((q) => q.rev === Number(body.rev)) : Number(body.rev) === 1 ? { rev: 1, data: e.data } : undefined;
      if (!v) return json(404, { error: 'not_found' });
      part.confirm = { rev: v.rev, by: me.displayName, at: at(), totals: totalsOf(v.data) };
      b.seq = next();
      return json(200, battleView(b));
    }
    if (method === 'POST' && sub === '/marks') {
      if (role === 'viewer') return json(403, { error: 'forbidden' });
      const w = s.warbands.get(String(body.warbandId));
      if (!w) return json(403, { error: 'forbidden' });
      if (b.status !== 'closed') return json(409, { error: 'open', problem: 'a battle is marked once it is closed' });
      const e = c.enrolments.find((q) => q.warbandId === w.id);
      if (!e || !b.participants.some((p) => p.warbandId === w.id)) return json(400, { error: 'invalid', problem: 'this warband did not fight the battle' });
      const v = w.versions.find((q) => q.rev === Number(body.rev));
      if (!v) return json(404, { error: 'not_found' });
      const confirmedRev = b.participants.find((p) => p.warbandId === w.id)?.confirm?.rev;
      if (confirmedRev !== undefined && v.rev < confirmedRev) return json(409, { error: 'older' });
      const before = [...(e.tags ?? [])].reverse().find((t) => !t.supersededBy && t.round < b.round);
      if (!before) return json(409, { error: 'no_start' });
      const changes = opts.changes?.(w.versions.find((q) => q.rev === before.rev)!.data, v.data, { id: b.id, round: b.round }) ?? [];
      const tag: FakeTag = { id: `tag-${b.id}-${w.id}-${next()}`, kind: 'after_battle', rev: v.rev, round: b.round, battleId: b.id, totals: totalsOf(v.data), createdBy: me.displayName, createdAt: at(), changes };
      for (const t of e.tags ?? []) if (t.battleId === b.id && t.kind === 'after_battle' && !t.supersededBy) t.supersededBy = tag.id;
      e.tags = [...(e.tags ?? []), tag];
      e.tag = tag;
      b.seq = next();
      return json(200, { tag: publicTag(tag), changes });
    }
    if (!lead) return json(403, { error: 'forbidden' });
    if (method === 'POST' && sub === '/close') {
      if (b.status !== 'closed') { b.status = 'closed'; b.closedAt = at(); b.seq = next(); }
      return json(200, battleView(b));
    }
    if (b.status === 'closed') return json(409, { error: 'closed' });
    if (method === 'DELETE' && sub === '') {
      // what is written for it holds it back, unless the leader takes it out with it (?content=1; server/src/battles.ts)
      const written = [...s.notes.values()].filter((n) => n.battleId === b.id && !n.deleted);
      if (written.length && query.get('content') !== '1') return json(409, { error: 'in_use', problem: 'notes, pictures or other things of the campaign belong to this battle' });
      for (const n of written) { n.deleted = true; n.text = ''; n.battleId = null; n.seq = next(); }
      s.battles.delete(b.id);
      return json(200, { removed: true });
    }
    if (method === 'PATCH' && sub === '') {
      if (body.turn !== undefined) b.turn = Number(body.turn);
      if (body.title !== undefined) b.title = String(body.title);
      for (const [w, o] of Object.entries((body.outcomes as Record<string, string> | undefined) ?? {})) {
        const p = b.participants.find((q) => q.warbandId === w);
        if (!p) return json(400, { error: 'invalid', problem: 'an outcome for a warband that did not fight' });
        p.outcome = o;
      }
      b.seq = next();
      return json(200, battleView(b));
    }
    if ((x = sub.match(/^\/protocol\/([^/]+)$/))) {
      const cur = b.entries.find((e) => e.id === x![1]);
      if (method === 'PUT') {
        if (cur?.deleted) return json(409, { error: 'removed' });
        const e = { turn: Number(body.turn), kind: body.kind as FakeEntry['kind'], payload: body.payload };
        if (cur) Object.assign(cur, e, { updatedAt: at() });
        else b.entries.push({ id: x[1]!, ...e, author: me.displayName, createdAt: at(), updatedAt: at() });
        b.seq = next();
        return json(200, { entry: battleView(b).entries.find((q) => q.id === x![1]), seq: b.seq });
      }
      if (method === 'DELETE') {
        const removed = !!cur && !cur.deleted;
        if (cur) cur.deleted = true;
        b.seq = next();
        return json(200, { removed, seq: b.seq });
      }
    }
    if (method === 'POST' && (x = sub.match(/^\/proposals\/([^/]+)\/(accept|reject)$/))) {
      const p = b.proposals.find((q) => q.id === x![1]);
      if (!p) return json(404, { error: 'not_found' });
      if (p.status !== 'open') return json(409, { error: 'decided' });
      p.status = x[2] === 'accept' ? 'accepted' : 'rejected';
      p.decidedBy = me.displayName;
      b.seq = next();
      return json(200, battleView(b));
    }
    return json(404, { error: 'not_found' });
  };
  const dataOf = (e: FakeEnrolment) => {
    const w = s.warbands.get(e.warbandId);
    return w ? w.versions.find((v) => v.rev === w.headRev)!.data : e.data;
  };
  const confirm = (c: FakeCampaign, e: FakeEnrolment) => {
    e.status = 'active';
    e.fromRound = c.round;
    e.confirmedAt = at();
    const w = s.warbands.get(e.warbandId);
    e.tag = { id: `tag-${e.id}`, kind: 'start', rev: w?.headRev ?? 1, round: c.round, battleId: null, totals: totalsOf(dataOf(e)), createdBy: me.displayName, createdAt: at() };
    e.tags = [e.tag];
    if (w) w.seq = next();
  };
  const leave = (c: FakeCampaign, e: FakeEnrolment) => {
    c.enrolments = c.enrolments.filter((x) => x !== e);
    const w = s.warbands.get(e.warbandId);
    if (w) { w.campaignId = null; w.seq = next(); }
  };
  /** A campaign the signed-in user is part of, with other players' warbands entered. */
  const addCampaign = (c: { name: string; place?: string; vanilla?: boolean; opening?: string; role?: FakeRole; round?: number; others?: { player: string; data: unknown; role?: FakeRole; pending?: boolean }[] }) => {
    const id = `campaign-${s.campaigns.size + 1}`;
    const camp: FakeCampaign = { id, name: c.name, ...(c.place ? { place: c.place } : {}), vanilla: !!c.vanilla, ...(c.opening ? { opening: c.opening } : {}), round: c.round ?? 0, createdAt: at(), members: [{ userId: me.id, username: me.username, displayName: me.displayName, role: c.role ?? 'leader' }], enrolments: [] };
    for (const [i, o] of (c.others ?? []).entries()) {
      const userId = `user-${o.player.toLowerCase()}`;
      if (!camp.members.some((m) => m.userId === userId)) camp.members.push({ userId, username: o.player.toLowerCase(), displayName: o.player, role: o.role ?? 'player' });
      const d = o.data as { name?: string; wb?: string };
      const e: FakeEnrolment = { id: `${id}-e${i + 1}`, warbandId: `${id}-w${i + 1}`, playerId: userId, player: o.player, status: 'pending', fromRound: null, createdAt: at(), confirmedAt: null, name: d.name ?? '', wbType: String(d.wb), tag: null, data: o.data };
      camp.enrolments.push(e);
      if (!o.pending) confirm(camp, e);
    }
    s.campaigns.set(id, camp);
    return camp;
  };

  const campaignRoutes = (method: string, path: string, query: URLSearchParams, body: Record<string, unknown>): Response | null => {
    if (path === '/campaigns') {
      if (method === 'GET') {
        return json(200, { campaigns: [...s.campaigns.values()].filter((c) => roleOf(c)).map((c) => ({ id: c.id, name: c.name, round: c.round, role: roleOf(c), members: c.members.length, warbands: c.enrolments.filter((e) => e.status === 'active').length, createdAt: c.createdAt, archived: (c.archivedBy ?? []).includes(me.id) })) });
      }
      if (method === 'POST') {
        const name = String(body.name ?? '').trim().replace(/\s+/g, ' ');
        if (!name) return json(400, { error: 'invalid', problem: 'a campaign needs a name' });
        const place = String(body.place ?? '');
        if (!/^[a-z0-9-]*$/.test(place)) return json(400, { error: 'invalid' });
        return json(201, view(addCampaign({ name, place, vanilla: body.vanilla === true })));
      }
    }
    const m = path.match(/^\/campaigns\/([^/]+)(\/.*)?$/);
    if (!m) return null;
    const c = s.campaigns.get(m[1]!);
    const role = c ? roleOf(c) : null;
    if (!c || !role) return json(404, { error: 'not_found' });
    const rest = m[2] ?? '';
    const lead = role === 'leader';
    const forbidden = json(403, { error: 'forbidden' });
    if (method === 'PUT' && rest === '/opening') {
      if (!lead) return forbidden;
      const text = String(body.text ?? '').trim();
      if (text.length > 4000) return json(400, { error: 'invalid' });
      c.opening = text;
      return json(200, view(c));
    }
    if (method === 'PUT' && rest === '/vanilla') {
      if (!lead) return forbidden;
      if (body.vanilla === true && !c.vanilla) return json(409, { error: 'conflict', problem: 'a running campaign cannot be turned to Vanilla Mordheim: it is chosen when the campaign starts' });
      if (body.vanilla !== true) c.vanilla = false;
      return json(200, view(c));
    }
    if (rest.startsWith('/battles')) return battleRoutes(c, role, method, rest, query, body);
    if (rest.startsWith('/background')) return backgroundRoutes(c, role, method, rest, query, body);
    if (rest.startsWith('/questions')) return questionRoutes(c, role, method, rest, body);
    if (rest.startsWith('/world')) return worldRoutes(c, role, method, rest, body);
    if (rest.startsWith('/scenarios')) return scenarioRoutes(c, role, method, rest, body);
    if (rest.startsWith('/style')) return styleRoutes(c, role, method, rest, body);
    if (rest.startsWith('/backstory')) return backstoryRoutes(c, role, method, rest, body);
    if (rest.startsWith('/plans')) return planRoutes(c, role, method, rest, body);
    if (rest.startsWith('/opponents')) return opponentRoutes(c, role, method, rest, body);
    if (rest.startsWith('/npc-warbands')) return npcRoutes(c, role, method, rest, body);
    if (rest.startsWith('/chapter-drafts')) return draftRoutes(c, role, method, rest, body);
    if (rest.startsWith('/notes')) return noteRoutes(c, role, method, rest, query, body);
    if (rest.startsWith('/attachments')) return pictureRoutes(c, role, method, rest, query, body);
    if (rest.startsWith('/timeline') || rest.startsWith('/chapters')) return timelineRoutes(c, role, method, rest, body);
    // what the others have by now: the yardstick of a warband that joins late (server/src/campaigns.ts catchUpPeers)
    if (method === 'GET' && rest === '/catchup') {
      const peers = c.enrolments.filter((e) => e.status === 'active' && e.tag).map((e) => ({
        rating: e.tag!.totals.rating, value: e.tag!.totals.spent + e.tag!.totals.gold,
        battles: [...s.battles.values()].filter((b) => b.campaignId === c.id && b.status === 'closed' && b.participants.some((p) => p.warbandId === e.warbandId)).length,
      }));
      return json(200, { peers, round: c.round });
    }
    if (method === 'GET' && rest === '') return json(200, view(c));
    // a leader deletes it by its name: gone for everyone, the warbands free again (server/src/campaigns.ts deleteCampaign)
    if (method === 'DELETE' && rest === '') {
      if (!lead) return forbidden;
      if (String(body.name ?? '').trim().replace(/\s+/g, ' ') !== c.name) return json(400, { error: 'invalid', problem: 'type the name of the campaign to delete it' });
      for (const e of c.enrolments) {
        const w = s.warbands.get(e.warbandId);
        if (w && w.campaignId === c.id) { w.campaignId = null; w.seq = next(); }
      }
      s.campaigns.delete(c.id);
      return json(200, { deleted: true });
    }
    // every member files it away in their own list
    if (method === 'PUT' && rest === '/archive') {
      const archived = body.archived === true;
      c.archivedBy = [...(c.archivedBy ?? []).filter((u) => u !== me.id), ...(archived ? [me.id] : [])];
      return json(200, { archived });
    }
    let x0: RegExpMatchArray | null;
    if (method === 'POST' && rest === '/rounds/advance') {
      if (!lead) return forbidden;
      const nextRound = c.round + 1;
      const battles = [...s.battles.values()].filter((b) => b.campaignId === c.id && b.round === nextRound);
      if (!battles.length) return json(409, { error: 'no_battle', problem: `no battle of round ${nextRound} yet` });
      if (battles.some((b) => b.status !== 'closed')) return json(409, { error: 'open', problem: `a battle of round ${nextRound} is still open` });
      const fought = new Set(battles.flatMap((b) => b.participants.map((p) => p.warbandId)));
      for (const e of c.enrolments.filter((q) => q.status === 'active' && !fought.has(q.warbandId))) {
        const w = s.warbands.get(e.warbandId);
        const t: FakeTag = { id: `tag-sat-${e.id}-${nextRound}`, kind: 'sat_out', rev: w?.headRev ?? 1, round: nextRound, battleId: null, totals: totalsOf(dataOf(e)), createdBy: me.displayName, createdAt: at() };
        e.tags = [...(e.tags ?? []), t];
        e.tag = t;
      }
      c.round = nextRound;
      return json(200, view(c));
    }
    if (method === 'PATCH' && rest === '') { if (!lead) return forbidden; c.name = String(body.name).trim(); return json(200, view(c)); }
    if ((x0 = rest.match(/^\/history\/([^/]+)$/))) {
      if (!lead) return forbidden;
      if (method === 'PUT') {
        const r = pastBattle(c.id, { ...(body as { round: number; outcomes: Record<string, string> }), id: x0[1]! });
        return typeof r === 'string' ? json(409, { error: r }) : json(200, view(c));
      }
      if (method === 'DELETE') {
        if ([...s.battles.values()].some((b) => b.campaignId === c.id && !b.takenOver)) return json(409, { error: 'history_closed' });
        const written = [...s.notes.values()].filter((n) => n.battleId === x0![1] && !n.deleted);
        if (written.length && query.get('content') !== '1') return json(409, { error: 'in_use', problem: 'notes or pictures belong to this battle' });
        for (const n of written) { n.deleted = true; n.text = ''; n.battleId = null; n.seq = next(); }
        s.battles.delete(x0[1]!);
        followHistory(c);
        return json(200, view(c));
      }
    }
    if (method === 'PUT' && rest === '/house-rules') {
      if (!lead) return forbidden;
      c.houseRules = { ...effectiveHouse(body.rules), showRarity: false } as unknown as Record<string, unknown>;
      return json(200, view(c));
    }
    let x: RegExpMatchArray | null;
    if ((x = rest.match(/^\/members\/([^/]+)$/))) {
      if (!lead) return forbidden;
      const userId = x[1]!;
      const leaders = c.members.filter((p) => p.role === 'leader').length;
      const cur = c.members.find((p) => p.userId === userId);
      if (method === 'PUT') {
        const r = body.role as FakeRole;
        if (cur?.role === 'leader' && r !== 'leader' && leaders <= 1) return json(409, { error: 'last_leader' });
        if (cur) cur.role = r;
        else {
          const p = s.people.find((q) => q.id === userId);
          if (!p) return json(400, { error: 'invalid', problem: 'no such player' });
          c.members.push({ ...p, userId: p.id, role: r });
        }
        return json(200, view(c));
      }
      if (method === 'DELETE') {
        if (cur?.role === 'leader' && leaders <= 1) return json(409, { error: 'last_leader' });
        c.members = c.members.filter((p) => p.userId !== userId);
        for (const e of c.enrolments.filter((q) => q.playerId === userId)) leave(c, e);
        return json(200, view(c));
      }
    }
    if (method === 'POST' && rest === '/enrolments') {
      if (role === 'viewer') return forbidden;
      const id = String(body.warbandId);
      if (s.warbands.has(id)) return json(409, { error: 'exists' });
      const d = body.data as { name?: string; wb?: string };
      const from = body.copiedFrom as FakeWarband['copiedFrom'] | undefined;
      const own = from && s.warbands.has(from.id) ? from : null;
      const w: FakeWarband = { id, headRev: 1, versions: [{ rev: 1, data: body.data, createdAt: at(), source: own ? 'copy' : 'import', note: `entered in ${c.name}` }], archivedAt: null, seq: next(), draft: null, copiedFrom: own, createdAt: at(), campaignId: c.id };
      s.warbands.set(id, w);
      const e: FakeEnrolment = { id: `${c.id}-e${c.enrolments.length + 1}-${id.slice(0, 4)}`, warbandId: id, playerId: me.id, player: me.displayName, status: 'pending', fromRound: null, createdAt: at(), confirmedAt: null, name: d.name ?? '', wbType: String(d.wb), tag: null };
      c.enrolments.push(e);
      if (lead) confirm(c, e);
      return json(201, { enrolmentId: e.id, warband: meta(w), head: w.versions[0], campaign: view(c) });
    }
    if ((x = rest.match(/^\/enrolments\/([^/]+)(\/confirm|\/decline)?$/))) {
      const e = c.enrolments.find((q) => q.id === x![1]);
      if (!e) return json(404, { error: 'not_found' });
      if (method === 'DELETE') {
        if (role === 'viewer' || (e.playerId !== me.id && !lead)) return forbidden;
        leave(c, e);
        return json(200, view(c));
      }
      if (!lead) return forbidden;
      if (x[2] === '/confirm') { if (e.status === 'pending') confirm(c, e); return json(200, view(c)); }
      if (x[2] === '/decline') { if (e.status !== 'pending') return json(409, { error: 'confirmed' }); leave(c, e); return json(200, view(c)); }
    }
    if (method === 'GET' && (x = rest.match(/^\/warbands\/([^/]+)$/))) {
      const e = c.enrolments.find((q) => q.warbandId === x![1]);
      if (!e) return json(404, { error: 'not_found' });
      const w = s.warbands.get(e.warbandId);
      return json(200, {
        warband: w ? meta(w) : { id: e.warbandId, name: e.name, wbType: e.wbType, headRev: 1, copiedFrom: null, createdAt: e.createdAt, updatedAt: e.createdAt, archivedAt: null, campaignId: c.id },
        player: { id: e.playerId, displayName: e.player }, status: e.status,
        head: { rev: w?.headRev ?? 1, data: dataOf(e), createdAt: e.createdAt, source: 'import', note: '', format: 2, appVersion: '', createdBy: e.player, bytes: 0 },
        draft: w?.draft && w.draft.baseRev === w.headRev ? { data: w.draft.data, updatedAt: w.draft.updatedAt } : null,
        tags: (e.tags ?? []).filter((t) => !t.supersededBy).map((t) => ({ ...publicTag(t), changes: t.changes ?? [] })),
      });
    }
    return json(404, { error: 'not_found' });
  };

  /** Another device saves a version. */
  const versionElsewhere = (id: string, data: unknown) => {
    const w = s.warbands.get(id)!;
    w.headRev++;
    w.versions.push({ rev: w.headRev, data, createdAt: at(), source: 'save' });
    w.draft = null;
    w.seq = next();
  };
  /** Another device of the same user drafts. */
  const draftElsewhere = (id: string, data: unknown, device = 'Laptop') => {
    const w = s.warbands.get(id)!;
    w.draft = { baseRev: w.headRev, data, device, updatedAt: at(), seq: next() };
  };

  /** Another player sends the signed-in user a copy (or makes a code: `code`). */
  const shareFrom = (from: string, data: unknown, code: string | null = null) => {
    const d = data as { name?: string; wb?: string };
    const sh: FakeShare = { id: `share-${s.shares.length + 1}`, name: d.name ?? String(d.wb), wbType: String(d.wb), from, to: code ? null : ME_NAME, toId: code ? null : 'me', code, data, createdAt: at(), expiresAt: shareExpires(), answeredAt: null, accepted: null, uses: 0, revokedAt: null, mine: false };
    s.shares.push(sh);
    return sh;
  };
  const open = (sh: FakeShare) => !sh.revokedAt && (sh.code !== null || sh.answeredAt === null);
  const summary = (x: FakeShare) => ({ id: x.id, name: x.name, wbType: x.wbType, from: x.from, to: x.to, code: x.code !== null, createdAt: x.createdAt, expiresAt: x.expiresAt, answeredAt: x.answeredAt, accepted: x.accepted, uses: x.uses, revokedAt: x.revokedAt });
  const normal = (c: unknown) => String(c).toUpperCase().replace(/[^0-9A-Z]/g, '');
  const byCode = (c: unknown) => s.shares.find((x) => x.code !== null && normal(x.code) === normal(c) && open(x));
  /** The copy becomes a warband of the signed-in user's. */
  const take = (sh: FakeShare, id: string) => {
    if (s.warbands.has(id)) return json(409, { error: 'exists' });
    const w: FakeWarband = { id, headRev: 1, versions: [{ rev: 1, data: sh.data, createdAt: at(), source: 'import', note: `shared by ${sh.from}` }], archivedAt: null, seq: next(), draft: null, copiedFrom: null, createdAt: at() };
    s.warbands.set(id, w);
    sh.uses++;
    if (!sh.code) { sh.answeredAt = at(); sh.accepted = true; }
    return json(201, { warband: meta(w), head: w.versions[0] });
  };

  /* ---- problem reports (4c1) ---- */
  const bugMine = (b: FakeBug) => ({ id: b.id, number: b.number, headline: b.headline, kind: b.kind, title: b.title, text: b.text, sourceRef: b.sourceRef, status: b.status, fixedIn: b.fixedIn, createdAt: b.createdAt, updatedAt: b.updatedAt });
  const bugSummary = (b: FakeBug) => ({
    id: b.id, number: b.number, reporterId: b.reporterId, reporterName: b.reporterName, kind: b.kind, title: b.title, status: b.status, severity: b.severity, area: b.area, headline: b.headline, appVersion: b.appVersion, view: b.view,
    fixedIn: b.fixedIn, consent: b.consent, attached: b.attachment !== null, createdAt: b.createdAt, updatedAt: b.updatedAt,
  });
  const bugDetail = (b: FakeBug) => ({ ...bugSummary(b), text: b.text, sourceRef: b.sourceRef, device: b.device, jsErrors: b.jsErrors, context: b.context, warbandId: b.warbandId, rev: b.rev, attachment: b.attachment });
  const bugFrom = (x: Partial<FakeBug> & { title: string; text: string }): FakeBug => {
    const b: FakeBug = {
      id: `bug-${s.bugs.length + 1}`, number: s.bugs.length + 1, reporterId: 'user-ben', reporterName: 'Ben', kind: 'bug', sourceRef: '', status: 'new', severity: null, area: '', headline: '', fixedIn: '', appVersion: 'abc1234', device: 'Firefox on Android', view: '/warbands/:id',
      context: null, jsErrors: [], warbandId: null, rev: null, consent: false, attachment: null, createdAt: at(), updatedAt: at(), sent: {}, ...x,
    };
    s.bugs.push(b);
    return b;
  };
  const bugRoutes = (method: string, path: string, query: URLSearchParams, body: Record<string, unknown>): Response | null => {
    let m: RegExpMatchArray | null;
    if (method === 'POST' && path === '/bugs') {
      const ex = s.bugs.find((b) => b.id === body.id);
      if (ex) return JSON.stringify(ex.sent) === JSON.stringify(body) ? json(200, { bug: bugMine(ex) }) : json(409, { error: 'exists' });
      if (!['bug', 'wish', 'rules'].includes(String(body.kind)) || !String(body.text ?? '').trim()) return json(400, { error: 'invalid', problem: 'not a report' });
      const attach = body.attach as { warbandId: string; rev: number | null; save: unknown } | null;
      const b = bugFrom({
        id: String(body.id), reporterId: me.id, reporterName: me.displayName, kind: body.kind as FakeBug['kind'], title: String(body.title), text: String(body.text), sourceRef: String(body.sourceRef ?? ''),
        appVersion: String(body.appVersion ?? ''), device: String(body.device ?? ''), view: String(body.view ?? ''), context: body.context ?? null, jsErrors: (body.jsErrors as unknown[]) ?? [],
        warbandId: attach?.warbandId ?? null, rev: attach?.rev ?? null, consent: !!attach, attachment: attach?.save ?? null, sent: body,
      });
      return json(201, { bug: bugMine(b) });
    }
    if (method === 'GET' && path === '/bugs/mine') return json(200, { bugs: s.bugs.filter((b) => b.reporterId === me.id).map(bugMine).reverse() });
    if (method === 'GET' && path === '/bugs') {
      const st = query.get('status') ?? 'open';
      const keep = (b: FakeBug) => st === 'all' || (st === 'open' ? ['new', 'confirmed', 'in_progress'].includes(b.status) : b.status === st);
      return json(200, { bugs: s.bugs.filter(keep).map(bugSummary).reverse() });
    }
    if ((m = path.match(/^\/bugs\/([^/]+)$/))) {
      const b = s.bugs.find((x) => x.id === m![1]);
      if (!b) return json(404, { error: 'not_found' });
      if (method === 'GET') return json(200, { bug: bugDetail(b) });
      if (method === 'PATCH') {
        const next = { ...b, ...(body as Partial<FakeBug>) };
        if (next.status === 'fixed' && !String(next.fixedIn).trim()) return json(400, { error: 'invalid', problem: 'a fixed report names the version it is fixed in' });
        Object.assign(b, body, { updatedAt: at() });
        if (b.status === 'closed' || b.status === 'duplicate') b.attachment = null;
        return json(200, { bug: bugDetail(b) });
      }
    }
    return null;
  };

  const handle = (method: string, path: string, query: URLSearchParams, body: Record<string, unknown>): Response => {
    let m: RegExpMatchArray | null;
    if (path.startsWith('/bugs')) return bugRoutes(method, path, query, body) ?? json(404, { error: 'not_found' });
    if (path.startsWith('/campaigns')) return campaignRoutes(method, path, query, body) ?? json(404, { error: 'not_found' });
    // the Library: the caller's own entries; another person's do not exist (server/src/routes-library.ts)
    if (path === '/library' && method === 'GET') {
      const since = Number(query.get('since') ?? 0);
      const mine = [...s.library.values()].filter((x) => x.owner === me.id).sort((a, b) => a.seq - b.seq);
      return json(200, { items: mine.filter((x) => x.seq > since).map(libraryView), seq: mine.at(-1)?.seq ?? 0 });
    }
    if ((m = /^\/library\/([^/]+)$/.exec(path))) {
      const id = m[1]!;
      const there = s.library.get(id);
      if (method === 'PUT') {
        if (there && there.owner !== me.id) return json(409, { error: 'exists' });
        if (there?.deletedAt) return json(409, { error: 'removed' });
        const b = body as { kind: string; name: string; body: unknown; baseSeq?: number };
        if (!there) {
          const item = { id, owner: me.id, kind: b.kind, name: b.name, body: b.body, createdAt: at(), updatedAt: at(), deletedAt: null, seq: next() };
          s.library.set(id, item);
          return json(201, { item: libraryView(item) });
        }
        if (JSON.stringify(there.body) === JSON.stringify(b.body) && there.name === b.name) return json(200, { item: libraryView(there) });
        if (b.baseSeq !== there.seq) return json(409, { error: 'stale', item: libraryView(there) });
        Object.assign(there, { name: b.name, body: b.body, updatedAt: at(), seq: next() });
        return json(200, { item: libraryView(there) });
      }
      if (method === 'DELETE') {
        if (!there || there.owner !== me.id) return json(404, { error: 'not_found' });
        Object.assign(there, { deletedAt: there.deletedAt ?? at(), seq: next() });
        return json(200, { removed: true });
      }
    }
    if (method === 'GET' && path === '/people') return json(200, { people: s.people });
    if (method === 'GET' && path === '/shares') {
      return json(200, { incoming: s.shares.filter((x) => x.toId === 'me' && open(x)).map(summary), outgoing: s.shares.filter((x) => x.mine).map(summary) });
    }
    if (method === 'POST' && path === '/shares') {
      const d = body.data as { name?: string; wb?: string } | undefined;
      if (!d || typeof d.wb !== 'string') return json(400, { error: 'invalid', problem: 'not a save' });
      const to = body.to ? s.people.find((p) => p.id === body.to) : undefined;
      if (body.to && !to) return json(400, { error: 'invalid', problem: 'no such player to send it to' });
      const code = to ? null : CODES[s.shares.filter((x) => x.code).length % CODES.length]!;
      const sh: FakeShare = { id: `share-${s.shares.length + 1}`, name: d.name || d.wb, wbType: d.wb, from: ME_NAME, to: to?.displayName ?? null, toId: to?.id ?? null, code, data: d, createdAt: at(), expiresAt: shareExpires(), answeredAt: null, accepted: null, uses: 0, revokedAt: null, mine: true };
      s.shares.push(sh);
      return json(201, { id: sh.id, code: code ? `${code.slice(0, 4)}-${code.slice(4)}` : null, expiresAt: sh.expiresAt });
    }
    if (method === 'POST' && (path === '/shares/peek' || path === '/shares/redeem')) {
      const sh = byCode(body.code);
      if (!sh) return json(404, { error: 'unknown_share_code' });
      return path === '/shares/peek' ? json(200, { name: sh.name, wbType: sh.wbType, from: sh.from, expiresAt: sh.expiresAt }) : take(sh, String(body.warbandId));
    }
    if ((m = path.match(/^\/shares\/([^/]+)(\/accept|\/decline)?$/))) {
      const sh = s.shares.find((x) => x.id === m![1]);
      const action = m[2] ?? (method === 'DELETE' ? 'revoke' : '');
      if (!sh || (action === 'revoke' ? !sh.mine : sh.toId !== 'me')) return json(404, { error: 'not_found' });
      if (action === 'revoke') { sh.revokedAt ??= at(); return json(200, { ok: true }); }
      if (!open(sh)) return json(409, { error: 'gone' });
      if (action === '/accept') return take(sh, String(body.warbandId));
      if (action === '/decline') { sh.answeredAt = at(); sh.accepted = false; return json(200, { ok: true }); }
    }
    if (method === 'GET' && path === '/sync') {
      const cursor = Number(query.get('cursor') ?? 0);
      const changed = [...s.warbands.values()].filter((w) => w.seq > cursor || (w.draft?.seq ?? 0) > cursor);
      return json(200, {
        epoch: s.epoch, cursor: s.seq,
        warbands: changed.map((w) => ({ ...meta(w), head: w.archivedAt ? null : w.versions.find((v) => v.rev === w.headRev), draft: w.archivedAt ? null : w.draft })),
      });
    }
    if (method === 'POST' && path === '/warbands') {
      const id = String(body.id);
      const ex = s.warbands.get(id);
      if (ex) return JSON.stringify(ex.versions[0]!.data) === JSON.stringify(body.data) ? json(200, { warband: meta(ex), rev: 1 }) : json(409, { error: 'exists' });
      const w: FakeWarband = { id, headRev: 1, versions: [{ rev: 1, data: body.data, createdAt: at(), source: String(body.source) }], archivedAt: null, seq: next(), draft: null, copiedFrom: (body.copiedFrom as FakeWarband['copiedFrom']) ?? null, createdAt: at() };
      s.warbands.set(id, w);
      return json(201, { warband: meta(w), rev: 1 });
    }
    if ((m = path.match(/^\/warbands\/([^/]+)(\/.*)?$/))) {
      const w = s.warbands.get(m[1]!);
      if (!w) return json(404, { error: 'not_found' });
      const rest = m[2] ?? '';
      if (method === 'GET' && rest === '') return json(200, { warband: meta(w), head: w.versions.find((v) => v.rev === w.headRev), draft: w.draft });
      if (method === 'GET' && rest === '/versions') return json(200, { versions: [...w.versions].reverse().map((v) => ({ rev: v.rev, format: 2, appVersion: '', source: v.source, createdBy: 'kai', createdAt: v.createdAt, note: v.note ?? '', bytes: JSON.stringify(v.data).length })) });
      if (method === 'GET' && rest.startsWith('/versions/')) {
        const v = w.versions.find((x) => x.rev === Number(rest.slice(10)));
        return v ? json(200, { version: { ...v, format: 2, createdBy: 'kai', note: v.note ?? '' } }) : json(404, { error: 'not_found' });
      }
      if (method === 'POST' && rest === '/versions') {
        if (w.archivedAt) return json(409, { error: 'archived' });
        if (body.baseRev !== w.headRev) return json(409, { error: 'stale', headRev: w.headRev });
        w.headRev++;
        w.versions.push({ rev: w.headRev, data: body.data, createdAt: at(), source: String(body.source ?? 'save'), note: String(body.note ?? '') });
        w.draft = null;
        w.seq = next();
        return json(201, { warband: meta(w), rev: w.headRev });
      }
      if (method === 'PUT' && rest === '/autosave') {
        if (w.archivedAt) return json(409, { error: 'archived' });
        if (w.draft && !body.force && w.draft.seq !== (body.afterSeq ?? null)) return json(409, { error: 'draft_conflict', draft: w.draft });
        w.draft = { baseRev: Number(body.baseRev), data: body.data, device: String(body.device ?? ''), updatedAt: at(), seq: next() };
        return json(200, { seq: w.draft.seq });
      }
      if (method === 'DELETE' && rest === '') {
        if (w.campaignId) return json(409, { error: 'enrolled' });
        w.archivedAt = at(); w.seq = next(); return json(200, { warband: meta(w) });
      }
      if (method === 'POST' && rest === '/unarchive') { w.archivedAt = null; w.seq = next(); return json(200, { warband: meta(w) }); }
    }
    return json(404, { error: 'not_found' });
  };

  /** An entry as the server answers: without its owner. */
  const libraryView = (x: typeof s.library extends Map<string, infer V> ? V : never) => ({ id: x.id, kind: x.kind, name: x.name, body: x.body, createdAt: x.createdAt, updatedAt: x.updatedAt, deletedAt: x.deletedAt, seq: x.seq });
  /** An entry in someone's Library (the signed-in user's unless `owner` says otherwise). */
  const libraryFrom = (x: { name: string; body: unknown; kind?: string; owner?: string }) => {
    const item = { id: `lib-${s.library.size + 1}`, owner: x.owner ?? me.id, kind: x.kind ?? 'idea', name: x.name, body: x.body, createdAt: at(), updatedAt: at(), deletedAt: null, seq: next() };
    s.library.set(item.id, item);
    return item;
  };
  return { state: s, handle, libraryFrom, versionElsewhere, draftElsewhere, shareFrom, addCampaign, addBattle, pastBattle, entryElsewhere, noteFrom, pictureFrom, backgroundFrom, questionFrom, factionFrom, npcFrom, reputationFrom, scenarioFrom, styleFrom, backstoryFrom, planFrom, opponentGroupFrom, opponentSkillFrom, draftFrom, bugFrom };
}
