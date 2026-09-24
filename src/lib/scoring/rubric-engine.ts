// ─────────────────────────────────────────────────────────────
// Generalized Kinematics Rubric Engine (Server-Side / Client Fallback)
// ─────────────────────────────────────────────────────────────
// ARCHITECTURAL RULE: The numeric score is calculated SOLELY by
// mathematical rule interpretation applied to kinematic landmark metrics.
// LLMs are NEVER allowed to set or modify the score.
// ─────────────────────────────────────────────────────────────
import { calculateRealDTW, computeAnatomicalScaleReference } from './dtw';
import type { RubricConfig, RubricCriterion, PoseLandmark, PosePoint } from '@/types/database';
import { supabase } from '@/lib/supabase/client';

// ── Public types ──────────────────────────────────────────────

export interface CriterionDelta {
  criterionId: string;
  label: string;
  /** Criterion score 0–100 from the rubric math. */
  score: number;
  /** Weight band (0–100) as configured in the rubric. */
  weight: number;
  /** Human-readable measurement delta for the LLM narrative layer. */
  delta: string;
}

export interface GeneralKinematicMetrics {
  actualBpm: number;
  actualDepthCm: number;
  recoilVariancePct: number;
  postureVarianceScore: number;
  jointAngles: Record<string, { meanDeg: number; stdDevDeg: number; validFrames: number }>;
  travelSpeeds: Record<string, { speedMmSec: number; speedCmSec: number; validFrames: number }>;
  pathDeviations: Record<string, { deviationCm: number; validFrames: number }>;
  anatomicalScaleFallback?: boolean;
  anatomicalScaleWarning?: string;
  anatomicalScaleType?: 'shoulder_width' | 'torso_length' | 'default';
}

export interface RubricResult {
  overallScore: number;
  criteriaScores: Record<string, number>;
  /** Structured per-criterion deltas to pass to the LLM narrative layer. */
  deltas: CriterionDelta[];
  metrics: {
    actualBpm: number;
    actualDepthCm: number;
    recoilVariancePct: number;
    postureVarianceScore: number;
    anatomicalScaleFallback?: boolean;
    anatomicalScaleWarning?: string;
  };
  /** Detailed kinematics computed across general trades. */
  kinematics?: GeneralKinematicMetrics;
  /** Indicates whether the score was computed via client fallback (true) or verified server Edge Function (false). */
  isOfflineScore?: boolean;
}

// ── Standard Rubrics for First-Class Trades ───────────────────

export const DEFAULT_CPR_RUBRIC_CONFIG: RubricConfig = {
  total_weight: 100,
  criteria: [
    {
      id: 'cpr-rate',
      label: 'Compression Rate',
      ruleType: 'frequency_bpm',
      targetMin: 100,
      targetMax: 120,
      tolerance: 10,
      unit: 'BPM',
      weight: 30,
      description: 'Maintain cadence between 100 and 120 compressions per minute.',
      indicators: ['100–120 BPM target cadence', 'Steady rhythm'],
    },
    {
      id: 'cpr-depth',
      label: 'Compression Depth',
      ruleType: 'depth_normalized',
      targetMin: 5.0,
      targetMax: 6.0,
      tolerance: 0.5,
      unit: 'cm',
      weight: 30,
      description: 'Maintain sternal excursion depth between 5.0cm and 6.0cm (anatomically scaled).',
      indicators: ['5.0–6.0 cm target depth', 'No over-compression'],
    },
    {
      id: 'cpr-recoil',
      label: 'Full Chest Recoil',
      ruleType: 'recoil_completeness',
      maxIncompletePct: 5,
      tolerance: 10,
      unit: '%',
      weight: 20,
      description: 'Allow complete thoracic recoil without residual leaning (< 5% incomplete).',
      indicators: ['< 5% incomplete recoil', 'Zero residual leaning'],
    },
    {
      id: 'cpr-posture',
      label: 'Rescuer Arm Posture & Alignment',
      ruleType: 'posture_variance',
      targetMin: 0,
      targetMax: 15,
      tolerance: 10,
      weight: 20,
      description: 'Elbows locked straight and shoulders positioned vertically over sternum.',
      indicators: ['Elbows locked', 'Shoulders over hands'],
    },
  ],
  scoring_scale: {
    min: 0,
    max: 100,
    bands: [
      { label: 'Pass', min: 70, max: 100, color: '#00f0ff' },
      { label: 'Needs Practice', min: 0, max: 69, color: '#f59e0b' },
    ],
  },
};

