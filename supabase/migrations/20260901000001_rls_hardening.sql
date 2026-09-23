-- ─────────────────────────────────────────────────────────────
-- ProofOfSkill — RLS Hardening & Policy Refinement Migration
-- File: supabase/migrations/20260901000001_rls_hardening.sql
-- ─────────────────────────────────────────────────────────────

-- 1. Ensure RLS is explicitly enabled on all 13 tables
ALTER TABLE institutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pose_landmark_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- Helper function to get current user's institute_id
CREATE OR REPLACE FUNCTION public.current_user_institute_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT institute_id FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- Helper function to get current user's internal user id (public.users.id)
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- ─────────────────────────────────────────────────────────────
-- CLEANUP PREVIOUS POLICIES FOR RE-CREATION WITH STRICT RULES
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "trades_select_tenant" ON trades;
DROP POLICY IF EXISTS "trades_write_staff" ON trades;
DROP POLICY IF EXISTS "rubrics_select_tenant" ON rubrics;
DROP POLICY IF EXISTS "rubrics_write_staff" ON rubrics;
DROP POLICY IF EXISTS "reference_clips_select_tenant" ON reference_clips;
DROP POLICY IF EXISTS "reference_clips_write_staff" ON reference_clips;
DROP POLICY IF EXISTS "pose_landmark_sets_select_tenant" ON pose_landmark_sets;
DROP POLICY IF EXISTS "pose_landmark_sets_insert_trainee" ON pose_landmark_sets;
DROP POLICY IF EXISTS "appeals_select_trainee" ON appeals;
DROP POLICY IF EXISTS "appeals_select_staff" ON appeals;
DROP POLICY IF EXISTS "appeals_insert_trainee" ON appeals;
DROP POLICY IF EXISTS "appeals_update_staff" ON appeals;
DROP POLICY IF EXISTS "usage_counters_select_admin" ON usage_counters;

DROP POLICY IF EXISTS "submissions_select_trainee" ON submissions;
DROP POLICY IF EXISTS "submissions_select_staff" ON submissions;
DROP POLICY IF EXISTS "submissions_insert_trainee" ON submissions;
DROP POLICY IF EXISTS "submissions_update_trainee" ON submissions;
DROP POLICY IF EXISTS "submissions_update_staff" ON submissions;
DROP POLICY IF EXISTS "submissions_delete_trainee" ON submissions;

DROP POLICY IF EXISTS "scores_select_trainee" ON scores;
DROP POLICY IF EXISTS "scores_select_staff" ON scores;
DROP POLICY IF EXISTS "scores_insert_trainee" ON scores;
DROP POLICY IF EXISTS "scores_write_staff" ON scores;

DROP POLICY IF EXISTS "feedback_select_trainee" ON feedback;
DROP POLICY IF EXISTS "feedback_select_staff" ON feedback;
DROP POLICY IF EXISTS "feedback_insert_trainee" ON feedback;
DROP POLICY IF EXISTS "feedback_insert_staff" ON feedback;

DROP POLICY IF EXISTS "certificates_select_trainee" ON certificates;
DROP POLICY IF EXISTS "certificates_select_staff" ON certificates;
DROP POLICY IF EXISTS "certificates_write_admin" ON certificates;

DROP POLICY IF EXISTS "audit_log_select_admin" ON audit_log;
DROP POLICY IF EXISTS "audit_log_insert_authenticated" ON audit_log;
DROP POLICY IF EXISTS "audit_log_insert_service_role" ON audit_log;

-- ─────────────────────────────────────────────────────────────
-- REFINED STRICT RLS POLICIES FOR ALL 13 TABLES
-- ─────────────────────────────────────────────────────────────

-- TRADES TABLE
CREATE POLICY "trades_select_tenant" ON trades
  FOR SELECT TO authenticated
  USING (institute_id = public.current_user_institute_id());

