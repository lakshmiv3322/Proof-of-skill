import { describe, it, expect } from 'vitest';
import { evaluateSubmissionWithLandmarks } from './rubric-engine';
import type { RubricConfig } from '@/types/database';

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
});
