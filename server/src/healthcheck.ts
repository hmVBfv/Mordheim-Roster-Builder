/* The container's healthcheck and roster-deploy's probe:
     node server/dist/healthcheck.js [--url <url>] [--print]
   Exit 0 if the server answers 200 with status "ok" within 5 seconds, else 1.
   --print writes the answer to stdout (for scripts and people). */

export async function probe(url: string, timeoutMs = 5000): Promise<{ ok: boolean; body: string }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    const body = await res.text();
    let status: unknown;
    try {
      status = (JSON.parse(body) as { status?: unknown }).status;
    } catch {
      status = undefined;
    }
    return { ok: res.status === 200 && status === 'ok', body };
  } catch (err) {
    return { ok: false, body: JSON.stringify({ error: (err as Error).message }) };
  }
}

export function parseArgs(argv: string[], env: NodeJS.ProcessEnv): { url: string; print: boolean } {
  let url = `http://127.0.0.1:${env.PORT ?? 3000}/api/v1/health`;
  let print = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url' && argv[i + 1]) url = argv[++i]!;
    else if (argv[i] === '--print') print = true;
  }
  return { url, print };
}
