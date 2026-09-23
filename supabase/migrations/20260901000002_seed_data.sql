-- -------------------------------------------------------------
-- ProofOfSkill — Seed Data & Anon Institute Policy
-- File: supabase/migrations/20260901000002_seed_data.sql
-- -------------------------------------------------------------

-- 1. Allow unauthenticated (anon) users to list active institutes for the signup dropdown
CREATE POLICY "institutes_select_active_anon" ON institutes
  FOR SELECT TO anon
  USING (is_active = true);

-- 2. Insert Default Institutes
INSERT INTO institutes (
  id, name, slug, plan_tier, max_seats, contact_email, is_active, settings
) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'Apex Vocational Institute',
    'apex-vocational',
    'growth',
    100,
    'admin@apex.edu',
    true,
    '{"allow_appeals": true, "appeal_window_days": 14, "require_human_review": true, "certificate_template": "standard", "branding_color": "#00f0ff"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Northgate Technical College',
    'northgate-tech',
    'enterprise',
    500,
    'admin@northgate.edu',
    true,
    '{"allow_appeals": true, "appeal_window_days": 30, "require_human_review": true, "certificate_template": "enterprise", "branding_color": "#c89b3c"}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- 3. Insert Default Trades
INSERT INTO trades (
  id, institute_id, name, description, category, is_active
) VALUES
  (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'CPR Chest Compression Assessment',
    'Standard American Heart Association adult CPR chest compression verification protocol.',
    'Emergency Medicine',
    true
  )
ON CONFLICT (id) DO NOTHING;

-- 4. Insert Default Rubric
INSERT INTO rubrics (
  id, institute_id, trade_id, name, version, is_published, pass_threshold, config
) VALUES
  (
    '00000000-0000-0000-0000-000000000020',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    'AHA-CPR-2026-v2',
    1,
    true,
    70.0,
    '{
      "criteria": [
        {
          "id": "rate",
          "label": "Compression Rate",
          "weight": 30,
          "targetMin": 100,
          "targetMax": 120,
          "tolerance": 5,
          "description": "Maintain cadence between 100 and 120 compressions per minute."
        },
        {
          "id": "depth",
          "label": "Compression Depth",
          "weight": 30,
          "targetMin": 5.0,
          "targetMax": 6.0,
          "tolerance": 0.5,
          "description": "Maintain sternal excursion depth between 5.0cm and 6.0cm."
        },
        {
          "id": "recoil",
          "label": "Full Recoil Completeness",
          "weight": 20,
          "targetMin": 95,
          "targetMax": 100,
          "tolerance": 5,
          "description": "Allow complete thoracic recoil without residual leaning."
        },
        {
          "id": "posture",
          "label": "Arm Posture & Vertical Lock",
          "weight": 20,
          "targetMin": 175,
          "targetMax": 180,
          "tolerance": 5,
          "description": "Elbows locked straight and shoulders positioned vertically over sternum."
        }
      ]
    }'::jsonb
  )
ON CONFLICT (id) DO NOTHING;
