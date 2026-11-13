/* The contract between the app's in-memory server (app/src/sync/fakeSync.ts) and the real one (server/src). About twenty test files of the
   app and the Playwright specs talk to the fake; nothing else says it answers as the server does. A scenario is a list of requests; the
   driver sends each to both and compares the status and the answer. A field that is different on every run is named in VOLATILE and
   compared by its type, never skipped; whatever else differs is listed by path. The fake is the one that gives way (docs/architecture.md). */
import { createFakeSync } from '../../../app/src/sync/fakeSync.ts';

export type Refs = Record<string, string>;

export interface Step {
  /** What the step shows, in the failure message. */
  name: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Below /api/v1, with its query. `{name}` is the reference of that name on the side that sends it (an id the side made up). */
  url: string;
  /** A string that is exactly `{name}` becomes the reference, at any depth. */
  body?: Record<string, unknown>;
  /** Keep a field of the answer as a reference: name → path ("share.id"). */
  capture?: Refs;
  /** A step that is not compared: somebody else does something, which each side does its own way, and may add references. */
  elsewhere?: boolean;
  /** Both sides must answer 2xx (a setup step through the API). */
}

export interface Outcome { status: number; body: unknown }

/** Fields that differ from run to run, with the type they must have on both sides. */
export const VOLATILE: Record<string, 'time' | 'number' | 'string'> = {
  createdAt: 'time', updatedAt: 'time', archivedAt: 'time', expiresAt: 'time', answeredAt: 'time', revokedAt: 'time', deletedAt: 'time', joinedAt: 'time', confirmedAt: 'time', closedAt: 'time', at: 'time', releasedAt: 'time',
  seq: 'number', cursor: 'number', epoch: 'string',
  // the server's wording of a refusal comes from its schema checker; the fake only has to refuse with some
  problem: 'string',
};
/** A share code as shown: K7M2-Q9XD. */
const SHARE_CODE = /^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/;
/** Ids the server makes up for itself, by where they stand: the mark (tag) of a warband. */
const VOLATILE_IDS = [/\.tags?(\[\d+\])?\.id$/, /\.enrolments\[\d+\]\.tag\.id$/];
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** An answer with its volatile fields replaced by their type (a null stays null: whether a value is there is part of the contract). */
export function normalize(v: unknown, volatile: Record<string, string> = VOLATILE, refs: Refs = {}, path = ''): unknown {
  if (typeof v === 'string') {
    const named = Object.entries(refs).find(([, value]) => value === v);
    return named ? `{${named[0]}}` : SHARE_CODE.test(v) ? '<code>' : v;
  }
  if (Array.isArray(v)) return v.map((x, i) => normalize(x, volatile, refs, `${path}[${i}]`));
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => {
      if (typeof x === 'string' && VOLATILE_IDS.some((re) => re.test(`${path}.${k}`))) return [k, '<id>'];
      // when a battle was played: a moment for a battle of the app, a day the leader gave for one of the history – only the moment varies
      if (k === 'playedAt' && typeof x === 'string' && TIME.test(x)) return [k, '<time>'];
      // the day a chapter was published is the day it was done: different on the server's clock and the fake's
      if (k === 'publishedOn' && typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)) return [k, '<day>'];
      const kind = volatile[k];
      if (kind && x !== null && x !== undefined) {
        const ok = kind === 'time' ? typeof x === 'string' && TIME.test(x) : typeof x === kind;
        return [k, ok ? `<${kind}>` : `<NOT A ${kind.toUpperCase()}: ${JSON.stringify(x)}>`];
      }
      return [k, normalize(x, volatile, refs, `${path}.${k}`)];
    }));
  }
  return v;
}

/** Every path at which two normalized values differ. */
export function differences(a: unknown, b: unknown, path = ''): string[] {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  const obj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
  if (obj(a) && obj(b)) {
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().flatMap((k) => {
      if (!(k in b)) return [`${path}.${k}: only in the server's answer`];
      if (!(k in a)) return [`${path}.${k}: only in the fake's answer`];
      return differences(a[k], b[k], `${path}.${k}`);
    });
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) return a.flatMap((x, i) => differences(x, b[i], `${path}[${i}]`));
  return [`${path || '(answer)'}: ${JSON.stringify(a)?.slice(0, 120)} ≠ ${JSON.stringify(b)?.slice(0, 120)}`];
}

