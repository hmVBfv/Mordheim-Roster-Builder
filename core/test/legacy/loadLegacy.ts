/* Loads the legacy app (js/*.js) in Node so the parity suites can compare it
   with core. The legacy modules expect a browser: this installs the same
   minimal DOM stubs the legacy tests in test/*.mjs use, and serves data/*.json
   to its fetch() from disk.

   The legacy app keeps its warband in a module-level singleton `S`. Vitest
   gives every test file its own module graph, so each parity file loads a
   fresh copy. */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type LegacyFn = (...args: any[]) => any;
export type LegacyModule = Record<string, LegacyFn | any>;

export interface Legacy {
  app: LegacyModule;
  engine: LegacyModule;
  state: LegacyModule;
  info: LegacyModule;
  /** Replace the legacy global state with a deep copy of `s`. */
  load(s: unknown): any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const ROOT = new URL('../../../', import.meta.url);

function installStubs(): void {
  const el = () => ({
    style: {}, className: '', textContent: '', value: '', checked: false,
    set innerHTML(_v: string) { /* ignored */ }, get innerHTML() { return ''; },
    appendChild() {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0 }),
    querySelectorAll: () => [], click() {}, focus() {}, select() {}, remove() {},
  });
  const g = globalThis as Record<string, unknown>;
  g.document = { getElementById: el, createElement: el, addEventListener() {}, body: { appendChild() {} }, querySelectorAll: () => [] };
  g.window = {
    addEventListener() {}, scrollTo() {}, innerWidth: 1000,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    storage: { list: async () => ({ keys: [] }) },
  };
  g.Blob = function Blob() {};
  (globalThis.URL as unknown as Record<string, unknown>).createObjectURL = () => '';
  g.confirm = () => true;
  g.alert = () => {};
  g.fetch = async (u: string | URL) => {
    const p = fileURLToPath(new URL(String(u)));
    return {
      ok: existsSync(p),
      json: async () => JSON.parse(readFileSync(p, 'utf8')) as unknown,
      arrayBuffer: async () => readFileSync(p).buffer,
    };
  };
}

export async function loadLegacy(): Promise<Legacy> {
  installStubs();
  const imp = (rel: string) => import(/* @vite-ignore */ fileURLToPath(new URL(rel, ROOT))) as Promise<Record<string, unknown>>;
  const app = await imp('js/app.js');
  const engine = await imp('js/engine.js');
  const state = await imp('js/state.js');
  const info = await imp('js/info.js');
  const replaceState = state.replaceState as (s: unknown) => void;
  return {
    app, engine, state, info,
    load(s: unknown) {
      replaceState(structuredClone(s));
      return state.S;
    },
  } as Legacy;
}
