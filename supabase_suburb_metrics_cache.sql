-- ============================================================================
-- suburb_metrics_cache — keep suburb-level numbers consistent across properties
-- ============================================================================
-- Apply via: Supabase Dashboard → SQL Editor → paste this file → Run
-- Idempotent: safe to re-run.
-- ============================================================================
--
-- Why: each Gemini call independently invents suburb-level numbers (growth,
-- median price, etc.), so two properties in the same suburb can show 4.8% vs
-- 7.5%. This cache locks suburb numbers in on the first generation; every
-- subsequent property in that suburb is told to use the cached values.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.suburb_metrics_cache (
  suburb_key          text PRIMARY KEY,              -- normalised "bondi-nsw"
  display_name        text,                          -- "Bondi, NSW"
  growth_text         text,                          -- "4.8% p.a." (display)
  growth_percent      numeric,                       -- 4.8 (numeric)
  median_house_price  bigint,
  median_unit_price   bigint,
  median_rent_weekly  integer,
  yield_percent       numeric,
  source              text,                          -- 'ABS' | 'gemini-seed'
  cached_at           timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Service role only; anon/authenticated cannot read or write directly.
ALTER TABLE public.suburb_metrics_cache ENABLE ROW LEVEL SECURITY;
