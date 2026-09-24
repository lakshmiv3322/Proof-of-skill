# ProofOfSkill — Enterprise Security Architecture & Compliance

This document outlines the security architecture, authorization boundaries, cryptographic verification mechanisms, and audit compliance controls implemented in **ProofOfSkill**. It is designed to assist enterprise security teams, compliance officers, and external auditors during technical reviews.

---

## 1. Multi-Tenant Row Level Security (RLS) Model

Every tenant-scoped table in PostgreSQL enforces Postgres Row-Level Security (RLS) at the database kernel level. Data isolation is structurally guaranteed by tenant partitioning via `institute_id`.

```
                    ┌───────────────────────────────┐
                    │      Client Application       │
                    │   (Vite + React Single-Page)  │
                    └──────────────┬────────────────┘
                                   │ Authenticated JWT (Bearer)
                                   ▼
                    ┌───────────────────────────────┐
                    │  PostgreSQL Connection Pool   │
                    │      (Supabase PostgREST)     │
                    └──────────────┬────────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
   ┌───────────────────────┐                 ┌───────────────────────┐
   │ Trainee Role Scoping  │                 │  Staff Role Scoping   │
   │  - Read own submissions│                 │  - Read all tenant    │
   │  - Read own progress  │                 │    submissions        │
   │  - Write to staging   │                 │  - Assess & override  │
   │  - Read active trades │                 │  - Manage rubrics     │
   └───────────────────────┘                 └───────────────────────┘
```

### 1.1 Role Definitions & Privileges

| Role | Scope | Table Permissions (Summary) |
|---|---|---|
| `trainee` | Own Records | `SELECT` own submissions, scores, certificates, and appeals. `INSERT` only to `submission_staging` and `appeals`. **Zero direct write access to `scores` or `submissions`**. |
| `assessor` | Assigned Institute | `SELECT` all submissions, scores, telemetry, and rubrics within their `institute_id`. `UPDATE` submission review notes and assessor overrides. |
| `institute_admin` | Assigned Institute | Full operational control within their `institute_id`. Manages users, trades, rubrics, view usage metrics, and audit logs. |
| `platform_admin` | Global (Cross-Tenant) | Super-administrator with system-wide diagnostic and configuration access. |

### 1.2 Non-Recursive RLS Helper Functions

To eliminate infinite recursion loops and optimize query execution plans, role and tenant resolution uses `SECURITY DEFINER` helper functions with pinned `search_path = public`:

- `public.current_user_id()`: Resolves `public.users.id` from `auth.uid()`.
- `public.current_user_role()`: Resolves `user_role` enum from `public.users`.
- `public.current_user_institute_id()`: Resolves tenant `institute_id` from `public.users`.

---

## 2. Server-Authoritative Scoring vs. Untrusted Client Boundary

ProofOfSkill operates on a strict **Zero-Trust Client Ingestion Model**. Client browsers and mobile devices are treated as untrusted video capture endpoints.

```
┌─────────────────┐       1. Raw Video & 33 Landmarks       ┌────────────────────────┐
│  Trainee Client ├────────────────────────────────────────►│   submission_staging   │
└─────────────────┘                                         └───────────┬────────────┘
                                                                        │
                                   2. Async Edge Invocation             │
                                      (score-submission)                │
                                                                        ▼
                                                            ┌────────────────────────┐
                                                            │  Server Edge Function  │
                                                            │  (DTW Kinematic Math)  │
                                                            └───────────┬────────────┘
                                                                        │
                                   3. Direct Write via Service Role     │
                                      (Bypasses client RLS)             │
                                                                        ▼
                                                            ┌────────────────────────┐
                                                            │   Authoritative DB     │
                                                            │  - submissions         │
                                                            │  - scores              │
                                                            │  - audit_log           │
                                                            └────────────────────────┘
```

### 2.1 Untrusted Client Data (`submission_staging`)
- Trainees capture webcam frames and process MediaPipe BlazePose landmarks locally for real-time visual preflight feedback.
- On capture completion, the raw telemetry payload is written to the unverified `submission_staging` table.
- Trainees have **NO permission to write directly to `public.submissions` or `public.scores`**.

