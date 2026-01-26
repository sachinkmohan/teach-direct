


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."book_lesson_atomic"("p_package_id" "uuid", "p_teacher_id" "uuid", "p_student_id" "uuid", "p_scheduled_at" timestamp with time zone, "p_meeting_link" "text", "p_price_per_class" numeric) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_lesson_id UUID;
  v_remaining_classes INTEGER;
BEGIN
  -- Lock the package row to prevent concurrent bookings
  SELECT remaining_classes INTO v_remaining_classes
  FROM public.packages
  WHERE id = p_package_id
  FOR UPDATE;

  -- Check if package has classes available
  IF v_remaining_classes <= 0 THEN
    RAISE EXCEPTION 'No remaining classes in this package';
  END IF;

  -- Create the lesson
  INSERT INTO public.lessons (
    package_id,
    teacher_id,
    student_id,
    scheduled_at,
    meeting_link,
    status
  )
  VALUES (
    p_package_id,
    p_teacher_id,
    p_student_id,
    p_scheduled_at,
    p_meeting_link,
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


CREATE OR REPLACE FUNCTION "public"."cancel_lesson_atomic"("p_lesson_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_package_id UUID;
  v_teacher_id UUID;
  v_price_per_class DECIMAL;
BEGIN
  -- Get lesson details and lock the row
  SELECT package_id, teacher_id INTO v_package_id, v_teacher_id
  FROM public.lessons
  WHERE id = p_lesson_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;

  -- Get price per class from package
  SELECT price_per_class INTO v_price_per_class
  FROM public.packages
  WHERE id = v_package_id;

  -- Update lesson status to cancelled
  UPDATE public.lessons
  SET
    status = 'cancelled',
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
  WHERE user_id = v_teacher_id;

  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."cancel_lesson_atomic"("p_lesson_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_lesson_atomic"("p_lesson_id" "uuid", "p_teacher_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
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

  -- Update lesson status to pending_confirmation
  UPDATE public.lessons
  SET
    status = 'pending_confirmation',
    auto_release_at = NOW() + INTERVAL '3 days',
    updated_at = NOW()
  WHERE id = p_lesson_id;

  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."complete_lesson_atomic"("p_lesson_id" "uuid", "p_teacher_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dispute_lesson"("p_lesson_id" "uuid", "p_student_id" "uuid", "p_reason" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_lesson_student_id UUID;
  v_lesson_status TEXT;
  v_existing_notes TEXT;
BEGIN
  -- Get lesson details and lock the row
  SELECT student_id, status, notes
  INTO v_lesson_student_id, v_lesson_status, v_existing_notes
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

  -- Update lesson status to disputed and append reason to notes
  UPDATE public.lessons
  SET
    status = 'disputed',
    auto_release_at = NULL,
    notes = CASE
      WHEN v_existing_notes IS NULL OR v_existing_notes = '' THEN
        'DISPUTE: ' || p_reason
      ELSE
        v_existing_notes || E'\n\nDISPUTE: ' || p_reason
    END,
    updated_at = NOW()
  WHERE id = p_lesson_id;

  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."dispute_lesson"("p_lesson_id" "uuid", "p_student_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Log the signup attempt
  RAISE LOG 'handle_new_user triggered for user: %, email: %', NEW.id, NEW.email;

  -- Insert user metadata into public.users
  INSERT INTO public.users (id, email, role, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    updated_at = NOW();

  -- If user is a teacher, create an empty teacher_profiles row
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'student') = 'teacher' THEN
    INSERT INTO public.teacher_profiles (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    RAISE LOG 'Created teacher profile for user: %', NEW.id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the signup
  RAISE LOG 'Error in handle_new_user for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_lesson_funds"("p_lesson_id" "uuid") RETURNS TABLE("success" boolean, "teacher_id" "uuid", "teacher_connect_id" "text", "transfer_amount" numeric, "price_per_class" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
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

  -- Validate status is pending_confirmation
  IF v_lesson_status != 'pending_confirmation' THEN
    RAISE EXCEPTION 'Lesson is not pending confirmation';
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
    available_balance = COALESCE(available_balance, 0) + v_teacher_amount,
    updated_at = NOW()
  WHERE user_id = v_teacher_id;

  -- Update lesson status to confirmed and clear auto_release_at
  UPDATE public.lessons
  SET
    status = 'confirmed',
    auto_release_at = NULL,
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
      'platform_fee_amount', v_price_per_class * 0.10
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
      'package_id', v_package_id
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


ALTER FUNCTION "public"."release_lesson_funds"("p_lesson_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_monthly_earnings"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_year INTEGER;
  v_month INTEGER;
BEGIN
  -- Only process completed lesson_payment transactions
  IF NEW.type = 'lesson_payment' AND NEW.status = 'completed' THEN
    v_year := EXTRACT(YEAR FROM NEW.created_at);
    v_month := EXTRACT(MONTH FROM NEW.created_at);

    -- Upsert the monthly earnings record
    INSERT INTO monthly_earnings (teacher_id, year, month, total_amount, lesson_count)
    VALUES (NEW.user_id, v_year, v_month, NEW.amount, 1)
    ON CONFLICT (teacher_id, year, month)
    DO UPDATE SET
      total_amount = monthly_earnings.total_amount + EXCLUDED.total_amount,
      lesson_count = monthly_earnings.lesson_count + 1,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_monthly_earnings"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."lessons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "scheduled_at" timestamp with time zone NOT NULL,
    "duration_minutes" integer DEFAULT 60 NOT NULL,
    "meeting_link" "text",
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "notes" "text",
    "auto_release_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "lessons_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'completed'::"text", 'pending_confirmation'::"text", 'confirmed'::"text", 'disputed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."lessons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."monthly_earnings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "year" integer NOT NULL,
    "month" integer NOT NULL,
    "total_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "lesson_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "monthly_earnings_month_check" CHECK ((("month" >= 1) AND ("month" <= 12)))
);


ALTER TABLE "public"."monthly_earnings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "total_classes" integer NOT NULL,
    "remaining_classes" integer NOT NULL,
    "price_per_class" numeric(10,2) NOT NULL,
    "total_amount" numeric(10,2) NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "stripe_payment_intent_id" "text",
    CONSTRAINT "check_remaining_classes_non_negative" CHECK (("remaining_classes" >= 0)),
    CONSTRAINT "packages_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'expired'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teacher_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "bio" "text",
    "subjects" "text"[] DEFAULT '{}'::"text"[],
    "languages" "text"[] DEFAULT '{}'::"text"[],
    "hourly_rate" numeric(10,2),
    "stripe_connect_id" "text",
    "stripe_connect_status" "text" DEFAULT 'pending'::"text",
    "available_balance" numeric(10,2) DEFAULT 0,
    "pending_balance" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "package_5_rate" numeric(10,2),
    "package_10_rate" numeric(10,2)
);


ALTER TABLE "public"."teacher_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "stripe_payment_intent_id" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "transactions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "transactions_type_check" CHECK (("type" = ANY (ARRAY['purchase'::"text", 'lesson_payment'::"text", 'withdrawal'::"text", 'refund'::"text"])))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "display_name" "text",
    "timezone" "text" DEFAULT 'UTC'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['student'::"text", 'teacher'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wallets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "balance" numeric(10,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."wallets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stripe_event_id" "text" NOT NULL,
    "type" "text" NOT NULL,
    "processed_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb"
);


ALTER TABLE "public"."webhook_events" OWNER TO "postgres";


ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monthly_earnings"
    ADD CONSTRAINT "monthly_earnings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monthly_earnings"
    ADD CONSTRAINT "monthly_earnings_teacher_id_year_month_key" UNIQUE ("teacher_id", "year", "month");



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_stripe_payment_intent_id_key" UNIQUE ("stripe_payment_intent_id");



ALTER TABLE ONLY "public"."teacher_profiles"
    ADD CONSTRAINT "teacher_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teacher_profiles"
    ADD CONSTRAINT "teacher_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_stripe_event_id_key" UNIQUE ("stripe_event_id");



CREATE INDEX "idx_lessons_auto_release" ON "public"."lessons" USING "btree" ("auto_release_at") WHERE ("status" = 'pending_confirmation'::"text");



CREATE INDEX "idx_lessons_package_id" ON "public"."lessons" USING "btree" ("package_id");



CREATE INDEX "idx_lessons_scheduled_at" ON "public"."lessons" USING "btree" ("scheduled_at");



CREATE INDEX "idx_lessons_status" ON "public"."lessons" USING "btree" ("status");



CREATE INDEX "idx_lessons_student_id" ON "public"."lessons" USING "btree" ("student_id");



CREATE INDEX "idx_lessons_teacher_id" ON "public"."lessons" USING "btree" ("teacher_id");



CREATE INDEX "idx_monthly_earnings_date" ON "public"."monthly_earnings" USING "btree" ("year" DESC, "month" DESC);



CREATE INDEX "idx_monthly_earnings_teacher_id" ON "public"."monthly_earnings" USING "btree" ("teacher_id");



CREATE INDEX "idx_packages_status" ON "public"."packages" USING "btree" ("status");



CREATE INDEX "idx_packages_stripe_payment_intent_id" ON "public"."packages" USING "btree" ("stripe_payment_intent_id");



CREATE INDEX "idx_packages_student_id" ON "public"."packages" USING "btree" ("student_id");



CREATE INDEX "idx_packages_teacher_id" ON "public"."packages" USING "btree" ("teacher_id");



CREATE INDEX "idx_transactions_stripe_payment_intent_id" ON "public"."transactions" USING "btree" ("stripe_payment_intent_id");



CREATE INDEX "idx_transactions_user_id" ON "public"."transactions" USING "btree" ("user_id");



CREATE INDEX "idx_webhook_events_stripe_event_id" ON "public"."webhook_events" USING "btree" ("stripe_event_id");



CREATE OR REPLACE TRIGGER "trigger_update_monthly_earnings" AFTER INSERT ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_monthly_earnings"();



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lessons"
    ADD CONSTRAINT "lessons_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."monthly_earnings"
    ADD CONSTRAINT "monthly_earnings_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teacher_profiles"
    ADD CONSTRAINT "teacher_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wallets"
    ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated users can view user profiles" ON "public"."users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Public can view teacher profiles" ON "public"."teacher_profiles" FOR SELECT USING (true);



CREATE POLICY "Service role can manage webhook_events" ON "public"."webhook_events" USING (true) WITH CHECK (true);



CREATE POLICY "Students can book lessons" ON "public"."lessons" FOR INSERT WITH CHECK (("auth"."uid"() = "student_id"));



CREATE POLICY "Students can insert own packages" ON "public"."packages" FOR INSERT WITH CHECK (("auth"."uid"() = "student_id"));



CREATE POLICY "Students can update own lessons" ON "public"."lessons" FOR UPDATE USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Students can update own transactions" ON "public"."transactions" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Students can view own lessons" ON "public"."lessons" FOR SELECT USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Students can view own packages" ON "public"."packages" FOR SELECT USING (("auth"."uid"() = "student_id"));



CREATE POLICY "System can insert packages" ON "public"."packages" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can insert transactions" ON "public"."transactions" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can insert users" ON "public"."users" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can update packages" ON "public"."packages" FOR UPDATE USING (true);



CREATE POLICY "System can update transactions" ON "public"."transactions" FOR UPDATE USING (true);



CREATE POLICY "Teachers can insert own profile" ON "public"."teacher_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Teachers can select profiles" ON "public"."teacher_profiles" FOR SELECT USING (true);



CREATE POLICY "Teachers can update own profile" ON "public"."teacher_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Teachers can update their lessons" ON "public"."lessons" FOR UPDATE USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can view own monthly earnings" ON "public"."monthly_earnings" FOR SELECT USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can view their lessons" ON "public"."lessons" FOR SELECT USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can view their packages" ON "public"."packages" FOR SELECT USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Users can insert own record" ON "public"."users" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own profile" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own record" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own wallet" ON "public"."wallets" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own transactions" ON "public"."transactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own wallet" ON "public"."wallets" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."lessons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."monthly_earnings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teacher_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wallets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_events" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."book_lesson_atomic"("p_package_id" "uuid", "p_teacher_id" "uuid", "p_student_id" "uuid", "p_scheduled_at" timestamp with time zone, "p_meeting_link" "text", "p_price_per_class" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."book_lesson_atomic"("p_package_id" "uuid", "p_teacher_id" "uuid", "p_student_id" "uuid", "p_scheduled_at" timestamp with time zone, "p_meeting_link" "text", "p_price_per_class" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."book_lesson_atomic"("p_package_id" "uuid", "p_teacher_id" "uuid", "p_student_id" "uuid", "p_scheduled_at" timestamp with time zone, "p_meeting_link" "text", "p_price_per_class" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_lesson_atomic"("p_lesson_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_lesson_atomic"("p_lesson_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_lesson_atomic"("p_lesson_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_lesson_atomic"("p_lesson_id" "uuid", "p_teacher_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_lesson_atomic"("p_lesson_id" "uuid", "p_teacher_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_lesson_atomic"("p_lesson_id" "uuid", "p_teacher_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."dispute_lesson"("p_lesson_id" "uuid", "p_student_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."dispute_lesson"("p_lesson_id" "uuid", "p_student_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dispute_lesson"("p_lesson_id" "uuid", "p_student_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."release_lesson_funds"("p_lesson_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."release_lesson_funds"("p_lesson_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."release_lesson_funds"("p_lesson_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_monthly_earnings"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_monthly_earnings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_monthly_earnings"() TO "service_role";


















GRANT ALL ON TABLE "public"."lessons" TO "anon";
GRANT ALL ON TABLE "public"."lessons" TO "authenticated";
GRANT ALL ON TABLE "public"."lessons" TO "service_role";



GRANT ALL ON TABLE "public"."monthly_earnings" TO "anon";
GRANT ALL ON TABLE "public"."monthly_earnings" TO "authenticated";
GRANT ALL ON TABLE "public"."monthly_earnings" TO "service_role";



GRANT ALL ON TABLE "public"."packages" TO "anon";
GRANT ALL ON TABLE "public"."packages" TO "authenticated";
GRANT ALL ON TABLE "public"."packages" TO "service_role";



GRANT ALL ON TABLE "public"."teacher_profiles" TO "anon";
GRANT ALL ON TABLE "public"."teacher_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."teacher_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."wallets" TO "anon";
GRANT ALL ON TABLE "public"."wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."wallets" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_events" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


