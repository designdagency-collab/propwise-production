-- Create table for tracking seller interest leads
CREATE TABLE IF NOT EXISTS seller_interest (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_address TEXT NOT NULL,
  target_price BIGINT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_seller_interest_user_id ON seller_interest(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_interest_created_at ON seller_interest(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seller_interest_property_address ON seller_interest(property_address);

-- Enable RLS
ALTER TABLE seller_interest ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own interest
CREATE POLICY "Users can insert their own interest" ON seller_interest
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can read their own submissions
CREATE POLICY "Users can read their own" ON seller_interest
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Admins can read all seller interest submissions
CREATE POLICY "Admins can read all" ON seller_interest
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );
