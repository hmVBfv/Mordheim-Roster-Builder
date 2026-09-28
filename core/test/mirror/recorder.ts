/* The mirror: the legacy tests (test/*.mjs) run unchanged against the legacy
 * app, and every call they make into it is repeated in core, from the state
 * legacy had just before the call (hooks.mjs wraps the legacy modules and
 * sends each call here).
 *
 * An action must leave core where it left legacy (warband, campaign file,
 * form drafts, compared in their canonical form); a query must answer the
 * same; a drawing must show what core's rules say (table.ts). Since each
 * call starts from legacy's own state, whatever the test did in between —
 * set a field by hand, stub a dialog — is part of the input.
 *
 * Whatever a legacy test asserts about a call's result therefore holds for
 * core as well. The findings go to the file named in MIRROR_REPORT, read by
 * legacy-tests.test.ts. */
import { writeFileSync } from 'node:fs';
import * as core from '../../src/index.ts';
import type { WarbandState } from '../../src/index.ts';
import type { Legacy } from '../legacy/loadLegacy.ts';
import { canonOf, cfCanon, data, draftCanon } from '../support/canon.ts';
import { TABLE, type Call, type Io, type Spec, type World } from './table.ts';

type Fn = (...args: unknown[]) => unknown;
type Rec = Record<string, unknown>;

export interface Finding { call: string; n: number; what: string; path: string; core: string; legacy: string }
export interface MirrorReport {
  /** Top-level calls per legacy function. */
  calls: Record<string, number>;
  /** Calls to functions table.ts does not know. */
  unmapped: Record<string, number>;
  /** Calls where legacy threw (core must then leave everything as it was). */
  threw: Record<string, number>;
  findings: Finding[];
  /** All differences, including those beyond the ones kept in `findings`. */
  differences: number;
}

const report: MirrorReport = { calls: {}, unmapped: {}, threw: {}, findings: [], differences: 0 };
const KEEP = 40;

const mods: Record<string, Rec> = {};
export function registerModule(name: string, ns: Rec): void { mods[name] = ns; }
const legacy = (): Legacy => mods as unknown as Legacy;

let depth = 0;

/* ---- comparing ---- */

function copy<T>(x: T): T {
  if (x === undefined || typeof x === 'function') return x;
  try { return structuredClone(x); } catch { return x; }
}

/* JSON-comparable, with object keys sorted: the two sides build their
   objects in different orders. */
function stable(v: unknown): unknown {
  const j = JSON.parse(JSON.stringify([v]) ?? '[null]')[0] as unknown;
  const sort = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(sort);
    if (x && typeof x === 'object') return Object.fromEntries(Object.keys(x).sort().map((k) => [k, sort((x as Rec)[k])]));
    return x;
  };
  return sort(j);
}

function firstDiff(a: unknown, b: unknown, path: string): [string, unknown, unknown] | null {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    for (const k of keys) {
      const d = firstDiff((a as Rec)[k], (b as Rec)[k], `${path}${Array.isArray(a) ? `[${k}]` : `.${k}`}`);
      if (d) return d;
    }
  }
  if (typeof a === 'string' && typeof b === 'string') {
    // where two texts part
    let i = 0;
    while (i < a.length && a[i] === b[i]) i++;
    const from = Math.max(0, i - 60);
    return [`${path || '(text)'} @${i}`, a.slice(from, i + 120), b.slice(from, i + 120)];
  }
  return [path || '(value)', a, b];
}

const short = (v: unknown) => { const s = JSON.stringify(v) ?? 'undefined'; return s.length > 400 ? s.slice(0, 400) + '…' : s; };

function compare(call: string, what: string, coreV: unknown, legacyV: unknown): void {
  const d = firstDiff(stable(coreV), stable(legacyV), '');
  if (!d) return;
  report.differences++;
  if (report.findings.length < KEEP) report.findings.push({ call, n: report.calls[call] ?? 0, what, path: d[0], core: short(d[1]), legacy: short(d[2]) });
}

/* ---- the legacy state as core sees it ---- */

const known = (s: unknown) => { const x = s as WarbandState | null; return !!(x && x.wb && data.WARBANDS[x.wb]); };

function legacyWorld(): World {
  const S = copy(mods.state!.S) as Rec & WarbandState;
  const camp = (S.campaign ?? null) as Rec | null;
  // legacy kept its half-filled forms inside the save; core holds them apart
  const bd = camp?._draft ? copy(camp._draft) as World['bd'] : null;
  const cd = camp?._cas ? copy(camp._cas) as World['cd'] : null;
  if (camp) for (const k of Object.keys(camp)) if (k.startsWith('_')) delete camp[k];
  // legacy's uid counter, which core keeps in the state
  if (Number.isFinite(Number(mods.state!.uid))) S.uidSeq = Number(mods.state!.uid);
  const s = known(S) ? core.normalizeState(core.ctxOf(data, S)) : S;
  const cfGet = mods.app?.cfGet as Fn | undefined;
  return { s, cf: cfGet ? copy(cfGet()) as World['cf'] : null, bd, cd, today: new Date().toISOString().slice(0, 10) };
}

const stateCanon = (s: unknown) => (known(s) ? canonOf(s) : stable(s));

