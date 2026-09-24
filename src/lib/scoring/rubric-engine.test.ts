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

  it('evaluates rule-configured CPR rubric with identical scores', () => {
    const jsonRuleRubric: RubricConfig = {
      total_weight: 100,
      scoring_scale: {
        min: 0,
        max: 100,
        bands: [{ label: 'Pass', min: 70, max: 100, color: 'blue' }],
      },
      criteria: [
        {
          id: 'crit-rate',
          label: 'Compression Rate',
          ruleType: 'frequency_bpm',
          targetMin: 100,
          targetMax: 120,
          tolerance: 10,
          weight: 35,
          description: '100–120 BPM',
          indicators: [],
        },
        {
          id: 'crit-depth',
          label: 'Compression Depth',
          ruleType: 'depth_normalized',
          targetMin: 5.0,
          targetMax: 6.0,
          tolerance: 0.5,
          weight: 35,
          description: '5.0–6.0 cm',
          indicators: [],
        },
        {
          id: 'crit-recoil',
          label: 'Full Chest Recoil',
          ruleType: 'recoil_completeness',
          maxIncompletePct: 5,
          weight: 15,
          description: '<5% incomplete',
          indicators: [],
        },
        {
          id: 'crit-posture',
          label: 'Rescuer Posture',
          ruleType: 'posture_variance',
          targetMin: 0,
          targetMax: 15,
          weight: 15,
          description: 'Straight arms',
          indicators: [],
        },
      ],
    };

    const result = evaluateSubmissionWithLandmarks('sub-rule-cpr', jsonRuleRubric, []);
    expect(result.overallScore).toBeGreaterThanOrEqual(80);
    expect(result.criteriaScores['crit-rate']).toBe(100);
    expect(result.criteriaScores['crit-depth']).toBe(100);
    expect(result.criteriaScores['crit-recoil']).toBe(100);
    expect(result.criteriaScores['crit-posture']).toBe(100);
  });

  it('evaluates rule-configured Welding rubric (SMAW) end-to-end', () => {
    const weldingRubric: RubricConfig = {
      total_weight: 100,
      scoring_scale: {
        min: 0,
        max: 100,
        bands: [
          { label: 'Certified', min: 75, max: 100, color: 'emerald' },
          { label: 'Unsatisfactory', min: 0, max: 74, color: 'red' },
        ],
      },
      criteria: [
        {
          id: 'weld-travel-speed',
          label: 'Travel Speed Progression',
          ruleType: 'travel_speed',
          landmark: 'right_wrist',
          targetMin: 2.5,
          targetMax: 4.5,
          tolerance: 1.0,
          unit: 'mm/s',
          weight: 30,
          description: 'Maintain 2.5–4.5 mm/s',
          indicators: ['2.5–4.5 mm/s'],
        },
        {
          id: 'weld-torch-angle',
          label: 'Lead/Work Torch Angle',
          ruleType: 'joint_angle_range',
          landmarks: ['right_shoulder', 'right_elbow', 'right_wrist'],
          targetMin: 70,
          targetMax: 85,
          tolerance: 10,
          unit: 'deg',
          weight: 30,
          description: '70°–85° drag angle',
          indicators: ['70°–85°'],
        },
        {
          id: 'weld-arc-stability',
          label: 'Arc Length & Standoff Stability',
          ruleType: 'path_stability',
          landmark: 'right_wrist',
          maxDeviation: 1.2,
          tolerance: 0.5,
          unit: 'cm',
          weight: 25,
          description: '< 1.2 cm wandering',
          indicators: ['< 1.2 cm'],
        },
        {
          id: 'weld-safety-posture',
          label: 'Welder Stance & Body Clearance',
          ruleType: 'posture_variance',
          targetMin: 0,
          targetMax: 70,
          tolerance: 15,
          weight: 15,
          description: 'Proper welder stance',
          indicators: ['Stable stance'],
        },
      ],
    };

    const frameCount = 30;
    const weldingLandmarks: PoseLandmark[] = Array.from({ length: frameCount }, (_, i) => {
      // Shoulder width = 0.30 frame units (39.0 cm -> 130 cm/unit)
      // Shoulder at (0.50, 0.15), Elbow at (0.50, 0.35) -> v1 = (0, -0.20)
      // Wrist at (0.693, 0.30) -> v2 = (0.193, -0.05) -> Angle is exactly 75.5° (optimal 70-85° window)
      // Travel: 0.35 cm in 1 sec = 0.00269 frame units displacement -> ~3.5 mm/s
      const xProgress = (i / frameCount) * 0.00269;
      return {
        frame: i,
        timestamp_ms: i * 33.3,
        points: [
          { name: 'left_shoulder', x: 0.20, y: 0.15, z: 0, visibility: 0.99 },
          { name: 'right_shoulder', x: 0.50, y: 0.15, z: 0, visibility: 0.99 },
          { name: 'right_elbow', x: 0.50, y: 0.35, z: 0, visibility: 0.99 },
          { name: 'right_wrist', x: 0.693 + xProgress, y: 0.30, z: 0, visibility: 0.99 },
        ],
      };
    });

    const result = evaluateSubmissionWithLandmarks('sub-weld-1', weldingRubric, weldingLandmarks);
    expect(result.overallScore).toBeGreaterThanOrEqual(75);
    expect(result.criteriaScores['weld-travel-speed']).toBe(100);
    expect(result.criteriaScores['weld-torch-angle']).toBe(100);
    expect(result.criteriaScores['weld-arc-stability']).toBe(100);
    expect(result.criteriaScores['weld-safety-posture']).toBe(100);
    expect(result.deltas.length).toBe(4);
  });
});
