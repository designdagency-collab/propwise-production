-- ============================================================================
-- Lead Reveals — Subscriber-side (Developers + Buyers Agents) tier
-- ============================================================================
-- Apply via: Supabase Dashboard → SQL Editor → paste this file → Run
-- Idempotent: safe to re-run.
-- ============================================================================

-- 1. Add role column to profiles -----------------------------------------------
-- Roles: 'homeowner' (default) | 'subscriber' (paid Developer/Buyers Agent) | 'admin'
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'homeowner';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_role_check'
      AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('homeowner', 'subscriber', 'admin'));
  END IF;
END $$;


-- 2. Configurable lead reveal price -------------------------------------------
-- Stored in cents. Editable from admin dashboard. Default: 4900 = $49.00.
ALTER TABLE public.billing_calibration
  ADD COLUMN IF NOT EXISTS lead_reveal_price_cents integer NOT NULL DEFAULT 4900;

-- Ensure the singleton 'main' row exists so admin reads/updates always succeed
INSERT INTO public.billing_calibration (id, lead_reveal_price_cents)
  VALUES ('main', 4900)
  ON CONFLICT (id) DO NOTHING;


-- 3. lead_reveals table -------------------------------------------------------
-- One row per (subscriber, lead). is_free distinguishes free quota from paid.
CREATE TABLE IF NOT EXISTS public.lead_reveals (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  subscriber_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.seller_interest(id) ON DELETE CASCADE,
  is_free boolean NOT NULL DEFAULT false,
  amount_cents integer NOT NULL DEFAULT 0,
  stripe_session_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscriber_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_reveals_subscriber ON public.lead_reveals(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_lead_reveals_lead ON public.lead_reveals(lead_id);


-- 4. RLS — subscribers can read their own reveal records ----------------------
ALTER TABLE public.lead_reveals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Subscribers read own reveals" ON public.lead_reveals;
CREATE POLICY "Subscribers read own reveals"
  ON public.lead_reveals
  FOR SELECT
  TO authenticated
  USING (subscriber_id = auth.uid());

-- (Inserts/updates go through the API using the service role key, which bypasses RLS.)


-- 5. Seed: grant the founding admin account subscriber privileges too ---------
-- (Admins can already see everything; this just lets you exercise the dashboard
--  with role = 'subscriber' rather than relying on is_admin overrides.)
UPDATE public.profiles
  SET role = 'subscriber'
  WHERE email = 'designd.agency@gmail.com'
    AND role = 'homeowner';
