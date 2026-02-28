-- ============================================================
-- RoboLedger: User Profiles + Role-Based Permissions
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Profiles table (one row per Supabase user)
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID        REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email        TEXT        NOT NULL,
  role         TEXT        NOT NULL DEFAULT 'normal_user'
                           CHECK (role IN ('admin', 'power_user', 'normal_user')),
  full_name    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Row Level Security — users see only their own row; admins see all
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- 3. Auto-create a profile row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'normal_user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Backfill existing users (swift@roboledgers.com becomes admin)
INSERT INTO public.profiles (id, email, role)
SELECT
  id,
  email,
  CASE WHEN email = 'swift@roboledgers.com' THEN 'admin' ELSE 'normal_user' END
FROM auth.users
ON CONFLICT (id) DO UPDATE
  SET role  = EXCLUDED.role,
      email = EXCLUDED.email;