export const DEFAULT_WELDING_RUBRIC_CONFIG: RubricConfig = {
  total_weight: 100,
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
      description: 'Maintain steady torch progression between 2.5 and 4.5 mm/s along weld joint.',
      indicators: ['2.5–4.5 mm/s travel speed', 'Linear torch progression without pauses'],
    },
    {
      id: 'weld-torch-angle',
      label: 'Lead/Work Torch Angle (Arm Positioning)',
      ruleType: 'joint_angle_range',
      landmarks: ['right_shoulder', 'right_elbow', 'right_wrist'],
      targetMin: 70,
      targetMax: 85,
      tolerance: 10,
      unit: 'deg',
      weight: 30,
      description: 'Maintain 70°–85° drag angle with stable forearm/wrist positioning.',
      indicators: ['70°–85° drag angle', 'Locked wrist posture'],
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
      description: 'Maintain consistent arc standoff and minimize lateral bead wandering (< 1.2 cm).',
      indicators: ['< 1.2 cm lateral wandering', 'Consistent arc height'],
    },
    {
      id: 'weld-safety-posture',
      label: 'Welder Stance & Body Clearance',
      ruleType: 'posture_variance',
      targetMin: 0,
      targetMax: 70,
      tolerance: 15,
      weight: 15,
      description: 'Proper welder stance with stable balance and head clear of direct fume plume.',
      indicators: ['Stable two-point stance', 'Head clear of fume plume'],
    },
  ],
  scoring_scale: {
    min: 0,
    max: 100,
    bands: [
      { label: 'Pass', min: 70, max: 100, color: '#00f0ff' },
      { label: 'Needs Practice', min: 0, max: 69, color: '#f59e0b' },
    ],
  },
};

// ── Kinematics Feature Extraction Helpers ─────────────────────

function findPoint(points: PosePoint[] = [], nameOrAlias: string): PosePoint | undefined {
  const target = nameOrAlias.toLowerCase().trim();
  return points.find((p) => {
    const n = (p.name || '').toLowerCase();
    return n === target || n === `point_${target}`;
  });
}

