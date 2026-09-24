import { describe, it, expect } from 'vitest';
import { evaluateSubmissionWithLandmarks } from './rubric-engine';
import type { RubricConfig, PoseLandmark } from '@/types/database';

const TEST_RUBRIC_CONFIG: RubricConfig = {
  total_weight: 100,
  scoring_scale: {
    min: 0,
    max: 100,
    bands: [
      { label: 'Excellent', min: 90, max: 100, color: 'green' },
      { label: 'Competent', min: 70, max: 89, color: 'blue' },
      { label: 'Needs Work', min: 0, max: 69, color: 'red' },
    ],
  },
  criteria: [
    { id: 'cpr-rate', label: 'Compression Rate', weight: 35, description: 'Rate of compressions', indicators: [] },
    { id: 'cpr-depth', label: 'Compression Depth', weight: 30, description: 'Depth of compressions', indicators: [] },
    { id: 'cpr-recoil', label: 'Full Chest Recoil', weight: 20, description: 'Full recoil achieved', indicators: [] },
    { id: 'cpr-posture', label: 'Arm Posture & Alignment', weight: 15, description: 'Arm posture', indicators: [] },
  ],
};

describe('RubricEngine Scoring Bands', () => {
  it('computes overall score correctly for ideal performance', () => {
    const result = evaluateSubmissionWithLandmarks('sub-test-1', TEST_RUBRIC_CONFIG, []);
    expect(result.overallScore).toBeGreaterThanOrEqual(70);
    expect(result.criteriaScores['cpr-rate']).toBeDefined();
    expect(result.criteriaScores['cpr-depth']).toBeDefined();
    expect(result.criteriaScores['cpr-recoil']).toBeDefined();
    expect(result.criteriaScores['cpr-posture']).toBeDefined();
    expect(result.isOfflineScore).toBe(true);
  });

  it('generates structured deltas matching rubric criteria', () => {
    const result = evaluateSubmissionWithLandmarks('sub-test-2', TEST_RUBRIC_CONFIG, []);
    expect(result.deltas.length).toBe(4);
    for (const delta of result.deltas) {
      expect(delta.score).toBeGreaterThanOrEqual(0);
      expect(delta.score).toBeLessThanOrEqual(100);
      expect(delta.weight).toBeGreaterThan(0);
      expect(typeof delta.delta).toBe('string');
    }
  });

  it('guarantees identical rubric depth score at near (1m) and far (2.5m) camera distances', () => {
    const targetPhysicalDepthCm = 5.5;
    const standardShoulderWidthCm = 39.0;
    const compressionRatio = targetPhysicalDepthCm / standardShoulderWidthCm;
    const frameCount = 64;

    // 1.0m Near capture
    const nearShoulderWidth = 0.30;
    const nearWristExcursion = nearShoulderWidth * compressionRatio;
    const nearLandmarks: PoseLandmark[] = Array.from({ length: frameCount }, (_, i) => {
      const phase = (i / 16) * 2 * Math.PI;
      const cycleOffset = ((Math.sin(phase) + 1) / 2) * nearWristExcursion;
      return {
        frame: i,
        timestamp_ms: i * 33.3,
        points: [
          { name: 'left_shoulder', x: 0.35, y: 0.25, z: 0, visibility: 0.99 },
          { name: 'right_shoulder', x: 0.35 + nearShoulderWidth, y: 0.25, z: 0, visibility: 0.99 },
          { name: 'left_wrist', x: 0.50, y: 0.55 + cycleOffset, z: 0, visibility: 0.99 },
          { name: 'right_wrist', x: 0.50, y: 0.55 + cycleOffset, z: 0, visibility: 0.99 },
        ],
      };
    });

    // 2.5m Far capture
    const farDistanceFactor = 2.5;
    const farShoulderWidth = nearShoulderWidth / farDistanceFactor;
    const farWristExcursion = nearWristExcursion / farDistanceFactor;
    const farLandmarks: PoseLandmark[] = Array.from({ length: frameCount }, (_, i) => {
      const phase = (i / 16) * 2 * Math.PI;
      const cycleOffset = ((Math.sin(phase) + 1) / 2) * farWristExcursion;
      return {
        frame: i,
        timestamp_ms: i * 33.3,
        points: [
          { name: 'left_shoulder', x: 0.44, y: 0.25, z: 0, visibility: 0.99 },
          { name: 'right_shoulder', x: 0.44 + farShoulderWidth, y: 0.25, z: 0, visibility: 0.99 },
          { name: 'left_wrist', x: 0.50, y: 0.55 + cycleOffset, z: 0, visibility: 0.99 },
          { name: 'right_wrist', x: 0.50, y: 0.55 + cycleOffset, z: 0, visibility: 0.99 },
        ],
      };
    });

    const nearResult = evaluateSubmissionWithLandmarks('sub-near', TEST_RUBRIC_CONFIG, nearLandmarks);
    const farResult = evaluateSubmissionWithLandmarks('sub-far', TEST_RUBRIC_CONFIG, farLandmarks);

    // Both must achieve 100/100 on compression depth
    expect(nearResult.criteriaScores['cpr-depth']).toBe(100);
    expect(farResult.criteriaScores['cpr-depth']).toBe(100);
    expect(nearResult.metrics.actualDepthCm).toBeCloseTo(5.5, 1);
    expect(farResult.metrics.actualDepthCm).toBeCloseTo(5.5, 1);
  });
});
