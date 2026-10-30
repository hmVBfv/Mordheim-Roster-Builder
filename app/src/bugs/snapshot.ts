/* What there is to report at the moment the reporter opens the form: the
   screen, the trail, the settings, the house rules of the warband or the
   campaign in view – read from this device, nothing sent yet. */
import { ctxOf, writeSave } from '@mordheim/core';
import { deviceLabel } from '../account/device.ts';
import { db } from '../db/db.ts';
import { FLAVOUR } from '../flavour.ts';
import { buildContext, readSettings, type ReportContext } from './context.ts';
import { recentErrors, recentSteps, type CapturedError } from './trail.ts';

/** The warband in view that may be attached, if the reporter wants. */
export interface AttachableWarband {
  id: string; name: string; rev: number | null; kb: number;
  /** A warband seen in a campaign is not on this device: its save is what the campaign showed, read when the form opened (#158). */
  save?: Record<string, unknown>;
}

export interface Snapshot {
  pathname: string;
  takenAt: string;
  context: ReportContext;
  errors: CapturedError[];
  device: string;
  warband: AttachableWarband | null;
}

/** The warband of another player in a campaign in view, as the campaign shows it to this reporter; null when it cannot be read now. */
async function campaignWarband(pathname: string): Promise<AttachableWarband | null> {
  const m = /^\/campaign\/([^/]+)\/warbands\/([^/]+)/.exec(pathname);
  if (!m || FLAVOUR !== 'campaign') return null;
  try {
    const { readWarband } = await import('../campaign/api.ts');
    const read = await readWarband(m[1]!, m[2]!);
    const save = (read.draft?.data ?? read.head.data) as Record<string, unknown>;
    return { id: read.warband.id, name: read.warband.name, rev: read.head.rev, kb: Math.max(1, Math.round(JSON.stringify(save).length / 1024)), save };
  } catch {
    return null; // offline or not allowed: the report goes without one
  }
}

const inView = (pathname: string, root: 'warbands' | 'campaign') => {
  const m = new RegExp(`^/${root}/([^/]+)`).exec(pathname);
  return m && m[1] !== 'new' ? m[1]! : null;
};

export async function takeSnapshot(pathname: string, now: Date = new Date()): Promise<Snapshot> {
  const warbandId = inView(pathname, 'warbands');
  const campaignId = FLAVOUR === 'campaign' ? inView(pathname, 'campaign') : null;
  const rec = warbandId ? await db.warbands.get(warbandId) : undefined;
  const seen = rec ? null : await campaignWarband(pathname);
  let role: string | null = null;
  let campaignHouse: unknown = null;
  if (campaignId) {
    const { campaignKey } = await import('../campaign/api.ts');
    const view = (await db.meta.get(campaignKey(campaignId)))?.value as { role?: string; campaign?: { houseRules?: unknown } } | undefined;
    role = view?.role ?? null;
    campaignHouse = view?.campaign?.houseRules ?? null;
  }
  return {
    pathname,
    takenAt: now.toISOString(),
    context: buildContext({
      pathname,
      steps: recentSteps(),
      settings: readSettings(role),
      warbandHouse: rec?.state.house ?? (seen?.save as { house?: unknown } | undefined)?.house,
      campaignHouse,
      hasWarband: !!rec || !!seen,
      hasCampaign: !!campaignId && campaignHouse !== null,
    }),
    errors: recentErrors(),
    device: deviceLabel(),
    warband: rec ? { id: rec.id, name: rec.name, rev: rec.serverRev ?? null, kb: Math.max(1, Math.round(JSON.stringify(rec.state).length / 1024)) } : seen,
  };
}

/** The save of the warband as it is on this device now, to travel along with a report. */
export async function warbandCopy(id: string): Promise<{ warbandId: string; rev: number | null; save: Record<string, unknown> } | null> {
  const rec = await db.warbands.get(id);
  if (!rec) return null;
  const { loadGameData } = await import('../game/gameData.ts');
  return { warbandId: rec.id, rev: rec.serverRev ?? null, save: writeSave(ctxOf(await loadGameData(), rec.state), __APP_VERSION__) };
}
