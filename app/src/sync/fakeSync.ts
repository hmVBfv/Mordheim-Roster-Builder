/* The campaign server's warband endpoints as the sync tests (Vitest and
   Playwright) need them: the
   same rules as server/src/routes-warbands.ts and warbands.ts (versions on
   baseRev, one draft per user with afterSeq, tombstones, sync by seq,
   epoch), in memory, for one signed-in user. Tests can act as "another
   device" by changing the state directly. Sharing as in
   server/src/routes-shares.ts: the others, copies sent, share codes. */
export interface FakeVersion { rev: number; data: unknown; createdAt: string; source: string; note?: string }
export interface FakeWarband {
  id: string; headRev: number; versions: FakeVersion[]; archivedAt: string | null; seq: number;
  draft: { baseRev: number; data: unknown; device: string; updatedAt: string; seq: number } | null;
  copiedFrom: { id: string; rev: number } | null; createdAt: string;
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

export function createFakeSync() {
  const s = {
    epoch: 'epoch-1',
    seq: 0,
    warbands: new Map<string, FakeWarband>(),
    calls: [] as string[],
    /** Answer nothing at all (offline). */
    down: false,
    people: [{ id: 'user-ben', username: 'ben', displayName: 'Ben' }, { id: 'user-rob', username: 'rob', displayName: 'Rob' }] as FakePerson[],
    shares: [] as FakeShare[],
  };
  const at = () => new Date(Date.UTC(2026, 9, 4, 12, 0, s.seq)).toISOString();
  const next = () => ++s.seq;
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const meta = (w: FakeWarband) => ({ id: w.id, name: '', wbType: '', headRev: w.headRev, copiedFrom: w.copiedFrom, createdAt: w.createdAt, updatedAt: at(), archivedAt: w.archivedAt });

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
      if (method === 'DELETE' && rest === '') { w.archivedAt = at(); w.seq = next(); return json(200, { warband: meta(w) }); }
      if (method === 'POST' && rest === '/unarchive') { w.archivedAt = null; w.seq = next(); return json(200, { warband: meta(w) }); }
    }
    return json(404, { error: 'not_found' });
  };

  return { state: s, handle, versionElsewhere, draftElsewhere, shareFrom };
}
