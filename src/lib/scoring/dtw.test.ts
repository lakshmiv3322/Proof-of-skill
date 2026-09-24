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

  it('eliminates camera-distance scoring drift: near camera (1.0m) and far camera (2.5m) yield identical depth', () => {
    // Target physical compression: 5.5 cm depth at 110 BPM (cycle ~545ms, ~16 frames at 30fps)
    // Standard adult bi-acromial shoulder breadth = 39.0 cm
    const targetPhysicalDepthCm = 5.5;
    const standardShoulderWidthCm = 39.0;
    const compressionRatio = targetPhysicalDepthCm / standardShoulderWidthCm; // ~0.141025

    const frameCount = 64; // ~4 full compression cycles

    // Scenario A: Near camera (1.0m) — Trainee appears large in frame
    // Shoulder width in frame = 0.30
    const nearShoulderWidth = 0.30;
    const nearWristExcursion = nearShoulderWidth * compressionRatio; // ~0.04231

    const nearSequence: PoseLandmark[] = Array.from({ length: frameCount }, (_, i) => {
      // Sinusoidal compression cycle
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

    // Scenario B: Far camera (2.5m) — Trainee appears 2.5x smaller in frame
    // Both shoulder distance and wrist movement in pixel/frame coordinates shrink by 2.5x
    const farDistanceFactor = 2.5;
    const farShoulderWidth = nearShoulderWidth / farDistanceFactor; // 0.12
    const farWristExcursion = nearWristExcursion / farDistanceFactor; // ~0.01692

    const farSequence: PoseLandmark[] = Array.from({ length: frameCount }, (_, i) => {
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

    const nearResult = extractKinematics(nearSequence);
    const farResult = extractKinematics(farSequence);

    // Both near (1.0m) and far (2.5m) must compute target 5.5 cm depth (+/- 0.1 cm)
    expect(nearResult.estimatedDepthCm).toBeCloseTo(5.5, 1);
    expect(farResult.estimatedDepthCm).toBeCloseTo(5.5, 1);

    // Drift between near and far camera captures must be virtually zero (< 0.1 cm)
    const driftDelta = Math.abs(nearResult.estimatedDepthCm - farResult.estimatedDepthCm);
    expect(driftDelta).toBeLessThan(0.1);
  });

  it('detects and flags occluded or partial shoulder visibility with visible fallback warning', () => {
    const frameCount = 32;

    // Sequence with occluded shoulders (visibility < 0.25, e.g. tight camera crop on hands only)
    const occludedSequence: PoseLandmark[] = Array.from({ length: frameCount }, (_, i) => ({
      frame: i,
      timestamp_ms: i * 33.3,
      points: [
        { name: 'left_shoulder', x: 0.35, y: 0.25, z: 0, visibility: 0.10 }, // Below 0.25 threshold
        { name: 'right_shoulder', x: 0.65, y: 0.25, z: 0, visibility: 0.15 }, // Below 0.25 threshold
        { name: 'left_wrist', x: 0.50, y: 0.55 + ((Math.sin(i / 4) + 1) / 2) * 0.05, z: 0, visibility: 0.95 },
        { name: 'right_wrist', x: 0.50, y: 0.55 + ((Math.sin(i / 4) + 1) / 2) * 0.05, z: 0, visibility: 0.95 },
      ],
    }));

    const kinematics = extractKinematics(occludedSequence);
    expect(kinematics.anatomicalScaleFallback).toBe(true);
    expect(kinematics.anatomicalScaleWarning).toBeDefined();
    expect(kinematics.anatomicalScaleWarning).toContain('Shoulder and torso landmarks were occluded');

    const dtwResult = calculateRealDTW('sub-occluded-test', occludedSequence);
    expect(dtwResult.anatomicalScaleFallback).toBe(true);
    expect(dtwResult.anatomicalScaleWarning).toBeDefined();
  });

  it('uses torso length fallback when shoulders are occluded but hips and shoulders form a trunk', () => {
    const frameCount = 32;

    // Sequence where shoulders and hips are clearly visible, but shoulders alone aren't wide
    const torsoSequence: PoseLandmark[] = Array.from({ length: frameCount }, (_, i) => ({
      frame: i,
      timestamp_ms: i * 33.3,
      points: [
        { name: 'left_shoulder', x: 0.45, y: 0.20, z: 0, visibility: 0.95 },
        { name: 'right_shoulder', x: 0.55, y: 0.20, z: 0, visibility: 0.95 },
        { name: 'left_hip', x: 0.45, y: 0.60, z: 0, visibility: 0.95 },
        { name: 'right_hip', x: 0.55, y: 0.60, z: 0, visibility: 0.95 },
        { name: 'left_wrist', x: 0.50, y: 0.55 + ((Math.sin(i / 4) + 1) / 2) * 0.05, z: 0, visibility: 0.95 },
        { name: 'right_wrist', x: 0.50, y: 0.55 + ((Math.sin(i / 4) + 1) / 2) * 0.05, z: 0, visibility: 0.95 },
      ],
    }));

    const kinematics = extractKinematics(torsoSequence);
    expect(kinematics.anatomicalScaleFallback).toBe(false);
  });
});
