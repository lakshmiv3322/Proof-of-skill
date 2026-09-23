-- ─────────────────────────────────────────────────────────────
-- ProofOfSkill — Complete Schema Migration
-- Matches src/types/database.ts exactly.
-- Run this in Supabase SQL Editor (or via supabase db push).
-- ─────────────────────────────────────────────────────────────

-- Enable pgcrypto for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────

create type user_role as enum (
  'trainee',
  'assessor',
  'institute_admin',
  'platform_admin'
);

create type submission_status as enum (
  'draft',
  'submitted',
  'ai_processing',
  'ai_processed',
  'under_review',
  'scored',
  'certified',
  'appealed'
);

create type appeal_status as enum (
  'pending',
  'approved',
  'rejected'
);

create type certificate_status as enum (
  'active',
  'revoked',
  'expired'
);

create type plan_tier as enum (
  'starter',
  'growth',
  'enterprise'
);

-- ─────────────────────────────────────────────────────────────
-- HELPER: auto-update updated_at on every write
-- ─────────────────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- TABLE: institutes  (global — no institute_id FK)
-- ─────────────────────────────────────────────────────────────

create table if not exists institutes (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text not null unique,
  plan_tier        plan_tier not null default 'starter',
  max_seats        integer not null default 50,
  contact_email    text not null,
  contact_phone    text,
  logo_url         text,
  is_active        boolean not null default true,
  settings         jsonb not null default '{
    "allow_appeals": true,
    "appeal_window_days": 14,
    "require_human_review": true,
    "certificate_template": "standard",
    "branding_color": null
  }'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger tr_institutes_updated_at
  before update on institutes
  for each row execute function set_updated_at();

-- institutes is globally readable by authenticated users (for signup dropdown)
alter table institutes enable row level security;

create policy "institutes: authenticated read all active"
  on institutes for select
  to authenticated
  using (is_active = true);

-- ─────────────────────────────────────────────────────────────
-- TABLE: users
-- ─────────────────────────────────────────────────────────────

