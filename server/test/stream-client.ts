/* A client of a stream for the tests, on a connection of its own: fetch keeps
   its connections for later requests, and a server that closes finds such a
   socket not idle for as long as the client holds it – the test would wait
   for the client, not for the server. */
import http from 'node:http';

export interface Opened {
  status: number;
  headers: http.IncomingHttpHeaders;
  res: http.IncomingMessage;
  /** Hangs up. */
  hangUp(): void;
}

export function openStream(url: string, headers: Record<string, string> = {}): Promise<Opened> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { agent: false, headers, method: 'GET' }, (res) => resolve({ status: res.statusCode ?? 0, headers: res.headers, res, hangUp: () => req.destroy() }));
    req.on('error', (e) => reject(e as Error));
    req.end();
  });
}

/** The whole body of an answer that ends (a refusal). */
export async function bodyOf(o: Opened): Promise<string> {
  let text = '';
  o.res.setEncoding('utf8');
  for await (const chunk of o.res) text += chunk as string;
  return text;
}
