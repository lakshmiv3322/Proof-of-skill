# ProofOfSkill — AI Biometric Skill Verification Platform

ProofOfSkill is a multi-tenant vocational and healthcare practical skill verification platform built with **React + Vite + TypeScript**, **Supabase (Auth, Postgres RLS, Edge Functions)**, **MediaPipe BlazePose 33-point Landmark Detection**, **Dynamic Time Warping (DTW) Rubric Engine**, and **LLM Coaching Feedback (Claude API)**.

---

## Key Features

- 🔒 **Row Level Security (RLS)**: Enforced isolation across multi-tenant institutes. Trainees access only their own submissions, assessors/admins access data strictly within their institute.
- 📐 **33-Point Biometric Pose Extraction**: Real-time MediaPipe BlazePose landmark capture via webcam or video file upload.
- ⚡ **Deterministic DTW Scoring**: Server-side Dynamic Time Warping engine calculating rates (BPM), compression depth, recoil release, and arm posture verticality.
- 🤖 **Tamper-Resistant Certification**: Edge Function `score-submission` serves as the authoritative source of truth. Unverified client-side scores are visibly flagged with an offline badge.
- 🎓 **Pedagogical AI Feedback**: Granular coaching feedback powered by Claude API with instant rule-based fallback templates.
- 📜 **Cryptographic Certificate Verification**: SHA-256 ledger verification links with public lookup RPC (`get_certificate_by_code`) and downloadable PDF certificates.

---

## Required Environment Variables

Create a `.env.local` file in the project root:

```env
# Supabase Backend Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Demo Mode Configuration
# Set to 'true' to enable the role-switcher toolbar for development & preview
VITE_DEMO_MODE=true
```

---

## Local Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Supabase Database Migrations

Apply the migration files in `supabase/migrations/` using the Supabase CLI or SQL Editor:

```bash
# Using Supabase CLI
supabase db push

# Or apply manually in Supabase SQL Editor in order:
# 1. supabase/migrations/20260901000000_proofofskill_schema.sql
# 2. supabase/migrations/20260901000001_rls_hardening.sql
```

### 3. Start Development Server

```bash
npm run dev
```

---

## How the Demo Role-Switcher Works

When `VITE_DEMO_MODE=true` is set in `.env.local`:
- An interactive **Role Switcher** bar appears at the top of the app shell.
- Developers can seamlessly impersonate any role (**Trainee**, **Assessor**, **Institute Admin**, **Platform Admin**).
- The switcher automatically retrieves an active user profile for that role within the current institute from `public.users`.
- In production (`VITE_DEMO_MODE=false`), the active user and role are strictly determined by the authenticated Supabase session.

---

## Build & Typecheck Commands

```bash
# Typecheck TypeScript
npx tsc -b

# Production Build
npx vite build
```
