-- =============================================================================
-- Casa Torino — Back-office financiero
-- Migración: tabla gastos + enums + RLS (trazabilidad contable)
-- Ejecutar en: Supabase SQL Editor o via CLI (`supabase db push`)
-- =============================================================================

-- Extensión para UUIDs (habitualmente ya activa en Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

CREATE TYPE public.categoria_gasto AS ENUM (
  'Ingredientes',
  'Personal',
  'Servicios',
  'Alquiler',
  'Mantenimiento',
  'Marketing',
  'Impuestos',
  'Transporte',
  'Otros'
);

CREATE TYPE public.origen_fondos AS ENUM (
  'Efectivo_Caja',
  'Banco'
);

-- -----------------------------------------------------------------------------
-- Tabla: gastos
-- user_id captura la sesión activa (auth.users) para auditoría contable.
-- -----------------------------------------------------------------------------

CREATE TABLE public.gastos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  importe       NUMERIC(12, 2) NOT NULL CHECK (importe > 0),
  concepto      TEXT NOT NULL CHECK (char_length(trim(concepto)) > 0),
  categoria     public.categoria_gasto NOT NULL,
  origen_fondos public.origen_fondos NOT NULL,
  user_id       UUID NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de consulta operativa (caja diaria / por usuaria)
CREATE INDEX idx_gastos_created_at ON public.gastos (created_at DESC);
CREATE INDEX idx_gastos_user_id ON public.gastos (user_id);
CREATE INDEX idx_gastos_origen_fondos ON public.gastos (origen_fondos);
CREATE INDEX idx_gastos_categoria ON public.gastos (categoria);

COMMENT ON TABLE public.gastos IS
  'Registro de gastos del restaurante. Toda fila debe vincularse a auth.users vía user_id.';

COMMENT ON COLUMN public.gastos.user_id IS
  'Usuaria de sesión (Claribel, Lorena, Yuli o Dayana) — trazabilidad de auditoría.';

COMMENT ON COLUMN public.gastos.origen_fondos IS
  'Efectivo_Caja vs Banco: crítico para no descuadrar la caja física.';

-- -----------------------------------------------------------------------------
-- Trigger: fuerza user_id = auth.uid() en INSERT y bloquea cambios en UPDATE
-- Garantiza trazabilidad aunque el cliente envíe otro UUID.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_gasto_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'No autenticada: no se puede registrar un gasto sin sesión.';
    END IF;
    NEW.user_id := auth.uid();
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Inmutabilidad de auditoría: no se puede reasignar ni alterar created_at
    NEW.user_id := OLD.user_id;
    NEW.created_at := OLD.created_at;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gastos_set_user_id
  BEFORE INSERT OR UPDATE ON public.gastos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_gasto_user_id();

-- -----------------------------------------------------------------------------
-- Row Level Security (RLS)
-- Solo usuarias autenticadas pueden leer/escribir. Sin acceso anónimo.
-- -----------------------------------------------------------------------------

ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;

-- Deny-by-default: sin políticas para anon / public role

CREATE POLICY "gastos_select_authenticated"
  ON public.gastos
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "gastos_insert_authenticated"
  ON public.gastos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
  );

-- user_id / created_at son inmutables vía trigger trg_gastos_set_user_id
CREATE POLICY "gastos_update_authenticated"
  ON public.gastos
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "gastos_delete_authenticated"
  ON public.gastos
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- -----------------------------------------------------------------------------
-- Grants mínimos (Supabase ya otorga a authenticated vía API; reforzamos)
-- -----------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gastos TO authenticated;
GRANT USAGE ON TYPE public.categoria_gasto TO authenticated;
GRANT USAGE ON TYPE public.origen_fondos TO authenticated;

-- Revocar acceso explícito al rol anónimo (defensa en profundidad)
REVOKE ALL ON public.gastos FROM anon;
