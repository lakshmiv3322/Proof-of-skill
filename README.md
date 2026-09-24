# ProofOfSkill — AI Biometric Skill Verification Platform

ProofOfSkill is an enterprise-grade, multi-tenant practical skill verification platform for vocational training and healthcare certification. It replaces subjective, pen-and-paper assessments with objective, camera-based 33-point kinematic pose extraction, deterministic Dynamic Time Warping (DTW) mathematical scoring, dual-phase AI coaching narratives, and cryptographically signed certificates.

---

## 🏗 Architecture Overview

```
                          ┌─────────────────────────────────────────────────────────┐
                          │                     Client Tier                         │
                          │   React 18 + Vite + TypeScript + MediaPipe BlazePose    │
                          │   (Real-time 33-landmark capture / Offline IndexedDB)   │
                          └────────────────────────────┬────────────────────────────┘
                                                       │
                                   1. Ingest Raw Video │ & Telemetry
                                                       ▼
                          ┌─────────────────────────────────────────────────────────┐
                          │            Untrusted Staging Storage                    │
                          │       - Database Table: `submission_staging`            │
                          │       - Storage Bucket: `submission-videos` (Private)   │
                          └────────────────────────────┬────────────────────────────┘
                                                       │
                                   2. Async Trigger    │ `score-submission`
                                      (Service Role)   │
                                                       ▼
                          ┌─────────────────────────────────────────────────────────┐
                          │             Authoritative Scoring Engine                │
                          │              (Supabase Edge Function)                   │
                          │       - 3D Anatomical Biacromial Normalization          │
                          │       - Dynamic Time Warping (DTW) Distance Matrix      │
                          │       - Kinematic Rubric Penalty Calculations           │
                          │       - Claude 3.5 Sonnet Feedback with Rule Fallbacks  │
                          └────────────────────────────┬────────────────────────────┘
                                                       │
                                   3. Atomic Commit    │ via Service Role
                                                       ▼
                          ┌─────────────────────────────────────────────────────────┐
                          │               Authoritative Database                    │
                          │           PostgreSQL with Kernel-Level RLS              │
                          │   - `submissions`, `scores`, `pose_landmark_sets`       │
                          │   - `rubrics`, `trades`, `institutes`, `users`          │
                          │   - `certificates` (HMAC-SHA256 signed)                 │
                          │   - `audit_log` (Append-only immutable event log)       │
                          └─────────────────────────────────────────────────────────┘
```

### Core Architecture Principles
1. **Zero-Trust Client Boundary**: Client browsers only capture raw video and landmark coordinates into an unverified `submission_staging` table. Clients possess **zero direct insert/update privileges** on official `submissions`, `scores`, or `certificates`.
2. **Server-Authoritative Evaluation**: Scoring is executed strictly by the server-side `score-submission` Edge Function using `SUPABASE_SERVICE_ROLE_KEY`.
3. **Deterministic Kinematic Math**: Scores are computed solely through mathematical formulas and DTW alignment against trade rubrics. Generative LLMs are never permitted to alter or set numeric scores.
4. **Multi-Tenant Isolation**: Row-Level Security (RLS) policies partition all access by `institute_id`.
5. **Auditable Lifecycle**: Every state transition, score calculation, assessor review, and override is permanently logged to `public.audit_log`.

---

## ⚙️ Environment Variables

Cross-check your `.env.local` against `.env.example`:

