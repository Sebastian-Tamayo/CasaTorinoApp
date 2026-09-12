-- =============================================================================
-- Casa Torino — Políticas DELETE para gastos e ingresos
-- Migración 003: permitir eliminación a usuarias autenticadas
-- Ejecutar en: Supabase SQL Editor (tras confirmación)
-- =============================================================================

-- Gastos: política de borrado (idempotente)
DROP POLICY IF EXISTS "Permitir eliminacion a usuarios autenticados" ON public.gastos;
CREATE POLICY "Permitir eliminacion a usuarios autenticados"
  ON public.gastos
  FOR DELETE
  TO authenticated
  USING (true);

-- Ingresos: política de borrado (antes solo SELECT/INSERT)
DROP POLICY IF EXISTS "Permitir eliminacion a usuarios autenticados" ON public.ingresos;
CREATE POLICY "Permitir eliminacion a usuarios autenticados"
  ON public.ingresos
  FOR DELETE
  TO authenticated
  USING (true);

-- Permisos de tabla (ingresos no tenía DELETE)
GRANT DELETE ON public.ingresos TO authenticated;
GRANT DELETE ON public.gastos TO authenticated;
