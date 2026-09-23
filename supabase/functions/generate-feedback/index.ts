// ─────────────────────────────────────────────────────────────
// Supabase Edge Function: generate-feedback
// Server-Side Claude API Narrative Generator with Fail-Safe Fallback
// ─────────────────────────────────────────────────────────────
// Hardened with:
// 1. Request size cap on deltas array (max 20)
// 2. Input validation & sanitization on criterionId, label, and delta
// 3. Per-client sliding window rate limiting (10 req/min)
// ─────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CriterionDelta {
  criterionId: string;
  label: string;
  score: number;
  weight: number;
  delta: string;
}

interface FeedbackSection {
  criterionId: string;
  label: string;
  text: string;
  isFallback: boolean;
}

// ── In-Memory Rate Limiting ──────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(clientId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(clientId) || [];
  const validTimestamps = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  validTimestamps.push(now);
  rateLimitMap.set(clientId, validTimestamps);
  return false;
}

// ── Input Sanitization & Validation ─────────────────────────
function sanitizeInput(str: string): string {
  if (typeof str !== "string") return "";
  return str.replace(/[^\w\s\d.,:;()\-%]/gi, "").slice(0, 300);
}

// ── Rule-Based Fail-Safe Fallback Templates ──────────────────
function extractNumber(delta: string, after: string): number {
  const idx = delta.indexOf(after);
  if (idx === -1) return 0;
  const match = delta.slice(idx + after.length).match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
}

const FALLBACK_TEMPLATES: Record<string, (delta: string) => string> = {
  "cpr-rate": (delta) => {
    if (delta.includes("Too Slow") || delta.includes("Significantly Too Slow")) {
      const bpm = extractNumber(delta, "BPM:");
      return `Your compression rate averaged ${bpm} BPM, which is below the 100–120 BPM target. ` +
        `Try using a mental cue like the beat of 'Stayin' Alive' (♩≈103 BPM) or set a metronome app to 110 BPM. ` +
        `A consistent, slightly faster rhythm will significantly improve perfusion pressure.`;
    }
    if (delta.includes("Too Fast")) {
      const bpm = extractNumber(delta, "BPM:");
      return `Your rate of ${bpm} BPM slightly exceeds the 120 BPM ceiling. ` +
        `Compressions that are too rapid allow insufficient ventricular filling between cycles. ` +
        `Slow your pace by roughly one compression every second — a quiet countdown helps.`;
    }
    return `Your compression rate is within the optimal 100–120 BPM range. Excellent rhythm control.`;
  },

  "cpr-depth": (delta) => {
    if (delta.includes("Too Shallow") || delta.includes("Critically Shallow")) {
      const depth = extractNumber(delta, "Depth:");
      return `Your average compression depth was ${depth} cm, which is below the minimum 5 cm threshold. ` +
        `Drive your body weight forward from your hips rather than pushing with your arms alone. ` +
        `Imagine pressing to at least one-third the depth of the chest — you will feel the sternum flex.`;
    }
    if (delta.includes("Too Deep")) {
      const depth = extractNumber(delta, "Depth:");
      return `At ${depth} cm your compressions exceed the 6 cm maximum. ` +
        `While rare, excessive depth increases rib fracture risk. ` +
        `Focus on feeling the sternum fully compressed without the chest collapsing entirely.`;
    }
    return `Excellent compression depth — you are consistently achieving 5–6 cm, which optimises stroke volume.`;
  },

  "cpr-recoil": (delta) => {
    const pct = extractNumber(delta, "Recoil:");
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

  "cpr-posture": (delta) => {
    const dist = extractNumber(delta, "Posture:");
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Per-User / IP Rate Limiting
    const clientIdentifier = req.headers.get("x-forwarded-for") || req.headers.get("authorization") || "anon-client";
    if (isRateLimited(clientIdentifier)) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Maximum 10 requests per minute." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { deltas } = await req.json();

    if (!Array.isArray(deltas)) {
      return new Response(JSON.stringify({ error: "deltas array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Request Size Cap (Max 20 items)
    if (deltas.length > 20) {
      return new Response(
        JSON.stringify({ error: "deltas array exceeds maximum size cap of 20 items" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    const sections: FeedbackSection[] = [];

    // Process all deltas concurrently with a strict 2-second timeout per criterion
    await Promise.all(
      deltas.map(async (d: CriterionDelta) => {
        // 3. Input Validation & Sanitization
        const cleanCriterionId = sanitizeInput(d.criterionId);
        const cleanLabel = sanitizeInput(d.label);
        const cleanDelta = sanitizeInput(d.delta);

        const fallbackFn = FALLBACK_TEMPLATES[cleanCriterionId] ?? FALLBACK_TEMPLATES["default"];
        const fallbackText = fallbackFn(cleanDelta);

        if (!apiKey) {
          sections.push({
            criterionId: cleanCriterionId,
            label: cleanLabel,
            text: fallbackText,
            isFallback: true,
          });
          return;
        }

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);

          const prompt = `You are an expert CPR & Vocational Trade Assessor coaching a student based on exact kinematic measurement data.
CRITERION: ${cleanLabel}
ASSESSED METRIC DELTA: ${cleanDelta}
SCORE: ${Number(d.score).toFixed(0)}/100 (Score is already locked and cannot be changed)

Generate 2-3 sentences of direct, actionable, constructive coaching feedback for the student addressing their specific delta. Never reference grading scales or rubric mechanics.`;

          const resp = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-3-5-haiku-20241022",
              max_tokens: 150,
              temperature: 0.2,
              messages: [{ role: "user", content: prompt }],
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!resp.ok) {
            throw new Error(`Claude API error: ${resp.status}`);
          }

          const json = await resp.json();
          const claudeText = json?.content?.[0]?.text?.trim() || fallbackText;

          sections.push({
            criterionId: cleanCriterionId,
            label: cleanLabel,
            text: claudeText,
            isFallback: false,
          });
        } catch {
          sections.push({
            criterionId: cleanCriterionId,
            label: cleanLabel,
            text: fallbackText,
            isFallback: true,
          });
        }
      })
    );

    // Maintain original ordering matching deltas
    const orderedSections = deltas.map((d: CriterionDelta) => {
      const cleanId = sanitizeInput(d.criterionId);
      return sections.find((s) => s.criterionId === cleanId) || {
        criterionId: cleanId,
        label: sanitizeInput(d.label),
        text: "Analysis completed.",
        isFallback: true,
      };
    });

    const anyFallback = orderedSections.some((s) => s.isFallback);

    return new Response(
      JSON.stringify({
        sections: orderedSections,
        anyFallback,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
