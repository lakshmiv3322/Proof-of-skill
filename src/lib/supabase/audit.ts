// ─────────────────────────────────────────────────────────────
// src/lib/supabase/audit.ts
// Audit log helper.
// The audit_log table has RLS configured for service_role insert only.
// Client audit logging requests execute via the SECURITY DEFINER RPC log_audit_event.
// ─────────────────────────────────────────────────────────────

import { supabase } from '@/lib/supabase/client';
import type { AuditLog } from '@/types/database';

type AuditEntry = Omit<AuditLog, 'id' | 'created_at'>;

/**
 * Write an audit log entry via RPC function.
 * Silently swallows errors so audit failures never block user flows.
 */
export async function logAudit(entry: Partial<AuditEntry> & Pick<AuditLog, 'action' | 'entity_type'>): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any)('log_audit_event', {
      p_action: entry.action,
      p_entity_type: entry.entity_type,
      p_entity_id: entry.entity_id ?? null,
      p_metadata: entry.metadata ?? {},
    });
    if (error) {
      console.warn('[audit] Failed to write audit entry via RPC:', error.message, entry);
    }
  } catch (e) {
    console.warn('[audit] Unexpected error writing audit entry:', e);
  }
}