create table if not exists users (
  id              uuid primary key default gen_random_uuid(),
  institute_id    uuid not null references institutes(id) on delete cascade,
  auth_id         uuid unique references auth.users(id) on delete set null,
  email           text not null unique,
  full_name       text not null,
  role            user_role not null default 'trainee',
  avatar_url      text,
  is_active       boolean not null default true,
  last_login_at   timestamptz,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists users_institute_id_idx on users(institute_id);
create index if not exists users_auth_id_idx on users(auth_id);

create trigger tr_users_updated_at
  before update on users
  for each row execute function set_updated_at();

alter table users enable row level security;

-- Users can read their own row and all users in the same institute
create policy "users: read own tenant"
  on users for select
  to authenticated
  using (
    institute_id = (
      select u.institute_id from users u
      where u.auth_id = auth.uid()
      limit 1
    )
    or auth_id = auth.uid()
  );

-- Users can update their own profile
create policy "users: update own profile"
  on users for update
  to authenticated
  using (auth_id = auth.uid())
  with check (auth_id = auth.uid());

-- Institute admins can manage users within their institute
create policy "users: admin manage own institute"
  on users for all
  to authenticated
  using (
    institute_id = (
      select u.institute_id from users u
      where u.auth_id = auth.uid()
        and u.role in ('institute_admin', 'platform_admin')
      limit 1
    )
  );

-- Platform admins can see everything
create policy "users: platform_admin full access"
  on users for all
  to authenticated
  using (
    exists (
      select 1 from users u
      where u.auth_id = auth.uid()
        and u.role = 'platform_admin'
    )
  );

-- Allow new user profile creation on signup (matches auth.uid())
create policy "users: insert own on signup"
  on users for insert
  to authenticated
  with check (auth_id = auth.uid());

-- Platform admins can manage institutes
create policy "institutes: platform_admin full access"
  on institutes for all
  to authenticated
  using (
    exists (
      select 1 from users
      where users.auth_id = auth.uid()
        and users.role = 'platform_admin'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- TABLE: trades
-- ─────────────────────────────────────────────────────────────

create table if not exists trades (
  id           uuid primary key default gen_random_uuid(),
  institute_id uuid not null references institutes(id) on delete cascade,
  name         text not null,
  description  text not null default '',
  category     text not null default '',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists trades_institute_id_idx on trades(institute_id);

create trigger tr_trades_updated_at
  before update on trades
  for each row execute function set_updated_at();

alter table trades enable row level security;

create policy "trades: tenant read"
  on trades for select
  to authenticated
  using (institute_id = (select u.institute_id from users u where u.auth_id = auth.uid() limit 1));

create policy "trades: admin write"
  on trades for all
  to authenticated
  using (
    institute_id = (
      select u.institute_id from users u
      where u.auth_id = auth.uid()
        and u.role in ('institute_admin', 'platform_admin')
      limit 1
    )
  );

-- ─────────────────────────────────────────────────────────────
-- TABLE: rubrics
-- ─────────────────────────────────────────────────────────────

create table if not exists rubrics (
  id              uuid primary key default gen_random_uuid(),
  institute_id    uuid not null references institutes(id) on delete cascade,
  trade_id        uuid not null references trades(id) on delete cascade,
  name            text not null,
  version         integer not null default 1,
  is_published    boolean not null default false,
  pass_threshold  numeric(5,2) not null default 70,
  config          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists rubrics_institute_id_idx on rubrics(institute_id);
create index if not exists rubrics_trade_id_idx on rubrics(trade_id);

create trigger tr_rubrics_updated_at
  before update on rubrics
  for each row execute function set_updated_at();

alter table rubrics enable row level security;

create policy "rubrics: tenant read"
  on rubrics for select
  to authenticated
  using (institute_id = (select u.institute_id from users u where u.auth_id = auth.uid() limit 1));

create policy "rubrics: admin write"
  on rubrics for all
  to authenticated
  using (
    institute_id = (
      select u.institute_id from users u
      where u.auth_id = auth.uid()
        and u.role in ('institute_admin', 'platform_admin')
      limit 1
    )
  );

-- ─────────────────────────────────────────────────────────────
-- TABLE: reference_clips
-- ─────────────────────────────────────────────────────────────

create table if not exists reference_clips (
  id                uuid primary key default gen_random_uuid(),
  institute_id      uuid not null references institutes(id) on delete cascade,
  trade_id          uuid not null references trades(id) on delete cascade,
  rubric_id         uuid references rubrics(id) on delete set null,
  title             text not null,
  description       text not null default '',
  video_url         text not null,
  thumbnail_url     text not null default '',
  duration_seconds  integer not null default 0,
  tags              text[] not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists reference_clips_institute_id_idx on reference_clips(institute_id);
create index if not exists reference_clips_trade_id_idx on reference_clips(trade_id);

create trigger tr_reference_clips_updated_at
  before update on reference_clips
  for each row execute function set_updated_at();

alter table reference_clips enable row level security;

create policy "reference_clips: tenant read"
  on reference_clips for select
  to authenticated
  using (institute_id = (select u.institute_id from users u where u.auth_id = auth.uid() limit 1));

create policy "reference_clips: admin write"
  on reference_clips for all
  to authenticated
  using (
    institute_id = (
      select u.institute_id from users u
      where u.auth_id = auth.uid()
        and u.role in ('institute_admin', 'platform_admin')
      limit 1
    )
  );

-- ─────────────────────────────────────────────────────────────
-- TABLE: submissions
-- ─────────────────────────────────────────────────────────────

create table if not exists submissions (
  id                  uuid primary key default gen_random_uuid(),
  institute_id        uuid not null references institutes(id) on delete cascade,
  trainee_id          uuid not null references users(id) on delete cascade,
  trade_id            uuid not null references trades(id) on delete cascade,
  rubric_id           uuid not null references rubrics(id) on delete restrict,
  reference_clip_id   uuid references reference_clips(id) on delete set null,
  status              submission_status not null default 'draft',
  video_url           text not null default '',
  thumbnail_url       text not null default '',
  duration_seconds    integer not null default 0,
  submitted_at        timestamptz,
  reviewed_at         timestamptz,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists submissions_institute_id_idx on submissions(institute_id);
create index if not exists submissions_trainee_id_idx on submissions(trainee_id);
create index if not exists submissions_status_idx on submissions(status);

create trigger tr_submissions_updated_at
  before update on submissions
  for each row execute function set_updated_at();

alter table submissions enable row level security;

-- Trainees see only their own submissions
create policy "submissions: trainee own"
  on submissions for select
  to authenticated
  using (
    trainee_id = (select u.id from users u where u.auth_id = auth.uid() limit 1)
  );

-- Assessors and admins see all submissions in their institute
create policy "submissions: assessor/admin tenant read"
  on submissions for select
  to authenticated
  using (
    institute_id = (
      select u.institute_id from users u
      where u.auth_id = auth.uid()
        and u.role in ('assessor', 'institute_admin', 'platform_admin')
      limit 1
    )
  );

-- Trainees can insert/update their own submissions
create policy "submissions: trainee insert"
  on submissions for insert
  to authenticated
  with check (
    trainee_id = (select u.id from users u where u.auth_id = auth.uid() limit 1)
    and institute_id = (select u.institute_id from users u where u.auth_id = auth.uid() limit 1)
  );

create policy "submissions: trainee update own draft"
  on submissions for update
  to authenticated
  using (
    trainee_id = (select u.id from users u where u.auth_id = auth.uid() limit 1)
    and status in ('draft', 'submitted')
  );

-- Assessors/admins can update status, notes, etc.
create policy "submissions: assessor/admin update"
  on submissions for update
  to authenticated
  using (
    institute_id = (
      select u.institute_id from users u
      where u.auth_id = auth.uid()
        and u.role in ('assessor', 'institute_admin', 'platform_admin')
      limit 1
    )
  );

-- ─────────────────────────────────────────────────────────────
-- TABLE: pose_landmark_sets
-- ─────────────────────────────────────────────────────────────

create table if not exists pose_landmark_sets (
  id               uuid primary key default gen_random_uuid(),
  institute_id     uuid not null references institutes(id) on delete cascade,
  submission_id    uuid not null references submissions(id) on delete cascade,
  frame_count      integer not null default 0,
  landmarks        jsonb not null default '[]'::jsonb,
  confidence_score numeric(4,3) not null default 0,
  source           text not null default 'ai' check (source in ('ai', 'manual')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists pose_landmark_sets_submission_id_idx on pose_landmark_sets(submission_id);
create index if not exists pose_landmark_sets_institute_id_idx on pose_landmark_sets(institute_id);

create trigger tr_pose_landmark_sets_updated_at
  before update on pose_landmark_sets
  for each row execute function set_updated_at();

alter table pose_landmark_sets enable row level security;

create policy "pose_landmark_sets: tenant read"
  on pose_landmark_sets for select
  to authenticated
  using (institute_id = (select u.institute_id from users u where u.auth_id = auth.uid() limit 1));

create policy "pose_landmark_sets: tenant insert (trainee via edge fn)"
  on pose_landmark_sets for insert
  to authenticated
  with check (institute_id = (select u.institute_id from users u where u.auth_id = auth.uid() limit 1));

-- ─────────────────────────────────────────────────────────────
-- TABLE: scores
-- ─────────────────────────────────────────────────────────────

create table if not exists scores (
  id                   uuid primary key default gen_random_uuid(),
  institute_id         uuid not null references institutes(id) on delete cascade,
  submission_id        uuid not null references submissions(id) on delete cascade,
  rubric_criterion_id  text not null,
  score                numeric(5,2) not null,
  max_score            numeric(5,2) not null,
  weight               numeric(5,2) not null,
  source               text not null default 'ai' check (source in ('ai', 'human')),
  assessor_id          uuid references users(id) on delete set null,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists scores_submission_id_idx on scores(submission_id);
create index if not exists scores_institute_id_idx on scores(institute_id);

create trigger tr_scores_updated_at
  before update on scores
  for each row execute function set_updated_at();

alter table scores enable row level security;

create policy "scores: tenant read"
  on scores for select
  to authenticated
  using (institute_id = (select u.institute_id from users u where u.auth_id = auth.uid() limit 1));

create policy "scores: assessor/admin write"
  on scores for all
  to authenticated
  using (
    institute_id = (
      select u.institute_id from users u
      where u.auth_id = auth.uid()
        and u.role in ('assessor', 'institute_admin', 'platform_admin')
      limit 1
    )
  );

-- ─────────────────────────────────────────────────────────────
-- TABLE: feedback
-- ─────────────────────────────────────────────────────────────

create table if not exists feedback (
  id                   uuid primary key default gen_random_uuid(),
  institute_id         uuid not null references institutes(id) on delete cascade,
  submission_id        uuid not null references submissions(id) on delete cascade,
  score_id             uuid references scores(id) on delete set null,
  rubric_criterion_id  text,
  author_id            uuid not null references users(id) on delete cascade,
  author_role          user_role not null,
  body                 text not null,
  timestamp_seconds    numeric(10,3),
  is_ai_generated      boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists feedback_submission_id_idx on feedback(submission_id);
create index if not exists feedback_institute_id_idx on feedback(institute_id);

create trigger tr_feedback_updated_at
  before update on feedback
  for each row execute function set_updated_at();

alter table feedback enable row level security;

create policy "feedback: tenant read"
  on feedback for select
  to authenticated
  using (institute_id = (select u.institute_id from users u where u.auth_id = auth.uid() limit 1));

create policy "feedback: tenant insert"
  on feedback for insert
  to authenticated
  with check (institute_id = (select u.institute_id from users u where u.auth_id = auth.uid() limit 1));

-- ─────────────────────────────────────────────────────────────
-- TABLE: certificates
-- ─────────────────────────────────────────────────────────────

create table if not exists certificates (
  id                uuid primary key default gen_random_uuid(),
  institute_id      uuid not null references institutes(id) on delete cascade,
  submission_id     uuid not null references submissions(id) on delete cascade,
  trainee_id        uuid not null references users(id) on delete cascade,
  trade_id          uuid not null references trades(id) on delete cascade,
  verification_code text not null unique,
  status            certificate_status not null default 'active',
  issued_at         timestamptz not null default now(),
  expires_at        timestamptz,
  issued_by         uuid not null references users(id) on delete restrict,
  overall_score     numeric(5,2) not null,
  pdf_url           text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists certificates_institute_id_idx on certificates(institute_id);
create index if not exists certificates_trainee_id_idx on certificates(trainee_id);
create index if not exists certificates_verification_code_idx on certificates(verification_code);

create trigger tr_certificates_updated_at
  before update on certificates
  for each row execute function set_updated_at();

alter table certificates enable row level security;

-- Trainees can see their own certificates
create policy "certificates: trainee own"
  on certificates for select
  to authenticated
  using (trainee_id = (select u.id from users u where u.auth_id = auth.uid() limit 1));

-- Staff see all in their institute
create policy "certificates: staff tenant read"
  on certificates for select
  to authenticated
  using (
    institute_id = (
      select u.institute_id from users u
      where u.auth_id = auth.uid()
        and u.role in ('assessor', 'institute_admin', 'platform_admin')
      limit 1
    )
  );

-- Admins manage certificates
create policy "certificates: admin write"
  on certificates for all
  to authenticated
  using (
    institute_id = (
      select u.institute_id from users u
      where u.auth_id = auth.uid()
        and u.role in ('institute_admin', 'platform_admin')
      limit 1
    )
  );

-- Public verification: anyone can look up a certificate by verification_code
-- (handled via a public-facing Edge Function — no direct anon policy needed)

-- ─────────────────────────────────────────────────────────────
-- TABLE: appeals
-- ─────────────────────────────────────────────────────────────

create table if not exists appeals (
  id                  uuid primary key default gen_random_uuid(),
  institute_id        uuid not null references institutes(id) on delete cascade,
  submission_id       uuid not null references submissions(id) on delete cascade,
  trainee_id          uuid not null references users(id) on delete cascade,
  status              appeal_status not null default 'pending',
  reason              text not null,
  submitted_at        timestamptz not null default now(),
  resolved_at         timestamptz,
  resolved_by         uuid references users(id) on delete set null,
  resolution_notes    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists appeals_institute_id_idx on appeals(institute_id);
create index if not exists appeals_trainee_id_idx on appeals(trainee_id);

create trigger tr_appeals_updated_at
  before update on appeals
  for each row execute function set_updated_at();

alter table appeals enable row level security;

create policy "appeals: trainee own"
  on appeals for select
  to authenticated
  using (trainee_id = (select u.id from users u where u.auth_id = auth.uid() limit 1));

create policy "appeals: trainee insert"
  on appeals for insert
  to authenticated
  with check (
    trainee_id = (select u.id from users u where u.auth_id = auth.uid() limit 1)
    and institute_id = (select u.institute_id from users u where u.auth_id = auth.uid() limit 1)
  );

create policy "appeals: staff tenant read"
  on appeals for select
  to authenticated
  using (
    institute_id = (
      select u.institute_id from users u
      where u.auth_id = auth.uid()
        and u.role in ('assessor', 'institute_admin', 'platform_admin')
      limit 1
    )
  );

create policy "appeals: admin resolve"
  on appeals for update
  to authenticated
  using (
    institute_id = (
      select u.institute_id from users u
      where u.auth_id = auth.uid()
        and u.role in ('institute_admin', 'platform_admin')
      limit 1
    )
  );

-- ─────────────────────────────────────────────────────────────
-- TABLE: usage_counters (global — no per-row institute filter)
-- ─────────────────────────────────────────────────────────────

create table if not exists usage_counters (
  id                    uuid primary key default gen_random_uuid(),
  institute_id          uuid not null references institutes(id) on delete cascade,
  period_year           integer not null,
  period_month          integer not null check (period_month between 1 and 12),
  submissions_count     integer not null default 0,
  ai_assessments_count  integer not null default 0,
  certificates_issued   integer not null default 0,
  active_users          integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (institute_id, period_year, period_month)
);

create index if not exists usage_counters_institute_id_idx on usage_counters(institute_id);

create trigger tr_usage_counters_updated_at
  before update on usage_counters
  for each row execute function set_updated_at();

alter table usage_counters enable row level security;

create policy "usage_counters: admin read own institute"
  on usage_counters for select
  to authenticated
  using (
    institute_id = (
      select u.institute_id from users u
      where u.auth_id = auth.uid()
        and u.role in ('institute_admin', 'platform_admin')
      limit 1
    )
  );

create policy "usage_counters: platform_admin full access"
  on usage_counters for all
  to authenticated
  using (
    exists (
      select 1 from users u
      where u.auth_id = auth.uid()
        and u.role = 'platform_admin'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- TABLE: audit_log (append-only — no updated_at, no update/delete)
-- ─────────────────────────────────────────────────────────────

create table if not exists audit_log (
  id           uuid primary key default gen_random_uuid(),
  institute_id uuid not null references institutes(id) on delete cascade,
  actor_id     uuid references users(id) on delete set null,
  actor_role   user_role,
  action       text not null,
  entity_type  text not null,
  entity_id    uuid not null,
  metadata     jsonb not null default '{}'::jsonb,
  ip_address   text,
  created_at   timestamptz not null default now()
);

create index if not exists audit_log_institute_id_idx on audit_log(institute_id);
create index if not exists audit_log_created_at_idx on audit_log(created_at desc);
create index if not exists audit_log_actor_id_idx on audit_log(actor_id);

alter table audit_log enable row level security;

create policy "audit_log: admin read own institute"
  on audit_log for select
  to authenticated
  using (
    institute_id = (
      select u.institute_id from users u
      where u.auth_id = auth.uid()
        and u.role in ('institute_admin', 'platform_admin')
      limit 1
    )
  );

-- Only server-side (service role) inserts — never from the browser directly
create policy "audit_log: service role insert"
  on audit_log for insert
  to service_role
  with check (true);

-- Prevent all deletes and updates (immutable audit trail)
create policy "audit_log: no delete"
  on audit_log for delete using (false);

-- ─────────────────────────────────────────────────────────────
-- FUNCTION: handle_new_auth_user
-- Called by a trigger on auth.users to auto-create a users row
-- when a new Supabase Auth user signs up.
-- The signed-up user must supply institute_id in their metadata.
-- ─────────────────────────────────────────────────────────────

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_institute_id uuid;
  v_full_name    text;
  v_role         user_role;
begin
  v_institute_id := (new.raw_user_meta_data->>'institute_id')::uuid;
  v_full_name    := coalesce(new.raw_user_meta_data->>'full_name', new.email);
  v_role         := coalesce(
    (new.raw_user_meta_data->>'role')::user_role,
    'trainee'::user_role
  );

  if v_institute_id is null then
    raise exception 'institute_id is required in signup metadata';
  end if;

  insert into public.users (
    auth_id, institute_id, email, full_name, role
  ) values (
    new.id, v_institute_id, new.email, v_full_name, v_role
  );

  return new;
end;
$$;

-- Wire the trigger to auth.users
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ─────────────────────────────────────────────────────────────
-- FUNCTION: get_certificate_by_code (public/anon verification)
-- Used by the /verify/:code route without requiring auth.
-- ─────────────────────────────────────────────────────────────

create or replace function public.get_certificate_by_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cert jsonb;
begin
  select to_jsonb(c) || jsonb_build_object(
    'trainee_name', u.full_name,
    'trade_name',   t.name,
    'institute_name', i.name
  )
  into v_cert
  from certificates c
  join users u on u.id = c.trainee_id
  join trades t on t.id = c.trade_id
  join institutes i on i.id = c.institute_id
  where c.verification_code = p_code
    and c.status = 'active'
  limit 1;

  return v_cert;
end;
$$;

-- Grant anon access for the verification endpoint
grant execute on function public.get_certificate_by_code(text) to anon;
grant execute on function public.get_certificate_by_code(text) to authenticated;
