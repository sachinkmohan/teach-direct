-- Create a lesson for testing auto-release functionality
-- This lesson is in 'pending_confirmation' with auto_release_at in the past
-- Run with: psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f test-auto-release.sql

-- First, check if Jane has an active package, if not create one
INSERT INTO public.packages (
  id,
  student_id,
  teacher_id,
  total_classes,
  remaining_classes,
  price_per_class,
  total_amount,
  status,
  created_at,
  updated_at
)
SELECT
  'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,  -- Jane (student)
  '11111111-1111-1111-1111-111111111111'::uuid,  -- John (teacher)
  5,
  4,  -- 1 lesson already used
  4.80,
  24.00,
  'active',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM public.packages
  WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid
);

-- Create a lesson in 'pending_confirmation' with auto_release_at 1 day ago
INSERT INTO public.lessons (
  id,
  package_id,
  teacher_id,
  student_id,
  scheduled_at,
  duration_minutes,
  status,
  auto_release_at,
  created_at,
  updated_at
) VALUES (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid,
  'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,  -- Package created above
  '11111111-1111-1111-1111-111111111111'::uuid,  -- John (teacher)
  '22222222-2222-2222-2222-222222222222'::uuid,  -- Jane (student)
  NOW() - INTERVAL '5 days',  -- Lesson was 5 days ago
  60,
  'pending_confirmation',
  NOW() - INTERVAL '1 day',  -- Auto-release was supposed to happen 1 day ago
  NOW() - INTERVAL '5 days',
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Verify the lesson was created
SELECT
  id,
  status,
  auto_release_at,
  auto_release_at < NOW() as "should_auto_release",
  scheduled_at
FROM public.lessons
WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid;

-- Summary
SELECT
  'Lesson created in pending_confirmation with auto_release_at in the past.' as message,
  'Run: curl -X POST http://127.0.0.1:54321/functions/v1/auto-release-lessons' as "next_step";
