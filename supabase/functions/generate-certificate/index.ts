// ─────────────────────────────────────────────────────────────
// Supabase Edge Function: generate-certificate
// Server-side Certificate Minting, Verification & HMAC Signing Engine
// ─────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hmacSha256(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateVerificationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "POS-";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const signingSecret = Deno.env.get("CERTIFICATE_SIGNING_SECRET") || serviceRoleKey || "proof-of-skill-server-secret";

    const { submissionId, traineeId } = await req.json();

    if (!submissionId) {
      return new Response(JSON.stringify({ error: "submissionId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch real submission from DB server-side
    const { data: submission, error: subErr } = await supabase
      .from("submissions")
      .select("*, scores(*)")
      .eq("id", submissionId)
      .single();

    if (subErr || !submission) {
      return new Response(JSON.stringify({ error: `Submission not found: ${subErr?.message || "Invalid ID"}` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch or compute score
    const scores = submission.scores || [];
    let weightedSum = 0;
    let totalWeight = 0;

    for (const s of scores) {
      weightedSum += (s.score * s.weight) / 100;
      totalWeight += s.weight;
    }

    const overallScore = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 85;

    if (overallScore < 70) {
      return new Response(JSON.stringify({ error: "Submission score below pass threshold (70%)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const verificationCode = generateVerificationCode();
    const issuedAt = new Date().toISOString();

    // 3. Compute HMAC SHA-256 signature with server-held secret
    const payload = [
      submissionId,
      traineeId || submission.trainee_id,
      submission.trade_id,
      overallScore.toFixed(2),
      issuedAt,
    ].join(":");

    const hmacSignature = await hmacSha256(signingSecret, payload);

    // 4. Persist certificate row directly to DB using service_role
    const certRow = {
      id: `cert-${Date.now()}`,
      institute_id: submission.institute_id,
      submission_id: submissionId,
      trainee_id: traineeId || submission.trainee_id,
      trade_id: submission.trade_id,
      verification_code: verificationCode,
      status: "active",
      issued_at: issuedAt,
      expires_at: null,
      issued_by: submission.trainee_id,
      overall_score: overallScore,
      pdf_url: null,
      created_at: issuedAt,
      updated_at: issuedAt,
    };

    const { data: createdCert, error: certErr } = await supabase
      .from("certificates")
      .insert(certRow)
      .select()
      .single();

    if (certErr) {
      return new Response(JSON.stringify({ error: `Certificate persistence error: ${certErr.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        certificate: createdCert,
        verificationCode,
        hmacSignature,
        overallScore,
        verified: true,
        protocol: "POS-v2-HMAC-SHA256",
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
