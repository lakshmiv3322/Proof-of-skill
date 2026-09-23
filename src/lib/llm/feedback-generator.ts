// ─────────────────────────────────────────────────────────────
// LLM Narrative Layer with Fail-safe (Edge Function & Fallback)
// ─────────────────────────────────────────────────────────────
// Architecture:
//  1. `generateFullFeedback` accepts the rubric's CriterionDelta[]
//     from the deterministic engine — it never sets or reads the score.
//  2. Calls server-side Supabase Edge Function with Claude API.
//  3. If Edge function is unavailable or exceeds 2-second timeout,
//     the rule-based fallback templates fire immediately so processing
//     never stalls.
// ─────────────────────────────────────────────────────────────
import type { CriterionDelta } from '@/lib/scoring/rubric-engine';
import { supabase } from '@/lib/supabase/client';

// ── Types ──────────────────────────────────────────────────────

export interface FeedbackSection {
  criterionId: string;
  label: string;
  text: string;
  isFallback: boolean;
}

export interface FullFeedback {
  sections: FeedbackSection[];
  anyFallback: boolean;
}

// ── Fallback templates (rule-based, criterion-id-mapped) ──────

export const FALLBACK_TEMPLATES: Record<string, (delta: string) => string> = {
  'cpr-rate': (delta) => {
    if (delta.includes('Too Slow') || delta.includes('Significantly Too Slow')) {
      const bpm = extractNumber(delta, 'BPM:');
      return `Your compression rate averaged ${bpm} BPM, which is below the 100–120 BPM target. ` +
        `Try using a mental cue like the beat of 'Stayin' Alive' (♩≈103 BPM) or set a metronome app to 110 BPM. ` +
        `A consistent, slightly faster rhythm will significantly improve perfusion pressure.`;
    }
    if (delta.includes('Too Fast')) {
      const bpm = extractNumber(delta, 'BPM:');
      return `Your rate of ${bpm} BPM slightly exceeds the 120 BPM ceiling. ` +
        `Compressions that are too rapid allow insufficient ventricular filling between cycles. ` +
        `Slow your pace by roughly one compression every second — a quiet countdown helps.`;
    }
    return `Your compression rate is within the optimal 100–120 BPM range. Excellent rhythm control.`;
  },

  'cpr-depth': (delta) => {
    if (delta.includes('Too Shallow') || delta.includes('Critically Shallow')) {
      const depth = extractNumber(delta, 'Depth:');
      return `Your average compression depth was ${depth} cm, which is below the minimum 5 cm threshold. ` +
        `Drive your body weight forward from your hips rather than pushing with your arms alone. ` +
        `Imagine pressing to at least one-third the depth of the chest — you will feel the sternum flex.`;
    }
    if (delta.includes('Too Deep')) {
      const depth = extractNumber(delta, 'Depth:');
      return `At ${depth} cm your compressions exceed the 6 cm maximum. ` +
        `While rare, excessive depth increases rib fracture risk. ` +
        `Focus on feeling the sternum fully compressed without the chest collapsing entirely.`;
    }
    return `Excellent compression depth — you are consistently achieving 5–6 cm, which optimises stroke volume.`;
  },

  'cpr-recoil': (delta) => {
    const pct = extractNumber(delta, 'Recoil:');
    if (pct > 15) {
      return `On ${pct}% of compressions your hands or body weight remained in contact with the chest between strokes. ` +
        `This "leaning" prevents the heart from refilling and reduces cardiac output by up to 40%. ` +
        `After each compression, consciously let your arms rise fully before the next downstroke.`;
    }
    if (pct > 5) {
      return `${pct}% of your compressions showed minor incomplete recoil. ` +
        `Check that your arms fully straighten and that you feel a slight lift between each compression. ` +
        `This is a small but meaningful correction.`;
    }
    return `Full chest recoil achieved on virtually every compression — outstanding technique.`;
  },

  'cpr-posture': (delta) => {
    const dist = extractNumber(delta, 'Posture:');
    if (dist >= 35) {
      return `Posture analysis detected significant deviation (score: ${dist}): shoulders are not directly over your hands, ` +
        `causing force to be applied at an angle and reducing efficiency. ` +
        `Reposition yourself so your arms are vertical, lock your elbows, and engage your core throughout the cycle.`;
    }
    if (dist >= 15) {
      return `Minor posture variance detected (score: ${dist}). Ensure your elbows remain fully locked throughout each compression. ` +
        `Bent elbows absorb force that should go into the chest.`;
    }
    return `Posture is excellent — arms locked, shoulders over hands. Your mechanical advantage is maximised.`;
  },

  default: (delta) =>
    `Analysis complete for this criterion. ${delta}. ` +
    `Review the rubric indicators and reference video clip for detailed technique guidance.`,
};

function extractNumber(delta: string, after: string): number {
  const idx = delta.indexOf(after);
  if (idx === -1) return 0;
  const match = delta.slice(idx + after.length).match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
}

// ── Full rubric feedback narrative generator ──────────────────

export async function generateFullFeedback(
  deltas: CriterionDelta[]
): Promise<FullFeedback> {
  // 1. Attempt to invoke server-side Supabase Edge Function
  try {
    const edgePromise = supabase.functions.invoke('generate-feedback', {
      body: { deltas },
    });

    const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: new Error('Client timeout') }), 2000)
    );

    const result = await Promise.race([edgePromise, timeoutPromise]);

    if (!result.error && result.data && Array.isArray(result.data.sections)) {
      return result.data as FullFeedback;
    }
  } catch (err) {
    console.info('[FeedbackGenerator] Edge Function generate-feedback falling back to local templates:', err);
  }

  // 2. Local rule-based fallback generator
  const sections: FeedbackSection[] = deltas.map(({ criterionId, label, delta }) => {
    const fallbackFn = FALLBACK_TEMPLATES[criterionId] ?? FALLBACK_TEMPLATES['default'];
    return {
      criterionId,
      label,
      text: fallbackFn(delta),
      isFallback: true,
    };
  });

  return { sections, anyFallback: true };
}

/**
 * @deprecated Use `generateFullFeedback`
 */
export async function generateFeedback(
  criterionId: string,
  _score: number,
  metrics: Record<string, number>
): Promise<{ text: string; isFallback: boolean }> {
  const delta = `BPM: ${metrics.actualBpm ?? 0}`;
  const fallbackFn = FALLBACK_TEMPLATES[criterionId] ?? FALLBACK_TEMPLATES['default'];
  return {
    text: fallbackFn(delta),
    isFallback: true,
  };
}
