-- Migration: Add multiple lesson durations with flexible pricing
-- This migration adds support for teachers to offer lessons in multiple durations (30, 45, 60 minutes)
-- with independent pricing for each duration.

-- ============================================================================
-- 1. Create teacher_lesson_offerings table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."teacher_lesson_offerings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "duration_minutes" integer NOT NULL,
    "single_rate" numeric(10,2) NOT NULL,
    "package_5_rate" numeric(10,2),
    "package_10_rate" numeric(10,2),
    "is_active" boolean DEFAULT true NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "teacher_lesson_offerings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "teacher_lesson_offerings_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE CASCADE,
    CONSTRAINT "unique_teacher_duration" UNIQUE ("teacher_id", "duration_minutes"),
    CONSTRAINT "teacher_lesson_offerings_duration_check" CHECK ("duration_minutes" IN (30, 45, 60)),
    CONSTRAINT "teacher_lesson_offerings_single_rate_check" CHECK ("single_rate" >= 1),
    CONSTRAINT "teacher_lesson_offerings_package_5_rate_check" CHECK ("package_5_rate" IS NULL OR "package_5_rate" >= 1),
    CONSTRAINT "teacher_lesson_offerings_package_10_rate_check" CHECK ("package_10_rate" IS NULL OR "package_10_rate" >= 1)
);

ALTER TABLE "public"."teacher_lesson_offerings" OWNER TO "postgres";

-- ============================================================================
-- 2. Add duration_minutes column to packages table
-- ============================================================================
ALTER TABLE "public"."packages"
    ADD COLUMN IF NOT EXISTS "duration_minutes" integer DEFAULT 30 NOT NULL;

-- ============================================================================
-- 2b. Update lessons table default to 30 minutes (was 60 in original schema)
-- ============================================================================
ALTER TABLE "public"."lessons"
    ALTER COLUMN "duration_minutes" SET DEFAULT 30;

-- ============================================================================
-- 3. Create indexes for teacher_lesson_offerings
-- ============================================================================
CREATE INDEX IF NOT EXISTS "idx_offerings_teacher_id" ON "public"."teacher_lesson_offerings" ("teacher_id");
CREATE INDEX IF NOT EXISTS "idx_offerings_teacher_duration" ON "public"."teacher_lesson_offerings" ("teacher_id", "duration_minutes");
CREATE INDEX IF NOT EXISTS "idx_offerings_active" ON "public"."teacher_lesson_offerings" ("teacher_id", "is_active") WHERE "is_active" = true;

-- ============================================================================
-- 4. Enable RLS and create policies for teacher_lesson_offerings
-- ============================================================================
ALTER TABLE "public"."teacher_lesson_offerings" ENABLE ROW LEVEL SECURITY;

-- Public can view active offerings (for students browsing teachers)
CREATE POLICY "Public can view active offerings" ON "public"."teacher_lesson_offerings"
    FOR SELECT
    USING ("is_active" = true);

-- Teachers can view all their own offerings (including inactive)
CREATE POLICY "Teachers can view own offerings" ON "public"."teacher_lesson_offerings"
    FOR SELECT
    USING ("auth"."uid"() = "teacher_id");

-- Teachers can insert their own offerings
CREATE POLICY "Teachers can insert own offerings" ON "public"."teacher_lesson_offerings"
    FOR INSERT
    WITH CHECK ("auth"."uid"() = "teacher_id");

-- Teachers can update their own offerings
CREATE POLICY "Teachers can update own offerings" ON "public"."teacher_lesson_offerings"
    FOR UPDATE
    USING ("auth"."uid"() = "teacher_id")
    WITH CHECK ("auth"."uid"() = "teacher_id");

-- Teachers can delete their own offerings
CREATE POLICY "Teachers can delete own offerings" ON "public"."teacher_lesson_offerings"
    FOR DELETE
    USING ("auth"."uid"() = "teacher_id");

