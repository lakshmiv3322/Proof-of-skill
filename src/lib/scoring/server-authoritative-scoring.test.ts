import { describe, it, expect } from 'vitest';
import { evaluateSubmissionWithLandmarks } from './rubric-engine';
import type { RubricConfig } from '@/types/database';
import fs from 'node:fs';
import path from 'node:path';

const STANDARD_CPR_RUBRIC: RubricConfig = {
  total_weight: 100,
  scoring_scale: {
    min: 0,
    max: 100,
    bands: [
      { label: 'Certified', min: 80, max: 100, color: 'green' },
      { label: 'Needs Practice', min: 0, max: 79, color: 'amber' },
    ],
  },
  criteria: [
    { id: 'cpr-rate', label: 'Compression Rate', description: 'Target 100-120 BPM', weight: 35, indicators: ['100-120 BPM'] },
    { id: 'cpr-depth', label: 'Compression Depth', description: 'Target 5.0-6.0 cm', weight: 35, indicators: ['5.0-6.0 cm'] },
    { id: 'cpr-recoil', label: 'Chest Recoil', description: 'Full recoil after each compression', weight: 15, indicators: ['Full recoil'] },
    { id: 'cpr-posture', label: 'Rescuer Posture', description: 'Arms straight, shoulders over hands', weight: 15, indicators: ['Arms locked'] },
  ],
};

describe('Server-Authoritative Scoring & RLS Lockdown Verification', () => {
  it('RLS Hardening Migration removes trainee INSERT on submissions, scores, and pose_landmark_sets', () => {
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20260901000001_rls_hardening.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // 1. Verify trainee INSERT policies are explicitly dropped
    expect(sql).toContain('DROP POLICY IF EXISTS "submissions_insert_trainee" ON submissions;');
    expect(sql).toContain('DROP POLICY IF EXISTS "scores_insert_trainee" ON scores;');
    expect(sql).toContain('DROP POLICY IF EXISTS "pose_landmark_sets_insert_trainee" ON pose_landmark_sets;');

    // 2. Verify no active CREATE POLICY granting INSERT to trainee on submissions or scores
    expect(sql).not.toMatch(/CREATE POLICY "submissions_insert_trainee"/);
    expect(sql).not.toMatch(/CREATE POLICY "scores_insert_trainee"/);
    expect(sql).not.toMatch(/CREATE POLICY "pose_landmark_sets_insert_trainee"/);

    // 3. Verify submission_staging table exists for raw trainee upload
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.submission_staging');
    expect(sql).toContain('CREATE POLICY "submission_staging_insert_trainee" ON public.submission_staging');
  });

  it('Score-Submission Edge Function is the sole score writer using service_role', () => {
    const edgeFunctionPath = path.resolve(process.cwd(), 'supabase/functions/score-submission/index.ts');
    const edgeFunctionCode = fs.readFileSync(edgeFunctionPath, 'utf8');

    // Verifies service role client is instantiated
    expect(edgeFunctionCode).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(edgeFunctionCode).toContain('createClient(supabaseUrl, serviceRoleKey)');

    // Verifies edge function writes to database tables
    expect(edgeFunctionCode).toContain('supabase.from("submissions").insert');
    expect(edgeFunctionCode).toContain('supabase.from("scores").insert');
    expect(edgeFunctionCode).toContain('supabase.from("pose_landmark_sets").insert');

    // Verifies score calculation is deterministic
    expect(edgeFunctionCode).toContain('computeDTWMetrics');
  });

  it('Client video-capture does NOT perform direct inserts into scores or submissions', () => {
    const clientPath = path.resolve(process.cwd(), 'src/components/trainee/video-capture.tsx');
    const clientCode = fs.readFileSync(clientPath, 'utf8');

    // Verify client only stages raw captures and calls server scoring
    expect(clientCode).toContain("from('submission_staging')");
    expect(clientCode).toContain('evaluateSubmissionServer');

    // Client must not execute direct supabase inserts to submissions or scores tables
    expect(clientCode).not.toContain("supabase.from('submissions').insert");
    expect(clientCode).not.toContain("supabase.from('scores').insert");
    expect(clientCode).not.toContain("supabase.from('pose_landmark_sets').insert");
  });

  it('Migration contains database-driven audit triggers on scores, submissions, and certificates', () => {
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20260901000004_server_authoritative_scoring_and_audit.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('tr_submissions_audit');
    expect(sql).toContain('AFTER INSERT OR UPDATE ON public.submissions');

    expect(sql).toContain('tr_scores_audit');
    expect(sql).toContain('AFTER INSERT OR UPDATE ON public.scores');

    expect(sql).toContain('tr_certificates_audit');
    expect(sql).toContain('AFTER INSERT OR UPDATE ON public.certificates');
  });

  it('DTW Scoring Math is consistent and deterministic', () => {
    const result1 = evaluateSubmissionWithLandmarks('sub-deterministic-1', STANDARD_CPR_RUBRIC);
    const result2 = evaluateSubmissionWithLandmarks('sub-deterministic-1', STANDARD_CPR_RUBRIC);

    expect(result1.overallScore).toEqual(result2.overallScore);
    expect(result1.criteriaScores).toEqual(result2.criteriaScores);
    expect(result1.metrics.actualBpm).toEqual(result2.metrics.actualBpm);
    expect(result1.metrics.actualDepthCm).toEqual(result2.metrics.actualDepthCm);
  });

  it('Migration 20260901000006 defines staging retention purge preserving pending/failed rows', () => {
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20260901000006_submission_staging_retention_policy.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('purge_completed_submission_staging');
    expect(sql).toContain("WHERE status = 'completed'");
    expect(sql).not.toContain("WHERE status = 'pending'");
    expect(sql).not.toContain("WHERE status = 'failed'");
    expect(sql).toContain('archive_or_delete_staging_row');
  });

  it('Score-submission edge function purges staging row on successful score commit', () => {
    const edgeFunctionPath = path.resolve(process.cwd(), 'supabase/functions/score-submission/index.ts');
    const edgeFunctionCode = fs.readFileSync(edgeFunctionPath, 'utf8');

    expect(edgeFunctionCode).toContain('.from("submission_staging")');
    expect(edgeFunctionCode).toContain('.delete()');
    expect(edgeFunctionCode).toContain('.eq("id", stagingId)');
    expect(edgeFunctionCode).toContain('anatomicalScaleFallback');
    expect(edgeFunctionCode).toContain('anatomicalScaleWarning');
  });
});
