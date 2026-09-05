-- =============================================================================
-- Casa Torino — Control de Cajas (Ingresos + Gastos)
-- Migración 002: tabla ingresos + ajuste categorías de gastos
-- Ejecutar en: Supabase SQL Editor (tras confirmación)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Tabla ingresos
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ingresos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  importe     NUMERIC(12, 2) NOT NULL CHECK (importe > 0),
  categoria   TEXT NOT NULL CHECK (categoria IN ('venta_local', 'domicilios')),
  metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('tarjeta', 'efectivo')),
  user_id     UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_ingresos_created_at ON public.ingresos (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingresos_user_id ON public.ingresos (user_id);
CREATE INDEX IF NOT EXISTS idx_ingresos_metodo_pago ON public.ingresos (metodo_pago);
CREATE INDEX IF NOT EXISTS idx_ingresos_categoria ON public.ingresos (categoria);

COMMENT ON TABLE public.ingresos IS
  'Entradas de caja (ventas local / domicilios). Trazabilidad vía user_id.';

-- Trigger: fuerza user_id = auth.uid() en INSERT (auditoría)
CREATE OR REPLACE FUNCTION public.set_ingreso_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'No autenticada: no se puede registrar un ingreso sin sesión.';
    END IF;
    NEW.user_id := auth.uid();
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.user_id := OLD.user_id;
    NEW.created_at := OLD.created_at;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ingresos_set_user_id ON public.ingresos;
CREATE TRIGGER trg_ingresos_set_user_id
  BEFORE INSERT OR UPDATE ON public.ingresos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_ingreso_user_id();

-- RLS: solo SELECT e INSERT para authenticated
ALTER TABLE public.ingresos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ingresos_select_authenticated" ON public.ingresos;
CREATE POLICY "ingresos_select_authenticated"
  ON public.ingresos
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "ingresos_insert_authenticated" ON public.ingresos;
CREATE POLICY "ingresos_insert_authenticated"
  ON public.ingresos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
  );

GRANT SELECT, INSERT ON public.ingresos TO authenticated;
REVOKE ALL ON public.ingresos FROM anon;

-- -----------------------------------------------------------------------------
-- 2) Categorías de gastos: quitar 'Ingredientes', asegurar 'Proveedores'
--    (PostgreSQL no permite DROP VALUE de un ENUM; recreamos el tipo)
-- -----------------------------------------------------------------------------

CREATE TYPE public.categoria_gasto_new AS ENUM (
  'Proveedores',
  'Personal',
  'Servicios',
  'Alquiler',
  'Mantenimiento',
  'Marketing',
  'Impuestos',
  'Transporte',
  'Otros'
);

ALTER TABLE public.gastos
  ALTER COLUMN categoria TYPE public.categoria_gasto_new
  USING (
    CASE categoria::text
      WHEN 'Ingredientes' THEN 'Proveedores'
      WHEN 'Proveedores' THEN 'Proveedores'
      ELSE categoria::text
    END
  )::public.categoria_gasto_new;

DROP TYPE public.categoria_gasto;
ALTER TYPE public.categoria_gasto_new RENAME TO categoria_gasto;

GRANT USAGE ON TYPE public.categoria_gasto TO authenticated;
