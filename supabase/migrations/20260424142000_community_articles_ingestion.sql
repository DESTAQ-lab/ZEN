-- Community feed model for importacao/e-commerce/marketplace news

CREATE TABLE IF NOT EXISTS public.community_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('rss', 'newsapi', 'official')),
  title text NOT NULL,
  summary text,
  url text NOT NULL,
  image_url text,
  category text NOT NULL DEFAULT 'marketplace',
  tags text[] NOT NULL DEFAULT '{}'::text[],
  published_at timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  relevance_score numeric(10,4) NOT NULL DEFAULT 0,
  is_featured boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  url_hash text GENERATED ALWAYS AS (md5(lower(coalesce(url, '')))) STORED
);

CREATE UNIQUE INDEX IF NOT EXISTS community_articles_url_hash_key
  ON public.community_articles (url_hash);

CREATE INDEX IF NOT EXISTS idx_community_articles_published_at_desc
  ON public.community_articles (published_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_articles_category
  ON public.community_articles (category);

CREATE INDEX IF NOT EXISTS idx_community_articles_source
  ON public.community_articles (source);

CREATE INDEX IF NOT EXISTS idx_community_articles_is_active
  ON public.community_articles (is_active);

CREATE INDEX IF NOT EXISTS idx_community_articles_relevance
  ON public.community_articles (relevance_score DESC, published_at DESC);

CREATE OR REPLACE FUNCTION public.community_articles_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_community_articles_touch_updated_at ON public.community_articles;
CREATE TRIGGER trg_community_articles_touch_updated_at
  BEFORE UPDATE ON public.community_articles
  FOR EACH ROW
  EXECUTE PROCEDURE public.community_articles_touch_updated_at();

CREATE TABLE IF NOT EXISTS public.community_ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL CHECK (status IN ('running', 'success', 'partial', 'failed')),
  items_read integer NOT NULL DEFAULT 0,
  items_inserted integer NOT NULL DEFAULT 0,
  items_updated integer NOT NULL DEFAULT 0,
  source_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_ingestion_runs_started_at_desc
  ON public.community_ingestion_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_ingestion_runs_status
  ON public.community_ingestion_runs (status);

ALTER TABLE public.community_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_ingestion_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_articles_select_public_active" ON public.community_articles;
CREATE POLICY "community_articles_select_public_active"
  ON public.community_articles
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "community_articles_service_role_write" ON public.community_articles;
CREATE POLICY "community_articles_service_role_write"
  ON public.community_articles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "community_ingestion_runs_service_role_all" ON public.community_ingestion_runs;
CREATE POLICY "community_ingestion_runs_service_role_all"
  ON public.community_ingestion_runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.community_articles TO anon, authenticated;
GRANT SELECT ON public.community_ingestion_runs TO authenticated;
GRANT ALL ON public.community_articles TO service_role;
GRANT ALL ON public.community_ingestion_runs TO service_role;
