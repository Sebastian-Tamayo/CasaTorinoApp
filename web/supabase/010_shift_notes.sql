-- =============================================================================
-- Casa Torino — Notas de turno (cambio de personal TPV)
-- Categorías: proveedor | general
-- Auth real: API TPV (cookie ct_tpv_session / X-Tpv-Key) + service_role.
-- RLS: sin acceso público anon; solo service_role (bypass) escribe desde el API.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.shift_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category     TEXT NOT NULL CHECK (category IN ('proveedor', 'general')),
  content      TEXT NOT NULL CHECK (char_length(trim(content)) > 0),
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shift_notes_active
  ON public.shift_notes (is_completed, category, created_at DESC)
  WHERE is_completed = false;

CREATE INDEX IF NOT EXISTS idx_shift_notes_created
  ON public.shift_notes (created_at DESC);

COMMENT ON TABLE public.shift_notes IS
  'Notas pendientes de turno TPV (proveedores / otras). Casa Torino.';

ALTER TABLE public.shift_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shift_notes_anon_all ON public.shift_notes;
DROP POLICY IF EXISTS shift_notes_auth_all ON public.shift_notes;

REVOKE ALL ON public.shift_notes FROM anon;
REVOKE ALL ON public.shift_notes FROM authenticated;