### 2.2 Server-Authoritative Execution (`score-submission`)
- The Supabase Edge Function `score-submission` executes independently on Deno runtime using `SUPABASE_SERVICE_ROLE_KEY`.
- The engine recalculates Dynamic Time Warping (DTW) distance matrices, cadence frequencies (BPM), anatomical biacromial normalization, and joint angles directly from the raw landmark stream.
- The certified score is committed to `public.submissions` and `public.scores`.
- If client-side fallback scores are displayed during offline mode, they are prominently tagged with `isOfflineScore: true` and an amber UI badge to prevent unverified credentialing.

---

## 3. Immutable Audit Logging & Database Trigger Coverage

All high-stakes actions, state mutations, and assessor overrides are recorded in the append-only `public.audit_log` table.

### 3.1 Immutability Guarantees
- `audit_log` has **NO `UPDATE` or `DELETE` policies**.
- Direct deletion is blocked at the RLS and trigger level (`CREATE POLICY "audit_log: no delete" ON audit_log FOR DELETE USING (false)`).
- Timestamps (`created_at`) are generated by database server clock `now()`.

### 3.2 Automated Database Trigger Hooks

| Trigger Name | Monitored Table | Event | Action Logged |
|---|---|---|---|
| `tr_audit_submission_status` | `submissions` | `UPDATE of status` | Records status transition (`submitted` → `under_review` → `scored` → `certified`). |
| `tr_audit_score_override` | `scores` | `UPDATE of assessor_override_score` | Records original AI score, human override score, assessor ID, and justification reason. |
| `tr_audit_appeal_status` | `appeals` | `UPDATE of status` | Records review outcome (`approved` / `rejected`) and reviewer notes. |
| `tr_audit_certificate_issued`| `certificates` | `INSERT` | Records certificate issuance, unique verification code, and trainee ID. |

---

## 4. Cryptographic Certificate Verification Architecture

Certificates issued by ProofOfSkill are tamper-evident and independently verifiable via digital signatures.

```
Certificate Payload:
  {
    certificate_id: "...",
    trainee_id: "...",
    institute_id: "...",
    trade_id: "...",
    overall_score: 94.5,
    issued_at: "2026-09-24T00:00:00Z"
  }
                 │
                 ▼  HMAC-SHA256 Signing (Server Secret)
  ┌────────────────────────────────────────────────────────┐
  │ Cryptographic Signature Hash (64-char Hex)             │
  │ e.g. "a3f89b1c74d0e28f..."                             │
  └────────────────────────────────────────────────────────┘
                 │
                 ▼
  ┌────────────────────────────────────────────────────────┐
  │ Public QR Code Verification URL                        │
  │ https://proofofskill.app/verify/POS-A7K92X4P           │
  └────────────────────────────────────────────────────────┘
```

### 4.1 Verification Workflow
1. **Minting**: When an assessor approves a passing submission, `generate-certificate` computes an **HMAC-SHA256** hash over the canonical JSON certificate payload and generates an 8-character verification code (`POS-XXXXXXXX`).
2. **Storage**: The hash, verification code, and metadata are persisted in `public.certificates`.
3. **Public Verification**: Any third-party employer, registrar, or regulator can access the verification page or call the PostgreSQL RPC `public.get_certificate_by_code(p_verification_code)`.
4. **Revocation Check**: The RPC explicitly validates `status = 'active'`. If a certificate is marked `revoked` or `expired`, the verification endpoint immediately returns an invalid state.

---

## 5. Storage Security & Media Isolation

Video evidence is stored in private Supabase Storage buckets:
- **Bucket**: `submission-videos` (Private, max 100 MB per file, allowed MIME types: `video/webm`, `video/mp4`, `video/quicktime`).
- **Object Path Hierarchy**: `<institute_id>/<submission_id>/video.webm`.
- **Access Control**: Download access is restricted strictly to authenticated users belonging to the matching `institute_id` folder via signed URLs.
- **Trainee Isolation**: Trainees can only upload files destined for their own `institute_id` prefix.

---

## 6. Retention & Data Lifecycle Management

To prevent unbounded storage growth of unverified telemetry:
- **Staging Cleanup Stored Procedure**: `public.purge_completed_submission_staging(p_retention_days)` deletes telemetry records that have been scored and committed to `submissions` after a configurable retention window (default: 30 days).
- **Failed/Pending Preservation**: Staging records with status `failed` or `pending` are excluded from automatic purges to preserve raw logs for assessor debugging and re-runs.
