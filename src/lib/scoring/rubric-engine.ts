// ─────────────────────────────────────────────────────────────
// Deterministic Rubric Engine (Server-Side / Client Fallback)
// ─────────────────────────────────────────────────────────────
// ARCHITECTURAL RULE: The numeric score is calculated SOLELY by
// mathematical rubric logic applied to real DTW output deltas.
// LLMs are NEVER allowed to set or modify the score.
// ─────────────────────────────────────────────────────────────
import { calculateRealDTW } from './dtw';
import type { RubricConfig, PoseLandmark } from '@/types/database';
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
  };
  /** Indicates whether the score was computed via client fallback (true) or verified server Edge Function (false). */
  isOfflineScore?: boolean;
}

// ── Local deterministic engine (guarantees identical math) ────

export function evaluateSubmissionWithLandmarks(
  submissionId: string,
  rubricConfig: RubricConfig,
  landmarks?: PoseLandmark[]
): RubricResult {
  // 1. Obtain mathematical variance from the real DTW algorithm
  const dtwResult = calculateRealDTW(submissionId, landmarks);

  // 2. Resolve concrete metric values from the DTW deltas.
  //    Reference values: 110 BPM rate, 5.5 cm depth.
  const actualBpm         = +(110 + dtwResult.rateVarianceBpm).toFixed(1);
  const actualDepthCm     = +(5.5 + dtwResult.depthVarianceCm).toFixed(2);
  const recoilVariancePct = +dtwResult.releaseVariancePct.toFixed(1);
  const postureVarianceScore = +dtwResult.postureVarianceScore.toFixed(1);

  const criteriaScores: Record<string, number> = {};
  const deltas: CriterionDelta[] = [];
  let weightedTotal = 0;

  // 3. Map DTW outputs to rubric criteria using strict deterministic rules.
  rubricConfig.criteria.forEach((criterion) => {
    let score = 0;
    let delta = '';

    switch (criterion.id) {
      // ── Rate ────────────────────────────────────────────────
      case 'cpr-rate': {
        if (actualBpm >= 100 && actualBpm <= 120) {
          score = 100;
          delta = `BPM: ${actualBpm} — Optimal (100–120 BPM)`;
        } else if (actualBpm >= 90 && actualBpm < 100) {
          score = 75;
          delta = `BPM: ${actualBpm} — Too Slow (target 100–120 BPM)`;
        } else if (actualBpm > 120 && actualBpm <= 130) {
          score = 75;
          delta = `BPM: ${actualBpm} — Too Fast (target 100–120 BPM)`;
        } else if (actualBpm < 90) {
          score = 40;
          delta = `BPM: ${actualBpm} — Significantly Too Slow (target 100–120 BPM)`;
        } else {
          score = 40;
          delta = `BPM: ${actualBpm} — Significantly Too Fast (target 100–120 BPM)`;
        }
        break;
      }

      // ── Depth ────────────────────────────────────────────────
      case 'cpr-depth': {
        if (actualDepthCm >= 5.0 && actualDepthCm <= 6.0) {
          score = 100;
          delta = `Depth: ${actualDepthCm} cm — Optimal (5–6 cm)`;
        } else if (actualDepthCm >= 4.0 && actualDepthCm < 5.0) {
          score = 60;
          delta = `Depth: ${actualDepthCm} cm — Too Shallow (target 5–6 cm)`;
        } else if (actualDepthCm > 6.0) {
          score = 70;
          delta = `Depth: ${actualDepthCm} cm — Too Deep (risk of injury above 6 cm)`;
        } else {
          score = 0;
          delta = `Depth: ${actualDepthCm} cm — Critically Shallow (< 4 cm, ineffective)`;
        }
        break;
      }

      // ── Recoil ───────────────────────────────────────────────
      case 'cpr-recoil': {
        if (recoilVariancePct <= 5) {
          score = 100;
          delta = `Recoil: ${recoilVariancePct}% incomplete — Excellent full release`;
        } else if (recoilVariancePct <= 15) {
          score = 80;
          delta = `Recoil: ${recoilVariancePct}% incomplete — Minor leaning detected`;
        } else if (recoilVariancePct <= 25) {
          score = 50;
          delta = `Recoil: ${recoilVariancePct}% incomplete — Leaning significantly reduces effectiveness`;
        } else {
          score = 20;
          delta = `Recoil: ${recoilVariancePct}% incomplete — Critically poor; cardiac refill blocked`;
        }
        break;
      }

      // ── Posture ──────────────────────────────────────────────
      case 'cpr-posture': {
        if (postureVarianceScore < 15) {
          score = 100;
          delta = `Posture: DTW distance ${postureVarianceScore} — Excellent arm alignment`;
        } else if (postureVarianceScore < 25) {
          score = 80;
          delta = `Posture: DTW distance ${postureVarianceScore} — Minor elbow bend detected`;
        } else if (postureVarianceScore < 35) {
          score = 60;
          delta = `Posture: DTW distance ${postureVarianceScore} — Elbows bent; reduces force transfer`;
        } else {
          score = 40;
          delta = `Posture: DTW distance ${postureVarianceScore} — Poor; shoulders not over hands`;
        }
        break;
      }

      default:
        score = 80;
        delta = `${criterion.label}: assessed at ${score}/100`;
    }

    criteriaScores[criterion.id] = score;
    deltas.push({ criterionId: criterion.id, label: criterion.label, score, weight: criterion.weight, delta });
    weightedTotal += (score * criterion.weight) / 100;
  });

  // 4. Compute final score: weighted sum normalised over total_weight.
  //    The LLM CANNOT modify this value.
  const overallScore = Math.round((weightedTotal / rubricConfig.total_weight) * 100);

  return {
    overallScore,
    criteriaScores,
    deltas,
    metrics: { actualBpm, actualDepthCm, recoilVariancePct, postureVarianceScore },
    // true = computed locally (client fallback); server path overrides to false
    isOfflineScore: true,
  };
}

/**
 * Server-side Edge Function invoker with local deterministic fallback.
 * Edge Function is the source of truth for tamper-resistant certification scores.
 */
export async function evaluateSubmissionServer(
  submissionId: string,
  rubricConfig: RubricConfig,
  landmarks?: PoseLandmark[]
): Promise<RubricResult> {
  try {
    const { data, error } = await supabase.functions.invoke('score-submission', {
      body: { submissionId, rubricConfig, landmarks },
    });

    if (!error && data && data.overallScore !== undefined) {
      return { ...(data as RubricResult), isOfflineScore: false };
    }
  } catch (err) {
    console.info('[RubricEngine] Edge Function score-submission falling back to local computation:', err);
  }

  // Local fallback (flagged as unverified/offline score)
  return evaluateSubmissionWithLandmarks(submissionId, rubricConfig, landmarks);
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
