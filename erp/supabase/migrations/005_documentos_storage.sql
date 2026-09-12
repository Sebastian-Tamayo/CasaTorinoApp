-- =============================================================================
-- Casa Torino — Gestor documental (Gestoría)
-- Migración 005: tabla documentos + bucket Storage
-- Ejecutar en: Supabase SQL Editor (tras confirmación)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Tabla documentos
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.documentos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  nombre            TEXT NOT NULL CHECK (char_length(trim(nombre)) > 0),
  url_archivo       TEXT NOT NULL,
  storage_path      TEXT NOT NULL,
  categoria         TEXT NOT NULL CHECK (
    categoria IN (
      'factura_proveedor',
      'albaran',
      'contrato_empleado',
      'impuesto',
      'otro'
    )
  ),
  gasto_id          UUID REFERENCES public.gastos (id) ON DELETE SET NULL,
  proveedor_nombre  TEXT,
  user_id           UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_documentos_created_at ON public.documentos (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documentos_categoria ON public.documentos (categoria);
CREATE INDEX IF NOT EXISTS idx_documentos_proveedor ON public.documentos (proveedor_nombre);
CREATE INDEX IF NOT EXISTS idx_documentos_gasto_id ON public.documentos (gasto_id);
CREATE INDEX IF NOT EXISTS idx_documentos_user_id ON public.documentos (user_id);

COMMENT ON TABLE public.documentos IS
  'Archivo digital de facturas, albaranes, contratos e impuestos.';

COMMENT ON COLUMN public.documentos.storage_path IS
  'Ruta relativa dentro del bucket documentos_adjuntos (para borrar el objeto).';

COMMENT ON COLUMN public.documentos.url_archivo IS
  'Path o URL pública/firmada de referencia; la preview usa signed URL desde storage_path.';

-- Trigger auditoría user_id
CREATE OR REPLACE FUNCTION public.set_documento_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'No autenticada: no se puede archivar un documento sin sesión.';
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

DROP TRIGGER IF EXISTS trg_documentos_set_user_id ON public.documentos;
CREATE TRIGGER trg_documentos_set_user_id
  BEFORE INSERT OR UPDATE ON public.documentos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_documento_user_id();

-- -----------------------------------------------------------------------------
-- 2) RLS documentos
-- -----------------------------------------------------------------------------

ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documentos_select_authenticated" ON public.documentos;
CREATE POLICY "documentos_select_authenticated"
  ON public.documentos FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "documentos_insert_authenticated" ON public.documentos;
CREATE POLICY "documentos_insert_authenticated"
  ON public.documentos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "documentos_delete_authenticated" ON public.documentos;
CREATE POLICY "documentos_delete_authenticated"
  ON public.documentos FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT, DELETE ON public.documentos TO authenticated;
REVOKE ALL ON public.documentos FROM anon;

-- -----------------------------------------------------------------------------
-- 3) Storage bucket documentos_adjuntos (privado)
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos_adjuntos',
  'documentos_adjuntos',
  false,
  10485760, -- 10 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Lectura: usuarias autenticadas
DROP POLICY IF EXISTS "documentos_storage_select" ON storage.objects;
CREATE POLICY "documentos_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos_adjuntos');

-- Subida
DROP POLICY IF EXISTS "documentos_storage_insert" ON storage.objects;
CREATE POLICY "documentos_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos_adjuntos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Borrado
DROP POLICY IF EXISTS "documentos_storage_delete" ON storage.objects;
CREATE POLICY "documentos_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documentos_adjuntos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
