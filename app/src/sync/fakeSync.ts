/* The campaign server's warband endpoints as the sync tests (Vitest and
   Playwright) need them: the
   same rules as server/src/routes-warbands.ts and warbands.ts (versions on
   baseRev, one draft per user with afterSeq, tombstones, sync by seq,
   epoch), in memory, for one signed-in user. Tests can act as "another
   device" by changing the state directly. */
export interface FakeVersion { rev: number; data: unknown; createdAt: string; source: string; note?: string }
export interface FakeWarband {
  id: string; headRev: number; versions: FakeVersion[]; archivedAt: string | null; seq: number;
  draft: { baseRev: number; data: unknown; device: string; updatedAt: string; seq: number } | null;
  copiedFrom: { id: string; rev: number } | null; createdAt: string;
}

export function createFakeSync() {
  const s = {
    epoch: 'epoch-1',
    seq: 0,
    warbands: new Map<string, FakeWarband>(),
    calls: [] as string[],
    /** Answer nothing at all (offline). */
    down: false,
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

  const handle = (method: string, path: string, query: URLSearchParams, body: Record<string, unknown>): Response => {
    let m: RegExpMatchArray | null;
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

  return { state: s, handle, versionElsewhere, draftElsewhere };
}
