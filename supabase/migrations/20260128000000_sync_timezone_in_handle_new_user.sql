-- Update handle_new_user() to sync timezone from auth metadata
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = public
    AS $$
BEGIN
  -- Log the signup attempt (user ID only, no PII)
  RAISE LOG 'handle_new_user triggered for user: %', NEW.id;

  -- Insert user metadata into public.users (now including timezone)
  INSERT INTO public.users (id, email, role, display_name, timezone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'timezone', 'UTC')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    display_name = EXCLUDED.display_name,
    timezone = EXCLUDED.timezone;

  -- If user is a teacher, also create teacher_profiles row
  IF (NEW.raw_user_meta_data->>'role') = 'teacher' THEN
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
