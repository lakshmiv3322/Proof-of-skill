import { describe, it, expect } from 'vitest';
import { computeVerificationHash } from './pdf-generator';

describe('Certificate Verification Hashing', () => {
  it('computes deterministic SHA-256 hash string for certificate payload', async () => {
    const params = {
      certificateId: 'cert-12345',
      submissionId: 'sub-67890',
      traineeId: 'user-trainee-1',
      score: 94.5,
      issuedAt: '2026-08-15T12:00:00Z',
    };

    const hash1 = await computeVerificationHash(params);
    const hash2 = await computeVerificationHash(params);

    expect(typeof hash1).toBe('string');
    expect(hash1.length).toBeGreaterThanOrEqual(16);
    expect(hash1).toBe(hash2);
  });

  it('produces different hash outputs for different scores', async () => {
    const baseParams = {
      certificateId: 'cert-12345',
      submissionId: 'sub-67890',
      traineeId: 'user-trainee-1',
      issuedAt: '2026-08-15T12:00:00Z',
    };

    const hashA = await computeVerificationHash({ ...baseParams, score: 94.5 });
    const hashB = await computeVerificationHash({ ...baseParams, score: 85.0 });

    expect(hashA).not.toBe(hashB);
  });
});
