# Supabase Setup Guide for TeachDirect

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in to your account
3. Click "New Project"
4. Fill in:
   - **Project name**: `teachdirect` (or your choice)
   - **Database password**: Create a strong password (save this!)
   - **Region**: Choose closest to your users
5. Click "Create new project"
6. Wait for the project to be initialized (5-10 minutes)

## Step 2: Get Your API Keys

1. Once your project is created, go to **Settings** → **API**
2. You'll see two keys:
   - **Project URL** (copy this)
   - **Anon Key** (copy this - labeled as "anon public")
3. These are your credentials

## Step 3: Configure Environment Variables

1. Open `.env.local` in the project root
2. Paste your credentials:
   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
3. Save the file

## Step 4: Create Database Tables

Run the following SQL in Supabase SQL Editor (Settings → SQL Editor):

```sql
-- Create users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher')),
  display_name TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create teacher_profiles table
CREATE TABLE public.teacher_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  bio TEXT,
  subjects TEXT[] DEFAULT '{}',
  languages TEXT[] DEFAULT '{}',
  hourly_rate DECIMAL(10, 2),
  stripe_connect_id TEXT,
  stripe_connect_status TEXT DEFAULT 'pending',
  available_balance DECIMAL(10, 2) DEFAULT 0,
  pending_balance DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create wallets table
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  balance DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users table
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Create RLS policies for teacher_profiles table
CREATE POLICY "Public can view teacher profiles"
  ON public.teacher_profiles FOR SELECT
  USING (true);

CREATE POLICY "Teachers can update own profile"
  ON public.teacher_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Create RLS policies for wallets table
CREATE POLICY "Users can view own wallet"
  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet"
  ON public.wallets FOR UPDATE
  USING (auth.uid() = user_id);
```

## Step 5: Create Auth Trigger

In the SQL Editor, run this to automatically create a user record when someone signs up:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::text, 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## Step 6: Test the Setup

1. Go back to your app (http://localhost:5174)
2. Click "Sign Up"
3. Fill in:
   - Email: test@example.com
   - Password: testpassword123
   - Role: Student
4. Click "Create Account"
5. You should be redirected to the dashboard
6. Click "Dashboard" in the header to verify authentication works
7. Click "Log Out" to test logout
8. Try visiting /dashboard without logging in - you should be redirected to login

## Troubleshooting

**"Supabase environment variables are not set"**
- Make sure you filled in `.env.local` with your keys
- Restart the dev server after updating `.env.local`

**"Error: CORS error" or "401 Unauthorized"**
- Double-check your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- Make sure you're using the Anon Key, not the Service Role Key

**Database tables not showing**
- Check that RLS policies are enabled
- Make sure you ran all the SQL statements

## Next Steps

Once authentication is working, proceed to:
- Checkpoint 3: Teacher Profiles & Browse
- Checkpoint 4: Stripe Connect Setup
- And beyond!
