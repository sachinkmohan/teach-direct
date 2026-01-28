-- Migration: Add 'incomplete' to lessons status constraint
ALTER TABLE public.lessons DROP CONSTRAINT IF EXISTS lessons_status_check;
ALTER TABLE public.lessons ADD CONSTRAINT lessons_status_check
  CHECK (status = ANY (ARRAY[
    'scheduled'::text,
    'completed'::text,
    'pending_confirmation'::text,
    'awaiting_admin_approval'::text,
    'confirmed'::text,
    'disputed'::text,
    'cancelled'::text,
    'incomplete'::text
  ]));
