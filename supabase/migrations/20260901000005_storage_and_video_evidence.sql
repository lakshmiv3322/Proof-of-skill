-- ─────────────────────────────────────────────────────────────
-- ProofOfSkill — Storage Setup & Multi-Tenant Video Evidence RLS
-- File: supabase/migrations/20260901000005_storage_and_video_evidence.sql
-- ─────────────────────────────────────────────────────────────

-- 1. Create the submission-videos bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'submission-videos',
  'submission-videos',
  false,               -- Private bucket: accessible only via authenticated RLS or signed URLs
  104857600,           -- 100 MB maximum file size limit
  ARRAY['video/webm', 'video/mp4', 'video/quicktime', 'video/x-matroska']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY['video/webm', 'video/mp4', 'video/quicktime', 'video/x-matroska'];

-- 2. Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Storage Policies for Multi-Tenant Isolation
-- Object paths follow the convention: <institute_id>/<submission_id>/video.webm

-- A. Trainee upload policy: Trainees may only upload video files to their own institute folder
DROP POLICY IF EXISTS "submission_videos_insert_trainee" ON storage.objects;
CREATE POLICY "submission_videos_insert_trainee" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'submission-videos'
    AND (storage.foldername(name))[1] = public.current_user_institute_id()::text
  );

-- B. Tenant read policy: Assessors, admins, and trainees can only read/sign URLs within their own institute
DROP POLICY IF EXISTS "submission_videos_select_tenant" ON storage.objects;
CREATE POLICY "submission_videos_select_tenant" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'submission-videos'
    AND (
      -- Institute staff (assessor, institute_admin, platform_admin) can inspect videos in their institute
      (public.current_user_role() IN ('assessor', 'institute_admin', 'platform_admin')
       AND (storage.foldername(name))[1] = public.current_user_institute_id()::text)
      OR
      -- Trainees can read videos belonging to their institute
      (public.current_user_role() = 'trainee'
       AND (storage.foldername(name))[1] = public.current_user_institute_id()::text)
    )
  );

-- C. Staff delete/manage policy: only institute admins or platform admins can purge evidence
DROP POLICY IF EXISTS "submission_videos_delete_admin" ON storage.objects;
CREATE POLICY "submission_videos_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'submission-videos'
    AND public.current_user_role() IN ('institute_admin', 'platform_admin')
    AND (storage.foldername(name))[1] = public.current_user_institute_id()::text
  );
