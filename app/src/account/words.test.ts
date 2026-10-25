import { describe, expect, it } from 'vitest';
import { auditLine, type AuditEntry } from './words';

const entry = (actor: string | null, payload: unknown): AuditEntry =>
  ({ seq: 1, at: '2026-10-21T10:00:00Z', actor, action: 'bug.update', targetType: 'bug', target: '19', payload });

describe('auditLine: who did it', () => {
  it('names a user by their name', () => {
    expect(auditLine(entry('rob', {})).who).toBe('rob');
  });
  it('names Claude for changes made through the bug token', () => {
    expect(auditLine(entry(null, { via: 'bug-token' })).who).toBe('Claude (bug token)');
  });
  it('names the Raspberry Pi for roster-cli changes', () => {
    expect(auditLine(entry(null, { via: 'roster-cli' })).who).toBe('Raspberry Pi (roster-cli)');
  });
  it('never says “someone”', () => {
    expect(auditLine(entry(null, {})).who).toBe('unknown actor');
  });
});

describe('auditLine: the detail column says something (#71)', () => {
  const at = (action: string, targetType: string | null, target: string | null, payload: unknown): AuditEntry => ({ seq: 1, at: '', actor: 'anna', action, targetType, target, payload });

  it('names what the change was about and the facts the entry carries', () => {
    expect(auditLine(at('battle.create', 'battle', '3f2a9c1b-0000-4000-8000-000000000000', { round: 1, title: 'Hel Fenn ferry', warbands: ['a', 'b'] })).detail)
      .toBe('battle 3f2a9c1b · round: 1 · title: Hel Fenn ferry · warbands: 2');
    expect(auditLine(at('bug.update', 'bug', '19', { status: 'fixed', fixedIn: '3f2a9c1' })).detail).toBe('bug 19 · status: fixed · fixedIn: 3f2a9c1');
  });

  it('is not filled with what is already in the line, or with long texts', () => {
    // the account actions keep their own words; a user or an invite is not repeated as an id
    expect(auditLine(at('invite.create', 'invite', 'x', { via: 'roster-cli', admin: true, note: 'Rob' })).detail).toBe('“Rob” · an admin account');
    expect(auditLine(at('campaign.rename', 'campaign', 'c1', { from: 'A'.repeat(200), to: 'New' })).detail).toBe(`campaign c1 · from: ${'A'.repeat(59)}… · to: New`);
  });

  it('stays empty only when there is nothing to say', () => {
    expect(auditLine(at('something.new', null, null, null)).detail).toBe('');
  });
});
