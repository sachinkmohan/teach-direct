-- Admin Approval Test Data
-- Run this AFTER `supabase db reset` to add test data for admin approval flow
--
-- Usage:
--   supabase db reset                           # First reset with default seed
--   psql "$DATABASE_URL" -f supabase/seeds/admin-approval-test.sql
--
-- Prerequisites:
--   1. Set VITE_ADMIN_EMAIL=john@teacher.test in .env.local
--   2. Login as John and complete Stripe Connect onboarding
--   3. Then run this script to create test lessons
--
-- Test Flow:
--   1. Login as Jane (jane@student.test / password123)
--   2. Go to /lessons - see lesson in "pending_confirmation"
--   3. Click "Confirm Lesson" -> moves to "awaiting_admin_approval"
--   4. Login as John (john@teacher.test / password123)
--   5. Go to /admin - see lessons awaiting approval
--   6. Click "Approve" -> Stripe transfer executes

-- Fixed UUIDs (matching seed.sql)
-- Teacher John: 11111111-1111-1111-1111-111111111111
-- Student Jane: 22222222-2222-2222-2222-222222222222

-- ============================================
-- 1. Create a Package for Jane with John
-- ============================================

INSERT INTO public.packages (
  id,
  student_id,
  teacher_id,
  total_classes,
  remaining_classes,
  price_per_class,
  total_amount,
  duration_minutes,
  status,
  created_at,
  updated_at
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '22222222-2222-2222-2222-222222222222',  -- Jane (student)
  '11111111-1111-1111-1111-111111111111',  -- John (teacher)
  5,
  3,  -- 2 lessons already booked
  4.80,
  24.00,
  30,  -- 30 minute lessons
  'active',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. Create Lessons for testing
-- ============================================

-- Lesson 1: awaiting_admin_approval (ready for admin to approve)
INSERT INTO public.lessons (
  id,
  package_id,
  teacher_id,
  student_id,
  scheduled_at,
  duration_minutes,
  status,
  created_at,
  updated_at
) VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  NOW() - INTERVAL '2 days',
  30,
  'awaiting_admin_approval',
  NOW() - INTERVAL '3 days',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Lesson 2: pending_confirmation (for testing student confirmation flow)
INSERT INTO public.lessons (
  id,
  package_id,
  teacher_id,
  student_id,
  scheduled_at,
  duration_minutes,
  status,
  created_at,
  updated_at
) VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  NOW() - INTERVAL '1 day',
  30,
  'pending_confirmation',
  NOW() - INTERVAL '2 days',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Summary
-- ============================================
--
-- Created:
--   - Package: 5 classes (3 remaining) at 4.80 EUR/class
--   - Lesson 1: awaiting_admin_approval (admin can approve at /admin)
--   - Lesson 2: pending_confirmation (Jane can confirm at /lessons)
--
-- To test admin approval:
--   1. Ensure John has completed Stripe Connect onboarding
--   2. Login as John, go to /admin
--   3. Approve the lesson
--   4. Check Stripe dashboard for transfer
--
