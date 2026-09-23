import { describe, it, expect } from 'vitest';
import { calculateRealDTW, extractKinematics, generateReferenceExemplar } from './dtw';
import type { PoseLandmark } from '@/types/database';

describe('DTW Kinematics Extraction', () => {
  it('generates standard reference exemplar trajectory', () => {
    const series = generateReferenceExemplar(150);
    expect(series.length).toBe(150);
    expect(series[0]).toBeDefined();
  });

  it('handles empty landmark sequence gracefully with fallback DTW metrics', () => {
    const dtwResult = calculateRealDTW('');
    expect(typeof dtwResult.rateVarianceBpm).toBe('number');
    expect(typeof dtwResult.depthVarianceCm).toBe('number');
    expect(typeof dtwResult.releaseVariancePct).toBe('number');
    expect(typeof dtwResult.postureVarianceScore).toBe('number');
    expect(typeof dtwResult.rawDtwDistance).toBe('number');
  });

  it('computes kinematics from mock 33-point BlazePose sequence', () => {
    const mockSequence: PoseLandmark[] = Array.from({ length: 30 }, (_, i) => ({
      frame: i,
      timestamp_ms: i * 33,
      points: [
        { name: 'LEFT_SHOULDER', x: 0.4, y: 0.3 + (i % 5) * 0.02, z: 0, visibility: 0.99 },
        { name: 'RIGHT_SHOULDER', x: 0.6, y: 0.3 + (i % 5) * 0.02, z: 0, visibility: 0.99 },
        { name: 'LEFT_ELBOW', x: 0.38, y: 0.45, z: 0, visibility: 0.99 },
        { name: 'RIGHT_ELBOW', x: 0.62, y: 0.45, z: 0, visibility: 0.99 },
        { name: 'LEFT_WRIST', x: 0.5, y: 0.65, z: 0, visibility: 0.99 },
        { name: 'RIGHT_WRIST', x: 0.5, y: 0.65, z: 0, visibility: 0.99 },
      ],
    }));

    const result = extractKinematics(mockSequence);
    expect(typeof result.estimatedBpm).toBe('number');
    expect(typeof result.estimatedDepthCm).toBe('number');
    expect(typeof result.recoilIncompletePct).toBe('number');
  });
});