/** One of the two servers, as a scenario drives it. */
export interface Side {
  refs: Refs;
  run(step: Step, url: string, body: Record<string, unknown> | undefined): Promise<Outcome>;
  /** What somebody else does in an `elsewhere` step. */
  elsewhere?(step: Step): Promise<void> | void;
}

const substitute = (v: unknown, refs: Refs): unknown => {
  if (typeof v === 'string') {
    const exact = /^\{(\w+)\}$/.exec(v);
    if (exact) {
      if (!(exact[1]! in refs)) throw new Error(`no reference "${exact[1]}"`);
      return refs[exact[1]!];
    }
    return v;
  }
  if (Array.isArray(v)) return v.map((x) => substitute(x, refs));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, substitute(x, refs)]));
  return v;
};
const inUrl = (url: string, refs: Refs) => url.replace(/\{(\w+)\}/g, (_, n: string) => { if (!(n in refs)) throw new Error(`no reference "${n}"`); return refs[n]!; });
const at = (v: unknown, path: string): unknown => path.split('.').reduce<unknown>((x, k) => (x && typeof x === 'object' ? (x as Record<string, unknown>)[k] : undefined), v);

/** The fake, called as the app calls the server. */
export function fakeSide(opts: Parameters<typeof createFakeSync>[0] = {}, refs: Refs = {}, elsewhere?: (fake: ReturnType<typeof createFakeSync>, step: Step, refs: Refs) => void): Side & { fake: ReturnType<typeof createFakeSync> } {
  const fake = createFakeSync(opts);
  return {
    fake, refs,
    async run(step, urlText, body) {
      const url = new URL(urlText, 'http://fake');
      const res = fake.handle(step.method ?? (body ? 'POST' : 'GET'), url.pathname, url.searchParams, body ?? {});
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) as unknown : null };
    },
    elsewhere: elsewhere ? (step) => elsewhere(fake, step, refs) : undefined,
  };
}

/** What a scenario found: one line per difference, "step: where: server ≠ fake". A `known` entry ("step | path") is a difference that is meant, with
    the reason as its value; one that no longer shows is reported as unused. */
export async function compare(steps: Step[], server: Side, fake: Side, known: Record<string, string> = {}): Promise<{ found: string[]; unused: string[] }> {
  const found: string[] = [];
  const used = new Set<string>();
  for (const step of steps) {
    if (step.elsewhere) {
      await server.elsewhere?.(step);
      await fake.elsewhere?.(step);
      continue;
    }
    const outcomes: Outcome[] = [];
    for (const side of [server, fake]) {
      const out = await side.run(step, inUrl(step.url, side.refs), step.body ? substitute(step.body, side.refs) as Record<string, unknown> : undefined);
      for (const [name, path] of Object.entries(step.capture ?? {})) {
        const v = at(out.body, path);
        if (typeof v === 'string') side.refs[name] = v;
        else found.push(`${step.name}: nothing to capture as "${name}" at ${path} (${side === server ? 'server' : 'fake'})`);
      }
      outcomes.push(out);
    }
    const [s, f] = outcomes as [Outcome, Outcome];
    const lines = [
      ...(s.status === f.status ? [] : [`status: server ${s.status} ≠ fake ${f.status}`]),
      ...differences(normalize(s.body, VOLATILE, server.refs), normalize(f.body, VOLATILE, fake.refs)).map((d) => d.replace(' ≠ ', ' (server) ≠ (fake) ')),
    ];
    for (const l of lines) {
      const key = `${step.name} | ${l.split(':')[0]}`;
      if (key in known) used.add(key);
      else found.push(`${step.name}: ${l}`);
    }
  }
  return { found, unused: Object.keys(known).filter((k) => !used.has(k)) };
}

/** The real server for a scenario: requests through app.inject with the session of the signed-in user; `before` runs ahead of each (the clock). */
export function serverSide(call: (r: { method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; url: string; body?: unknown; token?: string | null }) => Promise<{ statusCode: number; body: string; json(): unknown }>, token: string, refs: Refs = {}, before: () => void = () => undefined, elsewhere?: (step: Step, refs: Refs) => Promise<void>): Side {
  return {
    refs,
    async run(step, url, body) {
      before();
      const res = await call({ method: step.method ?? (body ? 'POST' : 'GET'), url: `/api/v1${url}`, ...(body ? { body } : {}), token });
      return { status: res.statusCode, body: res.body ? res.json() : null };
    },
    elsewhere: elsewhere ? (step) => elsewhere(step, refs) : undefined,
  };
}