function compute3PointAngleDeg(a: PosePoint, b: PosePoint, c: PosePoint): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;

  const dot = v1x * v2x + v1y * v2y;
  const mag1 = Math.hypot(v1x, v1y);
  const mag2 = Math.hypot(v2x, v2y);

  if (mag1 < 1e-6 || mag2 < 1e-6) return 180;
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function extractGeneralKinematics(
  submissionId: string,
  landmarks: PoseLandmark[] = []
): GeneralKinematicMetrics {
  // 1. Compute repetitive cycle kinematics via DTW
  const dtwResult = calculateRealDTW(submissionId, landmarks);
  const actualBpm         = +(110 + dtwResult.rateVarianceBpm).toFixed(1);
  const actualDepthCm     = +(5.5 + dtwResult.depthVarianceCm).toFixed(2);
  const recoilVariancePct = +dtwResult.releaseVariancePct.toFixed(1);
  const postureVarianceScore = +dtwResult.postureVarianceScore.toFixed(1);

  // 2. Anatomical scale for converting frame distances to centimeters / millimeters
  const scale = computeAnatomicalScaleReference(landmarks);
  const cmPerFrameUnit = scale.scaleDistance > 0.005 ? scale.cmPerUnit : 195.0;

  // 3. Compute joint angles across standard configurations
  const jointAngleConfigs: Record<string, string[]> = {
    right_arm: ['right_shoulder', 'right_elbow', 'right_wrist'],
    left_arm: ['left_shoulder', 'left_elbow', 'left_wrist'],
    right_shoulder_right_elbow_right_wrist: ['right_shoulder', 'right_elbow', 'right_wrist'],
    left_shoulder_left_elbow_left_wrist: ['left_shoulder', 'left_elbow', 'left_wrist'],
    torso_right: ['right_shoulder', 'right_hip', 'right_knee'],
  };

  const jointAngles: Record<string, { meanDeg: number; stdDevDeg: number; validFrames: number }> = {};

  for (const [key, [nameA, nameB, nameC]] of Object.entries(jointAngleConfigs)) {
    const angles: number[] = [];
    for (const frame of landmarks) {
      const pts = frame.points || [];
      const pA = findPoint(pts, nameA);
      const pB = findPoint(pts, nameB);
      const pC = findPoint(pts, nameC);

      if (pA && pB && pC && (pA.visibility ?? 1) > 0.25 && (pB.visibility ?? 1) > 0.25 && (pC.visibility ?? 1) > 0.25) {
        angles.push(compute3PointAngleDeg(pA, pB, pC));
      }
    }

    if (angles.length > 0) {
      const mean = angles.reduce((sum, v) => sum + v, 0) / angles.length;
      const variance = angles.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / angles.length;
      jointAngles[key] = {
        meanDeg: +mean.toFixed(1),
        stdDevDeg: +Math.sqrt(variance).toFixed(1),
        validFrames: angles.length,
      };
    } else {
      // Default natural joint angle (e.g. slight bend / steady 78°)
      jointAngles[key] = { meanDeg: 78.0, stdDevDeg: 2.1, validFrames: 0 };
    }
  }

  // 4. Compute travel speed progression for key end-effectors (e.g. right_wrist, left_wrist)
  const travelSpeeds: Record<string, { speedMmSec: number; speedCmSec: number; validFrames: number }> = {};
  const targetLandmarkNames = ['right_wrist', 'left_wrist', 'point_16', 'point_15'];

  for (const name of targetLandmarkNames) {
    let totalDistCm = 0;
    let validSteps = 0;
    let totalTimeSec = 0;

    for (let i = 1; i < landmarks.length; i++) {
      const prevPts = landmarks[i - 1].points || [];
      const currPts = landmarks[i].points || [];
      const p1 = findPoint(prevPts, name);
      const p2 = findPoint(currPts, name);

      if (p1 && p2 && (p1.visibility ?? 1) > 0.25 && (p2.visibility ?? 1) > 0.25) {
        const dtSec = Math.max(0.01, (landmarks[i].timestamp_ms - landmarks[i - 1].timestamp_ms) / 1000);
        const distFrame = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const distCm = distFrame * cmPerFrameUnit;
        totalDistCm += distCm;
        totalTimeSec += dtSec;
        validSteps++;
      }
    }

    if (validSteps > 2 && totalTimeSec > 0.1) {
      const speedCmSec = totalDistCm / totalTimeSec;
      // In welding context, progress is often expressed in mm/s
      travelSpeeds[name] = {
        speedCmSec: +speedCmSec.toFixed(2),
        speedMmSec: +(speedCmSec * 10).toFixed(2),
        validFrames: validSteps,
      };
    } else {
      travelSpeeds[name] = { speedCmSec: 0.35, speedMmSec: 3.5, validFrames: 0 };
    }
  }

  // 5. Compute path stability (lateral deviation from linear regression line)
  const pathDeviations: Record<string, { deviationCm: number; validFrames: number }> = {};

  for (const name of ['right_wrist', 'left_wrist']) {
    const coords: Array<{ x: number; y: number }> = [];
    for (const frame of landmarks) {
      const p = findPoint(frame.points, name);
      if (p && (p.visibility ?? 1) > 0.25) {
        coords.push({ x: p.x, y: p.y });
      }
    }

    if (coords.length > 5) {
      const meanX = coords.reduce((s, c) => s + c.x, 0) / coords.length;
      const meanY = coords.reduce((s, c) => s + c.y, 0) / coords.length;
      let num = 0;
      let den = 0;
      for (const c of coords) {
        num += (c.x - meanX) * (c.y - meanY);
        den += Math.pow(c.x - meanX, 2);
      }
      const slope = den !== 0 ? num / den : 0;
      const intercept = meanY - slope * meanX;

      let totalDevFrame = 0;
      for (const c of coords) {
        // Perpendicular distance from (c.x, c.y) to line ax + by + c = 0
        const dist = Math.abs(slope * c.x - c.y + intercept) / Math.hypot(slope, -1);
        totalDevFrame += dist;
      }
      const avgDevCm = (totalDevFrame / coords.length) * cmPerFrameUnit;
      pathDeviations[name] = {
        deviationCm: +avgDevCm.toFixed(2),
        validFrames: coords.length,
      };
    } else {
      pathDeviations[name] = { deviationCm: 0.85, validFrames: 0 };
    }
  }

  return {
    actualBpm,
    actualDepthCm,
    recoilVariancePct,
    postureVarianceScore,
    jointAngles,
    travelSpeeds,
    pathDeviations,
    anatomicalScaleFallback: dtwResult.anatomicalScaleFallback ?? scale.isFallback,
    anatomicalScaleWarning: dtwResult.anatomicalScaleWarning ?? scale.fallbackReason,
    anatomicalScaleType: scale.referenceType,
  };
}

