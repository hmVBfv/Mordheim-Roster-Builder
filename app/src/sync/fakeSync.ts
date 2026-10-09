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
   districts held). */
import { effectiveHouse, houseDifferences } from '@mordheim/core';
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
export interface FakeBattle {
  id: string; campaignId: string; round: number; title: string; district: string; status: 'open' | 'closed'; turn: number; createdAt: string; seq: number;
  participants: { warbandId: string; outcome: string }[];
  entries: FakeEntry[];
  proposals: FakeProposal[];
  closedAt?: string | null;
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
  houseRules?: Record<string, unknown>;
  members: { userId: string; displayName: string; username: string; role: FakeRole; canLead: boolean }[];
  enrolments: FakeEnrolment[];
}

export interface FakePerson { id: string; username: string; displayName: string }
export interface FakeShare {
  id: string; name: string; wbType: string; from: string; to: string | null; toId: string | null; code: string | null; data: unknown;
  createdAt: string; expiresAt: string; answeredAt: string | null; accepted: boolean | null; uses: number; revokedAt: string | null;
  /** Made by the signed-in user. */
  mine: boolean;
}
const ME_NAME = 'Kai';
const SHARE_EXPIRES = '2026-10-11T12:00:00.000Z';
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
      campaign: { id: c.id, name: c.name, round: c.round, houseRules: c.houseRules ?? {}, createdAt: c.createdAt, updatedAt: c.createdAt },
      role,
      members: c.members.map(({ canLead, ...m }) => ({ ...m, joinedAt: c.createdAt, ...(role === 'leader' ? { canLead } : {}) })),
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
    return { id: b.id, round: b.round, title: b.title, status: b.status, turn: b.turn, warbands: ws.map((w) => w.name), warbandIds: ws.map((w) => w.id), marked: Object.keys(marksOf(b)), createdAt: b.createdAt, closedAt: b.closedAt ?? null };
  };
  /** The marks that stand after a battle, by warband. */
  const marksOf = (b: FakeBattle) => Object.fromEntries([...s.campaigns.values()].flatMap((c) => c.enrolments).flatMap((e) => (e.tags ?? [])
    .filter((t) => t.battleId === b.id && t.kind === 'after_battle' && !t.supersededBy)
    .map((t) => [e.warbandId, { tagId: t.id, rev: t.rev, totals: t.totals, changes: t.changes?.length ?? 0, unexplained: t.changes?.filter((x) => x.unexplained).length ?? 0, createdAt: t.createdAt }])));
  const battleView = (b: FakeBattle) => ({
    battle: { id: b.id, campaignId: b.campaignId, round: b.round, title: b.title, scenario: '', district: b.district, status: b.status, turn: b.turn, createdAt: b.createdAt, updatedAt: b.createdAt, closedAt: b.closedAt ?? null },
    seq: b.seq,
    participants: b.participants.map((p) => {
      const e = nameOf(p.warbandId)!;
      return { warbandId: p.warbandId, name: e.name, wbType: e.wbType, wbName: opts.wbName?.(e.wbType) ?? e.wbType, playerId: e.playerId, player: e.player, outcome: p.outcome, revBefore: 1 };
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
        const b = addBattle(c.id, { title: String(body.title ?? ''), warbandIds: ws });
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
    if (method === 'POST' && sub === '/marks') {
      if (role === 'viewer') return json(403, { error: 'forbidden' });
      const w = s.warbands.get(String(body.warbandId));
      if (!w) return json(403, { error: 'forbidden' });
      if (b.status !== 'closed') return json(409, { error: 'open', problem: 'a battle is marked once it is closed' });
      const e = c.enrolments.find((q) => q.warbandId === w.id);
      if (!e || !b.participants.some((p) => p.warbandId === w.id)) return json(400, { error: 'invalid', problem: 'this warband did not fight the battle' });
      const v = w.versions.find((q) => q.rev === Number(body.rev));
      if (!v) return json(404, { error: 'not_found' });
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
  const addCampaign = (c: { name: string; role?: FakeRole; round?: number; others?: { player: string; data: unknown; role?: FakeRole; pending?: boolean }[] }) => {
    const id = `campaign-${s.campaigns.size + 1}`;
    const camp: FakeCampaign = { id, name: c.name, round: c.round ?? 0, createdAt: at(), members: [{ userId: me.id, username: me.username, displayName: me.displayName, role: c.role ?? 'leader', canLead: true }], enrolments: [] };
    for (const [i, o] of (c.others ?? []).entries()) {
      const userId = `user-${o.player.toLowerCase()}`;
      if (!camp.members.some((m) => m.userId === userId)) camp.members.push({ userId, username: o.player.toLowerCase(), displayName: o.player, role: o.role ?? 'player', canLead: false });
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
        return json(200, { campaigns: [...s.campaigns.values()].filter((c) => roleOf(c)).map((c) => ({ id: c.id, name: c.name, round: c.round, role: roleOf(c), members: c.members.length, warbands: c.enrolments.filter((e) => e.status === 'active').length, createdAt: c.createdAt })) });
      }
      if (method === 'POST') {
        const name = String(body.name ?? '').trim().replace(/\s+/g, ' ');
        if (!name) return json(400, { error: 'invalid', problem: 'a campaign needs a name' });
        return json(201, view(addCampaign({ name })));
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
    if (rest.startsWith('/battles')) return battleRoutes(c, role, method, rest, query, body);
    if (rest.startsWith('/notes')) return noteRoutes(c, role, method, rest, query, body);
    if (method === 'GET' && rest === '') return json(200, view(c));
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
          c.members.push({ ...p, userId: p.id, role: r, canLead: false });
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
    const sh: FakeShare = { id: `share-${s.shares.length + 1}`, name: d.name ?? String(d.wb), wbType: String(d.wb), from, to: code ? null : ME_NAME, toId: code ? null : 'me', code, data, createdAt: at(), expiresAt: SHARE_EXPIRES, answeredAt: null, accepted: null, uses: 0, revokedAt: null, mine: false };
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

  const handle = (method: string, path: string, query: URLSearchParams, body: Record<string, unknown>): Response => {
    let m: RegExpMatchArray | null;
    if (path.startsWith('/campaigns')) return campaignRoutes(method, path, query, body) ?? json(404, { error: 'not_found' });
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
      const sh: FakeShare = { id: `share-${s.shares.length + 1}`, name: d.name || d.wb, wbType: d.wb, from: ME_NAME, to: to?.displayName ?? null, toId: to?.id ?? null, code, data: d, createdAt: at(), expiresAt: SHARE_EXPIRES, answeredAt: null, accepted: null, uses: 0, revokedAt: null, mine: true };
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

  return { state: s, handle, versionElsewhere, draftElsewhere, shareFrom, addCampaign, addBattle, entryElsewhere, noteFrom };
}
