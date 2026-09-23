// ─────────────────────────────────────────────────────────────
// ProofOfSkill — Core Multi-Tenant Data Model
// ─────────────────────────────────────────────────────────────
// Every tenant-facing model carries an `institute_id` (or
// `workspace_id`) so that Row-Level Security can scope all
// queries to the authenticated user's tenant.
// ─────────────────────────────────────────────────────────────

// ── Enums ────────────────────────────────────────────────────

export type UserRole =
  | 'trainee'
  | 'assessor'
  | 'institute_admin'
  | 'platform_admin';

export type SubmissionStatus =
  | 'draft'
  | 'submitted'
  | 'ai_processing'
  | 'ai_processed'
  | 'under_review'
  | 'scored'
  | 'certified'
  | 'appealed';

export type AppealStatus = 'pending' | 'approved' | 'rejected';

export type CertificateStatus = 'active' | 'revoked' | 'expired';

export type PlanTier = 'starter' | 'growth' | 'enterprise';

// ── Base / shared shapes ─────────────────────────────────────

/** ISO-8601 timestamp string (matches Supabase `timestamptz`). */
export type ISODateString = string;

/** UUID string. */
export type UUID = string;

/** Fields shared by every tenant-scoped table. */
export interface TenantScoped {
  institute_id: UUID;
}

/** Fields shared by every table with standard audit columns. */
export interface Auditable {
  created_at: ISODateString;
  updated_at: ISODateString;
}

// ── institutes ────────────────────────────────────────────────

export interface Institute extends Auditable {
  id: UUID;
  name: string;
  slug: string;
  plan_tier: PlanTier;
  max_seats: number;
  contact_email: string;
  contact_phone: string | null;
  logo_url: string | null;
  is_active: boolean;
  settings: InstituteSettings;
}

export interface InstituteSettings {
  allow_appeals: boolean;
  appeal_window_days: number;
  require_human_review: boolean;
  certificate_template: string;
  branding_color: string | null;
}

// ── users ────────────────────────────────────────────────────

export interface User extends TenantScoped, Auditable {
  id: UUID;
  auth_id: UUID | null;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  last_login_at: ISODateString | null;
  metadata: Record<string, unknown>;
}

// ── trades ───────────────────────────────────────────────────

/** A trade / skill domain (e.g. "Welding — SMAW", "Carpentry — Framing"). */
export interface Trade extends TenantScoped, Auditable {
  id: UUID;
  name: string;
  description: string;
  category: string;
  is_active: boolean;
}

// ── rubrics ──────────────────────────────────────────────────

/**
 * A rubric defines the scoring criteria for a trade.
 * The `config` column is a JSON blob that holds the structured
 * rubric definition (criteria, weight bands, pass thresholds).
 */
export interface Rubric extends TenantScoped, Auditable {
  id: UUID;
  trade_id: UUID;
  name: string;
  version: number;
  is_published: boolean;
  pass_threshold: number;
  config: RubricConfig;
}

export interface RubricConfig {
  criteria: RubricCriterion[];
  scoring_scale: {
    min: number;
    max: number;
    bands: RubricBand[];
  };
  total_weight: number;
}

export interface RubricCriterion {
  id: string;
  label: string;
  description: string;
  weight: number;
  indicators: string[];
}

export interface RubricBand {
  label: string;
  min: number;
  max: number;
  color: string;
}

// ── reference_clips ──────────────────────────────────────────

/** Exemplar video clips that demonstrate correct technique. */
export interface ReferenceClip extends TenantScoped, Auditable {
  id: UUID;
  trade_id: UUID;
  rubric_id: UUID | null;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  duration_seconds: number;
  tags: string[];
}

// ── submissions ─────────────────────────────────────────────

/** A trainee's video submission for assessment. */
export interface Submission extends TenantScoped, Auditable {
  id: UUID;
  trainee_id: UUID;
  trade_id: UUID;
  rubric_id: UUID;
  reference_clip_id: UUID | null;
  status: SubmissionStatus;
  video_url: string;
  thumbnail_url: string;
  duration_seconds: number;
  submitted_at: ISODateString | null;
  reviewed_at: ISODateString | null;
  notes: string | null;
}

// ── pose_landmark_sets ───────────────────────────────────────

/** Pose / body-position data extracted from a submission video. */
export interface PoseLandmarkSet extends TenantScoped, Auditable {
  id: UUID;
  submission_id: UUID;
  frame_count: number;
  landmarks: PoseLandmark[];
  confidence_score: number;
  source: 'ai' | 'manual';
}

export interface PoseLandmark {
  frame: number;
  timestamp_ms: number;
  points: PosePoint[];
}

export interface PosePoint {
  name: string;
  x: number;
  y: number;
  z: number;
  visibility: number;
}

// ── scores ───────────────────────────────────────────────────

/** Per-criterion scores for a submission. */
export interface Score extends TenantScoped, Auditable {
  id: UUID;
  submission_id: UUID;
  rubric_criterion_id: string;
  score: number;
  max_score: number;
  weight: number;
  source: 'ai' | 'human';
  assessor_id: UUID | null;
  notes: string | null;
}

// ── feedback ─────────────────────────────────────────────────

/** Qualitative feedback attached to a submission or criterion. */
export interface Feedback extends TenantScoped, Auditable {
  id: UUID;
  submission_id: UUID;
  score_id: UUID | null;
  rubric_criterion_id: string | null;
  author_id: UUID;
  author_role: UserRole;
  body: string;
  timestamp_seconds: number | null;
  is_ai_generated: boolean;
}

// ── certificates ────────────────────────────────────────────

/** Verifiable, shareable proof of skill attainment. */
export interface Certificate extends TenantScoped, Auditable {
  id: UUID;
  submission_id: UUID;
  trainee_id: UUID;
  trade_id: UUID;
  verification_code: string;
  status: CertificateStatus;
  issued_at: ISODateString;
  expires_at: ISODateString | null;
  issued_by: UUID;
  overall_score: number;
  pdf_url: string | null;
}

// ── appeals ──────────────────────────────────────────────────

/** A trainee's appeal against a scoring decision. */
export interface Appeal extends TenantScoped, Auditable {
  id: UUID;
  submission_id: UUID;
  trainee_id: UUID;
  status: AppealStatus;
  reason: string;
  submitted_at: ISODateString;
  resolved_at: ISODateString | null;
  resolved_by: UUID | null;
  resolution_notes: string | null;
}

// ── usage_counters ───────────────────────────────────────────

/** Per-institute, per-month usage tracking for billing/limits. */
export interface UsageCounter extends Auditable {
  id: UUID;
  institute_id: UUID;
  period_year: number;
  period_month: number;
  submissions_count: number;
  ai_assessments_count: number;
  certificates_issued: number;
  active_users: number;
}

// ── audit_log ────────────────────────────────────────────────

/** Immutable audit trail for compliance and security. */
export interface AuditLog extends TenantScoped {
  id: UUID;
  actor_id: UUID | null;
  actor_role: UserRole | null;
  action: string;
  entity_type: string;
  entity_id: UUID;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: ISODateString;
}

// ── Convenience: Database shape ───────────────────────────────

export interface Database {
  institutes: Institute;
  users: User;
  trades: Trade;
  rubrics: Rubric;
  reference_clips: ReferenceClip;
  submissions: Submission;
  pose_landmark_sets: PoseLandmarkSet;
  scores: Score;
  feedback: Feedback;
  certificates: Certificate;
  appeals: Appeal;
  usage_counters: UsageCounter;
  audit_log: AuditLog;
}

export type TableName = keyof Database;
export type Row<T extends TableName> = Database[T];
