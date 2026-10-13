-- Casa Torino — Plano interactivo de mesas (OVERLAY, no destructivo)
-- Ejecutar en: Supabase → SQL Editor → Run
--
-- REGLAS:
-- 1) NO borra ops_kv ni datos del TPV actual (mesas/carts/jornada/cierres/kitchen).
-- 2) El TPV actual sigue usando ops_kv clave `tpv` como fuente de carritos.
-- 3) Esta tabla solo SOLAPA: camarero asignado + estado visual + total espejo.
-- 4) id de mesa = mismo identificador que ya usa el TPV ("1"…"17").

-- ---------------------------------------------------------------------------
-- 1) Catálogo / estado visual de mesas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tables (
  id text PRIMARY KEY,                          -- "1".."17" (igual que TPV)
  name text NOT NULL,                          -- "Mesa 1"
  zone text NOT NULL,                          -- Entrada | Barra | Salon | Lateral
  shape text NOT NULL DEFAULT 'square',        -- square | rect | circle
  status text NOT NULL DEFAULT 'libre'
    CHECK (status IN ('libre', 'ocupada')),
  total_amount numeric(12, 2) NOT NULL DEFAULT 0,
  current_waiter_id text NULL,                 -- id/local del camarero
  current_waiter_name text NULL,               -- nombre visible en el plano
  sort_order int NOT NULL DEFAULT 0,
  layout jsonb NOT NULL DEFAULT '{}'::jsonb,   -- coords UI {col,row,...}
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tables_zone_idx ON public.tables (zone);
CREATE INDEX IF NOT EXISTS tables_status_idx ON public.tables (status);
CREATE INDEX IF NOT EXISTS tables_waiter_idx ON public.tables (current_waiter_id);

-- updated_at automático (solo si no existe ya un trigger genérico)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tables_set_updated_at ON public.tables;
CREATE TRIGGER tables_set_updated_at
  BEFORE UPDATE ON public.tables
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2) Pedidos / comandas actuales
--    En producción NO hay tabla SQL `pedidos`: viven en ops_kv (`tpv`, `kitchen`)
--    con campo `mesa`. Aquí solo añadimos un vínculo opcional si algún día
--    existiera una tabla de pedidos, SIN tocar filas actuales.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.pedidos') IS NOT NULL THEN
    ALTER TABLE public.pedidos
      ADD COLUMN IF NOT EXISTS table_id text
      REFERENCES public.tables(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS pedidos_table_id_idx ON public.pedidos (table_id);
  END IF;
  IF to_regclass('public.orders') IS NOT NULL THEN
    ALTER TABLE public.orders
      ADD COLUMN IF NOT EXISTS table_id text
      REFERENCES public.tables(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS orders_table_id_idx ON public.orders (table_id);
  END IF;
END $$;

-- Vista de solo lectura: cruza plano + carrito vivo del TPV (ops_kv.tpv)
CREATE OR REPLACE VIEW public.v_tables_live AS
SELECT
  t.id,
  t.name,
  t.zone,
  t.shape,
  t.status,
  t.total_amount,
  t.current_waiter_id,
  t.current_waiter_name,
  t.layout,
  t.updated_at,
  (kv.value -> 'tables' -> t.id) AS tpv_cart_blob
FROM public.tables t
LEFT JOIN public.ops_kv kv ON kv.key = 'tpv';

-- ---------------------------------------------------------------------------
-- 3) Seed 17 mesas del plano Casa Torino (idempotente: no pisa si ya existen)
-- ---------------------------------------------------------------------------
INSERT INTO public.tables (id, name, zone, shape, status, total_amount, sort_order, layout)
VALUES
  ('1',  'Mesa 1',  'Entrada', 'rect',   'libre', 0, 1,  '{"area":"entrada","row":3,"col":1}'::jsonb),
  ('2',  'Mesa 2',  'Entrada', 'rect',   'libre', 0, 2,  '{"area":"entrada","row":2,"col":1}'::jsonb),
  ('3',  'Mesa 3',  'Entrada', 'rect',   'libre', 0, 3,  '{"area":"entrada","row":1,"col":1}'::jsonb),
  ('4',  'Mesa 4',  'Barra',   'circle', 'libre', 0, 4,  '{"area":"barra","row":1,"col":1}'::jsonb),
  ('5',  'Mesa 5',  'Barra',   'circle', 'libre', 0, 5,  '{"area":"barra","row":1,"col":2}'::jsonb),
  ('6',  'Mesa 6',  'Salon',   'square', 'libre', 0, 6,  '{"area":"salon","row":3,"col":1}'::jsonb),
  ('7',  'Mesa 7',  'Salon',   'square', 'libre', 0, 7,  '{"area":"salon","row":3,"col":2}'::jsonb),
  ('8',  'Mesa 8',  'Salon',   'square', 'libre', 0, 8,  '{"area":"salon","row":3,"col":3}'::jsonb),
  ('9',  'Mesa 9',  'Salon',   'square', 'libre', 0, 9,  '{"area":"salon","row":2,"col":3}'::jsonb),
  ('10', 'Mesa 10', 'Salon',   'square', 'libre', 0, 10, '{"area":"salon","row":2,"col":2}'::jsonb),
  ('11', 'Mesa 11', 'Salon',   'square', 'libre', 0, 11, '{"area":"salon","row":2,"col":1}'::jsonb),
  ('12', 'Mesa 12', 'Salon',   'square', 'libre', 0, 12, '{"area":"salon","row":1,"col":1}'::jsonb),
  ('13', 'Mesa 13', 'Salon',   'square', 'libre', 0, 13, '{"area":"salon","row":1,"col":2}'::jsonb),
  ('14', 'Mesa 14', 'Salon',   'square', 'libre', 0, 14, '{"area":"salon","row":1,"col":3}'::jsonb),
  ('15', 'Mesa 15', 'Lateral', 'rect',   'libre', 0, 15, '{"area":"lateral","row":3,"col":1}'::jsonb),
  ('16', 'Mesa 16', 'Lateral', 'rect',   'libre', 0, 16, '{"area":"lateral","row":2,"col":1}'::jsonb),
  ('17', 'Mesa 17', 'Lateral', 'rect',   'libre', 0, 17, '{"area":"lateral","row":1,"col":1}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4) RLS: lectura/escritura con anon (mismo modelo que ops_kv del TPV)
--    El cliente móvil/Windows habla DIRECTO a Supabase (sin rutas Vercel).
-- ---------------------------------------------------------------------------
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tables_all ON public.tables;
CREATE POLICY tables_all ON public.tables
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tables TO anon, authenticated;
GRANT SELECT ON public.v_tables_live TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) Realtime (postgres_changes) — solo añade a la publication, no borra nada
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;

COMMENT ON TABLE public.tables IS
  'Plano interactivo Casa Torino. Overlay: no sustituye ops_kv.tpv (carritos del TPV).';
