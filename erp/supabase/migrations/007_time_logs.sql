-- =============================================================================
-- Casa Torino — Registro horario (fichaje camareras)
-- Cumple RD-ley 8/2019 art. 34.9 ET: entrada/salida con marca de tiempo,
-- conservación ≥ 4 años, accesible para personal e Inspección.
--
-- Ejecutar UNA VEZ en: Supabase → SQL Editor → New query → Run
-- Project: fpnjtgoxljqmwuukyrrm (mismo que ops_kv)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.time_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_name TEXT NOT NULL,
  event_type    TEXT NOT NULL CHECK (event_type IN ('entrada', 'salida')),
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  timezone      TEXT NOT NULL DEFAULT 'Europe/Madrid',
  source        TEXT NOT NULL DEFAULT 'tpv',
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_logs_employee_logged
  ON public.time_logs (employee_name, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_time_logs_logged_at
  ON public.time_logs (logged_at DESC);

COMMENT ON TABLE public.time_logs IS
  'Registro diario de jornada (entrada/salida). Conservar 4 años. Casa Torino.';

ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS time_logs_all ON public.time_logs;
CREATE POLICY time_logs_all ON public.time_logs
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Inmutabilidad práctica: el TPV solo INSERTA (no UPDATE/DELETE desde la app).
GRANT SELECT, INSERT ON public.time_logs TO anon, authenticated;
REVOKE UPDATE, DELETE ON public.time_logs FROM anon;
-- authenticated puede leer/insertar; borrados solo por service role / SQL si Inspección lo pide.
GRANT SELECT, INSERT ON public.time_logs TO authenticated;

-- Semilla opcional de nombres (solo referencia; el TPV usa lista fija)
-- Lorena, Claribel, Yuli, Dayana, Alison, Sharif
