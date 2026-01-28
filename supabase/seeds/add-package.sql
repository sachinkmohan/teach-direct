-- Add packages for Jane (student) with John (teacher)
-- Run with: psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f add-package.sql
-- Uses fixed UUIDs to be idempotent (safe to re-run)

-- 1. 5-class package (30 minutes)
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
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',  -- Fixed UUID
  '22222222-2222-2222-2222-222222222222',  -- Jane (student)
  '11111111-1111-1111-1111-111111111111',  -- John (teacher)
  5,
  5,
  4.80,                -- 24.00 / 5 classes
  24.00,
  30,
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 2. 10-class package (45 minutes)
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
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',  -- Fixed UUID
  '22222222-2222-2222-2222-222222222222',  -- Jane (student)
  '11111111-1111-1111-1111-111111111111',  -- John (teacher)
  10,
  10,
  4.90,                -- Estimate for 45-min 10-class rate
  49.00,
  45,
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 3. Single lesson (30 minutes)
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
  'cccccccc-cccc-cccc-cccc-cccccccccccc',  -- Fixed UUID
  '22222222-2222-2222-2222-222222222222',  -- Jane (student)
  '11111111-1111-1111-1111-111111111111',  -- John (teacher)
  1,
  1,
  5.00,
  5.00,
  30,
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 4. Single lesson (60 minutes)
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
  'dddddddd-dddd-dddd-dddd-dddddddddddd',  -- Fixed UUID
  '22222222-2222-2222-2222-222222222222',  -- Jane (student)
  '11111111-1111-1111-1111-111111111111',  -- John (teacher)
  1,
  1,
  10.00,               -- Estimate for 60-min single rate
  10.00,
  60,
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Confirm packages were created
SELECT
  id as package_id,
  total_classes,
  remaining_classes,
  duration_minutes,
  price_per_class,
  total_amount,
  status
FROM public.packages
WHERE student_id = '22222222-2222-2222-2222-222222222222'
ORDER BY created_at DESC;
