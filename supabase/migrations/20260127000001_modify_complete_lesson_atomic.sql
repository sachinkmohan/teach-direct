-- Migration: Modify complete_lesson_atomic to set auto_release_at to 3 days
-- Lessons auto-move to awaiting_admin_approval after 3 days if student doesn't confirm
-- Note: CREATE OR REPLACE preserves existing OWNER and GRANT permissions from base schema

CREATE OR REPLACE FUNCTION public.complete_lesson_atomic(p_lesson_id uuid, p_teacher_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lesson_teacher_id UUID;
  v_lesson_status TEXT;
  v_scheduled_at TIMESTAMPTZ;
BEGIN
  -- Get lesson details and lock the row
  SELECT teacher_id, status, scheduled_at
  INTO v_lesson_teacher_id, v_lesson_status, v_scheduled_at
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
    RAISE EXCEPTION 'Cannot complete a lesson that has not occurred yet';
  END IF;

  -- Update lesson status to pending_confirmation with auto_release_at (3 days)
  UPDATE public.lessons
  SET
    status = 'pending_confirmation',
    auto_release_at = NOW() + INTERVAL '3 days',
    updated_at = NOW()
  WHERE id = p_lesson_id;

  RETURN TRUE;
END;
$$;