-- ============================================================================
-- 5. Grant permissions
-- ============================================================================
-- Anonymous users can only read active offerings (RLS enforces is_active = true)
GRANT SELECT ON TABLE "public"."teacher_lesson_offerings" TO "anon";
-- Authenticated users can read, insert, update, delete their own offerings (RLS enforces ownership)
GRANT ALL ON TABLE "public"."teacher_lesson_offerings" TO "authenticated";
-- Service role has full access (for edge functions)
GRANT ALL ON TABLE "public"."teacher_lesson_offerings" TO "service_role";

-- ============================================================================
-- 6. Migrate existing teacher pricing data to offerings (30-minute duration)
-- ============================================================================
INSERT INTO "public"."teacher_lesson_offerings" (
    "teacher_id",
    "duration_minutes",
    "single_rate",
    "package_5_rate",
    "package_10_rate",
    "is_active",
    "display_order"
)
SELECT
    tp."user_id",
    30,
    tp."hourly_rate",
    tp."package_5_rate",
    tp."package_10_rate",
    true,
    0
FROM "public"."teacher_profiles" tp
WHERE tp."hourly_rate" IS NOT NULL
ON CONFLICT ("teacher_id", "duration_minutes") DO NOTHING;

-- ============================================================================
-- 7. Update book_lesson_atomic to set lesson duration from package
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."book_lesson_atomic"(
    "p_package_id" "uuid",
    "p_teacher_id" "uuid",
    "p_student_id" "uuid",
    "p_scheduled_at" timestamp with time zone,
    "p_meeting_link" "text",
    "p_price_per_class" numeric
) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
DECLARE
  v_lesson_id UUID;
  v_remaining_classes INTEGER;
  v_duration_minutes INTEGER;
  v_pkg_student_id UUID;
  v_pkg_teacher_id UUID;
BEGIN
  -- Lock the package row to prevent concurrent bookings and get duration
  SELECT remaining_classes, duration_minutes, student_id, teacher_id
  INTO v_remaining_classes, v_duration_minutes, v_pkg_student_id, v_pkg_teacher_id
  FROM public.packages
  WHERE id = p_package_id
  FOR UPDATE;

  -- Validate package was found
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Package not found';
  END IF;

  -- Validate ownership: package must belong to the student
  IF v_pkg_student_id != p_student_id THEN
    RAISE EXCEPTION 'Package does not belong to this student';
  END IF;

  -- Validate package is for the correct teacher
  IF v_pkg_teacher_id != p_teacher_id THEN
    RAISE EXCEPTION 'Package is not for this teacher';
  END IF;

  -- Check if package has classes available
  IF v_remaining_classes <= 0 THEN
    RAISE EXCEPTION 'No remaining classes in this package';
  END IF;

  -- Create the lesson with duration from package
  INSERT INTO public.lessons (
    package_id,
    teacher_id,
    student_id,
    scheduled_at,
    meeting_link,
    duration_minutes,
    status
  )
  VALUES (
    p_package_id,
    p_teacher_id,
    p_student_id,
    p_scheduled_at,
    p_meeting_link,
    v_duration_minutes,
    'scheduled'
  )
  RETURNING id INTO v_lesson_id;

  -- Deduct one class from package
  UPDATE public.packages
  SET
    remaining_classes = remaining_classes - 1,
    updated_at = NOW()
  WHERE id = p_package_id;

  -- Update teacher's pending balance
  UPDATE public.teacher_profiles
  SET
    pending_balance = COALESCE(pending_balance, 0) + p_price_per_class,
    updated_at = NOW()
  WHERE user_id = p_teacher_id;

  RETURN v_lesson_id;
END;
$$;

ALTER FUNCTION "public"."book_lesson_atomic"("p_package_id" "uuid", "p_teacher_id" "uuid", "p_student_id" "uuid", "p_scheduled_at" timestamp with time zone, "p_meeting_link" "text", "p_price_per_class" numeric) OWNER TO "postgres";