### Frontend Client (Vite)
| Variable | Description | Example / Default |
|---|---|---|
| `VITE_SUPABASE_URL` | The public HTTPS endpoint of your Supabase project | `https://your-project.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | The public anonymous API key (enforces RLS) | `eyJhbGciOi...` |
| `VITE_DEMO_MODE` | Set `'true'` for local demo & offline role-switcher; `'false'` for production Supabase auth | `'true'` |

### Supabase Edge Functions (Secrets Vault)
Set these in your Supabase project via `supabase secrets set`:
| Variable | Description | Required By |
|---|---|---|
| `SUPABASE_URL` | Supabase project URL (automatically injected in Cloud) | All Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key with admin privileges to commit scores | `score-submission`, `generate-certificate` |
| `CERTIFICATE_SIGNING_SECRET` | Secret key used for cryptographic HMAC-SHA256 certificate signatures | `generate-certificate` |
| `ANTHROPIC_API_KEY` | Optional: Anthropic API key for Claude coaching narrative generation | `generate-feedback` |

---

## 🚀 Supabase Setup & Deployment Guide

Follow these steps to deploy ProofOfSkill on a fresh Supabase project from scratch.

### Step 1: Install Dependencies & Supabase CLI
```bash
npm install
npm install -g supabase
```

### Step 2: Link Supabase Project & Apply Migrations
Login and link your Supabase project:
```bash
supabase login
supabase link --project-ref <your-project-ref>
```

Apply all migrations in chronological sequence:
```bash
supabase db push
```

#### Migration Sequence Breakdown
If applying manually via the **Supabase SQL Editor**, execute the files in this exact order:
1. `supabase/migrations/20260901000000_proofofskill_schema.sql` — Base tables, enums, triggers, RPCs, initial schema.
2. `supabase/migrations/20260901000001_rls_hardening.sql` — Comprehensive Row-Level Security policies.
3. `supabase/migrations/20260901000002_seed_data.sql` — Default demo institutes, trades, and initial CPR/Welding rubrics.
4. `supabase/migrations/20260901000003_fix_rls_recursion.sql` — Non-recursive `SECURITY DEFINER` auth helpers.
5. `supabase/migrations/20260901000004_server_authoritative_scoring_and_audit.sql` — `submission_staging` table, client permission restrictions, audit triggers.
6. `supabase/migrations/20260901000005_storage_and_video_evidence.sql` — Private `submission-videos` storage bucket and tenant isolation policies.
7. `supabase/migrations/20260901000006_submission_staging_retention_policy.sql` — Staging retention stored procedures (`purge_completed_submission_staging`).

### Step 3: Configure Storage Buckets
The migrations automatically configure the `submission-videos` private bucket. Verify in the Supabase Dashboard under **Storage**:
- **Bucket**: `submission-videos` (Public: `false`, Max file size: `100MB`)

### Step 4: Set Edge Function Secrets & Deploy
Configure environment secrets in Supabase:
```bash
supabase secrets set CERTIFICATE_SIGNING_SECRET="your-high-entropy-hmac-secret"
supabase secrets set ANTHROPIC_API_KEY="sk-ant-api..." # Optional for Claude feedback
```

Deploy the three Edge Functions:
```bash
supabase functions deploy score-submission
supabase functions deploy generate-certificate
supabase functions deploy generate-feedback
```

### Step 5: Build and Run the Client Application
```bash
# Development server (Port 3000)
npm run dev

