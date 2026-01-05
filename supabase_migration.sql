-- Propwise Database Schema Migration
-- Run this in your Supabase SQL Editor

-- Create profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  phone TEXT UNIQUE,
  phone_verified BOOLEAN DEFAULT false,
  search_count INTEGER DEFAULT 0,
  credit_topups INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add credit_topups column if it doesn't exist (for existing tables)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credit_topups INTEGER DEFAULT 0;

-- Add plan_type column to profiles for tracking membership tier
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'FREE_TRIAL';

-- Add signup_fingerprint column for abuse detection (tracks which device created the account)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS signup_fingerprint TEXT;

-- Add PRO plan tracking columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_used INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_month TEXT;

-- Add phone recovery columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verification_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_code_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_pending TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_recovery_prompted BOOLEAN DEFAULT false;

-- Add recovery code columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recovery_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recovery_code_expires_at TIMESTAMPTZ;

-- Add enterprise waitlist columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS enterprise_waitlist BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS enterprise_waitlist_date TIMESTAMPTZ;

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan_type TEXT NOT NULL DEFAULT 'FREE',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create search_history table
CREATE TABLE IF NOT EXISTS search_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_phone_verified ON profiles(phone_verified);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Service role has full access (for server-side operations)
DROP POLICY IF EXISTS "Service role full access profiles" ON profiles;
CREATE POLICY "Service role full access profiles" ON profiles FOR ALL USING (true);

-- RLS Policies for subscriptions
DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access subscriptions" ON subscriptions;
CREATE POLICY "Service role full access subscriptions" ON subscriptions FOR ALL USING (true);

-- RLS Policies for search_history
DROP POLICY IF EXISTS "Users can view own search history" ON search_history;
CREATE POLICY "Users can view own search history" ON search_history
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own search history" ON search_history;
CREATE POLICY "Users can insert own search history" ON search_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access search_history" ON search_history;
CREATE POLICY "Service role full access search_history" ON search_history FOR ALL USING (true);

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, phone_verified)
  VALUES (
    NEW.id, 
    NEW.email, 
    NEW.raw_user_meta_data->>'full_name',
    NEW.phone, 
    CASE WHEN NEW.phone IS NOT NULL THEN true ELSE false END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, profiles.email),
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, profiles.phone);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- DEVICE FINGERPRINTS TABLE (for abuse prevention)
-- ============================================
CREATE TABLE IF NOT EXISTS device_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT UNIQUE NOT NULL,
  searches_used INTEGER DEFAULT 0,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast fingerprint lookups
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_fingerprint ON device_fingerprints(fingerprint);

-- RLS policies for device_fingerprints (allow anonymous access for tracking)
ALTER TABLE device_fingerprints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous fingerprint read" ON device_fingerprints;
CREATE POLICY "Allow anonymous fingerprint read" ON device_fingerprints
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anonymous fingerprint insert" ON device_fingerprints;
CREATE POLICY "Allow anonymous fingerprint insert" ON device_fingerprints
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous fingerprint update" ON device_fingerprints;
CREATE POLICY "Allow anonymous fingerprint update" ON device_fingerprints
  FOR UPDATE USING (true);

-- ============================================
-- PROPERTY CACHE TABLE (for consistent results)
-- ============================================
-- Caches Gemini API responses by address for 2 weeks
CREATE TABLE IF NOT EXISTS property_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address_key TEXT UNIQUE NOT NULL,  -- normalized lowercase address
  data JSONB NOT NULL,               -- full API response
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_property_cache_address ON property_cache(address_key);
CREATE INDEX IF NOT EXISTS idx_property_cache_created ON property_cache(created_at);

-- RLS policies (service role access for server-side caching)
ALTER TABLE property_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access property_cache" ON property_cache;
CREATE POLICY "Service role full access property_cache" ON property_cache FOR ALL USING (true);

-- Optional: Auto-cleanup old cache entries (run periodically via cron)
-- DELETE FROM property_cache WHERE created_at < NOW() - INTERVAL '14 days';