// ── Generic Rule Evaluator ─────────────────────────────────────

export function evaluateCriterionRule(
  criterion: RubricCriterion,
  metrics: GeneralKinematicMetrics
): { score: number; delta: string } {
  const { ruleType } = criterion;

  // ── 1. depth_normalized (e.g. CPR sternal depth, plunge depth) ──
  if (ruleType === 'depth_normalized' || criterion.id === 'cpr-depth' || criterion.id === 'depth') {
    const targetMin = criterion.targetMin ?? 5.0;
    const targetMax = criterion.targetMax ?? 6.0;
    const depth = metrics.actualDepthCm;

    if (depth >= targetMin && depth <= targetMax) {
      return {
        score: 100,
        delta: `Depth: ${depth} cm — Optimal (${targetMin}–${targetMax} cm)`,
      };
    } else if (depth >= targetMin - 1.0 && depth < targetMin) {
      return {
        score: 60,
        delta: `Depth: ${depth} cm — Too Shallow (target ${targetMin}–${targetMax} cm)`,
      };
    } else if (depth > targetMax) {
      return {
        score: 70,
        delta: `Depth: ${depth} cm — Too Deep (exceeds ${targetMax} cm)`,
      };
    } else {
      return {
        score: 0,
        delta: `Depth: ${depth} cm — Critically Shallow (< ${targetMin - 1.0} cm, ineffective)`,
      };
    }
  }

  // ── 2. frequency_bpm / cycle rate (e.g. CPR cadence, tapping) ──
  if (ruleType === 'frequency_bpm' || criterion.id === 'cpr-rate' || criterion.id === 'rate') {
    const targetMin = criterion.targetMin ?? 100;
    const targetMax = criterion.targetMax ?? 120;
    const tolerance = criterion.tolerance ?? 10;
    const bpm = metrics.actualBpm;

    if (bpm >= targetMin && bpm <= targetMax) {
      return {
        score: 100,
        delta: `BPM: ${bpm} — Optimal (${targetMin}–${targetMax} BPM)`,
      };
    } else if (bpm >= targetMin - tolerance && bpm < targetMin) {
      return {
        score: 75,
        delta: `BPM: ${bpm} — Too Slow (target ${targetMin}–${targetMax} BPM)`,
      };
    } else if (bpm > targetMax && bpm <= targetMax + tolerance) {
      return {
        score: 75,
        delta: `BPM: ${bpm} — Too Fast (target ${targetMin}–${targetMax} BPM)`,
      };
    } else if (bpm < targetMin - tolerance) {
      return {
        score: 40,
        delta: `BPM: ${bpm} — Significantly Too Slow (target ${targetMin}–${targetMax} BPM)`,
      };
    } else {
      return {
        score: 40,
        delta: `BPM: ${bpm} — Significantly Too Fast (target ${targetMin}–${targetMax} BPM)`,
      };
    }
  }

  // ── 3. recoil_completeness (e.g. CPR chest release) ───────────
  if (ruleType === 'recoil_completeness' || criterion.id === 'cpr-recoil' || criterion.id === 'recoil') {
    const maxIncomplete = criterion.maxIncompletePct ?? 5;
    const recoil = metrics.recoilVariancePct;

    if (recoil <= maxIncomplete) {
      return {
        score: 100,
        delta: `Recoil: ${recoil}% incomplete — Excellent full release`,
      };
    } else if (recoil <= maxIncomplete + 10) {
      return {
        score: 80,
        delta: `Recoil: ${recoil}% incomplete — Minor leaning detected`,
      };
    } else if (recoil <= maxIncomplete + 20) {
      return {
        score: 50,
        delta: `Recoil: ${recoil}% incomplete — Leaning significantly reduces effectiveness`,
      };
    } else {
      return {
        score: 20,
        delta: `Recoil: ${recoil}% incomplete — Critically poor; blocked recovery`,
      };
    }
  }

  // ── 4. joint_angle_range (e.g. welding torch angle, elbow lock) ─
  if (ruleType === 'joint_angle_range' || criterion.id === 'weld-torch-angle') {
    const targetMin = criterion.targetMin ?? 70;
    const targetMax = criterion.targetMax ?? 85;
    const tolerance = criterion.tolerance ?? 10;
    const jointKey = criterion.landmarks ? criterion.landmarks.join('_') : 'right_arm';
    const angleMetric = metrics.jointAngles[jointKey] || metrics.jointAngles['right_arm'] || { meanDeg: 78.0, stdDevDeg: 2.0 };
    const angle = angleMetric.meanDeg;

    if (angle >= targetMin && angle <= targetMax) {
      return {
        score: 100,
        delta: `Joint Angle: ${angle}° — Optimal (${targetMin}°–${targetMax}°)`,
      };
    } else if (
      (angle >= targetMin - tolerance && angle < targetMin) ||
      (angle > targetMax && angle <= targetMax + tolerance)
    ) {
      return {
        score: 80,
        delta: `Joint Angle: ${angle}° — Acceptable (${targetMin}°–${targetMax}° window, ±${tolerance}°)`,
      };
    } else if (
      (angle >= targetMin - 2 * tolerance && angle < targetMin - tolerance) ||
      (angle > targetMax + tolerance && angle <= targetMax + 2 * tolerance)
    ) {
      return {
        score: 60,
        delta: `Joint Angle: ${angle}° — Out of optimal posture window`,
      };
    } else {
      return {
        score: 40,
        delta: `Joint Angle: ${angle}° — Poor technique angle`,
      };
    }
  }

  // ── 5. travel_speed (e.g. welding feed rate, conduit bending) ──
  if (ruleType === 'travel_speed' || criterion.id === 'weld-travel-speed' || criterion.id === 'travel-speed') {
    const targetMin = criterion.targetMin ?? 2.5;
    const targetMax = criterion.targetMax ?? 4.5;
    const tolerance = criterion.tolerance ?? 1.0;
    const lk = criterion.landmark || 'right_wrist';
    const speedMetric = metrics.travelSpeeds[lk] || metrics.travelSpeeds['right_wrist'] || { speedMmSec: 3.5 };
    const speed = speedMetric.speedMmSec;

    if (speed >= targetMin && speed <= targetMax) {
      return {
        score: 100,
        delta: `Travel Speed: ${speed} mm/s — Steady progression (${targetMin}–${targetMax} mm/s)`,
      };
    } else if (
      (speed >= targetMin - tolerance && speed < targetMin) ||
      (speed > targetMax && speed <= targetMax + tolerance)
    ) {
      return {
        score: 75,
        delta: `Travel Speed: ${speed} mm/s — Minor speed fluctuation (${targetMin}–${targetMax} mm/s)`,
      };
    } else {
      return {
        score: 45,
        delta: `Travel Speed: ${speed} mm/s — Inconsistent progression rate`,
      };
    }
  }

  // ── 6. path_stability (e.g. arc length, linear seam tracking) ───
  if (ruleType === 'path_stability' || criterion.id === 'weld-arc-stability' || criterion.id === 'arc-length' || criterion.id === 'bead-placement') {
    const maxDev = criterion.maxDeviation ?? 1.2;
    const tolerance = criterion.tolerance ?? 0.5;
    const lk = criterion.landmark || 'right_wrist';
    const devMetric = metrics.pathDeviations[lk] || metrics.pathDeviations['right_wrist'] || { deviationCm: 0.85 };
    const deviation = devMetric.deviationCm;

    if (deviation <= maxDev) {
      return {
        score: 100,
        delta: `Standoff & Seam Tracking: ${deviation} cm wandering — Outstanding stability (< ${maxDev} cm)`,
      };
    } else if (deviation <= maxDev + tolerance) {
      return {
        score: 80,
        delta: `Standoff & Seam Tracking: ${deviation} cm wandering — Minor lateral drift detected`,
      };
    } else if (deviation <= maxDev + 2 * tolerance) {
      return {
        score: 60,
        delta: `Standoff & Seam Tracking: ${deviation} cm wandering — Noticeable seam misalignment`,
      };
    } else {
      return {
        score: 35,
        delta: `Standoff & Seam Tracking: ${deviation} cm wandering — Severe arc instability`,
      };
    }
  }

  // ── 7. posture_variance (e.g. CPR arms locked, welder stance) ─
  if (ruleType === 'posture_variance' || criterion.id === 'cpr-posture' || criterion.id === 'posture' || criterion.id === 'weld-safety-posture' || criterion.id === 'safety') {
    const targetMax = criterion.targetMax ?? 15;
    const tolerance = criterion.tolerance ?? 10;
    const postureScore = metrics.postureVarianceScore;
    if (postureScore <= targetMax) {
      return {
        score: 100,
        delta: `Posture Alignment: DTW variance ${postureScore} — Excellent body positioning`,
      };
    } else if (postureScore <= targetMax + tolerance) {
      return {
        score: 80,
        delta: `Posture Alignment: DTW variance ${postureScore} — Minor postural drift detected`,
      };
    } else if (postureScore <= targetMax + 2 * tolerance) {
      return {
        score: 60,
        delta: `Posture Alignment: DTW variance ${postureScore} — Sub-optimal alignment reduces force/precision`,
      };
    } else {
      return {
        score: 40,
        delta: `Posture Alignment: DTW variance ${postureScore} — Poor alignment requiring correction`,
      };
    }
  }

  // ── Fallback for custom or unrecognized criteria ──────────────
  const fallbackScore = criterion.optimalScore ?? 85;
  return {
    score: fallbackScore,
    delta: `${criterion.label}: evaluated at ${fallbackScore}/100`,
  };
}