CREATE POLICY "trades_write_staff" ON trades
  FOR ALL TO authenticated
  USING (
    institute_id = public.current_user_institute_id()
    AND public.current_user_role() IN ('institute_admin', 'platform_admin')
  );

-- RUBRICS TABLE
CREATE POLICY "rubrics_select_tenant" ON rubrics
  FOR SELECT TO authenticated
  USING (institute_id = public.current_user_institute_id());

CREATE POLICY "rubrics_write_staff" ON rubrics
  FOR ALL TO authenticated
  USING (
    institute_id = public.current_user_institute_id()
    AND public.current_user_role() IN ('assessor', 'institute_admin', 'platform_admin')
  );

-- REFERENCE CLIPS TABLE
CREATE POLICY "reference_clips_select_tenant" ON reference_clips
  FOR SELECT TO authenticated
  USING (institute_id = public.current_user_institute_id());

CREATE POLICY "reference_clips_write_staff" ON reference_clips
  FOR ALL TO authenticated
  USING (
    institute_id = public.current_user_institute_id()
    AND public.current_user_role() IN ('assessor', 'institute_admin', 'platform_admin')
  );

-- SUBMISSIONS TABLE
CREATE POLICY "submissions_select_trainee" ON submissions
  FOR SELECT TO authenticated
  USING (trainee_id = public.current_user_id());

CREATE POLICY "submissions_select_staff" ON submissions
  FOR SELECT TO authenticated
  USING (
    institute_id = public.current_user_institute_id()
    AND public.current_user_role() IN ('assessor', 'institute_admin', 'platform_admin')
  );

CREATE POLICY "submissions_insert_trainee" ON submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    trainee_id = public.current_user_id()
    AND institute_id = public.current_user_institute_id()
  );

CREATE POLICY "submissions_update_trainee" ON submissions
  FOR UPDATE TO authenticated
  USING (
    trainee_id = public.current_user_id()
    AND status IN ('draft', 'submitted')
  )
  WITH CHECK (trainee_id = public.current_user_id());

CREATE POLICY "submissions_update_staff" ON submissions
  FOR UPDATE TO authenticated
  USING (
    institute_id = public.current_user_institute_id()
    AND public.current_user_role() IN ('assessor', 'institute_admin', 'platform_admin')
  );

CREATE POLICY "submissions_delete_trainee" ON submissions
  FOR DELETE TO authenticated
  USING (
    trainee_id = public.current_user_id()
    AND status = 'draft'
  );

-- POSE LANDMARK SETS TABLE
CREATE POLICY "pose_landmark_sets_select_tenant" ON pose_landmark_sets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = pose_landmark_sets.submission_id
        AND (s.trainee_id = public.current_user_id() OR s.institute_id = public.current_user_institute_id())
    )
  );

CREATE POLICY "pose_landmark_sets_insert_trainee" ON pose_landmark_sets
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = pose_landmark_sets.submission_id
        AND s.trainee_id = public.current_user_id()
    )
  );

-- SCORES TABLE
CREATE POLICY "scores_select_trainee" ON scores
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = scores.submission_id
        AND s.trainee_id = public.current_user_id()
    )
  );

CREATE POLICY "scores_select_staff" ON scores
  FOR SELECT TO authenticated
  USING (
    institute_id = public.current_user_institute_id()
    AND public.current_user_role() IN ('assessor', 'institute_admin', 'platform_admin')
  );

CREATE POLICY "scores_insert_trainee" ON scores
  FOR INSERT TO authenticated
  WITH CHECK (
    institute_id = public.current_user_institute_id()
    AND EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = scores.submission_id
        AND s.trainee_id = public.current_user_id()
    )
  );

CREATE POLICY "scores_write_staff" ON scores
  FOR ALL TO authenticated
  USING (
    institute_id = public.current_user_institute_id()
    AND public.current_user_role() IN ('assessor', 'institute_admin', 'platform_admin')
  );

-- FEEDBACK TABLE
CREATE POLICY "feedback_select_trainee" ON feedback
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = feedback.submission_id
        AND s.trainee_id = public.current_user_id()
    )
  );

