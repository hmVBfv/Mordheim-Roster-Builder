/* Opponents on the server (server/src/routes-opponents.ts): groups of
   profiles and the campaign's own skills. Leaders' own – read and written by
   leaders; for everyone else there is no such thing.
   The last answer is kept on the device (under the account's own key);
   every change needs the connection. */
import type { OpponentProfile } from '@mordheim/core';
import { api, ApiError } from '../account/api.ts';
import { asker, ownKey } from '../account/owner.ts';
import { db } from '../db/db.ts';

export interface Group { id: string; name: string; note: string; profiles: OpponentProfile[]; updatedBy: string; updatedAt: string; seq: number }
export interface OwnSkill { id: string; name: string; text: string; updatedBy: string; updatedAt: string; seq: number }
export interface Opponents { groups: Group[]; skills: OwnSkill[]; seq: number }

/** The limits the server holds to (server/src/opponents.ts). */
export const MAX_PROFILES = 40;

const key = (cid: string) => ownKey('opponents:', cid);

export async function cachedOpponents(cid: string): Promise<Opponents | null> {
  return ((await db.meta.get(key(cid)))?.value as Opponents | undefined) ?? null;
}

export async function getOpponents(cid: string): Promise<Opponents> {
  const who = asker();
  const r = await api<Opponents>(`/campaigns/${cid}/opponents`);
  await who.keep('opponents:', cid, r);
  return r;
}

/** Keeps the device's copy in step with a change this device made. */
async function keepWith(cid: string, change: (o: Opponents) => Opponents): Promise<void> {
  const who = asker();
  const cur = (await cachedOpponents(cid)) ?? { groups: [], skills: [], seq: 0 };
  await who.keep('opponents:', cid, change(cur));
}

const byName = <T extends { name: string }>(xs: T[]) => [...xs].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

export async function putGroup(cid: string, id: string, body: { name: string; note: string; profiles: OpponentProfile[] }, baseSeq: number): Promise<Group> {
  const r = await api<{ group: Group }>(`/campaigns/${cid}/opponents/groups/${id}`, { method: 'PUT', body: { ...body, baseSeq } });
  await keepWith(cid, (o) => ({ ...o, groups: byName([...o.groups.filter((g) => g.id !== id), r.group]), seq: Math.max(o.seq, r.group.seq) }));
  return r.group;
}

export async function removeGroup(cid: string, id: string): Promise<void> {
  const r = await api<{ removed: boolean; seq: number }>(`/campaigns/${cid}/opponents/groups/${id}`, { method: 'DELETE' });
  await keepWith(cid, (o) => ({ ...o, groups: o.groups.filter((g) => g.id !== id), seq: Math.max(o.seq, r.seq) }));
}

export async function putSkill(cid: string, id: string, body: { name: string; text: string }, baseSeq: number): Promise<OwnSkill> {
  const r = await api<{ skill: OwnSkill }>(`/campaigns/${cid}/opponents/skills/${id}`, { method: 'PUT', body: { ...body, baseSeq } });
  await keepWith(cid, (o) => ({ ...o, skills: byName([...o.skills.filter((s) => s.id !== id), r.skill]), seq: Math.max(o.seq, r.skill.seq) }));
  return r.skill;
}

export async function removeSkill(cid: string, id: string): Promise<void> {
  const r = await api<{ removed: boolean; seq: number }>(`/campaigns/${cid}/opponents/skills/${id}`, { method: 'DELETE' });
  await keepWith(cid, (o) => ({ ...o, skills: o.skills.filter((s) => s.id !== id), seq: Math.max(o.seq, r.seq) }));
}

/** What stands on the server now, when another leader changed it first (409 `stale`). */
export function staleOf<T>(e: unknown): T | null {
  return e instanceof ApiError && e.status === 409 && e.code === 'stale' ? ((e.body as { current?: T } | undefined)?.current ?? null) : null;
}
