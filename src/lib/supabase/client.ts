// ─────────────────────────────────────────────────────────────
// src/lib/supabase/client.ts
// Singleton Supabase client.
// ─────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  'https://placeholder.supabase.co';
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  'placeholder-anon-key';

const isMissingEnv =
  supabaseUrl === 'https://placeholder.supabase.co' ||
  supabaseAnonKey === 'placeholder-anon-key';

if (isMissingEnv) {
  console.warn(
    '[ProofOfSkill] Supabase env vars not configured.\n' +
      'Copy .env.example -> .env.local and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.\n' +
      'Running in demo/offline mode — auth and data features are disabled.'
  );
}

// ── Singleton client ──────────────────────────────────────────

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: !isMissingEnv,
    autoRefreshToken: !isMissingEnv,
    detectSessionInUrl: !isMissingEnv,
  },
});

export const isSupabaseConfigured = !isMissingEnv;

export type SupabaseClient = typeof supabase;
