-- ─────────────────────────────────────────────────────────────
-- ProofOfSkill — Server-Authoritative Scoring & Audit Triggers
-- File: supabase/migrations/20260901000004_server_authoritative_scoring_and_audit.sql
-- ─────────────────────────────────────────────────────────────

-- 1. Create submission_staging table for raw captures (untrusted client data)
CREATE TABLE IF NOT EXISTS public.submission_staging (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id     uuid NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
  trainee_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  trade_id         uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  rubric_id        uuid NOT NULL REFERENCES public.rubrics(id) ON DELETE CASCADE,
  video_url        text NOT NULL DEFAULT '',
  duration_seconds integer NOT NULL DEFAULT 0,
  raw_landmarks    jsonb NOT NULL DEFAULT '[]'::jsonb,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message    text,
  created_at       timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.submission_staging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "submission_staging_insert_trainee" ON public.submission_staging;
DROP POLICY IF EXISTS "submission_staging_select_trainee" ON public.submission_staging;
DROP POLICY IF EXISTS "submission_staging_select_staff" ON public.submission_staging;

CREATE POLICY "submission_staging_insert_trainee" ON public.submission_staging
  FOR INSERT TO authenticated
  WITH CHECK (
    trainee_id = public.current_user_id()
    AND institute_id = public.current_user_institute_id()
  );

CREATE POLICY "submission_staging_select_trainee" ON public.submission_staging
  FOR SELECT TO authenticated
  USING (trainee_id = public.current_user_id());

CREATE POLICY "submission_staging_select_staff" ON public.submission_staging
  FOR SELECT TO authenticated
  USING (
    institute_id = public.current_user_institute_id()
    AND public.current_user_role() IN ('assessor', 'institute_admin', 'platform_admin')
  );

-- 2. Revoke trainee direct insert policies on submissions, scores, pose_landmark_sets
DROP POLICY IF EXISTS "submissions_insert_trainee" ON public.submissions;
DROP POLICY IF EXISTS "scores_insert_trainee" ON public.scores;
DROP POLICY IF EXISTS "pose_landmark_sets_insert_trainee" ON public.pose_landmark_sets;

-- 3. Ensure staff can write where appropriate (service_role always bypasses RLS)
DROP POLICY IF EXISTS "submissions_write_staff" ON public.submissions;
CREATE POLICY "submissions_write_staff" ON public.submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    institute_id = public.current_user_institute_id()
    AND public.current_user_role() IN ('assessor', 'institute_admin', 'platform_admin')
  );

DROP POLICY IF EXISTS "scores_write_staff" ON public.scores;
CREATE POLICY "scores_write_staff" ON public.scores
  FOR ALL TO authenticated
  USING (
    institute_id = public.current_user_institute_id()
    AND public.current_user_role() IN ('assessor', 'institute_admin', 'platform_admin')
  );

DROP POLICY IF EXISTS "pose_landmark_sets_write_staff" ON public.pose_landmark_sets;
CREATE POLICY "pose_landmark_sets_write_staff" ON public.pose_landmark_sets
  FOR ALL TO authenticated
  USING (
    institute_id = public.current_user_institute_id()
    AND public.current_user_role() IN ('assessor', 'institute_admin', 'platform_admin')
  );

-- ─────────────────────────────────────────────────────────────
-- 4. DATABASE-DRIVEN AUDIT TRIGGERS
-- Replaces voluntary client RPC with tamper-proof PostgreSQL triggers.
-- Runs automatically inside database transaction on INSERT or UPDATE.
-- ─────────────────────────────────────────────────────────────

-- Trigger on submissions: logs submission creation and status changes
CREATE OR REPLACE FUNCTION public.tr_audit_submissions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role user_role;
  v_action text;
  v_metadata jsonb;
