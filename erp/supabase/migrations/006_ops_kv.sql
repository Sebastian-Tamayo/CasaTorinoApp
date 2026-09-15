-- Casa Torino — almacén operativo TPV / Cocina / Jornada (gratis en Supabase)
-- Ejecutar UNA VEZ en: Supabase → SQL Editor → New query → Run

CREATE TABLE IF NOT EXISTS public.ops_kv (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ops_kv_updated_at_idx ON public.ops_kv (updated_at DESC);

ALTER TABLE public.ops_kv ENABLE ROW LEVEL SECURITY;

-- Acceso solo desde el backend del TPV (usa la anon/publishable key en servidor).
DROP POLICY IF EXISTS ops_kv_select ON public.ops_kv;
DROP POLICY IF EXISTS ops_kv_insert ON public.ops_kv;
DROP POLICY IF EXISTS ops_kv_update ON public.ops_kv;
DROP POLICY IF EXISTS ops_kv_delete ON public.ops_kv;
DROP POLICY IF EXISTS ops_kv_all ON public.ops_kv;

CREATE POLICY ops_kv_all ON public.ops_kv
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ops_kv TO anon, authenticated;

COMMENT ON TABLE public.ops_kv IS 'Estado operativo Casa Torino (kitchen, tpv, jornada, cierres). Sustituye Vercel Blob/Edge Config.';