# Production build
npm run build
```

---

## 📐 Rubric JSON Rule Format & Configuration Guide

ProofOfSkill uses a **generalized kinematic rubric format** (`RubricConfig`). This schema allows institute administrators to define biomechanical quality standards for any physical trade (e.g. CPR, Welding, Carpentry, Phlebotomy) without modifying application code.

### How the Visual Rubric Editor Maps to JSON

The administrator interface at `src/components/admin/rubric-editor.tsx` provides both a visual rule builder and a raw JSON code editor. Here is how each visual field maps directly to the schema:

| UI Field in Rubric Editor | JSON Key in `criteria[]` | Type | Purpose |
|---|---|---|---|
| **Rule Title / Name** | `label` | `string` | Display name of the assessment criterion |
| **Rule Type** | `ruleType` | `KinematicRuleType` | Kinematic formula engine applied to the landmark stream |
| **Weight (%)** | `weight` | `number` (0–100) | Proportion of total score allocated to this rule |
| **Target Min / Max** | `targetMin`, `targetMax` | `number` | Ideal numerical window (e.g., 100–120 BPM, 70°–85° angle) |
| **Tolerance** | `tolerance` | `number` | Grace margin where linear penalty is applied before failure |
| **Unit** | `unit` | `string` | Measurement unit (`BPM`, `cm`, `deg`, `mm/s`, `%`) |
| **Tracked Joint(s)** | `landmarks` / `landmark` | `string[]` / `string` | MediaPipe BlazePose landmarks used (e.g. `['right_shoulder', 'right_elbow', 'right_wrist']`) |
| **Clinical / Trade Description** | `description` | `string` | Explanation and rubric requirements |
| **Assessor Indicator Checklist** | `indicators` | `string[]` | Practical checklists shown to human evaluators |

---

### Supported Kinematic Rule Types

1. `frequency_bpm`: Measures repetition cadence using zero-crossing / peak detection on vertical excursion (e.g., CPR compression rate).
2. `depth_normalized`: Measures physical excursion depth scaled by the rescuer's anatomical biacromial shoulder width (e.g., CPR compression depth).
3. `recoil_completeness`: Measures chest/joint release return percentage (< 5% residual leaning).
4. `joint_angle_range`: Computes 3-point 3D joint angle $\theta = \arccos\left(\frac{\vec{u}\cdot\vec{v}}{\|\vec{u}\|\|\vec{v}\|}\right)$ across three landmarks (e.g., elbow lock, welding torch work angle).
5. `travel_speed`: Computes horizontal/linear velocity in mm/s or cm/s of an end effector (e.g., welding torch progression).
6. `path_stability`: Measures root-mean-square lateral path wander relative to the primary motion vector.
7. `posture_variance`: Measures vertical torso/arm alignment score against a gravity reference vector.

---

### Worked Examples

#### Example 1: CPR Chest Compression Rubric (`cpr_bls_v1`)
```json
{
  "total_weight": 100,
  "criteria": [
    {
      "id": "cpr-rate",
      "label": "Compression Rate",
      "ruleType": "frequency_bpm",
      "targetMin": 100,
      "targetMax": 120,
      "tolerance": 10,
      "unit": "BPM",
      "weight": 30,
      "description": "Maintain cadence between 100 and 120 compressions per minute.",
      "indicators": ["100–120 BPM target cadence", "Steady rhythm"]
    },
    {
      "id": "cpr-depth",
      "label": "Compression Depth",
      "ruleType": "depth_normalized",
      "targetMin": 5.0,
      "targetMax": 6.0,
      "tolerance": 0.5,
      "unit": "cm",
      "weight": 30,
      "description": "Maintain sternal excursion depth between 5.0cm and 6.0cm (anatomically scaled).",
      "indicators": ["5.0–6.0 cm target depth", "No over-compression"]
    },
    {
      "id": "cpr-recoil",
      "label": "Full Chest Recoil",
      "ruleType": "recoil_completeness",
      "maxIncompletePct": 5,
      "tolerance": 10,
      "unit": "%",
      "weight": 20,
      "description": "Allow complete thoracic recoil without residual leaning (< 5% incomplete).",
      "indicators": ["< 5% incomplete recoil", "Zero residual leaning"]
    },
    {
      "id": "cpr-posture",
      "label": "Rescuer Arm Posture & Alignment",
      "ruleType": "posture_variance",
      "targetMin": 0,
      "targetMax": 15,
      "tolerance": 10,
      "weight": 20,
      "description": "Elbows locked straight and shoulders positioned vertically over sternum.",
      "indicators": ["Elbows locked", "Shoulders over hands"]
    }
  ],
  "scoring_scale": {
    "min": 0,
    "max": 100,
    "bands": [
      { "label": "Pass", "min": 70, "max": 100, "color": "#00f0ff" },
      { "label": "Needs Practice", "min": 0, "max": 69, "color": "#f59e0b" }
    ]
  }
}
```

#### Example 2: SMAW Plate Welding Rubric (`welding_smaw_v1`)
```json
{
  "total_weight": 100,
  "criteria": [
    {
      "id": "weld-travel-speed",
      "label": "Travel Speed Progression",
      "ruleType": "travel_speed",
      "landmark": "right_wrist",
      "targetMin": 2.5,
      "targetMax": 4.5,
      "tolerance": 1.0,
      "unit": "mm/s",
      "weight": 30,
      "description": "Maintain steady torch progression between 2.5 and 4.5 mm/s along weld joint.",
      "indicators": ["2.5–4.5 mm/s travel speed", "Linear torch progression without pauses"]
    },
    {
      "id": "weld-torch-angle",
      "label": "Lead/Work Torch Angle (Arm Positioning)",
      "ruleType": "joint_angle_range",
      "landmarks": ["right_shoulder", "right_elbow", "right_wrist"],
      "targetMin": 70,
      "targetMax": 85,
      "tolerance": 10,
      "unit": "deg",
      "weight": 30,
      "description": "Maintain 70°–85° drag angle with stable forearm/wrist positioning.",
      "indicators": ["70°–85° drag angle", "Locked wrist posture"]
    },
    {
      "id": "weld-arc-stability",
      "label": "Arc Length & Standoff Stability",
      "ruleType": "path_stability",
      "landmark": "right_wrist",
      "maxDeviation": 1.2,
      "tolerance": 0.5,
      "unit": "cm",
      "weight": 25,
      "description": "Maintain consistent arc standoff and minimize lateral bead wandering (< 1.2 cm).",
      "indicators": ["< 1.2 cm lateral wandering", "Consistent arc height"]
    },
    {
      "id": "weld-safety-posture",
      "label": "Welder Stance & Body Clearance",
      "ruleType": "posture_variance",
      "targetMin": 0,
      "targetMax": 70,
      "tolerance": 15,
      "weight": 15,
      "description": "Proper welder stance with stable balance and head clear of direct fume plume.",
      "indicators": ["Stable two-point stance", "Head clear of fume plume"]
    }
  ],
  "scoring_scale": {
    "min": 0,
    "max": 100,
    "bands": [
      { "label": "Pass", "min": 70, "max": 100, "color": "#00f0ff" },
      { "label": "Needs Practice", "min": 0, "max": 69, "color": "#f59e0b" }
    ]
  }
}
```

---

## 🔒 Security & Compliance

For detailed documentation on the PostgreSQL Row-Level Security architecture, server-authoritative scoring boundaries, audit log triggers, and cryptographic certificate verification flow, refer to [SECURITY.md](SECURITY.md).