function compareWorlds(call: string, got: World, want: World): void {
  compare(call, 'warband', stateCanon(got.s), stateCanon(want.s));
  compare(call, 'campaign file', cfCanon(got.cf), cfCanon(want.cf));
  compare(call, 'battle form', draftCanon(got.bd, got.s), draftCanon(want.bd, want.s));
  compare(call, 'casualty form', got.cd, want.cd);
}

/* ---- a call ---- */

function readDom(id: string): string | undefined {
  const doc = (globalThis as { document?: { getElementById?: (id: string) => { value?: unknown } | null } }).document;
  const el = doc?.getElementById?.(id);
  return el && el.value != null ? String(el.value) : undefined;
}

/* Records the answers legacy got from confirm() and prompt(). */
function listenToDialogs(io: Io): () => void {
  const g = globalThis as Rec;
  const oc = g.confirm, op = g.prompt;
  if (typeof oc === 'function') g.confirm = (...a: unknown[]) => { const r = (oc as Fn)(...a); io.confirms.push(!!r); return r; };
  if (typeof op === 'function') g.prompt = (...a: unknown[]) => { const r = (op as Fn)(...a); io.prompts.push(r == null ? null : String(r)); return r; };
  return () => { g.confirm = oc; g.prompt = op; };
}

function mirror(call: string, spec: Spec, before: World | null, c: Call, threw: boolean): void | Promise<void> {
  if (spec.kind === 'query' && spec.pure) {
    if (!threw) compare(call, 'answer', spec.run(c), spec.legacy ? spec.legacy(c) : c.ret);
    return;
  }
  const after = legacyWorld();
  if (!before) return;
  if (threw) {
    // Legacy failed on this input; core answers with a neutral value and
    // leaves everything as it was.
    report.threw[call] = (report.threw[call] ?? 0) + 1;
    if (spec.kind === 'action') compareWorlds(call, { ...before, ...spec.run(c) }, before);
    if (spec.kind === 'query') spec.run(c);
    return;
  }
  if (spec.kind === 'action') {
    const out = { ...before, ...spec.run(c) };
    compareWorlds(call, out, after);
    if (spec.ret) { const [cv, lv] = spec.ret(c, out); compare(call, 'result', cv, lv); }
    return;
  }
  const unchanged = () => compareWorlds(`${call} (changed the state)`, before, after);
  if (spec.kind === 'query') {
    const norm = spec.norm ?? ((v: unknown) => v);
    compare(call, 'answer', norm(spec.run(c), c), norm(spec.legacy ? spec.legacy(c) : c.ret, c));
    unchanged();
    return;
  }
  if (!spec.mutates) unchanged();
  if (!spec.check) return;
  const res = spec.check(c);
  if (res instanceof Promise) return res.then(([cv, lv]) => compare(call, 'check', cv, lv));
  compare(call, 'check', res[0], res[1]);
}

function crashed(call: string, e: unknown): void {
  report.differences++;
  if (report.findings.length < KEEP) report.findings.push({ call, n: report.calls[call] ?? 0, what: 'core threw', path: '', core: String((e as Error)?.stack ?? e).slice(0, 600), legacy: '' });
}

export function callWrapped(mod: string, name: string, f: Fn, self: unknown, args: unknown[]): unknown {
  if (depth > 0) return f.apply(self, args);
  const call = `${mod}.${name}`;
  report.calls[call] = (report.calls[call] ?? 0) + 1;
  const spec = TABLE[call];
  depth++;
  if (!spec) {
    report.unmapped[call] = (report.unmapped[call] ?? 0) + 1;
    try { const r = f.apply(self, args); return r; } finally { depth--; }
  }
  let before: World | null = null;
  const io: Io = { confirms: [], prompts: [], dom: {} };
  const c: Call = { w: null as unknown as World, args: args.map(copy), raw: args, io, ret: undefined, L: legacy() };
  try {
    if (!(spec.kind === 'query' && spec.pure)) before = legacyWorld();
    c.w = before as World;
    for (const id of ('dom' in spec && spec.dom ? spec.dom(args) : [])) io.dom[id] = readDom(id);
  } catch (e) { crashed(`${call} (reading the legacy state)`, e); }
  const stop = listenToDialogs(io);
  let ret: unknown, threw: unknown = null, failed = false;
  try { ret = f.apply(self, args); } catch (e) { threw = e; failed = true; } finally { stop(); }
  c.ret = ret;
  // Decrements depth once the mirror is done (for an async legacy function,
  // after its promise settled: until then the test awaits it).
  const finish = async (legacyFailed: boolean): Promise<void> => {
    try { await mirror(call, spec, before, c, legacyFailed); } catch (e) { crashed(call, e); } finally { depth--; }
  };
  if (!failed && ret && typeof (ret as Promise<unknown>).then === 'function') {
    return (ret as Promise<unknown>).then(
      async (v) => { c.ret = v; await finish(false); return v; },
      async (e) => { await finish(true); throw e; });
  }
  try {
    const p = mirror(call, spec, before, c, failed);
    if (p instanceof Promise) throw new Error('an asynchronous check for a synchronous function');
  } catch (e) { crashed(call, e); } finally { depth--; }
  if (failed) throw threw;
  return ret;
}

process.on('exit', () => {
  const out = process.env.MIRROR_REPORT;
  if (out) writeFileSync(out, JSON.stringify(report));
});
