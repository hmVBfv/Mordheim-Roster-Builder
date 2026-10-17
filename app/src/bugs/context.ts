/* What goes along with a problem report without the reporter writing it
   (concept.md 4.12; Rob, 09.10.2026): where they were, the last steps, the
   settings of this device, the house rules, the last JavaScript errors. All
   of it is structure and fixed words (trail.ts says why); the form shows it
   before anything is sent, and the reporter may leave it out. */
import { houseDefaults, houseRules, HOUSE_RULE_KEYS, type WarbandState } from '@mordheim/core';
import { FLAVOUR } from '../flavour.ts';
import { readChoice, resolveTheme } from '../theme/theme.ts';
import { getSyncStatus, type SyncStatus } from '../sync/runner.ts';
import { recentErrors, recentSteps, routePattern, type CapturedError, type Step } from './trail.ts';

export type RuleValues = Record<string, string | number | boolean>;

export interface ReportSettings {
  theme: string;
  flavour: string;
  online: boolean;
  sync: string;
  role: string | null;
  viewport: string;
  installed: boolean;
}

/** The context as the server stores it (server/src/bugs.ts ContextBody). */
export interface ReportContext {
  screen: string;
  steps: Step[];
  settings: ReportSettings;
  houseRules: { warband: RuleValues | null; campaign: RuleValues | null };
}

/** The house rules that differ from the defaults, as plain values (`notes` is text a player wrote and stays out). */
export function ruleSummary(house: unknown): RuleValues {
  const have = houseRules({ house } as WarbandState) as unknown as Record<string, unknown>;
  const base = houseDefaults() as unknown as Record<string, unknown>;
  const out: RuleValues = {};
  for (const k of HOUSE_RULE_KEYS) {
    if (JSON.stringify(have[k]) === JSON.stringify(base[k])) continue;
    const v = have[k];
    out[k] = typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? (typeof v === 'string' ? v.slice(0, 80) : v) : JSON.stringify(v).slice(0, 80);
  }
  return out;
}

/** The sync as one line: its state and what waits, and – for an error – the first words of why. */
export function syncLine(s: SyncStatus): string {
  if (s.state === 'off') return 'off';
  const base = `${s.state}, ${s.waiting} waiting, ${s.conflicts} in conflict`;
  return s.state === 'error' ? `${base}: ${s.message.slice(0, 60)}` : base;
}

export interface ContextInput {
  pathname: string;
  steps: Step[];
  settings: ReportSettings;
  warbandHouse: unknown;
  campaignHouse: unknown;
  /** Whether there is a warband / a campaign in view at all. */
  hasWarband: boolean;
  hasCampaign: boolean;
}

export function buildContext(i: ContextInput): ReportContext {
  return {
    screen: routePattern(i.pathname),
    steps: i.steps,
    settings: i.settings,
    houseRules: {
      warband: i.hasWarband ? ruleSummary(i.warbandHouse) : null,
      campaign: i.hasCampaign ? ruleSummary(i.campaignHouse) : null,
    },
  };
}

/** The settings of this device, now. */
export function readSettings(role: string | null): ReportSettings {
  const choice = readChoice();
  const resolved = document.documentElement.dataset.theme ?? resolveTheme(choice, false);
  return {
    theme: choice === 'system' ? `system (${resolved})` : choice,
    flavour: FLAVOUR,
    online: navigator.onLine,
    sync: syncLine(getSyncStatus()),
    role,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    installed: typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches,
  };
}

export const currentSteps = recentSteps;
export const currentErrors = recentErrors;
export type { CapturedError, Step };
