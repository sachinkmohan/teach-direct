-- Migration: Add admin approval step for lesson payouts
-- This adds 'awaiting_admin_approval' status and new RPC functions

-- 1. Update the lessons status constraint to include 'awaiting_admin_approval'
ALTER TABLE public.lessons DROP CONSTRAINT IF EXISTS lessons_status_check;
ALTER TABLE public.lessons ADD CONSTRAINT lessons_status_check
  CHECK (status = ANY (ARRAY[
    'scheduled'::text,
    'completed'::text,
    'pending_confirmation'::text,
    'awaiting_admin_approval'::text,
    'confirmed'::text,
    'disputed'::text,
    'cancelled'::text
  ]));

-- 2. Create student_confirm_lesson RPC
-- This sets status to 'awaiting_admin_approval' without any balance changes or Stripe transfer
CREATE OR REPLACE FUNCTION public.student_confirm_lesson(p_lesson_id uuid, p_student_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lesson_student_id UUID;
  v_lesson_status TEXT;
BEGIN
  -- Get lesson details and lock the row
  SELECT student_id, status
  INTO v_lesson_student_id, v_lesson_status
  FROM public.lessons
  WHERE id = p_lesson_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;

  -- Validate student owns the lesson
  IF v_lesson_student_id != p_student_id THEN
    RAISE EXCEPTION 'You are not the student for this lesson';
  END IF;

  -- Validate lesson status is pending_confirmation
  IF v_lesson_status != 'pending_confirmation' THEN
    RAISE EXCEPTION 'Lesson is not pending confirmation';
  END IF;

  -- Update lesson status to awaiting_admin_approval
  UPDATE public.lessons
  SET
    status = 'awaiting_admin_approval',
    auto_release_at = NULL,
    updated_at = NOW()
  WHERE id = p_lesson_id;

  RETURN TRUE;
END;
$$;

ALTER FUNCTION public.student_confirm_lesson(uuid, uuid) OWNER TO postgres;
GRANT ALL ON FUNCTION public.student_confirm_lesson(uuid, uuid) TO authenticated;
GRANT ALL ON FUNCTION public.student_confirm_lesson(uuid, uuid) TO service_role;

-- 3. Create admin_approve_lesson RPC
-- This sets status to 'confirmed', moves balances, and creates transactions
-- Returns data needed for Stripe transfer
CREATE OR REPLACE FUNCTION public.admin_approve_lesson(p_lesson_id uuid)
RETURNS TABLE(
  success boolean,
  teacher_id uuid,
  teacher_connect_id text,
  transfer_amount numeric,
  price_per_class numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lesson_status TEXT;
  v_package_id UUID;
  v_teacher_id UUID;
  v_student_id UUID;
  v_price_per_class DECIMAL;
  v_teacher_amount DECIMAL;
  v_teacher_connect_id TEXT;
BEGIN
  -- Get lesson details and lock the row
  SELECT l.status, l.package_id, l.teacher_id, l.student_id
  INTO v_lesson_status, v_package_id, v_teacher_id, v_student_id
  FROM public.lessons l
  WHERE l.id = p_lesson_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;

  -- Validate status is awaiting_admin_approval
  IF v_lesson_status != 'awaiting_admin_approval' THEN
    RAISE EXCEPTION 'Lesson is not awaiting admin approval';
  END IF;

  -- Get price per class from package
  SELECT pkg.price_per_class INTO v_price_per_class
  FROM public.packages pkg
  WHERE pkg.id = v_package_id;

  IF NOT FOUND OR v_price_per_class IS NULL THEN
    RAISE EXCEPTION 'Package not found or price missing';
  END IF;

  -- Get teacher's Stripe Connect ID
  SELECT tp.stripe_connect_id INTO v_teacher_connect_id
  FROM public.teacher_profiles tp
  WHERE tp.user_id = v_teacher_id;

  IF v_teacher_connect_id IS NULL THEN
    RAISE EXCEPTION 'Teacher does not have a connected Stripe account';
  END IF;

  -- Calculate teacher's amount (90% after 10% platform fee)
  v_teacher_amount := v_price_per_class * 0.90;

  -- Move funds from pending to available (teacher gets 90%)
  UPDATE public.teacher_profiles
  SET
    pending_balance = GREATEST(0, COALESCE(pending_balance, 0) - v_price_per_class),
    available_balance = GREATEST(0, COALESCE(available_balance, 0) + v_teacher_amount),
    updated_at = NOW()
  WHERE user_id = v_teacher_id;

  -- Update lesson status to confirmed
  UPDATE public.lessons
  SET
    status = 'confirmed',
    updated_at = NOW()
  WHERE id = p_lesson_id;

  -- Create transaction record for the teacher (receiving payment - 90%)
  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    status,
    metadata
  )
  VALUES (
    v_teacher_id,
    'lesson_payment',
    v_teacher_amount,
    'completed',
    jsonb_build_object(
      'lesson_id', p_lesson_id,
      'student_id', v_student_id,
      'package_id', v_package_id,
      'gross_amount', v_price_per_class,
      'platform_fee_percent', 10,
      'platform_fee_amount', v_price_per_class * 0.10,
      'approved_by_admin', true
    )
  );

  -- Create transaction record for the student (lesson confirmed/spent)
  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    status,
    metadata
  )
  VALUES (
    v_student_id,
    'lesson_payment',
    v_price_per_class,
    'completed',
    jsonb_build_object(
      'lesson_id', p_lesson_id,
      'teacher_id', v_teacher_id,
      'package_id', v_package_id,
      'approved_by_admin', true
    )
  );

  -- Return data needed for Stripe transfer
  RETURN QUERY SELECT
    TRUE::BOOLEAN,
    v_teacher_id::UUID,
    v_teacher_connect_id::TEXT,
    v_teacher_amount::DECIMAL,
    v_price_per_class::DECIMAL;
