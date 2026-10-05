/* The campaign server's warband endpoints as the sync tests (Vitest and
   Playwright) need them: the
   same rules as server/src/routes-warbands.ts and warbands.ts (versions on
   baseRev, one draft per user with afterSeq, tombstones, sync by seq,
   epoch), in memory, for one signed-in user. Tests can act as "another
   device" by changing the state directly. Sharing as in
   server/src/routes-shares.ts: the others, copies sent, share codes.
   Campaigns as in server/src/routes-campaigns.ts (phase 4a1): members,
   warbands entered (the signed-in user's among the sync's own, the others'
   kept here), a leader's confirmation with the start tag. */
export interface FakeVersion { rev: number; data: unknown; createdAt: string; source: string; note?: string }
export interface FakeWarband {
  id: string; headRev: number; versions: FakeVersion[]; archivedAt: string | null; seq: number;
  draft: { baseRev: number; data: unknown; device: string; updatedAt: string; seq: number } | null;
  copiedFrom: { id: string; rev: number } | null; createdAt: string;
  campaignId?: string | null;
}

export type FakeRole = 'leader' | 'player' | 'viewer';
export interface FakeTotals { rating: number; spent: number; models: number; heroes: number; gold: number; fallen: number }
export interface FakeEnrolment {
  id: string; warbandId: string; playerId: string; player: string; status: 'pending' | 'active'; fromRound: number | null;
  createdAt: string; confirmedAt: string | null; name: string; wbType: string;
  tag: { id: string; kind: 'start'; rev: number; round: number; battleId: null; totals: FakeTotals; createdBy: string; createdAt: string } | null;
  /** Another player's warband: its save, kept here. */
  data?: unknown;
}
export interface FakeCampaign {
  id: string; name: string; round: number; createdAt: string;
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

export function createFakeSync(opts: { me?: { id: string; username: string; displayName: string }; totals?: (save: unknown) => FakeTotals; wbName?: (wb: string) => string } = {}) {
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
      campaign: { id: c.id, name: c.name, round: c.round, houseRules: {}, createdAt: c.createdAt, updatedAt: c.createdAt },
      role,
      members: c.members.map(({ canLead, ...m }) => ({ ...m, joinedAt: c.createdAt, ...(role === 'leader' ? { canLead } : {}) })),
      enrolments: c.enrolments.map((e) => ({
        id: e.id, warbandId: e.warbandId, playerId: e.playerId, player: e.player, status: e.status, fromRound: e.fromRound,
        createdAt: e.createdAt, confirmedAt: e.confirmedAt, name: e.name, wbType: e.wbType, wbName: opts.wbName?.(e.wbType) ?? e.wbType, tag: e.tag,
        headRev: s.warbands.get(e.warbandId)?.headRev ?? 1, updatedAt: c.createdAt,
      })),
    };
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

  const campaignRoutes = (method: string, path: string, body: Record<string, unknown>): Response | null => {
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
    if (method === 'GET' && rest === '') return json(200, view(c));
    if (method === 'PATCH' && rest === '') { if (!lead) return forbidden; c.name = String(body.name).trim(); return json(200, view(c)); }
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
        tags: e.tag ? [e.tag] : [],
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
    if (path.startsWith('/campaigns')) return campaignRoutes(method, path, body) ?? json(404, { error: 'not_found' });
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

  return { state: s, handle, versionElsewhere, draftElsewhere, shareFrom, addCampaign };
}
