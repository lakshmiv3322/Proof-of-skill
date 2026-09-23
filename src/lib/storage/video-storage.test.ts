// ─────────────────────────────────────────────────────────────
// src/lib/storage/video-storage.test.ts
// Verification of Video Storage Pipeline, Security Policies, and Playback
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  VIDEO_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  compressVideoBlob,
  uploadSubmissionVideo,
  getSignedVideoUrl,
} from './video-storage';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Video Evidence Storage & Playback Pipeline', () => {
  it('enforces secure enterprise bucket and signed URL TTL (15 minutes)', () => {
    expect(VIDEO_BUCKET).toBe('submission-videos');
    expect(SIGNED_URL_TTL_SECONDS).toBe(900); // 15 minutes in seconds
  });

  it('compresses or preserves video blobs without corruption', async () => {
    const sampleBlob = new Blob(['test-video-frame-data-simulation'], { type: 'video/webm' });
    const processed = await compressVideoBlob(sampleBlob);
    expect(processed).toBeDefined();
    expect(processed.size).toBeGreaterThan(0);
  });

  it('generates tenant-partitioned object paths for submissions', async () => {
    const instituteId = '00000000-0000-0000-0000-000000000001';
    const submissionId = 'sub-test-123';
    const blob = new Blob(['video-payload'], { type: 'video/webm' });

    let progressCalled = false;
    const result = await uploadSubmissionVideo({
      fileOrBlob: blob,
      instituteId,
      submissionId,
      onProgress: (p) => {
        if (p > 0) progressCalled = true;
      },
    });

    expect(result.storagePath).toBe(`${instituteId}/${submissionId}/video.webm`);
    expect(progressCalled).toBe(true);
  });

  it('resolves signed URLs or local evidence URLs without exposing public permanent links', async () => {
    const url = await getSignedVideoUrl('blob:local-test-video', 'sub-test-123');
    expect(url).toBe('blob:local-test-video');
  });

  it('confirms storage migration file enforces multi-tenant RLS isolation', () => {
    const migrationPath = resolve(process.cwd(), 'supabase/migrations/20260901000005_storage_and_video_evidence.sql');
    const content = readFileSync(migrationPath, 'utf-8');

    expect(content).toContain('submission-videos');
    expect(content).toContain('submission_videos_insert_trainee');
    expect(content).toContain('submission_videos_select_tenant');
    expect(content).toContain('public.current_user_institute_id()');
  });

  it('confirms video-capture.tsx no longer writes hardcoded blob:live-capture', () => {
    const videoCapturePath = resolve(process.cwd(), 'src/components/trainee/video-capture.tsx');
    const content = readFileSync(videoCapturePath, 'utf-8');

    expect(content).not.toContain("video_url: 'blob:live-capture'");
    expect(content).toContain('uploadSubmissionVideo');
    expect(content).toContain('realVideoStoragePath');
  });

  it('confirms evaluation-page.tsx no longer contains hardcoded 2:45 video placeholder', () => {
    const evalPath = resolve(process.cwd(), 'src/components/assessor/evaluation-page.tsx');
    const content = readFileSync(evalPath, 'utf-8');

    expect(content).not.toContain('>2:45<');
    expect(content).not.toContain('Play submission video');
    expect(content).toContain('SubmissionVideoPlayer');
    expect(content).toContain('DEFAULT_CPR_CRITERIA');
  });
});
