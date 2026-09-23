// ─────────────────────────────────────────────────────────────
// src/lib/mock/demo-data.ts
// Single consolidated demo data source gated behind VITE_DEMO_MODE.
// ─────────────────────────────────────────────────────────────

export const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== 'false';

export const DEMO_CERTIFICATE = {
  id: 'cert-001-demo',
  institute_id: '00000000-0000-0000-0000-000000000001',
  submission_id: 'sub-010',
  trainee_id: '00000000-0000-0000-0000-000000000002',
  trade_id: 'trade-cpr',
  verification_code: 'POS-CPR-2026-042AH',
  status: 'active' as const,
  issued_at: '2026-08-15T10:00:00Z',
  expires_at: '2028-08-15T10:00:00Z',
  issued_by: '00000000-0000-0000-0000-000000000003',
  overall_score: 91.5,
  pdf_url: null,
  created_at: '2026-08-15T10:00:00Z',
  updated_at: '2026-08-15T10:00:00Z',
  trainee_name: 'Marcus Webb',
  trade_name: 'CPR / First-Aid Chest Compression',
  institute_name: 'Apex Vocational Institute',
};
