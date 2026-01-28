-- Seed data for local development
-- This file is automatically run after migrations when you do `supabase db reset`

-- Fixed UUIDs for test users (so we can reference them consistently)
-- Teacher John: 11111111-1111-1111-1111-111111111111
-- Student Jane: 22222222-2222-2222-2222-222222222222

-- ============================================
-- 1. Create auth.users (authentication records)
-- ============================================

-- Teacher: John (password: password123)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud,
  is_sso_user,
  is_anonymous,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change_token_current,
  phone_change_token,
  reauthentication_token,
  email_change,
  phone_change
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'john@teacher.test',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"role": "teacher", "display_name": "John"}',
  NOW(),
  NOW(),
  'authenticated',
  'authenticated',
  FALSE,
  FALSE,
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  ''
);

-- Student: Jane (password: password123)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud,
  is_sso_user,
  is_anonymous,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change_token_current,
  phone_change_token,
  reauthentication_token,
  email_change,
  phone_change
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'jane@student.test',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"role": "student", "display_name": "Jane"}',
  NOW(),
  NOW(),
  'authenticated',
  'authenticated',
  FALSE,
  FALSE,
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  ''
);

-- ============================================
-- 1b. Create auth.identities (required for email login)
-- ============================================

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '{"sub": "11111111-1111-1111-1111-111111111111", "email": "john@teacher.test"}',
  'email',
  '11111111-1111-1111-1111-111111111111',
  NOW(),
  NOW(),
  NOW()
);

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  '22222222-2222-2222-2222-222222222222',
  '{"sub": "22222222-2222-2222-2222-222222222222", "email": "jane@student.test"}',
  'email',
  '22222222-2222-2222-2222-222222222222',
  NOW(),
  NOW(),
  NOW()
);

-- The handle_new_user trigger will automatically create:
-- - public.users entries for both
-- - public.teacher_profiles entry for John

-- ============================================
-- 2. Update timezones for users
-- ============================================

-- Set teacher John's timezone to Berlin
UPDATE public.users
SET timezone = 'Europe/Berlin'
WHERE id = '11111111-1111-1111-1111-111111111111';

-- Set student Jane's timezone to Asia (using Asia/Kolkata as example)
UPDATE public.users
SET timezone = 'Asia/Kolkata'
WHERE id = '22222222-2222-2222-2222-222222222222';

-- ============================================
-- 3. Update Teacher John's profile with rates
-- ============================================

-- Wait a moment for trigger to complete, then update the teacher profile
UPDATE public.teacher_profiles
SET
  bio = 'Experienced Malayalam teacher with 5+ years of teaching experience. I make learning fun and interactive!',
  subjects = ARRAY['Malayalam'],
  languages = ARRAY['English', 'Malayalam', 'Hindi'],
  hourly_rate = 5.00,
  package_5_rate = 24.00,
  package_10_rate = 45.00,
  stripe_connect_id = 'acct_1SuAEtL1IsnZMWBN',
  stripe_connect_status = 'active'
WHERE user_id = '11111111-1111-1111-1111-111111111111';

-- ============================================
-- 4. Create default lesson offering for John (30 minutes)
-- ============================================

INSERT INTO public.teacher_lesson_offerings (
  teacher_id,
  duration_minutes,
  single_rate,
  package_5_rate,
  package_10_rate,
  is_active,
  display_order
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  30,
  5.00,
  24.00,
  49.00,
  true,
  0
) ON CONFLICT (teacher_id, duration_minutes) DO UPDATE
SET
  single_rate = EXCLUDED.single_rate,
  package_5_rate = EXCLUDED.package_5_rate,
  package_10_rate = EXCLUDED.package_10_rate,
  is_active = EXCLUDED.is_active;

-- ============================================
-- 5. Summary of Test Accounts
-- ============================================
--
-- TEACHER:
--   Email: john@teacher.test
--   Password: password123
--   Name: John
--   Timezone: Europe/Berlin
--   Subject: Malayalam
--   Legacy Rates (for backward compatibility):
--     Hourly Rate: 5 EUR
--     5-Class Package: 24 EUR (4.80 EUR/class)
--     10-Class Package: 49 EUR (4.90 EUR/class)
--   Lesson Offerings:
--     30 minutes: 5 EUR single, 24 EUR (5 classes), 49 EUR (10 classes) - ACTIVE
--   Stripe: CONNECTED (acct_1SuAEtL1IsnZMWBN, status: active)
--
-- STUDENT:
--   Email: jane@student.test
--   Password: password123
--   Name: Jane
--   Timezone: Asia/Kolkata
--
