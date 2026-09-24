-- ─────────────────────────────────────────────────────────────
-- ProofOfSkill — Submission Staging Retention & Cleanup Policy
-- File: supabase/migrations/20260901000006_submission_staging_retention_policy.sql
-- ─────────────────────────────────────────────────────────────

-- 1. Database Function: Purge completed staging rows
-- Only purges rows marked as 'completed' (successfully scored & persisted in submissions/scores).
-- Pending and failed staging rows are preserved indefinitely for retry and debugging.
CREATE OR REPLACE FUNCTION public.purge_completed_submission_staging(p_retention_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  -- Delete completed staging records older than the retention window
  DELETE FROM public.submission_staging
  WHERE status = 'completed'
    AND created_at < (now() - (p_retention_days || ' days')::interval);

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Log audit event if any rows were purged
  IF v_deleted_count > 0 THEN
    INSERT INTO public.audit_log (
      institute_id,
      actor_id,
      actor_role,
      action,
      entity_type,
      entity_id,
      metadata,
      created_at
    )
    SELECT
      id,
      '00000000-0000-0000-0000-000000000001'::uuid,
      'platform_admin'::user_role,
      'staging.purged',
      'submission_staging',
      gen_random_uuid(),
      jsonb_build_object(
        'purged_count', v_deleted_count,
        'retention_days', p_retention_days,
        'executed_at', now()
      ),
      now()
    FROM public.institutes
    LIMIT 1;
  END IF;

  RETURN v_deleted_count;
END;
$$;

-- Grant execution to authenticated staff and service role
GRANT EXECUTE ON FUNCTION public.purge_completed_submission_staging(integer) TO authenticated, service_role;

-- 2. Immediate cleanup helper function for single completed staging ID
CREATE OR REPLACE FUNCTION public.archive_or_delete_staging_row(p_staging_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status
  FROM public.submission_staging
  WHERE id = p_staging_id;

  IF v_status IS NULL THEN
    RETURN false;
  END IF;

  -- ONLY delete if already completed or being marked completed
  -- Never delete pending or failed rows
  IF v_status = 'completed' OR v_status = 'processing' THEN
    DELETE FROM public.submission_staging WHERE id = p_staging_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_or_delete_staging_row(uuid) TO authenticated, service_role;

-- 3. Setup pg_cron scheduled job if pg_cron extension is available (Supabase Pro/Enterprise)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Run daily at 03:00 UTC to purge completed staging rows older than 30 days
    PERFORM cron.schedule(
      'purge_old_completed_staging_daily',
      '0 3 * * *',
      'SELECT public.purge_completed_submission_staging(30);'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- pg_cron not active on standard local or free tier instances; safe to ignore
    NULL;
END;
$$;
