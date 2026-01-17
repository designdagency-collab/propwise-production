-- Create table for tracking high-rated suburb discoveries
CREATE TABLE IF NOT EXISTS high_rated_suburbs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  suburb_name TEXT NOT NULL,
  state TEXT,
  average_stars DECIMAL(3,1) NOT NULL,
  property_count INTEGER,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_high_rated_suburbs_user_id ON high_rated_suburbs(user_id);
CREATE INDEX IF NOT EXISTS idx_high_rated_suburbs_discovered_at ON high_rated_suburbs(discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_high_rated_suburbs_average_stars ON high_rated_suburbs(average_stars DESC);
CREATE INDEX IF NOT EXISTS idx_high_rated_suburbs_suburb_name ON high_rated_suburbs(suburb_name);

-- Enable RLS (only admins and the user who discovered it can read)
ALTER TABLE high_rated_suburbs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own discoveries
CREATE POLICY "Users can insert their own discoveries" ON high_rated_suburbs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can read all discoveries
CREATE POLICY "Admins can read all" ON high_rated_suburbs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Policy: Users can read their own discoveries
CREATE POLICY "Users can read their own" ON high_rated_suburbs
  FOR SELECT
  USING (auth.uid() = user_id);
