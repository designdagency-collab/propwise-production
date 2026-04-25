-- ============================================================================
-- Pre-fetch Street View image at lead creation time
-- ============================================================================
-- Apply via: Supabase Dashboard → SQL Editor → paste this file → Run
-- Idempotent: safe to re-run.
-- ============================================================================

-- Stores a base64-encoded JPEG of the property's Street View, fetched once
-- when the lead is created so dashboard loads don't re-hit Google.
ALTER TABLE public.seller_interest
  ADD COLUMN IF NOT EXISTS street_view_image text;

-- Tracks whether we've attempted the fetch and what happened, so we can:
--  - Skip retrying for addresses Google has no imagery for ('unavailable')
--  - Lazy-backfill legacy rows that pre-date this column ('pending')
ALTER TABLE public.seller_interest
  ADD COLUMN IF NOT EXISTS street_view_status text NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'seller_interest_street_view_status_check'
      AND table_name = 'seller_interest'
  ) THEN
    ALTER TABLE public.seller_interest
      ADD CONSTRAINT seller_interest_street_view_status_check
      CHECK (street_view_status IN ('pending', 'available', 'unavailable'));
  END IF;
END $$;
