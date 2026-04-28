-- Cron orchestration for Community ingestion (every 30 minutes)

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE IF NOT EXISTS private.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON private.app_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON private.app_settings TO service_role;

CREATE OR REPLACE FUNCTION private.app_setting(setting_key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private
AS $$
  SELECT value
  FROM private.app_settings
  WHERE key = setting_key
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION private.app_setting(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.app_setting(text) TO service_role;

CREATE OR REPLACE FUNCTION public.community_trigger_ingest_http()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ingest_url text;
  ingest_secret text;
  req_id bigint;
BEGIN
  ingest_url := private.app_setting('community_ingest_url');
  ingest_secret := private.app_setting('community_ingest_secret');

  IF ingest_url IS NULL OR length(trim(ingest_url)) = 0 THEN
    RAISE EXCEPTION 'community_ingest_url is not configured in private.app_settings';
  END IF;

  SELECT net.http_post(
    url := ingest_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-community-cron-secret', coalesce(ingest_secret, '')
    ),
    body := jsonb_build_object('trigger', 'pg_cron')
  )
  INTO req_id;

  RETURN req_id;
END;
$$;

REVOKE ALL ON FUNCTION public.community_trigger_ingest_http() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_trigger_ingest_http() TO service_role;

DO $do$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'community_ingest_30m'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'community_ingest_30m',
    '*/30 * * * *',
    $cron$SELECT public.community_trigger_ingest_http();$cron$
  );
END;
$do$;
