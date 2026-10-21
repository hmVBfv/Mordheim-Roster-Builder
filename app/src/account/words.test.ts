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