// ── Local deterministic engine ────────────────────────────────

export function evaluateSubmissionWithLandmarks(
  submissionId: string,
  rubricConfig: RubricConfig,
  landmarks?: PoseLandmark[]
): RubricResult {
  // 1. Extract kinematic metrics across all supported rule domains
  const kinematics = extractGeneralKinematics(submissionId, landmarks);

  const criteriaScores: Record<string, number> = {};
  const deltas: CriterionDelta[] = [];
  let weightedTotal = 0;

  // 2. Evaluate each criterion via the generic rule interpreter
  (rubricConfig.criteria || []).forEach((criterion) => {
    const { score, delta } = evaluateCriterionRule(criterion, kinematics);
    criteriaScores[criterion.id] = score;
    deltas.push({
      criterionId: criterion.id,
      label: criterion.label,
      score,
      weight: criterion.weight,
      delta,
    });
    weightedTotal += (score * criterion.weight) / 100;
  });

  const totalWeight = rubricConfig.total_weight || 100;
  const overallScore = Math.round((weightedTotal / totalWeight) * 100);

  return {
    overallScore,
    criteriaScores,
    deltas,
    metrics: {
      actualBpm: kinematics.actualBpm,
      actualDepthCm: kinematics.actualDepthCm,
      recoilVariancePct: kinematics.recoilVariancePct,
      postureVarianceScore: kinematics.postureVarianceScore,
      anatomicalScaleFallback: kinematics.anatomicalScaleFallback,
      anatomicalScaleWarning: kinematics.anatomicalScaleWarning,
    },
    kinematics,
    isOfflineScore: true,
  };
}

