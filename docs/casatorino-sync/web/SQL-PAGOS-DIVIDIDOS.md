-- Casa Torino — pagos divididos (referencia)
--
-- Hoy el TPV NO usa tablas relacionales de pedidos/pagos.
-- Las ventas viven en Supabase `public.ops_kv` clave `jornada`:
--   value.sales[] = {
--     id, at, mesa, total, tip, paymentMethod,
--     payments: [{ id, method: 'efectivo'|'tarjeta', amount }],
--     lines: [...]
--   }
--
-- Compatibilidad: ventas antiguas solo con `paymentMethod` se
-- interpretan como un único pago por el total.
--
-- Si en el futuro se normaliza a SQL, usar algo así:

create table if not exists public.tpv_sales (
  id text primary key,
  jornada_id text,
  mesa text,
  total numeric(12,2) not null check (total >= 0),
  tip numeric(12,2) not null default 0,
  payment_method text not null check (payment_method in ('efectivo','tarjeta','mixto')),
  created_at timestamptz not null default now()
);

create table if not exists public.tpv_sale_payments (
  id text primary key,
  sale_id text not null references public.tpv_sales(id) on delete cascade,
  method text not null check (method in ('efectivo','tarjeta')),
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists tpv_sale_payments_sale_id_idx
  on public.tpv_sale_payments (sale_id);
