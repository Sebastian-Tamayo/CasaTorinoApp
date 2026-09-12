-- =============================================================================
-- Casa Torino ERP — Fase 1: fiscalidad, proveedores, RRHH
-- Migración 004
-- Ejecutar en: Supabase SQL Editor (SOLO tras confirmación explícita)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Ampliar categoría de gastos: 'Nóminas y SS'
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'categoria_gasto'
      AND e.enumlabel = 'Nóminas y SS'
  ) THEN
    ALTER TYPE public.categoria_gasto ADD VALUE 'Nóminas y SS';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2) Tabla gastos: proveedor + IVA
-- -----------------------------------------------------------------------------

ALTER TABLE public.gastos
  ADD COLUMN IF NOT EXISTS proveedor_nombre TEXT,
  ADD COLUMN IF NOT EXISTS base_imponible NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS porcentaje_iva NUMERIC(5, 2) NOT NULL DEFAULT 0;

UPDATE public.gastos
SET base_imponible = importe
WHERE base_imponible IS NULL;

ALTER TABLE public.gastos
  ALTER COLUMN base_imponible SET NOT NULL;

ALTER TABLE public.gastos
  DROP CONSTRAINT IF EXISTS gastos_porcentaje_iva_check;

ALTER TABLE public.gastos
  ADD CONSTRAINT gastos_porcentaje_iva_check
  CHECK (porcentaje_iva >= 0 AND porcentaje_iva <= 100);

ALTER TABLE public.gastos
  DROP CONSTRAINT IF EXISTS gastos_base_imponible_check;

ALTER TABLE public.gastos
  ADD CONSTRAINT gastos_base_imponible_check
  CHECK (base_imponible >= 0);

CREATE INDEX IF NOT EXISTS idx_gastos_proveedor_nombre
  ON public.gastos (proveedor_nombre);

-- -----------------------------------------------------------------------------
-- 3) Tabla ingresos: base imponible + IVA (default 10%)
-- -----------------------------------------------------------------------------

ALTER TABLE public.ingresos
  ADD COLUMN IF NOT EXISTS porcentaje_iva NUMERIC(5, 2) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS base_imponible NUMERIC(12, 2);

UPDATE public.ingresos
SET base_imponible = ROUND(importe / (1 + (porcentaje_iva / 100.0)), 2)
WHERE base_imponible IS NULL;

ALTER TABLE public.ingresos
  ALTER COLUMN base_imponible SET NOT NULL;

ALTER TABLE public.ingresos
  DROP CONSTRAINT IF EXISTS ingresos_porcentaje_iva_check;

ALTER TABLE public.ingresos
  ADD CONSTRAINT ingresos_porcentaje_iva_check
  CHECK (porcentaje_iva >= 0 AND porcentaje_iva <= 100);

ALTER TABLE public.ingresos
  DROP CONSTRAINT IF EXISTS ingresos_base_imponible_check;

ALTER TABLE public.ingresos
  ADD CONSTRAINT ingresos_base_imponible_check
  CHECK (base_imponible >= 0);

-- -----------------------------------------------------------------------------
-- 4) Tabla empleados
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.empleados (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  nombre                   TEXT NOT NULL CHECK (char_length(trim(nombre)) > 0),
  puesto                   TEXT NOT NULL CHECK (char_length(trim(puesto)) > 0),
  salario_bruto            NUMERIC(12, 2) NOT NULL CHECK (salario_bruto >= 0),
  coste_seguridad_social   NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (coste_seguridad_social >= 0),
  porcentaje_retencion_irpf NUMERIC(5, 2) NOT NULL DEFAULT 0
    CHECK (porcentaje_retencion_irpf >= 0 AND porcentaje_retencion_irpf <= 100),
  activo                   BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_empleados_nombre ON public.empleados (nombre);

COMMENT ON TABLE public.empleados IS
  'Plantilla RRHH Casa Torino. Coste SS = aportación empresa.';

-- -----------------------------------------------------------------------------
-- 5) Tabla nominas_pagadas
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.nominas_pagadas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  empleado_id  UUID NOT NULL REFERENCES public.empleados (id) ON DELETE RESTRICT,
  mes_anio     DATE NOT NULL,
  importe_neto NUMERIC(12, 2) NOT NULL CHECK (importe_neto >= 0),
  importe_irpf NUMERIC(12, 2) NOT NULL CHECK (importe_irpf >= 0),
  UNIQUE (empleado_id, mes_anio)
);

CREATE INDEX IF NOT EXISTS idx_nominas_mes ON public.nominas_pagadas (mes_anio DESC);
CREATE INDEX IF NOT EXISTS idx_nominas_empleado ON public.nominas_pagadas (empleado_id);

COMMENT ON COLUMN public.nominas_pagadas.mes_anio IS
  'Primer día del mes liquidado (ej. 2026-09-01).';

-- -----------------------------------------------------------------------------
-- 6) RLS — empleados
-- -----------------------------------------------------------------------------

ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empleados_select_authenticated" ON public.empleados;
CREATE POLICY "empleados_select_authenticated"
  ON public.empleados FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "empleados_insert_authenticated" ON public.empleados;
CREATE POLICY "empleados_insert_authenticated"
  ON public.empleados FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "empleados_update_authenticated" ON public.empleados;
CREATE POLICY "empleados_update_authenticated"
  ON public.empleados FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "empleados_delete_authenticated" ON public.empleados;
CREATE POLICY "empleados_delete_authenticated"
  ON public.empleados FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empleados TO authenticated;
REVOKE ALL ON public.empleados FROM anon;

-- -----------------------------------------------------------------------------
-- 7) RLS — nominas_pagadas
-- -----------------------------------------------------------------------------

ALTER TABLE public.nominas_pagadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nominas_select_authenticated" ON public.nominas_pagadas;
CREATE POLICY "nominas_select_authenticated"
  ON public.nominas_pagadas FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "nominas_insert_authenticated" ON public.nominas_pagadas;
CREATE POLICY "nominas_insert_authenticated"
  ON public.nominas_pagadas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "nominas_update_authenticated" ON public.nominas_pagadas;
CREATE POLICY "nominas_update_authenticated"
  ON public.nominas_pagadas FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "nominas_delete_authenticated" ON public.nominas_pagadas;
CREATE POLICY "nominas_delete_authenticated"
  ON public.nominas_pagadas FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nominas_pagadas TO authenticated;
REVOKE ALL ON public.nominas_pagadas FROM anon;
