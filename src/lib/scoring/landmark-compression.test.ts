import { describe, it, expect } from 'vitest';
import { compressLandmarks, decompressLandmarks } from './landmark-compression';
import { extractKinematics } from './dtw';
import type { PoseLandmark } from '@/types/database';

describe('Landmark Compression & Scoring Equivalence', () => {
  it('compresses and decompresses landmark sequence without altering kinematic scoring results', () => {
    const mockSequence: PoseLandmark[] = Array.from({ length: 60 }, (_, i) => ({
      frame: i,
      timestamp_ms: i * 33,
      points: [
        { name: 'left_shoulder', x: 0.35, y: 0.25, z: 0.012345, visibility: 0.99876 },
        { name: 'right_shoulder', x: 0.65, y: 0.25, z: 0.012345, visibility: 0.99876 },
        { name: 'left_wrist', x: 0.5, y: 0.5 + Math.sin(i / 5) * 0.1, z: 0, visibility: 0.99 },
        { name: 'right_wrist', x: 0.5, y: 0.5 + Math.sin(i / 5) * 0.1, z: 0, visibility: 0.99 },
      ],
    }));

    const compressedJson = compressLandmarks(mockSequence);
    const compressedSize = new Blob([compressedJson]).size;
    const uncompressedSize = new Blob([JSON.stringify(mockSequence)]).size;

    // Verify significant size reduction
    expect(compressedSize).toBeLessThan(uncompressedSize);

    const restoredSequence = decompressLandmarks(compressedJson);
    expect(restoredSequence.length).toBe(mockSequence.length);

    const originalKinematics = extractKinematics(mockSequence);
    const restoredKinematics = extractKinematics(restoredSequence);

    expect(restoredKinematics.estimatedBpm).toBe(originalKinematics.estimatedBpm);
    expect(restoredKinematics.estimatedDepthCm).toBeCloseTo(originalKinematics.estimatedDepthCm, 2);
    expect(restoredKinematics.recoilIncompletePct).toBe(originalKinematics.recoilIncompletePct);
  });
});
