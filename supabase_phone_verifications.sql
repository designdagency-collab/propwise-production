-- ============================================================================
-- phone_verifications — anonymous OTP verification for seller/buyer interest
-- ============================================================================
-- Apply via: Supabase Dashboard → SQL Editor → paste this file → Run
-- Idempotent: safe to re-run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.phone_verifications (
  phone           text PRIMARY KEY,
  code            text NOT NULL,
  expires_at      timestamptz NOT NULL,
  verified_at     timestamptz,
  attempts        int NOT NULL DEFAULT 0,
  last_sent_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- For verified-recently lookups when seller-interest submits
CREATE INDEX IF NOT EXISTS idx_phone_verifications_verified_at
  ON public.phone_verifications(verified_at)
  WHERE verified_at IS NOT NULL;

-- RLS: locked down — only the service role (used by API endpoints) can touch this.
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;
-- (No policies defined → no anon/authenticated access. Service role bypasses RLS.)