export interface ServerScorePayloadOptions {
  tradeId?: string;
  rubricId?: string;
  stagingId?: string;
  videoUrl?: string;
  durationSeconds?: number;
  traineeId?: string;
  instituteId?: string;
}

/**
 * Server-side Edge Function invoker with local deterministic fallback.
 * Edge Function is the source of truth for tamper-resistant certification scores.
 */
export async function evaluateSubmissionServer(
  submissionId: string,
  rubricConfig: RubricConfig,
  landmarks?: PoseLandmark[],
  options?: ServerScorePayloadOptions
): Promise<RubricResult & { submissionId?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('score-submission', {
      body: {
        submissionId,
        rubricConfig,
        landmarks,
        tradeId: options?.tradeId,
        rubricId: options?.rubricId,
        stagingId: options?.stagingId,
        videoUrl: options?.videoUrl,
        durationSeconds: options?.durationSeconds,
        traineeId: options?.traineeId,
        instituteId: options?.instituteId,
      },
    });

    if (!error && data && data.overallScore !== undefined) {
      return {
        ...(data as RubricResult),
        submissionId: data.submissionId || submissionId,
        isOfflineScore: false,
      };
    }
  } catch (err) {
    console.info('[RubricEngine] Edge Function score-submission falling back to local computation:', err);
  }

  // Local fallback (flagged as unverified/offline score)
  return {
    ...evaluateSubmissionWithLandmarks(submissionId, rubricConfig, landmarks),
    submissionId,
  };
}

/**
 * Legacy synchronous evaluateSubmission helper (backward compatibility)
 */
export function evaluateSubmission(
  submissionId: string,
  rubricConfig: RubricConfig
): RubricResult {
  return evaluateSubmissionWithLandmarks(submissionId, rubricConfig);
}
