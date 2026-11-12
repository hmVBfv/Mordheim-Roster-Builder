/* The contract between the app's in-memory server (app/src/sync/fakeSync.ts) and the real one (server/src). About twenty test files of the
   app and the Playwright specs talk to the fake; nothing else says it answers as the server does. A scenario is a list of requests; the
   driver sends each to both and compares the status and the answer. A field that is different on every run is named in VOLATILE and
   compared by its type, never skipped; whatever else differs is listed by path. The fake is the one that gives way (docs/architecture.md). */
import { createFakeSync } from '../../../app/src/sync/fakeSync.ts';

export interface Step {
  /** What the step shows, in the failure message. */
  name: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Below /api/v1, with its query. */
  url: string;
  body?: Record<string, unknown>;
}

export interface Outcome { status: number; body: unknown }

/** Fields that differ from run to run, with the type they must have on both sides. */
export const VOLATILE: Record<string, 'time' | 'number' | 'string'> = {
  createdAt: 'time', updatedAt: 'time', archivedAt: 'time',
  seq: 'number', cursor: 'number', epoch: 'string',
  // the server's wording of a refusal comes from its schema checker; the fake only has to refuse with some
  problem: 'string',
};
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** An answer with its volatile fields replaced by their type (a null stays null: whether a value is there is part of the contract). */
export function normalize(v: unknown, volatile: Record<string, string> = VOLATILE): unknown {
  if (Array.isArray(v)) return v.map((x) => normalize(x, volatile));
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => {
      const kind = volatile[k];
      if (kind && x !== null && x !== undefined) {
        const ok = kind === 'time' ? typeof x === 'string' && TIME.test(x) : typeof x === kind;
        return [k, ok ? `<${kind}>` : `<NOT A ${kind.toUpperCase()}: ${JSON.stringify(x)}>`];
      }
      return [k, normalize(x, volatile)];
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

/** The fake, called as the app calls the server. */
export function fakeSide(opts: Parameters<typeof createFakeSync>[0] = {}) {
  const fake = createFakeSync(opts);
  return {
    fake,
    async run(step: Step): Promise<Outcome> {
      const url = new URL(step.url, 'http://fake');
      const res = fake.handle(step.method ?? (step.body ? 'POST' : 'GET'), url.pathname, url.searchParams, step.body ?? {});
      const text = await res.text();
      return { status: res.status, body: text ? JSON.parse(text) as unknown : null };
    },
  };
}

/** What a scenario found: one line per difference, "step: where: server ≠ fake". */
export async function compare(steps: Step[], server: (s: Step) => Promise<Outcome>, fake: (s: Step) => Promise<Outcome>, known: Record<string, string> = {}): Promise<{ found: string[]; unused: string[] }> {
  const found: string[] = [];
  const used = new Set<string>();
  for (const step of steps) {
    const [s, f] = [await server(step), await fake(step)];
    const lines = [
      ...(s.status === f.status ? [] : [`status: server ${s.status} ≠ fake ${f.status}`]),
      ...differences(normalize(s.body), normalize(f.body)).map((d) => d.replace(' ≠ ', ' (server) ≠ (fake) ')),
    ];
    for (const l of lines) {
      const key = `${step.name} | ${l.split(':')[0]}`;
      if (key in known) used.add(key);
      else found.push(`${step.name}: ${l}`);
    }
  }
  return { found, unused: Object.keys(known).filter((k) => !used.has(k)) };
}