CREATE POLICY "feedback_select_staff" ON feedback
  FOR SELECT TO authenticated
  USING (
    institute_id = public.current_user_institute_id()
    AND public.current_user_role() IN ('assessor', 'institute_admin', 'platform_admin')
  );

CREATE POLICY "feedback_insert_trainee" ON feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    institute_id = public.current_user_institute_id()
    AND EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = feedback.submission_id
        AND s.trainee_id = public.current_user_id()
    )
  );

CREATE POLICY "feedback_insert_staff" ON feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    institute_id = public.current_user_institute_id()
    AND public.current_user_role() IN ('assessor', 'institute_admin', 'platform_admin')
  );

-- CERTIFICATES TABLE
-- Trainees can read their own certificates
CREATE POLICY "certificates_select_trainee" ON certificates
  FOR SELECT TO authenticated
  USING (trainee_id = public.current_user_id());

-- Staff can read certificates in their institute
CREATE POLICY "certificates_select_staff" ON certificates
  FOR SELECT TO authenticated
  USING (
    institute_id = public.current_user_institute_id()
    AND public.current_user_role() IN ('assessor', 'institute_admin', 'platform_admin')
  );

-- Admins / service_role can insert/update certificates
CREATE POLICY "certificates_write_admin" ON certificates
  FOR ALL TO authenticated
  USING (
    institute_id = public.current_user_institute_id()
    AND public.current_user_role() IN ('institute_admin', 'platform_admin')
  );

-- Note: NO public/anon SELECT policy is created for certificates table directly.
-- Public certificate verification MUST go through `get_certificate_by_code` RPC function.

-- APPEALS TABLE
CREATE POLICY "appeals_select_trainee" ON appeals
  FOR SELECT TO authenticated
  USING (trainee_id = public.current_user_id());

CREATE POLICY "appeals_select_staff" ON appeals
  FOR SELECT TO authenticated
  USING (
    institute_id = public.current_user_institute_id()
    AND public.current_user_role() IN ('assessor', 'institute_admin', 'platform_admin')
  );

CREATE POLICY "appeals_insert_trainee" ON appeals
  FOR INSERT TO authenticated
  WITH CHECK (
    trainee_id = public.current_user_id()
    AND institute_id = public.current_user_institute_id()
  );

CREATE POLICY "appeals_update_staff" ON appeals
  FOR UPDATE TO authenticated
  USING (
    institute_id = public.current_user_institute_id()
    AND public.current_user_role() IN ('assessor', 'institute_admin', 'platform_admin')
  );

-- USAGE_COUNTERS TABLE
CREATE POLICY "usage_counters_select_admin" ON usage_counters
  FOR SELECT TO authenticated
  USING (
    institute_id = public.current_user_institute_id()
    AND public.current_user_role() IN ('institute_admin', 'platform_admin')
  );

-- AUDIT_LOG TABLE
-- Strict insert-only via service_role (or via log_audit_event SECURITY DEFINER helper function).
CREATE POLICY "audit_log_insert_service_role" ON audit_log
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "audit_log_select_admin" ON audit_log
  FOR SELECT TO authenticated
  USING (
    institute_id = public.current_user_institute_id()
    AND public.current_user_role() IN ('institute_admin', 'platform_admin')
  );

-- ─────────────────────────────────────────────────────────────
-- SECURITY DEFINER RPC: log_audit_event
-- Enables client code to request audit logging safely.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action text,
  p_entity_type text,
  p_entity_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user users%ROWTYPE;
BEGIN
  SELECT * INTO v_user FROM users WHERE auth_id = auth.uid() LIMIT 1;
  IF v_user.id IS NOT NULL THEN
    INSERT INTO audit_log (institute_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
    VALUES (v_user.institute_id, v_user.id, v_user.role, p_action, p_entity_type, p_entity_id, p_metadata);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit_event TO authenticated;
