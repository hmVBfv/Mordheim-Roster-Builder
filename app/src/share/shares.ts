/* Sharing a warband (Rob, 05.10.2026): a copy straight to another player,
   or a short code they enter. Always a copy: the recipient gets a warband of
   their own, the sender's stays private (server/src/routes-shares.ts).
   The lists and answers here; sending and taking a copy, which need the
   rules, in take.ts. */
import { api } from '../account/api.ts';

export interface Person { id: string; username: string; displayName: string }
export interface Share {
  id: string; name: string; wbType: string; from: string; to: string | null; code: boolean;
  createdAt: string; expiresAt: string; answeredAt: string | null; accepted: boolean | null; uses: number; revokedAt: string | null;
}
export interface CodeLook { name: string; wbType: string; from: string; expiresAt: string }
export interface Taken { warband: { id: string; createdAt: string }; head: { rev: number; data: unknown } }

export const listPeople = () => api<{ people: Person[] }>('/people').then((r) => r.people);
export const listShares = () => api<{ incoming: Share[]; outgoing: Share[] }>('/shares');

export const peekCode = (code: string) => api<CodeLook>('/shares/peek', { body: { code } });
export const declineShare = (id: string) => api(`/shares/${id}/decline`, { body: {} });
export const revokeShare = (id: string) => api(`/shares/${id}`, { method: 'DELETE' });