END;
$$;

ALTER FUNCTION public.admin_approve_lesson(uuid) OWNER TO postgres;
-- Only service_role can call this (edge function verifies admin email before calling)
GRANT ALL ON FUNCTION public.admin_approve_lesson(uuid) TO service_role;

-- 4. Create revert_admin_approval RPC
-- This reverts a lesson back to 'awaiting_admin_approval' if Stripe transfer fails
-- Undoes all changes made by admin_approve_lesson
CREATE OR REPLACE FUNCTION public.revert_admin_approval(p_lesson_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lesson_status TEXT;
  v_package_id UUID;
  v_teacher_id UUID;
  v_price_per_class DECIMAL;
  v_teacher_amount DECIMAL;
BEGIN
  -- Get lesson details and lock the row
  SELECT l.status, l.package_id, l.teacher_id
  INTO v_lesson_status, v_package_id, v_teacher_id
  FROM public.lessons l
  WHERE l.id = p_lesson_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;

  -- Only revert if status is 'confirmed' (meaning approval was done but transfer failed)
  IF v_lesson_status != 'confirmed' THEN
    RAISE EXCEPTION 'Lesson is not in confirmed status, cannot revert';
  END IF;

  -- Get price per class from package
  SELECT pkg.price_per_class INTO v_price_per_class
  FROM public.packages pkg
  WHERE pkg.id = v_package_id;

  IF NOT FOUND OR v_price_per_class IS NULL THEN
    RAISE EXCEPTION 'Package not found or price missing';
  END IF;

  -- Calculate teacher's amount (90% after 10% platform fee)
  v_teacher_amount := v_price_per_class * 0.90;

  -- Revert teacher balance: move funds back from available to pending
  UPDATE public.teacher_profiles
  SET
    pending_balance = COALESCE(pending_balance, 0) + v_price_per_class,
    available_balance = GREATEST(0, COALESCE(available_balance, 0) - v_teacher_amount),
    updated_at = NOW()
  WHERE user_id = v_teacher_id;

  -- Revert lesson status back to awaiting_admin_approval
  UPDATE public.lessons
  SET
    status = 'awaiting_admin_approval',
    updated_at = NOW()
  WHERE id = p_lesson_id;

  -- Delete the transaction records that were created for this lesson approval
  DELETE FROM public.transactions
  WHERE metadata->>'lesson_id' = p_lesson_id::text
    AND metadata->>'approved_by_admin' = 'true';

  RETURN TRUE;
END;
$$;

ALTER FUNCTION public.revert_admin_approval(uuid) OWNER TO postgres;
GRANT ALL ON FUNCTION public.revert_admin_approval(uuid) TO service_role;

-- 5. Modify complete_lesson_atomic to set auto_release_at to 3 days
-- Lessons auto-move to awaiting_admin_approval after 3 days if student doesn't confirm
CREATE OR REPLACE FUNCTION public.complete_lesson_atomic(p_lesson_id uuid, p_teacher_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

ALTER FUNCTION public.complete_lesson_atomic(uuid, uuid) OWNER TO postgres;
GRANT ALL ON FUNCTION public.complete_lesson_atomic(uuid, uuid) TO authenticated;
GRANT ALL ON FUNCTION public.complete_lesson_atomic(uuid, uuid) TO service_role;
