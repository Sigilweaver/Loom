/**
 * Audit message format, shared by the auditor (writer) and the chat UI
 * (reader) so the two cannot disagree about the prefix.
 */

export type AuditVerdict = 'passed' | 'warning';

export function formatAuditMessage(verdict: AuditVerdict, text: string): string {
  return `Audit ${verdict}: ${text}`;
}

export function parseAuditMessage(content: string | undefined): { isAudit: boolean; isWarning: boolean; text: string } {
  const match = /^Audit (passed|warning):\s*/.exec(content ?? '');
  if (match) {
    return { isAudit: true, isWarning: match[1] === 'warning', text: (content ?? '').slice(match[0].length) };
  }
  return { isAudit: false, isWarning: false, text: '' };
}