BEGIN
  v_actor_id := public.current_user_id();
  IF v_actor_id IS NULL THEN
    v_actor_id := NEW.trainee_id;
  END IF;

  v_actor_role := public.current_user_role();
  IF v_actor_role IS NULL THEN
    v_actor_role := 'trainee'::user_role;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'submission.submitted';
    v_metadata := jsonb_build_object(
      'trade_id', NEW.trade_id,
      'rubric_id', NEW.rubric_id,
      'status', NEW.status,
      'duration_seconds', NEW.duration_seconds
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'submission.status_changed';
      v_metadata := jsonb_build_object(
        'state_before', jsonb_build_object('status', OLD.status),
        'state_after', jsonb_build_object('status', NEW.status)
      );
    ELSE
      v_action := 'submission.updated';
      v_metadata := jsonb_build_object('status', NEW.status);
    END IF;
  END IF;

  INSERT INTO public.audit_log (
    institute_id,
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    NEW.institute_id,
    v_actor_id,
    v_actor_role,
    v_action,
    'submission',
    NEW.id,
    v_metadata
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_submissions_audit ON public.submissions;
CREATE TRIGGER tr_submissions_audit
  AFTER INSERT OR UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.tr_audit_submissions();

-- Trigger on scores: logs score creation and assessor overrides
CREATE OR REPLACE FUNCTION public.tr_audit_scores()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role user_role;
  v_action text;
  v_metadata jsonb;
BEGIN
  v_actor_id := public.current_user_id();
  v_actor_role := public.current_user_role();

  IF TG_OP = 'INSERT' THEN
    v_action := 'score.created';
    v_metadata := jsonb_build_object(
      'submission_id', NEW.submission_id,
      'rubric_criterion_id', NEW.rubric_criterion_id,
      'score', NEW.score,
      'weight', NEW.weight,
      'source', NEW.source
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.score IS DISTINCT FROM NEW.score THEN
      v_action := 'score.override';
      v_metadata := jsonb_build_object(
        'submission_id', NEW.submission_id,
        'rubric_criterion_id', NEW.rubric_criterion_id,
        'source', NEW.source,
        'previous_score', OLD.score,
        'new_score', NEW.score,
        'state_before', jsonb_build_object('score', OLD.score, 'source', OLD.source),
        'state_after', jsonb_build_object('score', NEW.score, 'source', NEW.source)
      );
    ELSE
      v_action := 'score.updated';
      v_metadata := jsonb_build_object(
        'submission_id', NEW.submission_id,
        'rubric_criterion_id', NEW.rubric_criterion_id
      );
    END IF;
  END IF;

  INSERT INTO public.audit_log (
    institute_id,
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    NEW.institute_id,
    v_actor_id,
    v_actor_role,
    v_action,
    'score',
    NEW.id,
    v_metadata
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_scores_audit ON public.scores;
CREATE TRIGGER tr_scores_audit
  AFTER INSERT OR UPDATE ON public.scores
  FOR EACH ROW EXECUTE FUNCTION public.tr_audit_scores();

-- Trigger on certificates: logs certificate issuance and revocation/status changes
CREATE OR REPLACE FUNCTION public.tr_audit_certificates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role user_role;
  v_action text;
  v_metadata jsonb;
BEGIN
  v_actor_id := public.current_user_id();
  IF v_actor_id IS NULL THEN
    v_actor_id := NEW.trainee_id;
  END IF;

  v_actor_role := public.current_user_role();
  IF v_actor_role IS NULL THEN
    v_actor_role := 'institute_admin'::user_role;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'certificate.issued';
    v_metadata := jsonb_build_object(
      'submission_id', NEW.submission_id,
      'trainee_id', NEW.trainee_id,
      'verification_code', NEW.verification_code,
      'overall_score', NEW.overall_score,
      'status', NEW.status
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'certificate.status_changed';
      v_metadata := jsonb_build_object(
        'verification_code', NEW.verification_code,
        'state_before', jsonb_build_object('status', OLD.status),
        'state_after', jsonb_build_object('status', NEW.status)
      );
    ELSE
      v_action := 'certificate.updated';
      v_metadata := jsonb_build_object(
        'verification_code', NEW.verification_code,
        'status', NEW.status
      );
    END IF;
  END IF;

  INSERT INTO public.audit_log (
    institute_id,
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    NEW.institute_id,
    v_actor_id,
    v_actor_role,
    v_action,
    'certificate',
    NEW.id,
    v_metadata
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_certificates_audit ON public.certificates;
CREATE TRIGGER tr_certificates_audit
  AFTER INSERT OR UPDATE ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.tr_audit_certificates();

