-- Add a package for Jane (student) with John (teacher)
-- Run with: psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f add-package.sql

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
) VALUES (
  gen_random_uuid(),  -- Generate a random UUID
  '22222222-2222-2222-2222-222222222222',  -- Jane (student)
  '11111111-1111-1111-1111-111111111111',  -- John (teacher)
  10,                  -- Total classes
  10,                  -- All classes remaining
  4.90,                -- Price per class (10-class package rate)
  49.00,               -- Total amount
  'active',
  NOW(),
  NOW()
);

-- Confirm the package was created
SELECT
  id,
  total_classes,
  remaining_classes,
  price_per_class,
  total_amount,
  status
FROM public.packages
WHERE student_id = '22222222-2222-2222-2222-222222222222'
ORDER BY created_at DESC
LIMIT 1;
