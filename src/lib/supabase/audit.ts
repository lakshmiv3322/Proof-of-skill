// ─────────────────────────────────────────────────────────────
// src/lib/supabase/audit.ts
// Audit Log Service & Security Architecture
// ─────────────────────────────────────────────────────────────
// CRITICAL SECURITY GUARANTEE:
// Submissions, Score Overrides, and Certificate Issuances are now
// logged automatically at the PostgreSQL database engine level
// via AFTER INSERT OR UPDATE triggers (`tr_submissions_audit`,
// `tr_scores_audit`, `tr_certificates_audit`).
//
// These database triggers cannot be bypassed or silenced by client
// modifications or network dropouts.
//
// The `logAudit` helper below is retained for non-table audit events
// (e.g. user sessions, exports, policy checks) using the
// SECURITY DEFINER RPC `log_audit_event`.
// ─────────────────────────────────────────────────────────────

import { supabase } from '@/lib/supabase/client';
import type { AuditLog } from '@/types/database';

type AuditEntry = Omit<AuditLog, 'id' | 'created_at'>;

/**
 * Write an auxiliary audit log entry via SECURITY DEFINER RPC.
 * Primary state changes (submissions, scores, certificates) are
 * automatically captured by PostgreSQL database triggers.
 */
export async function logAudit(
  entry: Partial<AuditEntry> & Pick<AuditLog, 'action' | 'entity_type'>
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any)('log_audit_event', {
      p_action: entry.action,
      p_entity_type: entry.entity_type,
      p_entity_id: entry.entity_id ?? null,
      p_metadata: entry.metadata ?? {},
    });
    if (error) {
      console.warn('[audit] Optional auxiliary audit log notice:', error.message);
    }
  } catch (e) {
    console.warn('[audit] Auxiliary audit log notice:', e);
  }
}
