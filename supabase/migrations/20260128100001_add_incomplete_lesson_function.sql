-- Migration: Create incomplete_lesson_atomic function
-- Allows teachers to mark past lessons as incomplete (e.g., student no-show)
-- Refunds the class credit back to the student's package
CREATE OR REPLACE FUNCTION public.incomplete_lesson_atomic(p_lesson_id uuid, p_teacher_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
  v_lesson_teacher_id UUID;
  v_lesson_status TEXT;
  v_scheduled_at TIMESTAMPTZ;
  v_package_id UUID;
  v_price_per_class DECIMAL;
BEGIN
  -- Get lesson details and lock the row
  SELECT teacher_id, status, scheduled_at, package_id
  INTO v_lesson_teacher_id, v_lesson_status, v_scheduled_at, v_package_id
  FROM public.lessons
  WHERE id = p_lesson_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;

  -- Validate teacher owns the lesson
  IF v_lesson_teacher_id != p_teacher_id THEN
    RAISE EXCEPTION 'You are not the teacher for this lesson';
  END IF;

  -- Validate lesson status is scheduled
  IF v_lesson_status != 'scheduled' THEN
    RAISE EXCEPTION 'Lesson is not in scheduled status';
  END IF;

  -- Validate lesson is in the past
  IF v_scheduled_at > NOW() THEN
    RAISE EXCEPTION 'Cannot mark a future lesson as incomplete';
  END IF;

  -- Get price per class from package
  SELECT price_per_class INTO v_price_per_class
  FROM public.packages
  WHERE id = v_package_id;

  -- Update lesson status to incomplete
  UPDATE public.lessons
  SET
    status = 'incomplete',
    updated_at = NOW()
  WHERE id = p_lesson_id;

  -- Refund the class back to the package
  UPDATE public.packages
  SET
    remaining_classes = remaining_classes + 1,
    updated_at = NOW()
  WHERE id = v_package_id;

  -- Reduce teacher's pending balance
  UPDATE public.teacher_profiles
  SET
    pending_balance = GREATEST(0, COALESCE(pending_balance, 0) - v_price_per_class),
    updated_at = NOW()
  WHERE user_id = v_lesson_teacher_id;

  RETURN TRUE;
END;
$func$;
