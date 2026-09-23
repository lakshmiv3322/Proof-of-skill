// ─────────────────────────────────────────────────────────────
// src/lib/supabase/client.ts
// Singleton Supabase client.
// ─────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://placeholder.supabase.co';
const FALLBACK_KEY = 'placeholder-anon-key';

function getSanitizedSupabaseUrl(rawUrl: unknown): { url: string; isConfigured: boolean } {
  if (typeof rawUrl !== 'string') {
    return { url: FALLBACK_URL, isConfigured: false };
  }
  const trimmed = rawUrl.trim();
  if (
    !trimmed ||
    trimmed.includes('<') ||
    trimmed.includes('>') ||
    trimmed.includes('placeholder.supabase.co') ||
    trimmed.includes('your-project') ||
    trimmed === 'undefined'
  ) {
    return { url: FALLBACK_URL, isConfigured: false };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return { url: parsed.origin, isConfigured: true };
    }
  } catch {
    // Invalid URL format
  }
  return { url: FALLBACK_URL, isConfigured: false };
}

function getSanitizedAnonKey(rawKey: unknown): { key: string; isConfigured: boolean } {
  if (typeof rawKey !== 'string') {
    return { key: FALLBACK_KEY, isConfigured: false };
  }
  const trimmed = rawKey.trim();
  if (
    !trimmed ||
    trimmed.includes('<') ||
    trimmed.includes('>') ||
    trimmed === FALLBACK_KEY ||
    trimmed.includes('your-anon-key') ||
    trimmed === 'undefined'
  ) {
    return { key: FALLBACK_KEY, isConfigured: false };
  }
  return { key: trimmed, isConfigured: true };
}

const { url: supabaseUrl, isConfigured: isUrlConfigured } = getSanitizedSupabaseUrl(
  import.meta.env.VITE_SUPABASE_URL
);
const { key: supabaseAnonKey, isConfigured: isKeyConfigured } = getSanitizedAnonKey(
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const isSupabaseConfigured = isUrlConfigured && isKeyConfigured;

if (!isSupabaseConfigured) {
  console.warn(
    '[ProofOfSkill] Supabase env vars not configured or using placeholders.\n' +
      'Running in demo/offline mode — auth and data features are operating via local demo data.'
  );
}

// ── Singleton client ──────────────────────────────────────────

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: isSupabaseConfigured,
    autoRefreshToken: isSupabaseConfigured,
    detectSessionInUrl: isSupabaseConfigured,
  },
});

export type SupabaseClient = typeof supabase;
